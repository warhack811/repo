import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverRoot, '..', '..');
const distRoot = path.resolve(serverRoot, 'dist');

const DEEPSEEK_API_KEY_ENV = 'DEEPSEEK_API_KEY';
const DEEPSEEK_FAST_MODEL_ENV = 'DEEPSEEK_FAST_MODEL';
const DEEPSEEK_REASONING_MODEL_ENV = 'DEEPSEEK_REASONING_MODEL';
const DEFAULT_FAST_MODEL = 'deepseek-v4-flash';
const DEFAULT_REASONING_MODEL = 'deepseek-v4-pro';

function readEnv(name) {
	const value = process.env[name];

	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function resolveApiKeySource() {
	const deepSeekApiKey = readEnv(DEEPSEEK_API_KEY_ENV);

	if (deepSeekApiKey) {
		return {
			apiKey: deepSeekApiKey,
			envName: DEEPSEEK_API_KEY_ENV,
		};
	}

	return undefined;
}

function resolveModelSources() {
	return {
		fast: {
			envName: readEnv(DEEPSEEK_FAST_MODEL_ENV) ? DEEPSEEK_FAST_MODEL_ENV : undefined,
			model: readEnv(DEEPSEEK_FAST_MODEL_ENV) ?? DEFAULT_FAST_MODEL,
		},
		reasoning: {
			envName: readEnv(DEEPSEEK_REASONING_MODEL_ENV) ? DEEPSEEK_REASONING_MODEL_ENV : undefined,
			model: readEnv(DEEPSEEK_REASONING_MODEL_ENV) ?? DEFAULT_REASONING_MODEL,
		},
	};
}

function buildAuthoritySummary(input) {
	return {
		api_key_authority: {
			alias_env: null,
			authoritative_env: DEEPSEEK_API_KEY_ENV,
			resolved_from: input.apiKeySource?.envName,
		},
		env_example_authoritative: false,
		model_authority: {
			fast: {
				authoritative_env: DEEPSEEK_FAST_MODEL_ENV,
				default_model: DEFAULT_FAST_MODEL,
				resolved_from: input.modelSources.fast.envName ?? 'default',
			},
			reasoning: {
				authoritative_env: DEEPSEEK_REASONING_MODEL_ENV,
				default_model: DEFAULT_REASONING_MODEL,
				resolved_from: input.modelSources.reasoning.envName ?? 'default',
			},
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
		message: 'Unknown DeepSeek smoke failure.',
		name: 'UnknownError',
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
	const [factoryModule] = await Promise.all([
		import(pathToFileURL(ensureDistFile('gateway/factory.js')).href),
	]);

	return {
		createModelGateway: factoryModule.createModelGateway,
	};
}

function buildIds(stageName) {
	const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

	return {
		runId: `deepseek_live_smoke_${stageName}_${stamp}`,
		traceId: `trace_deepseek_live_smoke_${stageName}_${stamp}`,
	};
}

function buildRequest(input) {
	return {
		available_tools: input.availableTools,
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
		metadata: input.metadata,
		run_id: input.runId,
		trace_id: input.traceId,
	};
}

function createDeepSeekGateway(input) {
	return input.modules.createModelGateway({
		config: {
			apiKey: input.apiKey,
			defaultMaxOutputTokens: 128,
			defaultModel: input.defaultModel,
		},
		provider: 'deepseek',
	});
}

async function runCheapRoundtrip(input) {
	const ids = buildIds('cheap_roundtrip');
	const gateway = createDeepSeekGateway({
		apiKey: input.apiKey,
		defaultModel: input.fastModel,
		modules: input.modules,
	});
	const response = await gateway.generate(
		buildRequest({
			maxOutputTokens: 64,
			runId: ids.runId,
			systemPrompt: 'You are a terse smoke-validation assistant.',
			traceId: ids.traceId,
			userPrompt: 'Reply with exactly one short sentence confirming DeepSeek fast mode works.',
		}),
	);

	if (response.provider !== 'deepseek' || response.model !== input.fastModel) {
		throw new Error(
			`Cheap roundtrip routed unexpectedly. provider=${response.provider} model=${response.model}`,
		);
	}

	return {
		model: response.model,
		provider: response.provider,
		response_preview: response.message.content.slice(0, 120),
		stage: 'cheap_roundtrip',
		status: 'PASS',
	};
}

async function runReasoningRoundtrip(input) {
	const ids = buildIds('reasoning_roundtrip');
	const gateway = createDeepSeekGateway({
		apiKey: input.apiKey,
		defaultModel: input.fastModel,
		modules: input.modules,
	});
	const response = await gateway.generate(
		buildRequest({
			maxOutputTokens: 128,
			runId: ids.runId,
			systemPrompt: 'You are a terse smoke-validation assistant.',
			traceId: ids.traceId,
			userPrompt:
				'Analyze this architecture choice deeply in two concise bullets: cheap model routing versus always using the strongest model.',
		}),
	);

	if (response.provider !== 'deepseek' || response.model !== input.reasoningModel) {
		throw new Error(
			`Reasoning roundtrip routed unexpectedly. provider=${response.provider} model=${response.model}`,
		);
	}

	return {
		model: response.model,
		provider: response.provider,
		response_preview: response.message.content.slice(0, 120),
		stage: 'reasoning_roundtrip',
		status: 'PASS',
	};
}

async function runStreamingRoundtrip(input) {
	const ids = buildIds('streaming_roundtrip');
	const gateway = createDeepSeekGateway({
		apiKey: input.apiKey,
		defaultModel: input.fastModel,
		modules: input.modules,
	});
	const chunks = [];

	for await (const chunk of gateway.stream(
		buildRequest({
			maxOutputTokens: 64,
			runId: ids.runId,
			systemPrompt: 'You are a terse smoke-validation assistant.',
			traceId: ids.traceId,
			userPrompt: 'Stream a short confirmation that DeepSeek streaming works.',
		}),
	)) {
		chunks.push(chunk);
	}

	const completed = chunks.find((chunk) => chunk.type === 'response.completed');
	const textDeltaCount = chunks.filter((chunk) => chunk.type === 'text.delta').length;

	if (!completed || completed.response.provider !== 'deepseek') {
		throw new Error('Streaming roundtrip did not produce a completed DeepSeek response.');
	}

	return {
		model: completed.response.model,
		provider: completed.response.provider,
		response_preview: completed.response.message.content.slice(0, 120),
		stage: 'streaming_roundtrip',
		status: 'PASS',
		text_delta_count: textDeltaCount,
	};
}

async function runToolSchemaRequest(input) {
	const ids = buildIds('tool_schema_request');
	const gateway = createDeepSeekGateway({
		apiKey: input.apiKey,
		defaultModel: input.fastModel,
		modules: input.modules,
	});
	const response = await gateway.generate(
		buildRequest({
			availableTools: [
				{
					description: 'Read a UTF-8 text file from the workspace.',
					name: 'file.read',
					parameters: {
						path: {
							description: 'Path to read.',
							required: true,
							type: 'string',
						},
					},
				},
			],
			maxOutputTokens: 128,
			runId: ids.runId,
			systemPrompt:
				'You are validating tool schema acceptance. Use tools only if needed; otherwise answer tersely.',
			traceId: ids.traceId,
			userPrompt:
				'If the file.read tool is available, either call it for README.md or briefly confirm the tool schema was accepted.',
		}),
	);

	if (response.provider !== 'deepseek') {
		throw new Error(`Tool schema request returned unexpected provider=${response.provider}`);
	}

	return {
		model: response.model,
		outcome_kind: response.tool_call_candidate ? 'tool_call_candidate' : 'assistant_response',
		provider: response.provider,
		response_preview: response.message.content.slice(0, 120),
		stage: 'tool_schema_request',
		status: 'PASS',
	};
}

function printSummary(summary) {
	process.stdout.write(`DEEPSEEK_LIVE_SMOKE_SUMMARY ${JSON.stringify(summary)}\n`);
}

async function main() {
	const apiKeySource = resolveApiKeySource();
	const modelSources = resolveModelSources();

	if (!apiKeySource) {
		printSummary({
			...buildAuthoritySummary({
				apiKeySource,
				modelSources,
			}),
			blocker_kind: 'credential_missing',
			database_url_present: readEnv('DATABASE_URL') !== undefined,
			provider: 'deepseek',
			result: 'BLOCKED',
			stage_results: [],
			working_directory: repoRoot,
		});
		process.exitCode = 2;
		return;
	}

	const modules = await loadRuntimeModules();
	const stageResults = [];
	const sharedInput = {
		apiKey: apiKeySource.apiKey,
		fastModel: modelSources.fast.model,
		modules,
		reasoningModel: modelSources.reasoning.model,
	};

	try {
		stageResults.push(await runCheapRoundtrip(sharedInput));
		stageResults.push(await runReasoningRoundtrip(sharedInput));
		stageResults.push(await runStreamingRoundtrip(sharedInput));
		stageResults.push(await runToolSchemaRequest(sharedInput));
	} catch (error) {
		printSummary({
			...buildAuthoritySummary({
				apiKeySource,
				modelSources,
			}),
			api_key_env: apiKeySource.envName,
			database_url_present: readEnv('DATABASE_URL') !== undefined,
			error: toErrorSummary(error),
			provider: 'deepseek',
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
			modelSources,
		}),
		api_key_env: apiKeySource.envName,
		database_url_present: readEnv('DATABASE_URL') !== undefined,
		provider: 'deepseek',
		result: 'PASS',
		stage_results: stageResults,
		working_directory: repoRoot,
	});
}

await main();
