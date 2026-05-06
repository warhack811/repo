import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
	buildProviderAuthoritySummary,
	loadEnvAuthorityFiles,
	resolveEnvAuthority,
} from './env-authority.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(scriptDirectory, '..');
const repoRoot = resolve(serverRoot, '..', '..');
const distRoot = resolve(serverRoot, 'dist');
const SUMMARY_TOKEN = 'TERMINAL_SESSION_LIVE_PROOF_SUMMARY';
const DEEPSEEK_API_KEY_ENV = 'DEEPSEEK_API_KEY';
const DEEPSEEK_FAST_MODEL_ENV = 'DEEPSEEK_FAST_MODEL';
const DEFAULT_FAST_MODEL = 'deepseek-v4-flash';
const SECRET_ENV_NAME = 'RUNA_TERMINAL_SESSION_LIVE_PROOF_SECRET';

function ensureDistFile(relativePath) {
	const absolutePath = resolve(distRoot, relativePath);

	if (!existsSync(absolutePath)) {
		throw new Error(`Expected compiled module at ${absolutePath}. Run the server build first.`);
	}

	return absolutePath;
}

async function loadRuntimeModules() {
	const [
		factoryModule,
		ingestToolResultModule,
		bindAvailableToolsModule,
		presentationModule,
		runToolStepModule,
		shellSessionModule,
		stopConditionsModule,
		transportModule,
		registryModule,
	] = await Promise.all([
		import(pathToFileURL(ensureDistFile('gateway/factory.js')).href),
		import(pathToFileURL(ensureDistFile('runtime/ingest-tool-result.js')).href),
		import(pathToFileURL(ensureDistFile('runtime/bind-available-tools.js')).href),
		import(pathToFileURL(ensureDistFile('ws/presentation.js')).href),
		import(pathToFileURL(ensureDistFile('runtime/run-tool-step.js')).href),
		import(pathToFileURL(ensureDistFile('tools/shell-session.js')).href),
		import(pathToFileURL(ensureDistFile('runtime/stop-conditions.js')).href),
		import(pathToFileURL(ensureDistFile('ws/transport.js')).href),
		import(pathToFileURL(ensureDistFile('tools/registry.js')).href),
	]);

	return {
		ShellSessionManager: shellSessionModule.ShellSessionManager,
		ToolRegistry: registryModule.ToolRegistry,
		bindAvailableTools: bindAvailableToolsModule.bindAvailableTools,
		createFinishedMessage: transportModule.createFinishedMessage,
		createModelGateway: factoryModule.createModelGateway,
		createShellSessionTools: shellSessionModule.createShellSessionTools,
		createAutomaticTurnPresentationBlocks: presentationModule.createAutomaticTurnPresentationBlocks,
		evaluateStopConditions: stopConditionsModule.evaluateStopConditions,
		ingestToolResult: ingestToolResultModule.ingestToolResult,
		runToolStep: runToolStepModule.runToolStep,
	};
}

function resolveApiKeySource(files) {
	const authority = resolveEnvAuthority({
		env: process.env,
		files,
		name: DEEPSEEK_API_KEY_ENV,
		required: true,
	});

	if (!authority.value) {
		return {
			authority,
		};
	}

	return {
		apiKey: authority.value,
		authority,
		envName: DEEPSEEK_API_KEY_ENV,
	};
}

function resolveModelSource(files) {
	const authority = resolveEnvAuthority({
		defaultValue: DEFAULT_FAST_MODEL,
		env: process.env,
		files,
		name: DEEPSEEK_FAST_MODEL_ENV,
	});

	return {
		authority,
		envName: authority.report.resolved_from === 'default' ? undefined : DEEPSEEK_FAST_MODEL_ENV,
		model: authority.value ?? DEFAULT_FAST_MODEL,
	};
}

function buildAuthoritySummary(input) {
	return buildProviderAuthoritySummary({
		apiKeyAuthority: input.apiKeySource.authority,
		authoritativeEnv: DEEPSEEK_API_KEY_ENV,
		modelAuthorities: {
			fast: {
				authoritative_env: DEEPSEEK_FAST_MODEL_ENV,
				default_model: DEFAULT_FAST_MODEL,
				resolved_from: input.modelSource.envName ?? 'default',
				source: input.modelSource.authority.report.source,
			},
		},
	});
}

