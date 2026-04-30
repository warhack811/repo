import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverRoot, '..', '..');
const distRoot = path.resolve(serverRoot, 'dist');
const localSmokeEnvFiles = [
	{ label: '.env', path: path.resolve(repoRoot, '.env') },
	{ label: '.env.local', path: path.resolve(repoRoot, '.env.local') },
];

const DEFAULT_MODEL = 'llama-3.1-8b-instant';
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
const compatibilityPromptVariants = {
	package_json_list: {
		id: 'package_json_list',
		prompt:
			'Tool kullanarak mevcut klasordeki dosyalari listele ve yalnizca "package.json var" ya da "package.json yok" diye yanit ver.',
	},
	readme_file_read_probe: {
		id: 'readme_file_read_probe',
		prompt:
			'Mevcut klasorde README.md varsa file.read ile oku ve yalnizca projenin adini ya da README yoksa "README yok" diye yanit ver.',
	},
};

const compatibilityToolVariants = {
	full_registry: 'full_registry',
	minimal_file_list: 'minimal_file_list',
	minimal_file_read: 'minimal_file_read',
};
const groqHygieneProfiles = {
	default_prompt_aware: {
		context_mode: null,
		id: 'default_prompt_aware',
		tool_serialization: null,
	},
	current_shape: {
		context_mode: 'legacy_split_system',
		id: 'current_shape',
		tool_serialization: 'full',
	},
	stripped_descriptions: {
		context_mode: 'legacy_split_system',
		id: 'stripped_descriptions',
		tool_serialization: 'strip_descriptions',
	},
	narrow_context_split: {
		context_mode: 'merged_system',
		id: 'narrow_context_split',
		tool_serialization: 'full',
	},
	groq_safe_minimal_schema: {
		context_mode: 'merged_system',
		id: 'groq_safe_minimal_schema',
		tool_serialization: 'minimal_non_primary',
	},
};
const smokeModes = {
	default: 'default',
	compatibility_matrix: 'compatibility_matrix',
};
const COMPATIBILITY_MATRIX_REQUEST_DELAY_MS = 15_000;

function readEnv(name) {
	const value = process.env[name];

	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

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

function readEnvFileValue(filePath, name) {
	if (!fs.existsSync(filePath)) {
		return undefined;
	}

	const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/u);

	for (const line of lines) {
		const trimmedLine = line.trim();

		if (trimmedLine.length === 0 || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
			continue;
		}

		const separatorIndex = trimmedLine.indexOf('=');

		if (separatorIndex <= 0) {
			continue;
		}

		const key = trimmedLine.slice(0, separatorIndex).trim();

		if (key !== name) {
			continue;
		}

		const rawValue = trimmedLine.slice(separatorIndex + 1);
		const value = normalizeEnvValue(rawValue);

		return value.length > 0 ? value : undefined;
	}

	return undefined;
}

function resolveLocalSmokeEnvFileValue(name) {
	for (const envFile of localSmokeEnvFiles) {
		const value = readEnvFileValue(envFile.path, name);

		if (value) {
			return {
				envName: name,
				source: envFile.label,
				value,
			};
		}
	}

	return undefined;
}

function resolveApiKeySource() {
	const groqApiKey = readEnv(GROQ_API_KEY_ENV);

	if (groqApiKey) {
		return {
			apiKey: groqApiKey,
			envName: GROQ_API_KEY_ENV,
			source: 'process.env',
		};
	}

	const fileBackedApiKey = resolveLocalSmokeEnvFileValue(GROQ_API_KEY_ENV);

	if (!fileBackedApiKey) {
		return undefined;
	}

	return {
		apiKey: fileBackedApiKey.value,
		envName: fileBackedApiKey.envName,
		source: fileBackedApiKey.source,
	};
}

