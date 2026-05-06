import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
	buildProviderAuthoritySummary,
	loadEnvAuthorityFiles,
	readEnvValue,
	resolveEnvAuthority,
} from './env-authority.mjs';

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
	return readEnvValue(process.env, name);
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

function resolveModelSources(files) {
	const fast = resolveEnvAuthority({
		defaultValue: DEFAULT_FAST_MODEL,
		env: process.env,
		files,
		name: DEEPSEEK_FAST_MODEL_ENV,
	});
	const reasoning = resolveEnvAuthority({
		defaultValue: DEFAULT_REASONING_MODEL,
		env: process.env,
		files,
		name: DEEPSEEK_REASONING_MODEL_ENV,
	});

	return {
		fast: {
			authority: fast,
			envName: fast.report.resolved_from === 'default' ? undefined : DEEPSEEK_FAST_MODEL_ENV,
			model: fast.value ?? DEFAULT_FAST_MODEL,
		},
		reasoning: {
			authority: reasoning,
			envName:
				reasoning.report.resolved_from === 'default' ? undefined : DEEPSEEK_REASONING_MODEL_ENV,
			model: reasoning.value ?? DEFAULT_REASONING_MODEL,
		},
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
				resolved_from: input.modelSources.fast.envName ?? 'default',
				source: input.modelSources.fast.authority.report.source,
			},
			reasoning: {
				authoritative_env: DEEPSEEK_REASONING_MODEL_ENV,
				default_model: DEFAULT_REASONING_MODEL,
				resolved_from: input.modelSources.reasoning.envName ?? 'default',
				source: input.modelSources.reasoning.authority.report.source,
			},
		},
	});
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
		metadata: {
			...input.metadata,
			model_router: {
				...(input.metadata?.model_router ?? {}),
				allow_provider_fallback: false,
			},
		},
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
			maxOutputTokens: 768,
			runId: ids.runId,
			systemPrompt: 'You are a terse smoke-validation assistant.',
			traceId: ids.traceId,
			userPrompt:
				'Analyze this architecture choice in exactly two short bullets, max 80 words total: cheap model routing versus always using the strongest model.',
		}),
	);

	if (response.provider !== 'deepseek' || response.model !== input.reasoningModel) {
		throw new Error(
			`Reasoning roundtrip routed unexpectedly. provider=${response.provider} model=${response.model}`,
		);
	}

	if (response.finish_reason !== 'stop' || response.message.content.trim().length === 0) {
		throw new Error(
			`Reasoning roundtrip produced no public answer. finish_reason=${response.finish_reason} content_length=${response.message.content.length}`,
		);
	}

	return {
		content_length: response.message.content.length,
		finish_reason: response.finish_reason,
		model: response.model,
		provider: response.provider,
		response_preview: response.message.content.slice(0, 120),
		stage: 'reasoning_roundtrip',
		status: 'PASS',
		max_output_tokens: 768,
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

	if (
		completed.response.finish_reason !== 'stop' ||
		completed.response.message.content.trim().length === 0
	) {
		throw new Error(
			`Streaming roundtrip produced no public answer. finish_reason=${completed.response.finish_reason} content_length=${completed.response.message.content.length}`,
		);
	}

	return {
		content_length: completed.response.message.content.length,
		finish_reason: completed.response.finish_reason,
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
			maxOutputTokens: 768,
			runId: ids.runId,
			systemPrompt:
				'You are validating tool schema acceptance. Call the requested tool when it is available. If you cannot call it, reply with one visible sentence explaining that the schema was accepted.',
			traceId: ids.traceId,
			userPrompt: 'Use the file.read tool for README.md.',
		}),
	);

	if (response.provider !== 'deepseek') {
		throw new Error(`Tool schema request returned unexpected provider=${response.provider}`);
	}

	if (
		response.tool_call_candidate === undefined &&
		(response.finish_reason !== 'stop' || response.message.content.trim().length === 0)
	) {
		throw new Error(
			`Tool schema request produced neither a tool call nor public assistant content. finish_reason=${response.finish_reason} content_length=${response.message.content.length}`,
		);
	}

	return {
		content_length: response.message.content.length,
		finish_reason: response.finish_reason,
		model: response.model,
		outcome_kind: response.tool_call_candidate ? 'tool_call_candidate' : 'assistant_response',
		provider: response.provider,
		response_preview: response.message.content.slice(0, 120),
		stage: 'tool_schema_request',
		status: 'PASS',
		tool_name: response.tool_call_candidate?.tool_name,
	};
}

function printSummary(summary) {
	process.stdout.write(`DEEPSEEK_LIVE_SMOKE_SUMMARY ${JSON.stringify(summary)}\n`);
}

async function main() {
	const envFiles = loadEnvAuthorityFiles(repoRoot);
	const apiKeySource = resolveApiKeySource(envFiles);
	const modelSources = resolveModelSources(envFiles);
	const databaseUrlAuthority = resolveEnvAuthority({
		env: process.env,
		files: envFiles,
		name: 'DATABASE_URL',
	});

	if (!apiKeySource.apiKey) {
		printSummary({
			...buildAuthoritySummary({
				apiKeySource,
				modelSources,
			}),
			blocker_kind: 'credential_missing',
			database_url_authority: databaseUrlAuthority.report,
			database_url_present: databaseUrlAuthority.report.present,
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
			database_url_authority: databaseUrlAuthority.report,
			database_url_present: databaseUrlAuthority.report.present,
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
		database_url_authority: databaseUrlAuthority.report,
		database_url_present: databaseUrlAuthority.report.present,
		provider: 'deepseek',
		result: 'PASS',
		stage_results: stageResults,
		working_directory: repoRoot,
	});
}

await main();
