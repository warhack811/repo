import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createDatabaseConnection, ensureDatabaseSchema, resolveDatabaseConfig } from '@runa/db';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(scriptDirectory, '..');
const workspaceRoot = resolve(serverRoot, '..', '..');
const distRoot = resolve(serverRoot, 'dist');
const envFilePath = resolve(workspaceRoot, '.env');
const envLocalFilePath = resolve(workspaceRoot, '.env.local');
const READY_TOKEN = 'APPROVAL_SMOKE_SERVER_READY';
const SUMMARY_TOKEN = 'APPROVAL_PERSISTENCE_LIVE_SMOKE_SUMMARY';
const LOCAL_HOST = '127.0.0.1';
const WAIT_TIMEOUT_MS = 20_000;

function normalizeEnvValue(rawValue) {
	const trimmedValue = rawValue.trim();

	if (
		(trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
		(trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
	) {
		return trimmedValue.slice(1, -1);
	}

	return trimmedValue;
}

function loadEnvironmentFile(filePath, fileOwnedKeys) {
	if (!existsSync(filePath)) {
		return 0;
	}

	const envFileContents = readFileSync(filePath, 'utf8');
	const envLines = envFileContents.split(/\r?\n/u);
	let loadedKeys = 0;

	for (const envLine of envLines) {
		const trimmedLine = envLine.trim();

		if (trimmedLine.length === 0 || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
			continue;
		}

		const separatorIndex = trimmedLine.indexOf('=');

		if (separatorIndex <= 0) {
			continue;
		}

		const key = trimmedLine.slice(0, separatorIndex).trim();
		const rawValue = trimmedLine.slice(separatorIndex + 1);
		const keyAlreadyOwnedByFile = fileOwnedKeys.has(key);

		if (key.length === 0 || (process.env[key] !== undefined && !keyAlreadyOwnedByFile)) {
			continue;
		}

		process.env[key] = normalizeEnvValue(rawValue);
		fileOwnedKeys.add(key);
		loadedKeys += 1;
	}

	return loadedKeys;
}

function loadControllerEnvironment() {
	const fileOwnedKeys = new Set();
	loadEnvironmentFile(envFilePath, fileOwnedKeys);
	loadEnvironmentFile(envLocalFilePath, fileOwnedKeys);
	process.env.NODE_ENV ??= 'development';
	process.env.RUNA_DEV_AUTH_ENABLED ??= '1';
	process.env.RUNA_DEV_AUTH_SECRET ??= randomUUID();
	process.env.RUNA_DEV_AUTH_EMAIL ??= 'dev@runa.local';
}

function ensureDistFile(relativePath) {
	const absolutePath = resolve(distRoot, relativePath);

	if (!existsSync(absolutePath)) {
		throw new Error(`Expected compiled module at ${absolutePath}. Run the server build first.`);
	}

	return absolutePath;
}

async function loadCreateLocalDevSessionToken() {
	const authModule = await import(pathToFileURL(ensureDistFile('auth/supabase-auth.js')).href);
	return authModule.createLocalDevSessionToken;
}

function printSummary(summary) {
	process.stdout.write(`${SUMMARY_TOKEN} ${JSON.stringify(summary)}\n`);
}

function logStep(message) {
	process.stdout.write(`[approval-smoke] ${message}\n`);
}

function createScenarioChain(input) {
	return {
		approval_boundary_observed: input.approval_boundary_observed === true,
		approval_resolve_sent: input.approval_resolve_sent === true,
		continuation_observed: input.continuation_observed === true,
		continuation_signal_types: Array.isArray(input.continuation_signal_types)
			? Array.from(new Set(input.continuation_signal_types))
			: [],
		reconnect_restart_tolerated: input.reconnect_restart_tolerated === true,
		terminal_run_finished_completed: input.terminal_run_finished_completed === true,
	};
}

function createMessageRecorder(socket) {
	const messages = [];
	const closeState = {
		code: null,
		reason: null,
	};

	socket.addEventListener('message', (event) => {
		try {
			messages.push(JSON.parse(String(event.data)));
		} catch (error) {
			messages.push({
				parse_error: error instanceof Error ? error.message : String(error),
				raw: String(event.data),
				type: 'parse.error',
			});
		}
	});
	socket.addEventListener('close', (event) => {
		closeState.code = event.code;
		closeState.reason = event.reason;
	});

	return {
		closeState,
		messages,
	};
}

async function connectWebSocket(url) {
	return await new Promise((resolvePromise, rejectPromise) => {
		const socket = new WebSocket(url);

		socket.addEventListener('open', () => resolvePromise(socket), { once: true });
		socket.addEventListener(
			'error',
			() => rejectPromise(new Error(`WebSocket connection failed for ${url}.`)),
			{ once: true },
		);
	});
}

async function waitForCondition(description, predicate, timeoutMs = WAIT_TIMEOUT_MS) {
	const startedAt = Date.now();

	while (Date.now() - startedAt < timeoutMs) {
		const value = await predicate();

		if (value) {
			return value;
		}

		await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
	}

	throw new Error(`Timed out while waiting for ${description}.`);
}

async function closeSocket(socket) {
	if (socket.readyState === WebSocket.CLOSED) {
		return;
	}

	socket.close();

	await new Promise((resolvePromise) => {
		socket.addEventListener('close', () => resolvePromise(), { once: true });
	});
}

function createReadyPromise(child) {
	return new Promise((resolvePromise, rejectPromise) => {
		let stdoutBuffer = '';
		let stderrBuffer = '';
		let resolved = false;

		child.stdout.on('data', (chunk) => {
			const text = chunk.toString();
			stdoutBuffer += text;
			const lines = stdoutBuffer.split(/\r?\n/u);
			stdoutBuffer = lines.pop() ?? '';

			for (const line of lines) {
				if (!line.startsWith(`${READY_TOKEN} `)) {
					continue;
				}

				try {
					resolved = true;
					resolvePromise(JSON.parse(line.slice(READY_TOKEN.length + 1)));
				} catch (error) {
					rejectPromise(
						new Error(
							`Failed to parse server ready payload: ${
								error instanceof Error ? error.message : String(error)
							}`,
						),
					);
				}
			}
		});

		child.stderr.on('data', (chunk) => {
			stderrBuffer += chunk.toString();
		});

		child.once('exit', (code, signal) => {
			if (resolved) {
				return;
			}

			rejectPromise(
				new Error(
					`Smoke server exited before ready signal (code=${code ?? 'null'}, signal=${
						signal ?? 'null'
					}). stderr tail: ${stderrBuffer.slice(-1200)}`,
				),
			);
		});
	});
}

function spawnSmokeServer(phase, targetPath) {
	const child = spawn(process.execPath, ['scripts/approval-persistence-live-smoke-server.mjs'], {
		cwd: serverRoot,
		env: {
			...process.env,
			RUNA_APPROVAL_SMOKE_PHASE: phase,
			RUNA_APPROVAL_SMOKE_TARGET_PATH: targetPath ?? '',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	});

	return {
		child,
		ready: createReadyPromise(child),
	};
}

async function stopSmokeServer(child) {
	if (child.exitCode !== null) {
		return;
	}

	await new Promise((resolvePromise) => {
		const exitHandler = () => resolvePromise();
		child.once('exit', exitHandler);
		child.kill();
		setTimeout(() => {
			if (child.exitCode !== null) {
				return;
			}

			const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
				stdio: 'ignore',
			});

			killer.once('exit', () => {
				if (child.exitCode === null) {
					child.removeListener('exit', exitHandler);
					resolvePromise();
				}
			});
		}, 3_000).unref();
	});
}

async function queryApprovalRow(connection, approvalId) {
	const rows = await connection.client`
		SELECT approval_id, status, decision, continuation_context, tool_name, target_label
		FROM approvals
		WHERE approval_id = ${approvalId}
		LIMIT 1
	`;

	return rows[0] ?? null;
}

async function queryRunRow(connection, runId) {
	const rows = await connection.client`
		SELECT run_id, current_state, last_state_at
		FROM runs
		WHERE run_id = ${runId}
		LIMIT 1
	`;

	return rows[0] ?? null;
}

async function queryRunEventTypes(connection, runId) {
	const rows = await connection.client`
		SELECT event_type
		FROM runtime_events
		WHERE run_id = ${runId}
		ORDER BY sequence_no ASC
	`;

	return rows.map((row) => row.event_type);
}

async function cleanupRunArtifacts(connection, runId, approvalId) {
	await connection.client`DELETE FROM runtime_events WHERE run_id = ${runId}`;
	await connection.client`DELETE FROM tool_calls WHERE run_id = ${runId}`;
	await connection.client`DELETE FROM approvals WHERE run_id = ${runId}`;
	await connection.client`DELETE FROM runs WHERE run_id = ${runId}`;
}

async function cleanupPolicyState(connection, sessionId) {
	await connection.client`DELETE FROM policy_states WHERE session_id = ${sessionId}`;
}

async function runToolApprovalRestartScenario(input) {
	const runId = `approval_smoke_tool_${randomUUID()}`;
	const traceId = `trace_${runId}`;
	const targetPath = join(input.tempDirectory, 'tool-approval', 'approved.txt');
	let approvalId = null;
	await mkdir(dirname(targetPath), { recursive: true });
	logStep(`tool scenario: starting initial server for ${runId}`);
	const firstServer = spawnSmokeServer('tool-approval-initial', targetPath);
	const firstReady = await firstServer.ready;
	const firstSocket = await connectWebSocket(
		`ws://${LOCAL_HOST}:${firstReady.port}/ws?access_token=${input.accessToken}`,
	);
	const firstRecorder = createMessageRecorder(firstSocket);

	try {
		await waitForCondition('tool approval connection.ready', () =>
			firstRecorder.messages.find((message) => message.type === 'connection.ready'),
		);

		firstSocket.send(
			JSON.stringify({
				payload: {
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'smoke-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Write the file after approval.', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: runId,
					trace_id: traceId,
				},
				type: 'run.request',
			}),
		);

		const pendingApprovalBlock = await waitForCondition('tool approval block', () => {
			for (const message of firstRecorder.messages) {
				if (message.type !== 'presentation.blocks' || message.payload?.run_id !== runId) {
					continue;
				}

				const approvalBlock = message.payload.blocks?.find(
					(block) => block.type === 'approval_block',
				);

				if (approvalBlock) {
					return approvalBlock;
				}
			}

			return null;
		});

		const pendingApprovalRow = await waitForCondition(
			'persisted pending tool approval row',
			async () => {
				return await queryApprovalRow(input.connection, pendingApprovalBlock.payload.approval_id);
			},
		);
		approvalId = pendingApprovalBlock.payload.approval_id;
		logStep(`tool scenario: persisted pending approval ${approvalId}`);

		await closeSocket(firstSocket);
		await stopSmokeServer(firstServer.child);
		logStep(`tool scenario: initial server stopped for ${runId}`);

		const secondServer = spawnSmokeServer('tool-approval-resolve', null);
		const secondReady = await secondServer.ready;
		const secondSocket = await connectWebSocket(
			`ws://${LOCAL_HOST}:${secondReady.port}/ws?access_token=${input.accessToken}`,
		);
		const secondRecorder = createMessageRecorder(secondSocket);

		try {
			await waitForCondition('tool approval reconnect ready', () =>
				secondRecorder.messages.find((message) => message.type === 'connection.ready'),
			);

			secondSocket.send(
				JSON.stringify({
					payload: {
						approval_id: pendingApprovalBlock.payload.approval_id,
						decision: 'approved',
					},
					type: 'approval.resolve',
				}),
			);
			logStep(`tool scenario: approval.resolve sent for ${approvalId}`);

			const resolvedPresentationMessage = await waitForCondition(
				'tool approval replay presentation blocks',
				() =>
					secondRecorder.messages.find(
						(message) =>
							message.type === 'presentation.blocks' &&
							message.payload?.run_id === runId &&
							message.payload.blocks?.some((block) => block.type === 'tool_result'),
					),
			);
			const approvedContents = await readFile(targetPath, 'utf8');
			const resolvedApprovalRow = await waitForCondition('resolved tool approval row', async () => {
				const row = await queryApprovalRow(
					input.connection,
					pendingApprovalBlock.payload.approval_id,
				);
				return row?.status === 'approved' && row?.decision === 'approved' ? row : null;
			});

			return {
				chain: createScenarioChain({
					approval_boundary_observed: true,
					approval_resolve_sent: true,
					continuation_observed: true,
					continuation_signal_types: secondRecorder.messages
						.filter(
							(message) => message.payload?.run_id === runId || message.type === 'connection.ready',
						)
						.map((message) => message.type),
					reconnect_restart_tolerated: true,
					terminal_run_finished_completed: false,
				}),
				approval_id: pendingApprovalBlock.payload.approval_id,
				persisted_pending_status: pendingApprovalRow.status,
				reconnect_message_types: secondRecorder.messages
					.filter(
						(message) => message.payload?.run_id === runId || message.type === 'connection.ready',
					)
					.map((message) => message.type),
				replayed_tool_result_summary:
					resolvedPresentationMessage.payload.blocks.find((block) => block.type === 'tool_result')
						?.payload?.summary ?? null,
				resolved_decision: resolvedApprovalRow?.decision ?? null,
				resolved_status: resolvedApprovalRow?.status ?? null,
				result: 'PASS',
				run_id: runId,
				scenario_id: 'tool_approval_restart',
				trace_id: traceId,
				written_content: approvedContents,
			};
		} finally {
			await closeSocket(secondSocket);
			await stopSmokeServer(secondServer.child);
			logStep(`tool scenario: resolve server stopped for ${runId}`);
		}
	} finally {
		await cleanupRunArtifacts(input.connection, runId, approvalId);
		logStep(`tool scenario: cleanup complete for ${runId}`);
	}
}

async function runAutoContinueRestartScenario(input) {
	const runId = `approval_smoke_auto_${randomUUID()}`;
	const traceId = `trace_${runId}`;
	const targetPath = join(input.tempDirectory, 'auto-continue', 'source.ts');
	let approvalId = null;
	await mkdir(dirname(targetPath), { recursive: true });
	await writeFile(targetPath, 'export const value = 1;\n', 'utf8');
	logStep(`auto-continue scenario: starting initial server for ${runId}`);

	const firstServer = spawnSmokeServer('auto-continue-initial', targetPath);
	const firstReady = await firstServer.ready;
	const firstSocket = await connectWebSocket(
		`ws://${LOCAL_HOST}:${firstReady.port}/ws?access_token=${input.accessToken}`,
	);
	const firstRecorder = createMessageRecorder(firstSocket);

	try {
		await waitForCondition('auto-continue connection.ready', () =>
			firstRecorder.messages.find((message) => message.type === 'connection.ready'),
		);

		firstSocket.send(
			JSON.stringify({
				payload: {
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'smoke-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Show me the file.', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: runId,
					trace_id: traceId,
				},
				type: 'run.request',
			}),
		);

		const pendingApprovalBlock = await waitForCondition('auto-continue approval block', () => {
			for (const message of firstRecorder.messages) {
				if (message.type !== 'presentation.blocks' || message.payload?.run_id !== runId) {
					continue;
				}

				const approvalBlock = message.payload.blocks?.find(
					(block) => block.type === 'approval_block',
				);

				if (approvalBlock) {
					return approvalBlock;
				}
			}

			return null;
		});

		const pendingApprovalRow = await waitForCondition(
			'persisted pending auto-continue approval row',
			async () => {
				const row = await queryApprovalRow(
					input.connection,
					pendingApprovalBlock.payload.approval_id,
				);
				return row?.target_label === 'agent.auto_continue' ? row : null;
			},
		);
		approvalId = pendingApprovalBlock.payload.approval_id;
		logStep(`auto-continue scenario: persisted pending approval ${approvalId}`);

		await closeSocket(firstSocket);
		await stopSmokeServer(firstServer.child);
		logStep(`auto-continue scenario: initial server stopped for ${runId}`);

		const secondServer = spawnSmokeServer('auto-continue-resume', null);
		const secondReady = await secondServer.ready;
		const secondSocket = await connectWebSocket(
			`ws://${LOCAL_HOST}:${secondReady.port}/ws?access_token=${input.accessToken}`,
		);
		const secondRecorder = createMessageRecorder(secondSocket);

		try {
			await waitForCondition('auto-continue reconnect ready', () =>
				secondRecorder.messages.find((message) => message.type === 'connection.ready'),
			);

			secondSocket.send(
				JSON.stringify({
					payload: {
						approval_id: pendingApprovalBlock.payload.approval_id,
						decision: 'approved',
					},
					type: 'approval.resolve',
				}),
			);
			logStep(`auto-continue scenario: approval.resolve sent for ${approvalId}`);

			const runFinishedMessage = await waitForCondition('auto-continue run.finished', () =>
				secondRecorder.messages.find(
					(message) => message.type === 'run.finished' && message.payload?.run_id === runId,
				),
			);
			const resolvedApprovalRow = await waitForCondition(
				'resolved auto-continue approval row',
				async () => {
					const row = await queryApprovalRow(
						input.connection,
						pendingApprovalBlock.payload.approval_id,
					);
					return row?.status === 'approved' && row?.decision === 'approved' ? row : null;
				},
			);
			const runRow = await waitForCondition('persisted completed run row', async () => {
				const row = await queryRunRow(input.connection, runId);
				return row?.current_state === 'COMPLETED' ? row : null;
			});
			const runtimeEventTypes = await queryRunEventTypes(input.connection, runId);

			return {
				chain: createScenarioChain({
					approval_boundary_observed: true,
					approval_resolve_sent: true,
					continuation_observed: true,
					continuation_signal_types: secondRecorder.messages
						.filter(
							(message) => message.payload?.run_id === runId || message.type === 'connection.ready',
						)
						.map((message) => message.type),
					reconnect_restart_tolerated: true,
					terminal_run_finished_completed: runFinishedMessage.payload.final_state === 'COMPLETED',
				}),
				approval_id: pendingApprovalBlock.payload.approval_id,
				final_state: runFinishedMessage.payload.final_state,
				message_types: secondRecorder.messages
					.filter(
						(message) => message.payload?.run_id === runId || message.type === 'connection.ready',
					)
					.map((message) => message.type),
				persisted_provider_config_keys: Object.keys(
					pendingApprovalRow?.continuation_context?.payload?.provider_config ?? {},
				).sort(),
				persisted_provider_api_key_redacted:
					pendingApprovalRow?.continuation_context?.payload?.provider_config?.apiKey === '',
				persisted_continuation_context: Boolean(pendingApprovalRow?.continuation_context),
				persisted_run_state: runRow?.current_state ?? null,
				resolved_decision: resolvedApprovalRow?.decision ?? null,
				resolved_status: resolvedApprovalRow?.status ?? null,
				result: 'PASS',
				run_id: runId,
				runtime_event_types: runtimeEventTypes,
				scenario_id: 'auto_continue_restart',
				trace_id: traceId,
			};
		} finally {
			await closeSocket(secondSocket);
			await stopSmokeServer(secondServer.child);
			logStep(`auto-continue scenario: resume server stopped for ${runId}`);
		}
	} finally {
		await cleanupRunArtifacts(input.connection, runId, approvalId);
		logStep(`auto-continue scenario: cleanup complete for ${runId}`);
	}
}

async function main() {
	loadControllerEnvironment();

	let databaseConfig;

	try {
		databaseConfig = resolveDatabaseConfig(process.env);
	} catch (error) {
		printSummary({
			error:
				error instanceof Error
					? {
							message: error.message,
							name: error.name,
						}
					: {
							message: String(error),
							name: 'UnknownError',
						},
			result: 'BLOCKED',
			reason: 'database_config_missing',
		});
		process.exitCode = 2;
		return;
	}

	const createLocalDevSessionToken = await loadCreateLocalDevSessionToken();
	const connection = createDatabaseConnection(databaseConfig);
	const tempDirectory = mkdtempSync(join(os.tmpdir(), 'runa-approval-smoke-'));
	let smokeSessionId;

	try {
		await ensureDatabaseSchema(connection);
		logStep('database schema ready');
		smokeSessionId = `approval_smoke_session_${randomUUID()}`;
		const smokeUserId = `approval_smoke_user_${randomUUID()}`;

		const accessToken = createLocalDevSessionToken({
			email: process.env.RUNA_DEV_AUTH_EMAIL,
			secret: process.env.RUNA_DEV_AUTH_SECRET,
			session_id: smokeSessionId,
			user_id: smokeUserId,
		}).access_token;
		logStep('local dev token created');

		const toolApproval = await runToolApprovalRestartScenario({
			accessToken,
			connection,
			tempDirectory,
		});
		const autoContinue = await runAutoContinueRestartScenario({
			accessToken,
			connection,
			tempDirectory,
		});

		printSummary({
			database_target: databaseConfig.target,
			database_url_source: databaseConfig.database_url_source,
			database_target_supported: true,
			local_dev_auth: 'enabled',
			result: 'PASS',
			scenarios: [toolApproval, autoContinue],
		});
	} catch (error) {
		printSummary({
			database_target: databaseConfig.target,
			database_url_source: databaseConfig.database_url_source,
			error:
				error instanceof Error
					? {
							message: error.message,
							name: error.name,
						}
					: {
							message: String(error),
							name: 'UnknownError',
						},
			result: 'FAIL',
		});
		process.exitCode = 1;
	} finally {
		if (typeof smokeSessionId === 'string') {
			await cleanupPolicyState(connection, smokeSessionId);
		}
		await connection.client.end({ timeout: 5 });
		rmSync(tempDirectory, { force: true, recursive: true });
	}
}

await main();