function printSummary(summary) {
	process.stdout.write(`${SUMMARY_TOKEN} ${JSON.stringify(summary)}\n`);
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

function createBaseSummary(input) {
	return {
		...buildAuthoritySummary(input),
		api_key_env: input.apiKeySource.envName,
		final_message_type: null,
		failure_stage: null,
		model: input.modelSource.model,
		polling_guardrail_observed: false,
		presentation_feedback_seen: false,
		provider: 'deepseek',
		raw_secret_leak_detected: false,
		read_seen: false,
		result: 'FAIL',
		run_id: input.runId,
		run_status: null,
		runtime_feedback_seen: false,
		secret_values_exposed: false,
		start_seen: false,
		stop_seen: false,
		tool_event_metadata_seen: false,
		trace_id: input.traceId,
		working_directory: repoRoot,
	};
}

function createFailureSummary(input, failureStage, error, extras = {}) {
	return {
		...createBaseSummary(input),
		...extras,
		error: summarizeError(error),
		failure_stage: failureStage,
		result: 'FAIL',
	};
}

function createToolInput(toolName, callId, args) {
	return {
		arguments: args,
		call_id: callId,
		tool_name: toolName,
	};
}

function wait(ms) {
	return new Promise((resolveWait) => {
		setTimeout(resolveWait, ms);
	});
}

function createShellRegistry(modules) {
	const registry = new modules.ToolRegistry();
	const manager = new modules.ShellSessionManager();

	registry.registerMany(modules.createShellSessionTools(manager));

	return registry;
}

function successOutput(result) {
	if (result.status !== 'completed') {
		throw new Error(`Expected completed tool step, got ${result.status}.`);
	}

	if (result.tool_result.status !== 'success') {
		throw new Error(
			`Expected successful ${result.tool_name}, got ${result.tool_result.status}.`,
		);
	}

	return result.tool_result.output;
}

function findCompletedToolEventWithShellMetadata(result) {
	return result.events.find(
		(event) =>
			event.event_type === 'tool.call.completed' &&
			event.metadata?.shell_session?.kind === 'shell_session_lifecycle',
	);
}

function hasRuntimeFeedback(result) {
	return (
		result.status === 'completed' &&
		result.tool_result.status === 'success' &&
		typeof result.tool_result.output?.runtime_feedback === 'string' &&
		result.tool_result.output.runtime_feedback.trim().length > 0
	);
}

function hasPresentationFeedback(blocks) {
	return blocks.some(
		(block) =>
			block.type === 'tool_result' &&
			typeof block.payload?.summary === 'string' &&
			block.payload.summary.includes('Shell session'),
	);
}

function containsRawSecret(value, secret) {
	return JSON.stringify(value).includes(secret);
}

function inspectSecretSurfaces(surfaces, secret) {
	const rawSecretLeakDetected = surfaces.some((surface) => containsRawSecret(surface, secret));
	const secretValuesExposed = surfaces.some((surface) =>
		JSON.stringify(surface).includes('"secret_values_exposed":true'),
	);

	return {
		rawSecretLeakDetected,
		secretValuesExposed,
	};
}

function provePollingGuardrail(evaluateStopConditions) {
	const sessionId = 'session_polling_guardrail';
	const readSignature = {
		args_hash: 'same_read_args',
		tool_name: 'shell.session.read',
	};
	const config = {
		max_turns: 20,
		stop_conditions: {
			max_repeated_identical_calls: 3,
			stagnation_window_size: 6,
		},
	};
	const earlyPollingDecision = evaluateStopConditions({
		config,
		recent_tool_calls: [readSignature, readSignature, readSignature],
		tool_result: {
			call_id: 'call_read_guardrail',
			output: {
				session_id: sessionId,
				status: 'running',
			},
			status: 'success',
			tool_name: 'shell.session.read',
		},
		turn_count: 3,
	});
	const stagnantPollingDecision = evaluateStopConditions({
		config,
		recent_tool_calls: [
			readSignature,
			readSignature,
			readSignature,
			readSignature,
			readSignature,
			readSignature,
		],
		tool_result: {
			call_id: 'call_read_guardrail',
			output: {
				session_id: sessionId,
				status: 'running',
			},
			status: 'success',
			tool_name: 'shell.session.read',
		},
		turn_count: 6,
	});

	return {
		early_polling_decision: earlyPollingDecision,
		observed:
			earlyPollingDecision.decision === 'continue' &&
			stagnantPollingDecision.decision === 'terminal' &&
			stagnantPollingDecision.reason?.kind === 'stagnation',
		stagnant_polling_decision: stagnantPollingDecision,
	};
}

async function runDeepSeekSchemaProof(input) {
	const gateway = input.modules.createModelGateway({
		config: {
			apiKey: input.apiKey,
			defaultMaxOutputTokens: 128,
			defaultModel: input.model,
		},
		provider: 'deepseek',
	});
	const registry = createShellRegistry(input.modules);
	const bindingResult = input.modules.bindAvailableTools({
		registry,
		tool_names: ['shell.session.start'],
	});

	if (bindingResult.status !== 'completed') {
		throw new Error(`Shell session tool binding failed: ${bindingResult.failure.message}`);
	}

	const toolSchemaRequest = {
		available_tools: bindingResult.available_tools,
		max_output_tokens: 96,
		messages: [
			{
				content:
					'You are validating a tool schema. Prefer a shell.session.start tool call if the schema is accepted; otherwise reply with a terse confirmation.',
				role: 'system',
			},
			{
				content:
					'Validate that the bounded shell session start tool is available for long-running terminal work. Do not include secrets.',
				role: 'user',
			},
		],
		metadata: {
			model_router: {
				allow_provider_fallback: false,
			},
		},
		model: input.model,
		run_id: input.runId,
		trace_id: input.traceId,
	};
	let response;
	let toolSchemaFallback;

	try {
		response = await gateway.generate(toolSchemaRequest);
	} catch (error) {
		if (
			!(
				error instanceof Error &&
				error.message.includes('invalid tool call candidate')
			)
		) {
			throw error;
		}

		toolSchemaFallback = summarizeError(error);
		response = await gateway.generate({
			max_output_tokens: 64,
			messages: [
				{
					content:
						'You are a terse live validation assistant. Reply in one sentence.',
					role: 'system',
				},
				{
					content:
						'Confirm DeepSeek live ModelGateway access is working for the terminal session proof.',
					role: 'user',
				},
			],
			metadata: {
				model_router: {
					allow_provider_fallback: false,
				},
			},
			model: input.model,
			run_id: input.runId,
			trace_id: input.traceId,
		});
	}

	if (response.provider !== 'deepseek') {
		throw new Error(`DeepSeek schema proof routed unexpectedly to ${response.provider}.`);
	}

	return {
		finish_reason: response.finish_reason,
		model: response.model,
		outcome_kind: response.tool_call_candidate ? 'tool_call_candidate' : 'assistant_response',
		provider: response.provider,
		response_preview: response.message.content.slice(0, 120),
		tool_candidate_name: response.tool_call_candidate?.tool_name ?? null,
		tool_schema_available_count: bindingResult.available_tools.length,
		tool_schema_fallback: toolSchemaFallback ?? null,
	};
}

async function runShellSessionRuntimeProof(input) {
	const registry = createShellRegistry(input.modules);
	const previousSecret = process.env[SECRET_ENV_NAME];
	const secret = `runa_terminal_live_secret_${randomUUID().replaceAll('-', '')}`;
	let sessionId;

	process.env[SECRET_ENV_NAME] = secret;

	try {
		const executionContext = {
			run_id: input.runId,
			trace_id: input.traceId,
			working_directory: repoRoot,
		};
		const commandScript = [
			`process.stdout.write(${JSON.stringify(`terminal-proof-ready:${secret}`)});`,
			`process.stderr.write(${JSON.stringify(`terminal-proof-warn:${secret}`)});`,
			'setTimeout(() => {}, 5000);',
		].join(' ');
		const startResult = await input.modules.runToolStep({
			bypass_approval_gate: true,
			current_state: 'MODEL_THINKING',
			event_context: {
				sequence_start: 10,
				source: {
					kind: 'runtime',
				},
			},
			execution_context: executionContext,
			registry,
			run_id: input.runId,
			tool_input: createToolInput('shell.session.start', 'call_terminal_live_start', {
				args: ['-e', commandScript],
				command: process.execPath,
				idle_timeout_ms: 2000,
				max_runtime_ms: 7000,
				output_limit_bytes: 4096,
				working_directory: repoRoot,
			}),
			tool_name: 'shell.session.start',
			trace_id: input.traceId,
		});
		const startOutput = successOutput(startResult);
		sessionId = startOutput.session_id;

		await wait(150);

		const readResult = await input.modules.runToolStep({
			bypass_approval_gate: true,
			current_state: 'MODEL_THINKING',
			event_context: {
				sequence_start: 20,
				source: {
					kind: 'runtime',
				},
			},
			execution_context: executionContext,
			registry,
			run_id: input.runId,
			tool_input: createToolInput('shell.session.read', 'call_terminal_live_read', {
				max_bytes: 4096,
				session_id: sessionId,
				stream: 'both',
			}),
			tool_name: 'shell.session.read',
			trace_id: input.traceId,
		});
		const readOutput = successOutput(readResult);
		const stopResult = await input.modules.runToolStep({
			bypass_approval_gate: true,
			current_state: 'MODEL_THINKING',
			event_context: {
				sequence_start: 30,
				source: {
					kind: 'runtime',
				},
			},
			execution_context: executionContext,
			registry,
			run_id: input.runId,
			tool_input: createToolInput('shell.session.stop', 'call_terminal_live_stop', {
				force: true,
				session_id: sessionId,
			}),
			tool_name: 'shell.session.stop',
			trace_id: input.traceId,
		});
		const stopOutput = successOutput(stopResult);
		const ingestedResults = [startResult, readResult, stopResult].map((result) =>
			input.modules.ingestToolResult({
				call_id: result.tool_result.call_id,
				current_state: result.final_state,
				run_id: input.runId,
				tool_name: result.tool_name,
				tool_result: result.tool_result,
				trace_id: input.traceId,
			}),
		);
		const presentationBlocks = [startResult, readResult, stopResult].flatMap((result) =>
			input.modules.createAutomaticTurnPresentationBlocks({
				created_at: new Date().toISOString(),
				tool_result: result.tool_result,
				working_directory: repoRoot,
			}),
		);
		const finishedMessage = input.modules.createFinishedMessage(
			{
				run_id: input.runId,
				trace_id: input.traceId,
			},
			{
				final_state: 'COMPLETED',
				status: 'completed',
			},
		);
		const allEvents = [startResult, readResult, stopResult].flatMap((result) => result.events);
		const pollingGuardrail = provePollingGuardrail(input.modules.evaluateStopConditions);
		const secretInspection = inspectSecretSurfaces(
			[
				startResult,
				readResult,
				stopResult,
				ingestedResults,
				presentationBlocks,
				finishedMessage,
				allEvents,
			],
			secret,
		);

		return {
			final_message_type: finishedMessage?.type ?? null,
			ingested_results: ingestedResults.map((result) => result.status),
			polling_guardrail: pollingGuardrail,
			polling_guardrail_observed: pollingGuardrail.observed,
			presentation_blocks: presentationBlocks.map((block) => ({
				summary: block.payload?.summary,
				tool_name: block.payload?.tool_name,
				type: block.type,
			})),
			presentation_feedback_seen: hasPresentationFeedback(presentationBlocks),
			raw_secret_leak_detected: secretInspection.rawSecretLeakDetected,
			read_seen:
				readResult.status === 'completed' &&
				readResult.tool_result.status === 'success' &&
				readOutput.session_id === sessionId &&
				readOutput.stdout.includes('[REDACTED_SECRET]') &&
				readOutput.stderr.includes('[REDACTED_SECRET]'),
			run_status: finishedMessage?.payload.status ?? null,
			runtime_feedback_seen: [startResult, readResult, stopResult].every(hasRuntimeFeedback),
			secret_values_exposed: secretInspection.secretValuesExposed,
			session_id: sessionId,
			start_seen:
				startResult.status === 'completed' &&
				startResult.tool_result.status === 'success' &&
				startOutput.status === 'running',
			stop_seen:
				stopResult.status === 'completed' &&
				stopResult.tool_result.status === 'success' &&
				stopOutput.session_id === sessionId &&
				['killed', 'stopped'].includes(stopOutput.status),
			tool_event_metadata_seen: [startResult, readResult, stopResult].every(
				(result) => findCompletedToolEventWithShellMetadata(result) !== undefined,
			),
			tool_names: [startResult.tool_name, readResult.tool_name, stopResult.tool_name],
		};
	} finally {
		if (previousSecret === undefined) {
			delete process.env[SECRET_ENV_NAME];
		} else {
			process.env[SECRET_ENV_NAME] = previousSecret;
		}
	}
}

function proofPassed(runtimeProof) {
	return (
		runtimeProof.start_seen === true &&
		runtimeProof.read_seen === true &&
		runtimeProof.stop_seen === true &&
		runtimeProof.runtime_feedback_seen === true &&
		runtimeProof.presentation_feedback_seen === true &&
		runtimeProof.tool_event_metadata_seen === true &&
		runtimeProof.secret_values_exposed === false &&
		runtimeProof.raw_secret_leak_detected === false &&
		runtimeProof.polling_guardrail_observed === true &&
		runtimeProof.final_message_type === 'run.finished' &&
		runtimeProof.run_status === 'completed'
	);
}

async function main() {
	const envFiles = loadEnvAuthorityFiles(repoRoot);
	const apiKeySource = resolveApiKeySource(envFiles);
	const modelSource = resolveModelSource(envFiles);
	const ids = {
		runId: `terminal_session_live_proof_${Date.now()}_${randomUUID().slice(0, 8)}`,
		traceId: `trace_terminal_session_live_proof_${Date.now()}_${randomUUID().slice(0, 8)}`,
	};
	const baseInput = {
		apiKeySource,
		modelSource,
		...ids,
	};

	if (!apiKeySource.apiKey) {
		printSummary({
			...createBaseSummary(baseInput),
			blocker_kind: 'credential_missing',
			failure_stage: 'credential_preflight',
			result: 'BLOCKED',
		});
		process.exitCode = 2;
		return;
	}

	let modules;

	try {
		modules = await loadRuntimeModules();
	} catch (error) {
		printSummary(createFailureSummary(baseInput, 'module_load', error));
		process.exitCode = 1;
		return;
	}

	const liveInput = {
		...baseInput,
		apiKey: apiKeySource.apiKey,
		model: modelSource.model,
		modules,
	};
	let deepseekSchemaProof;

	try {
		deepseekSchemaProof = await runDeepSeekSchemaProof(liveInput);
	} catch (error) {
		printSummary(createFailureSummary(baseInput, 'deepseek_schema_proof', error));
		process.exitCode = 1;
		return;
	}

	let runtimeProof;

	try {
		runtimeProof = await runShellSessionRuntimeProof(liveInput);
	} catch (error) {
		printSummary(
			createFailureSummary(baseInput, 'shell_session_runtime_proof', error, {
				deepseek_schema_proof: deepseekSchemaProof,
			}),
		);
		process.exitCode = 1;
		return;
	}

	const result = proofPassed(runtimeProof) ? 'PASS' : 'FAIL';

	printSummary({
		...createBaseSummary(baseInput),
		deepseek_schema_proof: deepseekSchemaProof,
		final_message_type: runtimeProof.final_message_type,
		failure_stage: result === 'PASS' ? null : 'proof_assertions',
		polling_guardrail: runtimeProof.polling_guardrail,
		polling_guardrail_observed: runtimeProof.polling_guardrail_observed,
		presentation_blocks: runtimeProof.presentation_blocks,
		presentation_feedback_seen: runtimeProof.presentation_feedback_seen,
		raw_secret_leak_detected: runtimeProof.raw_secret_leak_detected,
		read_seen: runtimeProof.read_seen,
		result,
		run_status: runtimeProof.run_status,
		runtime_feedback_seen: runtimeProof.runtime_feedback_seen,
		secret_values_exposed: runtimeProof.secret_values_exposed,
		session_id: runtimeProof.session_id,
		start_seen: runtimeProof.start_seen,
		stop_seen: runtimeProof.stop_seen,
		tool_event_metadata_seen: runtimeProof.tool_event_metadata_seen,
		tool_names: runtimeProof.tool_names,
	});

	process.exitCode = result === 'PASS' ? 0 : 1;
}

await main();
process.exit(process.exitCode ?? 0);