function resolveModelSource() {
	const groqModel = readEnv(GROQ_MODEL_ENV);

	if (groqModel) {
		return {
			envName: GROQ_MODEL_ENV,
			model: groqModel,
			source: 'process.env',
		};
	}

	const fileBackedModel = resolveLocalSmokeEnvFileValue(GROQ_MODEL_ENV);

	if (fileBackedModel) {
		return {
			envName: fileBackedModel.envName,
			model: fileBackedModel.value,
			source: fileBackedModel.source,
		};
	}

	return {
		envName: undefined,
		model: DEFAULT_MODEL,
		source: 'default',
	};
}

function resolveSmokeMode() {
	const requestedMode = readEnv('RUNA_GROQ_LIVE_SMOKE_MODE');

	if (!requestedMode) {
		return smokeModes.default;
	}

	return requestedMode;
}

function buildAuthoritySummary(input) {
	return {
		api_key_authority: {
			alias_env: null,
			authoritative_env: GROQ_API_KEY_ENV,
			legacy_non_authoritative_envs: LEGACY_NON_AUTHORITATIVE_GROQ_ENVS,
			resolved_from: input.apiKeySource?.envName,
			source: input.apiKeySource?.source ?? null,
		},
		env_example_authoritative: false,
		model_authority: {
			alias_env: null,
			authoritative_env: GROQ_MODEL_ENV,
			default_model: DEFAULT_MODEL,
			resolved_from: input.modelSource.envName ?? 'default',
			source: input.modelSource.source,
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
		model: input.model,
		run_id: input.runId,
		trace_id: input.traceId,
	};
}

function summarizeAvailableTools(availableTools) {
	return {
		available_tool_count: Array.isArray(availableTools) ? availableTools.length : 0,
		available_tool_names: Array.isArray(availableTools)
			? availableTools.map((tool) => tool.name)
			: [],
	};
}

function summarizeModelRequest(modelRequest) {
	const lastUserMessage = [...(modelRequest.messages ?? [])]
		.reverse()
		.find((message) => message.role === 'user' && typeof message.content === 'string');
	const groqRequestHygiene =
		modelRequest.metadata &&
		typeof modelRequest.metadata === 'object' &&
		!Array.isArray(modelRequest.metadata) &&
		modelRequest.metadata.groq_request_hygiene &&
		typeof modelRequest.metadata.groq_request_hygiene === 'object' &&
		!Array.isArray(modelRequest.metadata.groq_request_hygiene)
			? modelRequest.metadata.groq_request_hygiene
			: null;

	return {
		compiled_context_present: modelRequest.compiled_context !== undefined,
		groq_request_hygiene: groqRequestHygiene,
		last_user_message_preview: lastUserMessage?.content?.slice(0, 160) ?? null,
		max_output_tokens: modelRequest.max_output_tokens ?? null,
		message_count: modelRequest.messages?.length ?? 0,
		message_roles: modelRequest.messages?.map((message) => message.role) ?? [],
		model: modelRequest.model ?? null,
		...summarizeAvailableTools(modelRequest.available_tools),
	};
}

function extractProviderErrorDebugPayload(input) {
	if (!Array.isArray(input.calls)) {
		return null;
	}

	for (let index = input.calls.length - 1; index >= 0; index -= 1) {
		const call = input.calls[index];

		if (call?.[0] !== '[provider.error.debug]') {
			continue;
		}

		try {
			return JSON.parse(String(call[1]));
		} catch {
			return {
				parse_error: 'invalid_provider_error_debug_json',
				raw: String(call[1]),
			};
		}
	}

	return null;
}

async function captureConsoleErrors(action) {
	const originalConsoleError = console.error;
	const capturedCalls = [];

	console.error = (...args) => {
		capturedCalls.push(args);
		originalConsoleError(...args);
	};

	try {
		try {
			return {
				capturedCalls,
				result: await action(),
			};
		} catch (error) {
			return {
				capturedCalls,
				error,
				result: undefined,
			};
		}
	} finally {
		console.error = originalConsoleError;
	}
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
		fileReadModule,
	] = await Promise.all([
		import(pathToFileURL(ensureDistFile('gateway/factory.js')).href),
		import(pathToFileURL(ensureDistFile('ws/live-request.js')).href),
		import(pathToFileURL(ensureDistFile('runtime/run-model-turn.js')).href),
		import(pathToFileURL(ensureDistFile('ws/runtime-dependencies.js')).href),
		import(pathToFileURL(ensureDistFile('runtime/bind-available-tools.js')).href),
		import(pathToFileURL(ensureDistFile('tools/registry.js')).href),
		import(pathToFileURL(ensureDistFile('tools/file-list.js')).href),
		import(pathToFileURL(ensureDistFile('tools/file-read.js')).href),
	]);

	return {
		ToolRegistry: registryModule.ToolRegistry,
		bindAvailableTools: bindAvailableToolsModule.bindAvailableTools,
		buildLiveModelRequest: liveRequestModule.buildLiveModelRequest,
		createModelGateway: factoryModule.createModelGateway,
		fileListTool: fileListModule.fileListTool,
		fileReadTool: fileReadModule.fileReadTool,
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

function buildCompatibilityVariantDefinitions(modules) {
	const fullRegistryResolver = () => {
		const bindingResult = modules.bindAvailableTools({
			registry: modules.getDefaultToolRegistry(),
		});

		if (bindingResult.status !== 'completed') {
			throw new Error(
				`Compatibility matrix full registry binding failed: ${bindingResult.failure.message}`,
			);
		}

		return bindingResult.available_tools;
	};
	const packageJsonVariants = [
		{
			prompt_variant: compatibilityPromptVariants.package_json_list,
			resolveAvailableTools() {
				return [
					{
						description: modules.fileListTool.description,
						name: modules.fileListTool.name,
						parameters: modules.fileListTool.callable_schema.parameters,
					},
				];
			},
			tool_mode: compatibilityToolVariants.minimal_file_list,
		},
		{
			prompt_variant: compatibilityPromptVariants.package_json_list,
			resolveAvailableTools: fullRegistryResolver,
			tool_mode: compatibilityToolVariants.full_registry,
		},
	];
	const readmeVariants = [
		{
			prompt_variant: compatibilityPromptVariants.readme_file_read_probe,
			resolveAvailableTools() {
				return [
					{
						description: modules.fileReadTool.description,
						name: modules.fileReadTool.name,
						parameters: modules.fileReadTool.callable_schema.parameters,
					},
				];
			},
			tool_mode: compatibilityToolVariants.minimal_file_read,
		},
		{
			prompt_variant: compatibilityPromptVariants.readme_file_read_probe,
			resolveAvailableTools: fullRegistryResolver,
			tool_mode: compatibilityToolVariants.full_registry,
		},
	];

	return [
		...packageJsonVariants.flatMap((variant) =>
			(variant.tool_mode === compatibilityToolVariants.full_registry
				? [groqHygieneProfiles.current_shape, groqHygieneProfiles.default_prompt_aware]
				: [
						groqHygieneProfiles.current_shape,
						groqHygieneProfiles.stripped_descriptions,
						groqHygieneProfiles.narrow_context_split,
					]
			).map((hygiene_profile) => ({
				...variant,
				hygiene_profile,
			})),
		),
		...readmeVariants.flatMap((variant) =>
			(variant.tool_mode === compatibilityToolVariants.full_registry
				? [groqHygieneProfiles.current_shape, groqHygieneProfiles.default_prompt_aware]
				: [
						groqHygieneProfiles.current_shape,
						groqHygieneProfiles.stripped_descriptions,
						groqHygieneProfiles.narrow_context_split,
					]
			).map((hygiene_profile) => ({
				...variant,
				hygiene_profile,
			})),
		),
	];
}

async function runCompatibilityMatrix(input) {
	const { buildLiveModelRequest, createModelGateway } = input.modules;
	const variants = buildCompatibilityVariantDefinitions(input.modules);
	const stageResults = [];

	for (const [index, variant] of variants.entries()) {
		if (index > 0) {
			await new Promise((resolvePromise) =>
				setTimeout(resolvePromise, COMPATIBILITY_MATRIX_REQUEST_DELAY_MS),
			);
		}

		const ids = buildIds(`compatibility_${variant.prompt_variant.id}_${variant.tool_mode}`);
		const availableTools = variant.resolveAvailableTools();
		const livePayload = {
			include_presentation_blocks: true,
			provider: 'groq',
			provider_config: {
				apiKey: input.apiKey,
			},
			request: {
				available_tools: availableTools,
				max_output_tokens: 64,
				messages: [
					{
						content: variant.prompt_variant.prompt,
						role: 'user',
					},
				],
				metadata:
					variant.hygiene_profile.context_mode === null &&
					variant.hygiene_profile.tool_serialization === null
						? undefined
						: {
								groq_request_hygiene: {
									context_mode: variant.hygiene_profile.context_mode,
									tool_serialization: variant.hygiene_profile.tool_serialization,
								},
							},
				model: input.model,
			},
			run_id: ids.runId,
			trace_id: ids.traceId,
		};
		const modelRequest = await buildLiveModelRequest(livePayload, repoRoot);
		const gateway = createModelGateway({
			config: {
				apiKey: input.apiKey,
				defaultMaxOutputTokens: 256,
				defaultModel: input.model,
			},
			provider: 'groq',
		});

		let captured;

		try {
			captured = await captureConsoleErrors(async () => {
				return await gateway.generate(modelRequest);
			});
		} catch (error) {
			captured = {
				capturedCalls: [],
				error,
				result: undefined,
			};
		}

		const providerErrorDebug = extractProviderErrorDebugPayload({
			calls: captured.capturedCalls ?? [],
		});

		if (captured.result) {
			stageResults.push({
				hygiene_profile: variant.hygiene_profile.id,
				outcome_kind: captured.result.tool_call_candidate
					? 'tool_call_candidate'
					: 'assistant_response',
				prompt_variant: variant.prompt_variant.id,
				provider: captured.result.provider,
				request_summary: summarizeModelRequest(modelRequest),
				result: 'PASS',
				stage: 'compatibility_matrix',
				tool_mode: variant.tool_mode,
			});
			continue;
		}

		const error = captured.error;
		stageResults.push({
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
			hygiene_profile: variant.hygiene_profile.id,
			provider_error_debug: providerErrorDebug,
			prompt_variant: variant.prompt_variant.id,
			request_summary: summarizeModelRequest(modelRequest),
			result: 'FAIL',
			stage: 'compatibility_matrix',
			tool_mode: variant.tool_mode,
		});
	}

	return stageResults;
}

function printSummary(summary) {
	process.stdout.write(`GROQ_LIVE_SMOKE_SUMMARY ${JSON.stringify(summary)}\n`);
}

async function main() {
	const apiKeySource = resolveApiKeySource();
	const modelSource = resolveModelSource();
	const model = modelSource.model;
	const smokeMode = resolveSmokeMode();

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
			smoke_mode: smokeMode,
			stage_results: [],
			working_directory: repoRoot,
		});
		process.exitCode = 2;
		return;
	}

	const modules = await loadRuntimeModules();
	const stageResults = [];

	try {
		if (smokeMode === smokeModes.compatibility_matrix) {
			stageResults.push(
				...(await runCompatibilityMatrix({
					apiKey: apiKeySource.apiKey,
					model,
					modules,
				})),
			);
		} else {
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
		}
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
			smoke_mode: smokeMode,
			stage_results: stageResults,
			working_directory: repoRoot,
		});
		process.exitCode = 1;
		return;
	}

	const hasFailedStage = stageResults.some((stage) => stage?.result === 'FAIL');

	printSummary({
		...buildAuthoritySummary({
			apiKeySource,
			modelSource,
		}),
		api_key_env: apiKeySource.envName,
		database_url_present: readEnv('DATABASE_URL') !== undefined,
		model,
		provider: 'groq',
		result: hasFailedStage ? 'FAIL' : 'PASS',
		smoke_mode: smokeMode,
		stage_results: stageResults,
		working_directory: repoRoot,
	});

	process.exitCode = hasFailedStage ? 1 : 0;
}

await main();
