import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverRoot, '..', '..');
const distRoot = path.resolve(serverRoot, 'dist');

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const GROQ_API_KEY_ENV = 'GROQ_API_KEY';
const GROQ_MODEL_ENV = 'GROQ_MODEL';
const LEGACY_NON_AUTHORITATIVE_GROQ_ENVS = [
	'GROQ_API_KEY_BACKUP',
	'GROQ_API_KEY_3',
	'GROQ_API_KEY_4',
];
const smokePersistenceWriter = {
	async upsertRun() {},
	async upsertToolCall() {},
};

function readEnv(name) {
	const value = process.env[name];

	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function resolveApiKeySource() {
	const groqApiKey = readEnv(GROQ_API_KEY_ENV);

	if (groqApiKey) {
		return {
			apiKey: groqApiKey,
			envName: GROQ_API_KEY_ENV,
		};
	}

	return undefined;
}

function resolveModelSource() {
	const groqModel = readEnv(GROQ_MODEL_ENV);

	if (groqModel) {
		return {
			envName: GROQ_MODEL_ENV,
			model: groqModel,
		};
	}

	return {
		envName: undefined,
		model: DEFAULT_MODEL,
	};
}

function buildAuthoritySummary(input) {
	return {
		api_key_authority: {
			alias_env: null,
			authoritative_env: GROQ_API_KEY_ENV,
			legacy_non_authoritative_envs: LEGACY_NON_AUTHORITATIVE_GROQ_ENVS,
			resolved_from: input.apiKeySource?.envName,
		},
		env_example_authoritative: false,
		model_authority: {
			alias_env: null,
			authoritative_env: GROQ_MODEL_ENV,
			default_model: DEFAULT_MODEL,
			resolved_from: input.modelSource.envName ?? 'default',
		},
	};
}

function toErrorSummary(error) {
	if (error instanceof Error) {
		return {
			message: error.message,
			name: error.name,
		};
	}

	return {
		message: 'Unknown smoke failure.',
		name: 'UnknownError',
	};
}

function buildStageRequest(input) {
	return {
		max_output_tokens: input.maxOutputTokens,
		messages: [
			{
				content: input.systemPrompt,
				role: 'system',
			},
			{
				content: input.userPrompt,
				role: 'user',
			},
		],
		model: input.model,
		run_id: input.runId,
		trace_id: input.traceId,
	};
}

function buildIds(stageName) {
	const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

	return {
		runId: `groq_live_smoke_${stageName}_${stamp}`,
		traceId: `trace_groq_live_smoke_${stageName}_${stamp}`,
	};
}

function ensureDistFile(relativePath) {
	const absolutePath = path.resolve(distRoot, relativePath);

	if (!fs.existsSync(absolutePath)) {
		throw new Error(`Expected compiled module at ${absolutePath}. Run the server build first.`);
	}

	return absolutePath;
}

async function loadRuntimeModules() {
	const [
		factoryModule,
		liveRequestModule,
		runModelTurnModule,
		runtimeDependenciesModule,
		bindAvailableToolsModule,
		registryModule,
		fileListModule,
	] = await Promise.all([
		import(pathToFileURL(ensureDistFile('gateway/factory.js')).href),
		import(pathToFileURL(ensureDistFile('ws/live-request.js')).href),
		import(pathToFileURL(ensureDistFile('runtime/run-model-turn.js')).href),
		import(pathToFileURL(ensureDistFile('ws/runtime-dependencies.js')).href),
		import(pathToFileURL(ensureDistFile('runtime/bind-available-tools.js')).href),
		import(pathToFileURL(ensureDistFile('tools/registry.js')).href),
		import(pathToFileURL(ensureDistFile('tools/file-list.js')).href),
	]);

	return {
		ToolRegistry: registryModule.ToolRegistry,
		bindAvailableTools: bindAvailableToolsModule.bindAvailableTools,
		buildLiveModelRequest: liveRequestModule.buildLiveModelRequest,
		createModelGateway: factoryModule.createModelGateway,
		fileListTool: fileListModule.fileListTool,
		getDefaultToolRegistry: runtimeDependenciesModule.getDefaultToolRegistry,
		runModelTurn: runModelTurnModule.runModelTurn,
	};
}

async function runAssistantRoundtrip(input) {
	const { ToolRegistry, createModelGateway, runModelTurn } = input.modules;
	const registry = new ToolRegistry();
	const ids = buildIds('assistant_roundtrip');
	const gateway = createModelGateway({
		config: {
			apiKey: input.apiKey,
			defaultMaxOutputTokens: 128,
			defaultModel: input.model,
		},
		provider: 'groq',
	});
	const result = await runModelTurn({
		current_state: 'MODEL_THINKING',
		execution_context: {
			run_id: ids.runId,
			trace_id: ids.traceId,
			working_directory: repoRoot,
		},
		model_gateway: gateway,
		model_request: buildStageRequest({
			maxOutputTokens: 128,
			model: input.model,
			runId: ids.runId,
			systemPrompt:
				'You are a terse smoke-validation assistant. Reply with a short plain-text answer.',
			traceId: ids.traceId,
			userPrompt: 'Reply with a short confirmation that this Groq live smoke roundtrip succeeded.',
		}),
		persistence_writer: smokePersistenceWriter,
		registry,
		run_id: ids.runId,
		trace_id: ids.traceId,
	});

	if (result.status !== 'completed' || result.model_turn_outcome.kind !== 'assistant_response') {
		throw new Error(
			`Assistant roundtrip did not finish as a completed assistant response. status=${result.status} final_state=${result.final_state}`,
		);
	}

	return {
		final_state: result.final_state,
		model: result.model_response.model,
		outcome_kind: result.model_turn_outcome.kind,
		provider: result.model_response.provider,
		response_preview: result.assistant_text.slice(0, 120),
		stage: 'assistant_roundtrip',
		status: 'PASS',
	};
}

async function runToolSchemaRoundtrip(input) {
	const { ToolRegistry, createModelGateway, fileListTool, runModelTurn } = input.modules;
	const registry = new ToolRegistry();
	registry.register(fileListTool);

	const ids = buildIds('tool_schema_roundtrip');
	const gateway = createModelGateway({
		config: {
			apiKey: input.apiKey,
			defaultMaxOutputTokens: 128,
			defaultModel: input.model,
		},
		provider: 'groq',
	});
	const result = await runModelTurn({
		current_state: 'MODEL_THINKING',
		execution_context: {
			run_id: ids.runId,
			trace_id: ids.traceId,
			working_directory: repoRoot,
		},
		model_gateway: gateway,
		model_request: buildStageRequest({
			maxOutputTokens: 128,
			model: input.model,
			runId: ids.runId,
			systemPrompt:
				'You are a terse smoke-validation assistant. Prefer a short plain-text answer unless a tool is strictly necessary.',
			traceId: ids.traceId,
			userPrompt:
				'Reply with a short confirmation that request-side tool schema reached Groq. Do not call any tool unless strictly necessary; if you must, only call file.list with path ".".',
		}),
		persistence_writer: smokePersistenceWriter,
		registry,
		run_id: ids.runId,
		trace_id: ids.traceId,
	});

	if (result.status === 'failed') {
		throw new Error(
			`Tool-schema roundtrip failed. final_state=${result.final_state} message=${result.failure.message}`,
		);
	}

	const availableToolCount = result.resolved_model_request.available_tools?.length ?? 0;

	if (availableToolCount < 1) {
		throw new Error(
			'Tool-schema roundtrip did not carry any available_tools into the resolved model request.',
		);
	}

	return {
		available_tool_count: availableToolCount,
		final_state: result.final_state,
		model: result.model_response.model,
		outcome_kind: result.model_turn_outcome.kind,
		provider: result.model_response.provider,
		stage: 'tool_schema_roundtrip',
		status: 'PASS',
	};
}

async function runBrowserShapeRoundtrip(input) {
	const { bindAvailableTools, buildLiveModelRequest, createModelGateway, getDefaultToolRegistry } =
		input.modules;
	const ids = buildIds('browser_shape_roundtrip');
	const livePayload = {
		include_presentation_blocks: true,
		provider: 'groq',
		provider_config: {
			apiKey: input.apiKey,
		},
		request: {
			max_output_tokens: 256,
			messages: [
				{
					content:
						'Read README.md if needed, then answer briefly whether the browser-shape Groq smoke request was accepted.',
					role: 'user',
				},
			],
			model: input.model,
		},
		run_id: ids.runId,
		trace_id: ids.traceId,
	};
	const registry = getDefaultToolRegistry();
	const bindingResult = bindAvailableTools({
		registry,
	});

	if (bindingResult.status !== 'completed') {
		throw new Error(
			`Browser-shape callable tools binding failed: ${bindingResult.failure.message}`,
		);
	}

	const modelRequest = await buildLiveModelRequest(livePayload, repoRoot);
	const gateway = createModelGateway({
		config: {
			apiKey: input.apiKey,
			defaultMaxOutputTokens: 256,
			defaultModel: input.model,
		},
		provider: 'groq',
	});
	const response = await gateway.generate({
		...modelRequest,
		available_tools: bindingResult.available_tools,
	});

	return {
		compiled_context_present: modelRequest.compiled_context !== undefined,
		message_count: modelRequest.messages.length,
		model: response.model,
		outcome_kind: response.tool_call_candidate ? 'tool_call_candidate' : 'assistant_response',
		provider: response.provider,
		stage: 'browser_shape_roundtrip',
		status: 'PASS',
		tool_count: bindingResult.available_tools.length,
	};
}

function printSummary(summary) {
	process.stdout.write(`GROQ_LIVE_SMOKE_SUMMARY ${JSON.stringify(summary)}\n`);
}

async function main() {
	const apiKeySource = resolveApiKeySource();
	const modelSource = resolveModelSource();
	const model = modelSource.model;

	if (!apiKeySource) {
		printSummary({
			...buildAuthoritySummary({
				apiKeySource,
				modelSource,
			}),
			blocker_kind: 'credential_missing',
			database_url_present: readEnv('DATABASE_URL') !== undefined,
			model,
			provider: 'groq',
			result: 'BLOCKED',
			stage_results: [],
			working_directory: repoRoot,
		});
		process.exitCode = 2;
		return;
	}

	const modules = await loadRuntimeModules();
	const stageResults = [];

	try {
		stageResults.push(
			await runAssistantRoundtrip({
				apiKey: apiKeySource.apiKey,
				model,
				modules,
			}),
		);
		stageResults.push(
			await runToolSchemaRoundtrip({
				apiKey: apiKeySource.apiKey,
				model,
				modules,
			}),
		);
		stageResults.push(
			await runBrowserShapeRoundtrip({
				apiKey: apiKeySource.apiKey,
				model,
				modules,
			}),
		);
	} catch (error) {
		printSummary({
			...buildAuthoritySummary({
				apiKeySource,
				modelSource,
			}),
			api_key_env: apiKeySource.envName,
			database_url_present: readEnv('DATABASE_URL') !== undefined,
			error: toErrorSummary(error),
			model,
			provider: 'groq',
			result: 'FAIL',
			stage_results: stageResults,
			working_directory: repoRoot,
		});
		process.exitCode = 1;
		return;
	}

	printSummary({
		...buildAuthoritySummary({
			apiKeySource,
			modelSource,
		}),
		api_key_env: apiKeySource.envName,
		database_url_present: readEnv('DATABASE_URL') !== undefined,
		model,
		provider: 'groq',
		result: 'PASS',
		stage_results: stageResults,
		working_directory: repoRoot,
	});
}

await main();
