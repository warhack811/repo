import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
	DatabaseConfigError,
	createDatabaseConnection,
	createDatabaseCrudSmokePlan,
	ensureDatabaseSchema,
	resolveDatabaseConfig,
	runDatabaseCrudSmokePlan,
} from '@runa/db';

import { classifyChainFailure, runSummaryScript } from './approval-release-rehearsal-lib.mjs';
import {
	applyFileBackedEnvironment,
	loadEnvAuthorityFiles,
	resolveEnvAuthority,
} from './env-authority.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(scriptDirectory, '..');
const workspaceRoot = resolve(serverRoot, '..', '..');
const distRoot = resolve(serverRoot, 'dist');
const SUMMARY_TOKEN = 'PERSISTENCE_RELEASE_PROOF_SUMMARY';

function loadControllerEnvironment() {
	const files = loadEnvAuthorityFiles(workspaceRoot);
	const shellEnv = { ...process.env };
	const loaded = applyFileBackedEnvironment(process.env, files);
	Object.assign(process.env, loaded.env);
	process.env.NODE_ENV ??= 'development';
	process.env.RUNA_DEV_AUTH_ENABLED ??= '1';
	process.env.RUNA_DEV_AUTH_SECRET ??= randomUUID();
	process.env.RUNA_DEV_AUTH_EMAIL ??= 'dev@runa.local';

	return {
		...loaded.summary,
		database_url_authority: resolveEnvAuthority({
			env: shellEnv,
			files,
			name: 'DATABASE_URL',
			required: true,
		}).report,
		deepseek_api_key_authority: resolveEnvAuthority({
			env: shellEnv,
			files,
			name: 'DEEPSEEK_API_KEY',
		}).report,
		groq_api_key_authority: resolveEnvAuthority({
			env: shellEnv,
			files,
			name: 'GROQ_API_KEY',
		}).report,
	};
}

function ensureDistFile(relativePath) {
	const absolutePath = resolve(distRoot, relativePath);

	if (!existsSync(absolutePath)) {
		throw new Error(`Expected compiled module at ${absolutePath}. Run the server build first.`);
	}

	return absolutePath;
}

function printSummary(summary) {
	process.stdout.write(`${SUMMARY_TOKEN} ${JSON.stringify(summary)}\n`);
}

function logStep(message) {
	process.stdout.write(`[persistence-release-proof] ${message}\n`);
}

function summarizeError(error) {
	if (error instanceof Error) {
		return {
			message: error.message,
			name: error.name,
		};
	}

	return {
		message: String(error),
		name: 'UnknownError',
	};
}

function summarizeDatabaseConfig(config) {
	let databaseUrlHost = 'unavailable';

	try {
		databaseUrlHost = new URL(config.database_url).host;
	} catch {
		databaseUrlHost = 'invalid-url';
	}

	return {
		database_url_host: databaseUrlHost,
		database_url_source: config.database_url_source,
		target: config.target,
		target_source: config.target_source,
	};
}

function summarizeConfigError(error) {
	if (error instanceof DatabaseConfigError) {
		return {
			error: summarizeError(error),
			missing_keys: error.missing_keys,
			reason: 'database_config_missing',
			result: 'BLOCKED',
			target: error.target ?? null,
		};
	}

	return {
		error: summarizeError(error),
		reason: 'database_config_failed',
		result: 'FAIL',
	};
}

function classifyApprovalPersistenceSummary(summary) {
	if (summary?.result === 'BLOCKED') {
		return summary.reason ?? 'approval_persistence_blocked';
	}

	if (!Array.isArray(summary?.scenarios)) {
		return 'approval_persistence_summary_missing';
	}

	const autoContinueScenario = summary.scenarios.find(
		(scenario) => scenario?.scenario_id === 'auto_continue_restart',
	);
	const chainFailure = classifyChainFailure(autoContinueScenario?.chain ?? null);

	if (chainFailure !== null) {
		return chainFailure;
	}

	return summary.result === 'PASS' ? null : 'approval_persistence_failed';
}

