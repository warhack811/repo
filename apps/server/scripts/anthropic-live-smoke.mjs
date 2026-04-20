import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverRoot, '..', '..');
const distRoot = path.resolve(serverRoot, 'dist');

const DEFAULT_MODEL = 'claude-sonnet-4-5';
const ANTHROPIC_API_KEY_ENV = 'ANTHROPIC_API_KEY';
const CLAUDE_API_KEY_ENV = 'CLAUDE_API_KEY';
const ANTHROPIC_MODEL_ENV = 'ANTHROPIC_MODEL';
const CLAUDE_MODEL_ENV = 'CLAUDE_MODEL';

function readEnv(name) {
	const value = process.env[name];

	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function resolveApiKeySource() {
	const anthropicApiKey = readEnv(ANTHROPIC_API_KEY_ENV);

	if (anthropicApiKey) {
		return {
			apiKey: anthropicApiKey,
			envName: ANTHROPIC_API_KEY_ENV,
		};
	}

	const claudeApiKey = readEnv(CLAUDE_API_KEY_ENV);

	if (claudeApiKey) {
		return {
			apiKey: claudeApiKey,
			envName: CLAUDE_API_KEY_ENV,
		};
	}

	return undefined;
}

function resolveModelSource() {
	const anthropicModel = readEnv(ANTHROPIC_MODEL_ENV);

	if (anthropicModel) {
		return {
			envName: ANTHROPIC_MODEL_ENV,
			model: anthropicModel,
		};
	}

	const claudeModel = readEnv(CLAUDE_MODEL_ENV);

	if (claudeModel) {
		return {
			envName: CLAUDE_MODEL_ENV,
			model: claudeModel,
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
			alias_env: CLAUDE_API_KEY_ENV,
			authoritative_env: ANTHROPIC_API_KEY_ENV,
			resolved_from: input.apiKeySource?.envName,
		},
		env_example_authoritative: false,
		model_authority: {
			alias_env: CLAUDE_MODEL_ENV,
			authoritative_env: ANTHROPIC_MODEL_ENV,
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
		runId: `anthropic_live_smoke_${stageName}_${stamp}`,
		traceId: `trace_anthropic_live_smoke_${stageName}_${stamp}`,
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
	const [factoryModule, runModelTurnModule, registryModule, fileListModule] = await Promise.all([
		import(pathToFileURL(ensureDistFile('gateway/factory.js')).href),
		import(pathToFileURL(ensureDistFile('runtime/run-model-turn.js')).href),
		import(pathToFileURL(ensureDistFile('tools/registry.js')).href),
		import(pathToFileURL(ensureDistFile('tools/file-list.js')).href),
	]);

	return {
		ToolRegistry: registryModule.ToolRegistry,
		createModelGateway: factoryModule.createModelGateway,
		fileListTool: fileListModule.fileListTool,
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
		provider: 'claude',
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
			userPrompt:
				'Reply with a short confirmation that this Anthropic live smoke roundtrip succeeded.',
		}),
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
		provider: 'claude',
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
				'Reply with a short confirmation that request-side tool schema reached Claude. Do not call any tool unless strictly necessary; if you must, only call file.list with path ".".',
		}),
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

function printSummary(summary) {
	process.stdout.write(`ANTHROPIC_LIVE_SMOKE_SUMMARY ${JSON.stringify(summary)}\n`);
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
			provider: 'claude',
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
			provider: 'claude',
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
		provider: 'claude',
		result: 'PASS',
		stage_results: stageResults,
		working_directory: repoRoot,
	});
}

await main();