async function loadCreateLocalDevSessionToken() {
	const authModule = await import(pathToFileURL(ensureDistFile('auth/supabase-auth.js')).href);
	return authModule.createLocalDevSessionToken;
}

async function loadBuildServer() {
	const appModule = await import(pathToFileURL(ensureDistFile('app.js')).href);
	return appModule.buildServer;
}

async function loadConversationStore() {
	return await import(pathToFileURL(ensureDistFile('persistence/conversation-store.js')).href);
}

function createSmokeAuthInput() {
	return {
		email: 'persistence-proof@runa.local',
		secret: process.env.RUNA_DEV_AUTH_SECRET,
		session_id: `persistence_proof_session_${randomUUID()}`,
		user_id: `persistence_proof_user_${randomUUID()}`,
	};
}

async function cleanupConversationArtifacts(connection, conversationId) {
	await connection.client`DELETE FROM conversation_messages WHERE conversation_id = ${conversationId}`;
	await connection.client`DELETE FROM conversation_members WHERE conversation_id = ${conversationId}`;
	await connection.client`DELETE FROM conversations WHERE conversation_id = ${conversationId}`;
}

async function runConversationFirstRunProof(config) {
	const createLocalDevSessionToken = await loadCreateLocalDevSessionToken();
	const buildServer = await loadBuildServer();
	const conversationStore = await loadConversationStore();
	const authInput = createSmokeAuthInput();
	const token = createLocalDevSessionToken(authInput).access_token;
	const server = await buildServer({
		logger: false,
	});
	const conversationId = `conversation_persistence_proof_${randomUUID()}`;
	const connection = createDatabaseConnection(config);
	const scope = {
		session_id: authInput.session_id,
		tenant_id: 'tenant_persistence_proof',
		user_id: authInput.user_id,
		workspace_id: 'workspace_persistence_proof',
	};

	try {
		await ensureDatabaseSchema(connection);

		const emptyListResponse = await server.inject({
			headers: {
				authorization: `Bearer ${token}`,
			},
			method: 'GET',
			url: '/conversations',
		});

		if (emptyListResponse.statusCode !== 200) {
			throw new Error(
				`Expected first-run /conversations 200, got ${emptyListResponse.statusCode}.`,
			);
		}

		const emptyListBody = JSON.parse(emptyListResponse.body);

		if (!Array.isArray(emptyListBody.conversations)) {
			throw new Error('Expected /conversations body to contain a conversations array.');
		}

		await conversationStore.ensureConversation({
			conversation_id: conversationId,
			created_at: '2026-04-29T00:00:00.000Z',
			initial_preview: 'Persistence release proof conversation',
			scope,
		});
		await conversationStore.appendConversationMessage({
			content: 'Prove persisted conversation message.',
			conversation_id: conversationId,
			created_at: '2026-04-29T00:01:00.000Z',
			role: 'user',
			run_id: 'run_persistence_release_proof',
			scope,
			trace_id: 'trace_persistence_release_proof',
		});

		const persistedConversations = await conversationStore.listConversations(scope);
		const persistedMessages = await conversationStore.listConversationMessages(
			conversationId,
			scope,
		);

		if (
			!persistedConversations.some(
				(conversation) => conversation.conversation_id === conversationId,
			)
		) {
			throw new Error('Expected persisted proof conversation to be listed for its owner.');
		}

		if (persistedMessages.length !== 1) {
			throw new Error(`Expected one persisted proof message, got ${persistedMessages.length}.`);
		}

		return {
			conversation_id: conversationId,
			empty_first_run_status: emptyListResponse.statusCode,
			persisted_conversation_visible: true,
			persisted_message_count: persistedMessages.length,
			result: 'PASS',
		};
	} finally {
		await cleanupConversationArtifacts(connection, conversationId);
		await connection.client.end({ timeout: 5 });
		await server.close();
	}
}

async function runDatabaseCrudProof() {
	const plan = createDatabaseCrudSmokePlan(process.env, {
		seed: `persistence_release_${randomUUID().replaceAll('-', '_')}`,
	});
	const result = await runDatabaseCrudSmokePlan(plan);

	return {
		...result,
		result: 'PASS',
	};
}

async function runLocalMemoryRlsProof() {
	const proofRun = await runSummaryScript({
		cwd: resolve(workspaceRoot, 'packages', 'db'),
		env: process.env,
		scriptPath: 'scripts/local-memory-rls-proof.mjs',
		summaryToken: 'LOCAL_MEMORY_RLS_PROOF',
	});

	if (proofRun.summary === null) {
		return {
			exit_code: proofRun.exit.code,
			result: 'FAIL',
			reason: 'local_memory_rls_summary_missing',
			signal: proofRun.exit.signal,
		};
	}

	return proofRun.summary;
}

async function runApprovalPersistenceProof() {
	const proofRun = await runSummaryScript({
		cwd: serverRoot,
		env: process.env,
		scriptPath: 'scripts/approval-persistence-live-smoke.mjs',
		summaryToken: 'APPROVAL_PERSISTENCE_LIVE_SMOKE_SUMMARY',
	});

	if (proofRun.summary === null) {
		return {
			exit_code: proofRun.exit.code,
			result: 'FAIL',
			reason: 'approval_persistence_summary_missing',
			signal: proofRun.exit.signal,
		};
	}

	return proofRun.summary;
}

function stepPassed(step) {
	return step?.result === 'PASS';
}

function firstFailureReason(steps) {
	if (steps.database_crud?.result !== 'PASS') {
		return steps.database_crud?.reason ?? 'database_crud_failed';
	}

	if (steps.conversation_first_run?.result !== 'PASS') {
		return steps.conversation_first_run?.reason ?? 'conversation_first_run_failed';
	}

	if (steps.memory_rls?.result !== 'PASS') {
		return steps.memory_rls?.reason ?? 'memory_rls_failed';
	}

	const approvalFailure = classifyApprovalPersistenceSummary(steps.approval_persistence);

	if (approvalFailure !== null) {
		return approvalFailure;
	}

	return null;
}

async function main() {
	const envSummary = loadControllerEnvironment();
	let config;

	try {
		config = resolveDatabaseConfig(process.env);
	} catch (error) {
		printSummary({
			environment: envSummary,
			...summarizeConfigError(error),
			server_scope: '@runa/server',
		});
		process.exitCode = error instanceof DatabaseConfigError ? 2 : 1;
		return;
	}

	const database = summarizeDatabaseConfig(config);
	const steps = {};

	try {
		logStep('running database CRUD smoke');
		steps.database_crud = await runDatabaseCrudProof();
		logStep('running first-run conversation proof');
		steps.conversation_first_run = await runConversationFirstRunProof(config);
		logStep('running local memory RLS proof');
		steps.memory_rls = await runLocalMemoryRlsProof();
		logStep('running approval persistence/reconnect proof');
		steps.approval_persistence = await runApprovalPersistenceProof();
	} catch (error) {
		printSummary({
			database,
			environment: envSummary,
			error: summarizeError(error),
			result: 'FAIL',
			server_scope: '@runa/server',
			steps,
		});
		process.exitCode = 1;
		return;
	}

	const failureReason = firstFailureReason(steps);
	const result =
		stepPassed(steps.database_crud) &&
		stepPassed(steps.conversation_first_run) &&
		stepPassed(steps.memory_rls) &&
		steps.approval_persistence?.result === 'PASS' &&
		failureReason === null
			? 'PASS'
			: steps.approval_persistence?.result === 'BLOCKED'
				? 'BLOCKED'
				: 'FAIL';

	printSummary({
		database,
		environment: envSummary,
		failure_stage: failureReason,
		result,
		server_scope: '@runa/server',
		steps,
	});

	if (result === 'BLOCKED') {
		process.exitCode = 2;
		return;
	}

	process.exitCode = result === 'PASS' ? 0 : 1;
}

await main();
process.exit(process.exitCode ?? 0);
