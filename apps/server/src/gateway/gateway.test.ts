import type { ModelRequest } from '@runa/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClaudeGateway } from './claude-gateway.js';
import { DeepSeekGateway } from './deepseek-gateway.js';
import { GatewayConfigurationError, GatewayResponseError } from './errors.js';
import { createModelGateway } from './factory.js';
import { GeminiGateway } from './gemini-gateway.js';
import { GroqGateway } from './groq-gateway.js';
import { OpenAiGateway } from './openai-gateway.js';
import { SambaNovaGateway } from './sambanova-gateway.js';
import { parseToolCallCandidatePartsDetailed } from './tool-call-candidate.js';

const groqRequest: ModelRequest = {
	max_output_tokens: 64,
	messages: [
		{ content: 'You are helpful.', role: 'system' },
		{ content: 'Hello', role: 'user' },
	],
	model: 'llama-3.3-70b-versatile',
	run_id: 'run_groq',
	trace_id: 'trace_groq',
};

const claudeRequest: ModelRequest = {
	max_output_tokens: 128,
	messages: [
		{ content: 'You are helpful.', role: 'system' },
		{ content: 'Hello Claude', role: 'user' },
	],
	model: 'claude-sonnet-4-5',
	run_id: 'run_claude',
	trace_id: 'trace_claude',
};

const openAiRequest: ModelRequest = {
	max_output_tokens: 96,
	messages: [
		{ content: 'You are helpful.', role: 'system' },
		{ content: 'Hello OpenAI', role: 'user' },
	],
	model: 'gpt-4.1-mini',
	run_id: 'run_openai',
	trace_id: 'trace_openai',
};

const geminiRequest: ModelRequest = {
	max_output_tokens: 96,
	messages: [
		{ content: 'You are helpful.', role: 'system' },
		{ content: 'Hello Gemini', role: 'user' },
	],
	model: 'gemini-3-flash-preview',
	run_id: 'run_gemini',
	trace_id: 'trace_gemini',
};

const sambaNovaRequest: ModelRequest = {
	max_output_tokens: 96,
	messages: [
		{ content: 'You are helpful.', role: 'system' },
		{ content: 'Hello SambaNova', role: 'user' },
	],
	model: 'DeepSeek-V3.1-cb',
	run_id: 'run_sambanova',
	trace_id: 'trace_sambanova',
};

const deepSeekRequest: ModelRequest = {
	max_output_tokens: 96,
	messages: [
		{ content: 'You are helpful.', role: 'system' },
		{ content: 'Hello DeepSeek', role: 'user' },
	],
	model: 'deepseek-v4-flash',
	run_id: 'run_deepseek',
	trace_id: 'trace_deepseek',
};

const gatewayTestEnvironment = process.env as NodeJS.ProcessEnv & {
	RUNA_DEBUG_PROVIDER_ERRORS?: string;
	RUNA_OPENAI_COMPAT_ALLOW_REMOTE?: string;
};

type LoggedEntry = Record<string, unknown> & {
	readonly message?: unknown;
};

const compiledContextRequest = {
	layers: [
		{
			content: {
				principles: [
					'Work semantically, deterministically, and with typed contracts.',
					'Use registered tools only; do not bypass the ToolRegistry.',
				],
			},
			kind: 'instruction',
			name: 'core_rules',
		},
		{
			content: {
				current_state: 'MODEL_THINKING',
				run_id: 'run_context_compiled',
				trace_id: 'trace_context_compiled',
				working_directory: 'D:/ai/Runa',
			},
			kind: 'runtime',
			name: 'run_layer',
		},
	],
} satisfies NonNullable<ModelRequest['compiled_context']>;

const callableToolsRequest: NonNullable<ModelRequest['available_tools']> = [
	{
		description: 'Read a UTF-8 text file from the workspace.',
		name: 'file.read',
		parameters: {
			encoding: {
				description: 'Optional text encoding.',
				type: 'string',
			},
			path: {
				description: 'Path to read.',
				required: true,
				type: 'string',
			},
		},
	},
	{
		description: 'Execute a non-interactive shell command.',
		name: 'shell.exec',
		parameters: {
			args: {
				description: 'Argument list.',
				items: {
					type: 'string',
				},
				type: 'array',
			},
			command: {
				description: 'Executable to run.',
				required: true,
				type: 'string',
			},
			timeout_ms: {
				description: 'Execution timeout in milliseconds.',
				type: 'number',
			},
		},
	},
];

const parameterlessToolRequest: NonNullable<ModelRequest['available_tools']> = [
	{
		description: 'Capture the current desktop screenshot.',
		name: 'desktop.screenshot',
		parameters: {},
	},
];

const prioritizationToolsRequest: NonNullable<ModelRequest['available_tools']> = [
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
	{
		description: 'Lists the entries in a local workspace directory with deterministic ordering.',
		name: 'file.list',
		parameters: {
			include_hidden: {
				description: 'Whether hidden files and directories should be listed.',
				type: 'boolean',
			},
			path: {
				description: 'Directory path to list.',
				required: true,
				type: 'string',
			},
		},
	},
	{
		description: 'Execute a non-interactive shell command.',
		name: 'shell.exec',
		parameters: {
			command: {
				description: 'Executable to run.',
				required: true,
				type: 'string',
			},
		},
	},
];

const denseGroqToolsRequest: NonNullable<ModelRequest['available_tools']> = [
	...prioritizationToolsRequest,
	{
		description: 'Write a file to the workspace.',
		name: 'file.write',
		parameters: {
			content: {
				description: 'File contents.',
				required: true,
				type: 'string',
			},
			create_dirs: {
				description: 'Whether parent directories may be created.',
				type: 'boolean',
			},
			path: {
				description: 'Destination path.',
				required: true,
				type: 'string',
			},
		},
	},
	{
		description: 'Read the git diff for the current workspace.',
		name: 'git.diff',
		parameters: {
			base_ref: {
				description: 'Optional base ref.',
				type: 'string',
			},
			path: {
				description: 'Optional path filter.',
				type: 'string',
			},
		},
	},
	{
		description: 'Inspect git status for the current workspace.',
		name: 'git.status',
		parameters: {
			include_ignored: {
				description: 'Whether ignored files should be included.',
				type: 'boolean',
			},
		},
	},
	{
		description: 'Search the web.',
		name: 'web.search',
		parameters: {
			max_results: {
				description: 'Maximum number of search results.',
				type: 'number',
			},
			query: {
				description: 'Search query.',
				required: true,
				type: 'string',
			},
		},
	},
	{
		description: 'Capture a desktop screenshot.',
		name: 'desktop.screenshot',
		parameters: {},
	},
];

interface MockFetchCall {
	readonly body: string;
	readonly headers: {
		readonly Authorization?: string;
		readonly 'anthropic-version'?: string;
		readonly 'x-api-key'?: string;
	};
	readonly method: string;
	readonly url: string;
}

interface GroqRequestBodyAssertion {
	readonly reasoning_effort?: string;
	readonly max_tokens?: number;
	readonly max_completion_tokens?: number;
	readonly messages?: ReadonlyArray<{
		readonly content: unknown;
		readonly role: string;
	}>;
	readonly model?: string;
	readonly stream?: boolean;
	readonly temperature?: number;
	readonly thinking?: {
		readonly type?: string;
	};
	readonly tool_choice?: string;
	readonly tools?: ReadonlyArray<{
		readonly function?: {
			readonly description?: string;
			readonly name?: string;
			readonly parameters?: {
				readonly properties?: Record<
					string,
					{
						readonly description?: string;
						readonly items?: {
							readonly type?: string;
						};
						readonly type?: string;
					}
				> & {
					readonly path?: {
						readonly description?: string;
						readonly items?: {
							readonly type?: string;
						};
						readonly type?: string;
					};
				};
				readonly required?: readonly string[];
				readonly type?: string;
			};
		};
		readonly type?: string;
	}>;
}

interface ClaudeRequestBodyAssertion {
	readonly max_tokens?: number;
	readonly messages?: ReadonlyArray<{
		readonly content: unknown;
		readonly role: string;
	}>;
	readonly model?: string;
	readonly stream?: boolean;
	readonly system?: string;
	readonly tools?: ReadonlyArray<{
		readonly description?: string;
		readonly input_schema?: {
			readonly properties?: Record<
				string,
				{
					readonly description?: string;
					readonly items?: {
						readonly type?: string;
					};
					readonly type?: string;
				}
			>;
			readonly required?: readonly string[];
			readonly type?: string;
		};
		readonly name?: string;
	}>;
}

function mockJsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		headers: {
			'content-type': 'application/json',
		},
		status,
	});
}

function mockSseResponse(events: readonly string[]): Response {
	return new Response(events.join('\n\n'), {
		headers: {
			'content-type': 'text/event-stream',
		},
		status: 200,
	});
}

function installFetchMock(response: Response) {
	const calls: MockFetchCall[] = [];
	const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
		calls.push({
			body: typeof init?.body === 'string' ? init.body : '',
			headers: ((init?.headers as MockFetchCall['headers'] | undefined) ??
				{}) as MockFetchCall['headers'],
			method: init?.method ?? 'GET',
			url,
		});

		return response;
	});

	vi.stubGlobal('fetch', fetchMock);

	return { calls, fetchMock };
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	gatewayTestEnvironment.RUNA_DEBUG_PROVIDER_ERRORS = undefined;
	gatewayTestEnvironment.RUNA_OPENAI_COMPAT_ALLOW_REMOTE = undefined;
});

beforeEach(() => {
	gatewayTestEnvironment.RUNA_DEBUG_PROVIDER_ERRORS = undefined;
	gatewayTestEnvironment.RUNA_OPENAI_COMPAT_ALLOW_REMOTE = undefined;
});

describe('tool call candidate parser', () => {
	it.each([
		[
			'accepts empty string input as an empty object',
			{
				call_id: 'call_empty_string',
				tool_input: '   ',
				tool_name: 'file.read',
			},
			{
				candidate: {
					call_id: 'call_empty_string',
					tool_input: {},
					tool_name: 'file.read',
				},
			},
		],
		[
			'accepts missing input as an empty object',
			{
				call_id: 'call_missing_input',
				tool_input: undefined,
				tool_name: 'file.read',
			},
			{
				candidate: {
					call_id: 'call_missing_input',
					tool_input: {},
					tool_name: 'file.read',
				},
			},
		],
		[
			'reports missing call ids',
			{
				call_id: '',
				tool_input: '{}',
				tool_name: 'file.read',
			},
			{
				rejection_reason: 'missing_call_id',
			},
		],
		[
			'reports invalid tool names',
			{
				call_id: 'call_invalid_name',
				tool_input: '{}',
				tool_name: 'file_read',
			},
			{
				rejection_reason: 'invalid_tool_name',
			},
		],
		[
			'reports unparseable tool inputs',
			{
				call_id: 'call_bad_input',
				tool_input: '{',
				tool_name: 'file.read',
			},
			{
				rejection_reason: 'unparseable_tool_input',
			},
		],
	])('%s', (_name, parts, expected) => {
		expect(parseToolCallCandidatePartsDetailed(parts)).toEqual(expected);
	});
});

describe('gateway factory', () => {
	it('returns a lazy gateway wrapper for the groq provider', () => {
		const gateway = createModelGateway({
			config: {
				apiKey: 'groq-key',
			},
			provider: 'groq',
		});

		expect(typeof gateway.generate).toBe('function');
		expect(typeof gateway.stream).toBe('function');
	});

	it('returns a lazy gateway wrapper for the claude provider', () => {
		const gateway = createModelGateway({
			config: {
				apiKey: 'claude-key',
			},
			provider: 'claude',
		});

		expect(typeof gateway.generate).toBe('function');
		expect(typeof gateway.stream).toBe('function');
	});

	it('returns a lazy gateway wrapper for the gemini provider', () => {
		const gateway = createModelGateway({
			config: {
				apiKey: 'gemini-key',
			},
			provider: 'gemini',
		});

		expect(typeof gateway.generate).toBe('function');
		expect(typeof gateway.stream).toBe('function');
	});

	it('returns a lazy gateway wrapper for the openai provider', () => {
		const gateway = createModelGateway({
			config: {
				apiKey: 'openai-key',
			},
			provider: 'openai',
		});

		expect(typeof gateway.generate).toBe('function');
		expect(typeof gateway.stream).toBe('function');
	});

	it('returns a lazy gateway wrapper for the sambanova provider', () => {
		const gateway = createModelGateway({
			config: {
				apiKey: 'sambanova-key',
			},
			provider: 'sambanova',
		});

		expect(typeof gateway.generate).toBe('function');
		expect(typeof gateway.stream).toBe('function');
	});

	it('returns a lazy gateway wrapper for the deepseek provider', () => {
		const gateway = createModelGateway({
			config: {
				apiKey: 'deepseek-key',
			},
			provider: 'deepseek',
		});

		expect(typeof gateway.generate).toBe('function');
		expect(typeof gateway.stream).toBe('function');
	});

	it('throws a typed error when generate() is attempted without a usable api key', async () => {
		const gateway = createModelGateway({
			config: {
				apiKey: '   ',
			},
			provider: 'groq',
		});

		await expect(gateway.generate(groqRequest)).rejects.toThrowError(GatewayConfigurationError);
	});
});

describe('DeepSeekGateway', () => {
	it('maps the internal request and response shapes for cheap generate()', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Hello from DeepSeek',
							role: 'assistant',
						},
					},
				],
				id: 'chatcmpl_deepseek_123',
				model: 'deepseek-v4-flash',
				usage: {
					completion_tokens: 9,
					prompt_tokens: 7,
					total_tokens: 16,
				},
			}),
		);
		const gateway = new DeepSeekGateway({ apiKey: 'deepseek-key' });

		const response = await gateway.generate(deepSeekRequest);
		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(calls[0]?.url).toBe('https://api.deepseek.com/chat/completions');
		expect(calls[0]?.headers.Authorization).toBe('Bearer deepseek-key');
		expect(requestBody.model).toBe('deepseek-v4-flash');
		expect(requestBody.max_tokens).toBe(96);
		expect(requestBody.thinking?.type).toBe('disabled');
		expect(requestBody.reasoning_effort).toBeUndefined();
		expect(requestBody.messages).toEqual([
			{ content: 'You are helpful.', role: 'system' },
			{ content: 'Hello DeepSeek', role: 'user' },
		]);
		expect(response).toEqual({
			finish_reason: 'stop',
			message: {
				content: 'Hello from DeepSeek',
				role: 'assistant',
			},
			model: 'deepseek-v4-flash',
			provider: 'deepseek',
			response_id: 'chatcmpl_deepseek_123',
			usage: {
				input_tokens: 7,
				output_tokens: 9,
				total_tokens: 16,
			},
		});
	});

	it('enables thinking for the reasoning model tier', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Reasoned answer',
							reasoning_content: 'hidden internal reasoning',
							role: 'assistant',
						},
					},
				],
				id: 'chatcmpl_deepseek_reasoning',
				model: 'deepseek-v4-pro',
			}),
		);
		const gateway = new DeepSeekGateway({ apiKey: 'deepseek-key' });

		const response = await gateway.generate({
			...deepSeekRequest,
			model: 'deepseek-v4-pro',
		});
		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(requestBody.thinking?.type).toBe('enabled');
		expect(requestBody.reasoning_effort).toBe('high');
		expect(response.message.content).toBe('Reasoned answer');
	});

	it('includes available_tools, deterministic tool temperature, and tool call parsing', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'tool_calls',
						message: {
							content: null,
							role: 'assistant',
							tool_calls: [
								{
									function: {
										arguments: '{"path":"README.md"}',
										name: 'file_read',
									},
									id: 'call_deepseek_tool',
									type: 'function',
								},
							],
						},
					},
				],
				id: 'chatcmpl_deepseek_tool',
				model: 'deepseek-v4-flash',
			}),
		);
		const gateway = new DeepSeekGateway({ apiKey: 'deepseek-key' });

		const response = await gateway.generate({
			...deepSeekRequest,
			available_tools: callableToolsRequest,
		});
		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(requestBody.tool_choice).toBe('auto');
		expect(requestBody.temperature).toBe(0);
		expect(requestBody.tools?.map((tool) => tool.function?.name)).toEqual([
			'file_read',
			'shell_exec',
		]);
		expect(response.tool_call_candidate).toEqual({
			call_id: 'call_deepseek_tool',
			tool_input: {
				path: 'README.md',
			},
			tool_name: 'file.read',
		});
	});

	it('accepts a streaming parameterless tool call when no arguments delta is sent', async () => {
		const { calls } = installFetchMock(
			mockSseResponse([
				'data: {"id":"chatcmpl_deepseek_stream_tool","model":"deepseek-v4-flash","choices":[{"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_deepseek_screenshot","type":"function","function":{"name":"desktop-screenshot"}}]},"finish_reason":null}]}',
				'data: {"id":"chatcmpl_deepseek_stream_tool","model":"deepseek-v4-flash","choices":[{"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":7,"completion_tokens":3,"total_tokens":10}}',
				'data: [DONE]',
			]),
		);
		const gateway = new DeepSeekGateway({ apiKey: 'deepseek-key' });
		const chunks = [];

		for await (const chunk of gateway.stream({
			...deepSeekRequest,
			available_tools: parameterlessToolRequest,
		})) {
			chunks.push(chunk);
		}

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;
		expect(requestBody.tools?.map((tool) => tool.function?.name)).toEqual(['desktop_screenshot']);
		expect(chunks).toEqual([
			{
				response: {
					finish_reason: 'stop',
					message: {
						content: '',
						role: 'assistant',
					},
					model: 'deepseek-v4-flash',
					provider: 'deepseek',
					response_id: 'chatcmpl_deepseek_stream_tool',
					tool_call_candidate: {
						call_id: 'call_deepseek_screenshot',
						tool_input: {},
						tool_name: 'desktop.screenshot',
					},
					usage: {
						input_tokens: 7,
						output_tokens: 3,
						total_tokens: 10,
					},
				},
				type: 'response.completed',
			},
		]);
	});

	it('surfaces missing call id as a structured DeepSeek streaming tool call rejection', async () => {
		installFetchMock(
			mockSseResponse([
				'data: {"id":"chatcmpl_deepseek_stream_missing_call","model":"deepseek-v4-flash","choices":[{"delta":{"role":"assistant","tool_calls":[{"index":0,"type":"function","function":{"name":"desktop_screenshot"}}]},"finish_reason":null}]}',
				'data: {"id":"chatcmpl_deepseek_stream_missing_call","model":"deepseek-v4-flash","choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
				'data: [DONE]',
			]),
		);
		const gateway = new DeepSeekGateway({ apiKey: 'deepseek-key' });
		const consumeStream = async () => {
			const chunks = [];

			for await (const chunk of gateway.stream({
				...deepSeekRequest,
				available_tools: parameterlessToolRequest,
			})) {
				chunks.push(chunk);
			}

			return chunks;
		};

		await expect(consumeStream()).rejects.toMatchObject({
			details: {
				arguments_length: 0,
				call_id_present: false,
				reason: 'missing_call_id',
				tool_name_raw: 'desktop_screenshot',
				tool_name_resolved: 'desktop.screenshot',
			},
			message:
				'DeepSeek streaming response contained an invalid tool call candidate (missing_call_id).',
		});
	});

	it('surfaces invalid JSON arguments as a structured DeepSeek streaming tool call rejection', async () => {
		installFetchMock(
			mockSseResponse([
				'data: {"id":"chatcmpl_deepseek_stream_bad_json","model":"deepseek-v4-flash","choices":[{"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_bad_json","type":"function","function":{"name":"file_read","arguments":"{\\"path\\""}}]},"finish_reason":null}]}',
				'data: {"id":"chatcmpl_deepseek_stream_bad_json","model":"deepseek-v4-flash","choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
				'data: [DONE]',
			]),
		);
		const gateway = new DeepSeekGateway({ apiKey: 'deepseek-key' });
		const consumeStream = async () => {
			const chunks = [];

			for await (const chunk of gateway.stream({
				...deepSeekRequest,
				available_tools: callableToolsRequest,
			})) {
				chunks.push(chunk);
			}

			return chunks;
		};

		await expect(consumeStream()).rejects.toMatchObject({
			details: {
				arguments_length: 7,
				call_id_present: true,
				reason: 'unparseable_tool_input',
				tool_name_raw: 'file_read',
				tool_name_resolved: 'file.read',
			},
			message:
				'DeepSeek streaming response contained an invalid tool call candidate (unparseable_tool_input).',
		});
	});

	it('accepts a non-streaming parameterless tool call with empty arguments', async () => {
		installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'tool_calls',
						message: {
							content: null,
							role: 'assistant',
							tool_calls: [
								{
									function: {
										arguments: '',
										name: 'desktop_screenshot',
									},
									id: 'call_deepseek_empty_args',
									type: 'function',
								},
							],
						},
					},
				],
				id: 'chatcmpl_deepseek_empty_args',
				model: 'deepseek-v4-flash',
			}),
		);
		const gateway = new DeepSeekGateway({ apiKey: 'deepseek-key' });

		const response = await gateway.generate({
			...deepSeekRequest,
			available_tools: parameterlessToolRequest,
		});

		expect(response.tool_call_candidate).toEqual({
			call_id: 'call_deepseek_empty_args',
			tool_input: {},
			tool_name: 'desktop.screenshot',
		});
	});

	it('streams DeepSeek text deltas, ignores keep-alive comments, and returns a terminal response chunk', async () => {
		const { calls } = installFetchMock(
			mockSseResponse([
				': keep-alive',
				'data: {"id":"chatcmpl_deepseek_stream","model":"deepseek-v4-flash","choices":[{"delta":{"role":"assistant","content":"Hello "},"finish_reason":null}]}',
				'data: {"id":"chatcmpl_deepseek_stream","model":"deepseek-v4-flash","choices":[{"delta":{"content":"from DeepSeek"},"finish_reason":"stop"}],"usage":{"prompt_tokens":7,"completion_tokens":9,"total_tokens":16}}',
				'data: [DONE]',
			]),
		);
		const gateway = new DeepSeekGateway({ apiKey: 'deepseek-key' });
		const chunks = [];

		for await (const chunk of gateway.stream(deepSeekRequest)) {
			chunks.push(chunk);
		}

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;
		expect(requestBody.stream).toBe(true);
		expect(chunks).toEqual([
			{
				text_delta: 'Hello ',
				type: 'text.delta',
			},
			{
				text_delta: 'from DeepSeek',
				type: 'text.delta',
			},
			{
				response: {
					finish_reason: 'stop',
					message: {
						content: 'Hello from DeepSeek',
						role: 'assistant',
					},
					model: 'deepseek-v4-flash',
					provider: 'deepseek',
					response_id: 'chatcmpl_deepseek_stream',
					usage: {
						input_tokens: 7,
						output_tokens: 9,
						total_tokens: 16,
					},
				},
				type: 'response.completed',
			},
		]);
	});

	it('rejects image attachments until a DeepSeek vision path is explicitly validated', async () => {
		const gateway = new DeepSeekGateway({ apiKey: 'deepseek-key' });

		await expect(
			gateway.generate({
				...deepSeekRequest,
				attachments: [
					{
						blob_id: 'blob_image',
						data_url: 'data:image/png;base64,AA==',
						kind: 'image',
						media_type: 'image/png',
						size_bytes: 2,
					},
				],
			}),
		).rejects.toThrow('DeepSeek gateway currently supports text/document attachments only');
	});
});

describe('SambaNovaGateway', () => {
	it('maps the internal request and response shapes for generate()', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Hello from SambaNova',
							role: 'assistant',
						},
					},
				],
				id: 'chatcmpl_sambanova_123',
				model: 'DeepSeek-V3.1-cb',
				usage: {
					completion_tokens: 9,
					prompt_tokens: 7,
					total_tokens: 16,
				},
			}),
		);
		const gateway = new SambaNovaGateway({ apiKey: 'sambanova-key' });

		const response = await gateway.generate(sambaNovaRequest);
		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(calls[0]?.url).toBe('https://api.sambanova.ai/v1/chat/completions');
		expect(calls[0]?.headers.Authorization).toBe('Bearer sambanova-key');
		expect(requestBody.model).toBe('DeepSeek-V3.1-cb');
		expect(requestBody.max_tokens).toBe(96);
		expect(requestBody.messages).toEqual([
			{ content: 'You are helpful.', role: 'system' },
			{ content: 'Hello SambaNova', role: 'user' },
		]);
		expect(response).toEqual({
			finish_reason: 'stop',
			message: {
				content: 'Hello from SambaNova',
				role: 'assistant',
			},
			model: 'DeepSeek-V3.1-cb',
			provider: 'sambanova',
			response_id: 'chatcmpl_sambanova_123',
			usage: {
				input_tokens: 7,
				output_tokens: 9,
				total_tokens: 16,
			},
		});
	});

	it('routes generate() to a loopback OpenAI-compatible baseUrl for local LM Studio smoke', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Hello from local vision',
							role: 'assistant',
						},
					},
				],
				id: 'chatcmpl_lmstudio_123',
				model: 'qwen/qwen3.5-9b',
			}),
		);
		const gateway = new OpenAiGateway({
			apiKey: 'lmstudio-local',
			baseUrl: 'http://localhost:1234/v1',
		});

		await gateway.generate({
			...openAiRequest,
			model: 'qwen/qwen3.5-9b',
		});

		expect(calls[0]?.url).toBe('http://localhost:1234/v1/chat/completions');
		expect(calls[0]?.headers.Authorization).toBe('Bearer lmstudio-local');
	});

	it('rejects non-loopback OpenAI-compatible baseUrl values', async () => {
		const gateway = new OpenAiGateway({
			apiKey: 'openai-compatible-key',
			baseUrl: 'https://example.com/v1',
		});

		await expect(gateway.generate(openAiRequest)).rejects.toThrow(
			'OpenAI-compatible baseUrl is limited to loopback hosts unless RUNA_OPENAI_COMPAT_ALLOW_REMOTE=1 is set.',
		);
	});

	it('allows remote OpenAI-compatible baseUrl values only behind an explicit env flag', async () => {
		gatewayTestEnvironment.RUNA_OPENAI_COMPAT_ALLOW_REMOTE = '1';
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Hello from a remote OpenAI-compatible gateway',
							role: 'assistant',
						},
					},
				],
				id: 'chatcmpl_remote_compat_123',
				model: 'qwen/qwen3.5-9b',
			}),
		);
		const gateway = new OpenAiGateway({
			apiKey: 'remote-compatible-key',
			baseUrl: 'https://openai-compatible.example/v1',
		});

		await gateway.generate({
			...openAiRequest,
			model: 'qwen/qwen3.5-9b',
		});

		expect(calls[0]?.url).toBe('https://openai-compatible.example/v1/chat/completions');
		expect(calls[0]?.headers.Authorization).toBe('Bearer remote-compatible-key');
	});

	it('includes available_tools and tool call parsing for generate()', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'tool_calls',
						message: {
							content: null,
							role: 'assistant',
							tool_calls: [
								{
									function: {
										arguments: '{"path":"README.md"}',
										name: 'file.read',
									},
									id: 'call_sambanova_tool',
									type: 'function',
								},
							],
						},
					},
				],
				id: 'chatcmpl_sambanova_tool',
				model: 'DeepSeek-V3.1-cb',
			}),
		);
		const gateway = new SambaNovaGateway({ apiKey: 'sambanova-key' });

		const response = await gateway.generate({
			...sambaNovaRequest,
			available_tools: callableToolsRequest,
		});
		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(requestBody.tool_choice).toBe('auto');
		expect(requestBody.tools?.map((tool) => tool.function?.name)).toEqual([
			'file.read',
			'shell.exec',
		]);
		expect(response.tool_call_candidate).toEqual({
			call_id: 'call_sambanova_tool',
			tool_input: {
				path: 'README.md',
			},
			tool_name: 'file.read',
		});
	});

	it('streams SambaNova text deltas and returns a terminal response chunk', async () => {
		const { calls } = installFetchMock(
			mockSseResponse([
				'data: {"id":"chatcmpl_sambanova_stream","model":"DeepSeek-V3.1-cb","choices":[{"delta":{"role":"assistant","content":"Hello "},"finish_reason":null}]}',
				'data: {"id":"chatcmpl_sambanova_stream","model":"DeepSeek-V3.1-cb","choices":[{"delta":{"content":"from SambaNova"},"finish_reason":"stop"}],"usage":{"prompt_tokens":7,"completion_tokens":9,"total_tokens":16}}',
				'data: [DONE]',
			]),
		);
		const gateway = new SambaNovaGateway({ apiKey: 'sambanova-key' });

		const chunks = [];

		for await (const chunk of gateway.stream(sambaNovaRequest)) {
			chunks.push(chunk);
		}

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(requestBody.stream).toBe(true);
		expect(chunks).toEqual([
			{
				text_delta: 'Hello ',
				type: 'text.delta',
			},
			{
				text_delta: 'from SambaNova',
				type: 'text.delta',
			},
			{
				response: {
					finish_reason: 'stop',
					message: {
						content: 'Hello from SambaNova',
						role: 'assistant',
					},
					model: 'DeepSeek-V3.1-cb',
					provider: 'sambanova',
					response_id: 'chatcmpl_sambanova_stream',
					usage: {
						input_tokens: 7,
						output_tokens: 9,
						total_tokens: 16,
					},
				},
				type: 'response.completed',
			},
		]);
	});
});

describe('GroqGateway', () => {
	it('maps the internal request and response shapes for generate()', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Hello from Groq',
							role: 'assistant',
						},
					},
				],
				id: 'chatcmpl_123',
				model: 'llama-3.3-70b-versatile',
				usage: {
					completion_tokens: 12,
					prompt_tokens: 8,
					total_tokens: 20,
				},
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		const response = await gateway.generate(groqRequest);
		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(calls[0]?.url).toBe('https://api.groq.com/openai/v1/chat/completions');
		expect(calls[0]?.headers.Authorization).toBe('Bearer groq-key');
		expect(requestBody.model).toBe('llama-3.3-70b-versatile');
		expect(requestBody.max_completion_tokens).toBe(64);
		expect(requestBody.messages).toEqual([
			{ content: 'You are helpful.', role: 'system' },
			{ content: 'Hello', role: 'user' },
		]);
		expect(response).toEqual({
			finish_reason: 'stop',
			message: {
				content: 'Hello from Groq',
				role: 'assistant',
			},
			model: 'llama-3.3-70b-versatile',
			provider: 'groq',
			response_id: 'chatcmpl_123',
			usage: {
				input_tokens: 8,
				output_tokens: 12,
				total_tokens: 20,
			},
		});
		expect(response.tool_call_candidate).toBeUndefined();
	});

	it('includes compiled_context as a deterministic system message when present', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Hello from Groq',
							role: 'assistant',
						},
					},
				],
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await gateway.generate({
			...groqRequest,
			compiled_context: compiledContextRequest,
		});

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;
		const compiledContextMessage = requestBody.messages?.[0];
		const compiledContextContent = compiledContextMessage?.content as string | undefined;

		expect(compiledContextMessage?.role).toBe('system');
		expect(compiledContextContent).toContain('[core_rules:instruction]');
		expect(compiledContextContent).toContain('[run_layer:runtime]');
		expect(compiledContextContent?.indexOf('[core_rules:instruction]') ?? -1).toBeLessThan(
			compiledContextContent?.indexOf('[run_layer:runtime]') ?? -1,
		);
		expect(requestBody.messages?.slice(1)).toEqual([
			{ content: 'You are helpful.', role: 'system' },
			{ content: 'Hello', role: 'user' },
		]);
	});

	it('can merge compiled_context with request system messages when explicitly requested in metadata', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Hello from Groq',
							role: 'assistant',
						},
					},
				],
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await gateway.generate({
			...groqRequest,
			compiled_context: compiledContextRequest,
			metadata: {
				groq_request_hygiene: {
					context_mode: 'merged_system',
				},
			},
		});

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;
		const compiledContextMessage = requestBody.messages?.[0];

		expect(compiledContextMessage?.role).toBe('system');
		expect(compiledContextMessage?.content).toContain('[core_rules:instruction]');
		expect(compiledContextMessage?.content).toContain('You are helpful.');
		expect(requestBody.messages?.slice(1)).toEqual([{ content: 'Hello', role: 'user' }]);
	});

	it('includes available_tools in the Groq request body when present', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Hello from Groq',
							role: 'assistant',
						},
					},
				],
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await gateway.generate({
			...groqRequest,
			available_tools: callableToolsRequest,
		});

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(requestBody.tool_choice).toBe('auto');
		expect(requestBody.temperature).toBe(0);
		expect(requestBody.tools).toEqual([
			{
				function: {
					description: 'Read a UTF-8 text file from the workspace.',
					name: 'file.read',
					parameters: {
						properties: {
							encoding: {
								description: 'Optional text encoding.',
								type: 'string',
							},
							path: {
								description: 'Path to read.',
								type: 'string',
							},
						},
						required: ['path'],
						type: 'object',
					},
				},
				type: 'function',
			},
			{
				function: {
					description: 'Execute a non-interactive shell command.',
					name: 'shell.exec',
					parameters: {
						properties: {
							args: {
								description: 'Argument list.',
								items: {
									type: 'string',
								},
								type: 'array',
							},
							command: {
								description: 'Executable to run.',
								type: 'string',
							},
							timeout_ms: {
								description: 'Execution timeout in milliseconds.',
								type: 'number',
							},
						},
						required: ['command'],
						type: 'object',
					},
				},
				type: 'function',
			},
		]);
	});

	it('prioritizes the prompt-relevant tool first for Groq request hygiene', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'package.json var',
							role: 'assistant',
						},
					},
				],
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await gateway.generate({
			...groqRequest,
			available_tools: prioritizationToolsRequest,
			messages: [
				{
					content:
						'Tool kullanarak mevcut klasordeki dosyalari listele ve yalnizca "package.json var" ya da "package.json yok" diye yanit ver.',
					role: 'user',
				},
			],
		});

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(requestBody.tools?.map((tool) => tool.function?.name)).toEqual([
			'file.list',
			'file.read',
			'shell.exec',
		]);
	});

	it('keeps legacy split-system serialization when explicitly requested in metadata', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Hello from Groq',
							role: 'assistant',
						},
					},
				],
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await gateway.generate({
			...groqRequest,
			compiled_context: compiledContextRequest,
			metadata: {
				groq_request_hygiene: {
					context_mode: 'legacy_split_system',
				},
			},
		});

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(requestBody.messages).toEqual([
			{
				content: expect.stringContaining('[core_rules:instruction]'),
				role: 'system',
			},
			{ content: 'You are helpful.', role: 'system' },
			{ content: 'Hello', role: 'user' },
		]);
	});

	it('minimizes non-primary full-registry tool metadata by default for Groq', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'package.json var',
							role: 'assistant',
						},
					},
				],
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await gateway.generate({
			...groqRequest,
			available_tools: [
				...prioritizationToolsRequest,
				{
					description: 'Search for a substring.',
					name: 'search.grep',
					parameters: {
						path: {
							description: 'File or directory path to search.',
							required: true,
							type: 'string',
						},
						query: {
							description: 'Substring query to search for.',
							required: true,
							type: 'string',
						},
					},
				},
			],
			messages: [
				{
					content:
						'Tool kullanarak mevcut klasordeki dosyalari listele ve yalnizca "package.json var" ya da "package.json yok" diye yanit ver.',
					role: 'user',
				},
			],
		});

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;
		const [primaryTool, secondaryTool] = requestBody.tools ?? [];

		expect(primaryTool?.function?.name).toBe('file.list');
		expect(primaryTool?.function?.description).toBeDefined();
		expect(primaryTool?.function?.parameters?.properties?.path?.description).toBeDefined();
		expect(secondaryTool?.function?.description).toBeUndefined();
		expect(secondaryTool?.function?.parameters?.properties?.path?.description).toBeUndefined();
	});

	it('uses merged-system plus minimal non-primary schemas for dense Groq tool registries', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'package.json var',
							role: 'assistant',
						},
					},
				],
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await gateway.generate({
			...groqRequest,
			available_tools: denseGroqToolsRequest,
			compiled_context: compiledContextRequest,
			messages: [
				{
					content:
						'Tool kullanarak mevcut klasordeki dosyalari listele ve yalnizca "package.json var" ya da "package.json yok" diye yanit ver.',
					role: 'user',
				},
			],
		});

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;
		const fileListTool = requestBody.tools?.[0];
		const fileReadTool = requestBody.tools?.find((tool) => tool.function?.name === 'file.read');
		const gitDiffTool = requestBody.tools?.find((tool) => tool.function?.name === 'git.diff');
		const gitDiffProperties = gitDiffTool?.function?.parameters?.properties as
			| {
					readonly base_ref?: {
						readonly description?: string;
					};
					readonly path?: {
						readonly description?: string;
					};
			  }
			| undefined;

		expect(requestBody.messages?.[0]?.role).toBe('system');
		expect(requestBody.messages).toHaveLength(2);
		expect(fileListTool?.function?.name).toBe('file.list');
		expect(fileListTool?.function?.description).toBeDefined();
		expect(fileReadTool?.function?.description).toBeUndefined();
		expect(fileReadTool?.function?.parameters?.properties?.path?.description).toBeUndefined();
		expect(gitDiffProperties?.base_ref?.description).toBeUndefined();
		expect(gitDiffProperties?.path?.description).toBeUndefined();
		expect(fileReadTool?.function?.parameters).toEqual({
			properties: {
				path: {
					type: 'string',
				},
			},
			required: ['path'],
			type: 'object',
		});
	});

	it('keeps legacy split-system defaults for dense file.read-oriented Groq prompts', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Runa',
							role: 'assistant',
						},
					},
				],
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await gateway.generate({
			...groqRequest,
			available_tools: denseGroqToolsRequest,
			compiled_context: compiledContextRequest,
			messages: [
				{
					content: 'You are helpful.',
					role: 'system',
				},
				{
					content:
						'Mevcut klasorde README.md varsa file.read ile oku ve yalnizca projenin adini ya da README yoksa "README yok" diye yanit ver.',
					role: 'user',
				},
			],
		});

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(requestBody.messages).toHaveLength(3);
		expect(requestBody.messages?.[0]?.role).toBe('system');
		expect(requestBody.messages?.[1]).toEqual({
			content: 'You are helpful.',
			role: 'system',
		});
		expect(requestBody.tools?.[0]?.function?.name).toBe('file.read');
		expect(requestBody.tools?.[1]?.function?.description).toBeUndefined();
	});

	it('adds a strict typed-tool instruction when Groq uses merged-system tool hygiene', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'package.json var',
							role: 'assistant',
						},
					},
				],
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await gateway.generate({
			...groqRequest,
			available_tools: [
				{
					description:
						'Lists the entries in a local workspace directory with deterministic ordering.',
					name: 'file.list',
					parameters: {
						include_hidden: {
							description: 'Whether hidden files and directories should be listed.',
							type: 'boolean',
						},
						path: {
							description: 'Directory path to list.',
							required: true,
							type: 'string',
						},
					},
				},
			],
			compiled_context: compiledContextRequest,
			metadata: {
				groq_request_hygiene: {
					context_mode: 'merged_system',
					tool_serialization: 'full',
				},
			},
			messages: [
				{
					content:
						'Tool kullanarak mevcut klasordeki dosyalari listele ve yalnizca "package.json var" ya da "package.json yok" diye yanit ver.',
					role: 'user',
				},
			],
		});

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(requestBody.messages?.[0]?.role).toBe('system');
		expect(requestBody.messages?.[0]?.content).toContain(
			'Do not quote booleans or numbers. Omit optional arguments unless they are necessary.',
		);
		expect(requestBody.messages?.slice(1)).toEqual([
			{
				content:
					'Tool kullanarak mevcut klasordeki dosyalari listele ve yalnizca "package.json var" ya da "package.json yok" diye yanit ver.',
				role: 'user',
			},
		]);
	});

	it('turns a non-2xx response into a typed response error', async () => {
		installFetchMock(mockJsonResponse(401, { error: { message: 'Unauthorized' } }));
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await expect(gateway.generate(groqRequest)).rejects.toThrowError(GatewayResponseError);
	});

	it('logs non-2xx Groq details to stderr only when debug env is enabled', async () => {
		gatewayTestEnvironment.RUNA_DEBUG_PROVIDER_ERRORS = '1';
		try {
			installFetchMock(mockJsonResponse(400, { error: { message: 'Invalid model' } }));
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const gateway = new GroqGateway({ apiKey: 'groq-key' });

			await expect(
				gateway.generate({
					...groqRequest,
					available_tools: callableToolsRequest,
					compiled_context: compiledContextRequest,
				}),
			).rejects.toThrowError(GatewayResponseError);

			const structuredEntries = consoleErrorSpy.mock.calls
				.map(([entry]) => (typeof entry === 'string' ? (JSON.parse(entry) as LoggedEntry) : null))
				.filter((entry): entry is LoggedEntry => entry !== null);
			const providerDebugEntry = structuredEntries.find(
				(entry) => entry.message === 'provider.error.debug',
			);

			expect(providerDebugEntry).toEqual({
				component: 'gateway.provider_http',
				level: 'error',
				message: 'provider.error.debug',
				provider: 'groq',
				request_summary: {
					compiled_context_chars: expect.any(Number),
					has_compiled_context: true,
					last_user_message_chars: 5,
					max_output_tokens: 64,
					message_count: 3,
					message_roles: ['system', 'system', 'user'],
					model: 'llama-3.3-70b-versatile',
					request_hygiene_context_mode: 'legacy_split_system',
					request_hygiene_tool_serialization: 'full',
					requested_tool_names: ['file.read', 'shell.exec'],
					run_id: 'run_groq',
					serialized_tool_names: ['file.read', 'shell.exec'],
					tool_count: 2,
					tool_names: ['file.read', 'shell.exec'],
					trace_id: 'trace_groq',
				},
				response_body: JSON.stringify({ error: { message: 'Invalid model' } }),
				status_code: 400,
				timestamp: expect.any(String),
			});
		} finally {
			gatewayTestEnvironment.RUNA_DEBUG_PROVIDER_ERRORS = undefined;
		}
	});

	it('keeps Groq non-2xx stderr logging silent by default', async () => {
		installFetchMock(mockJsonResponse(400, { error: { message: 'Invalid model' } }));
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await expect(gateway.generate(groqRequest)).rejects.toThrowError(GatewayResponseError);

		expect(
			consoleErrorSpy.mock.calls.some(
				(call) =>
					typeof call[0] === 'string' && call[0].includes('"message":"provider.error.debug"'),
			),
		).toBe(false);
	});

	it('maps a Groq tool call response into tool_call_candidate', async () => {
		installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'tool_calls',
						message: {
							content: null,
							role: 'assistant',
							tool_calls: [
								{
									function: {
										arguments: '{"path":"src/example.ts"}',
										name: 'file.read',
									},
									id: 'call_groq_tool',
									type: 'function',
								},
							],
						},
					},
				],
				id: 'chatcmpl_tool_123',
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		const response = await gateway.generate(groqRequest);

		expect(response.message).toEqual({
			content: '',
			role: 'assistant',
		});
		expect(response.tool_call_candidate).toEqual({
			call_id: 'call_groq_tool',
			tool_input: {
				path: 'src/example.ts',
			},
			tool_name: 'file.read',
		});
		expect(response.tool_call_candidates).toEqual([
			{
				call_id: 'call_groq_tool',
				tool_input: {
					path: 'src/example.ts',
				},
				tool_name: 'file.read',
			},
		]);
	});

	it('parses multiple Groq tool calls additively while keeping the first candidate for backward compatibility', async () => {
		installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'tool_calls',
						message: {
							content: 'Calling tools',
							role: 'assistant',
							tool_calls: [
								{
									function: {
										arguments: '{"path":"src/example.ts"}',
										name: 'file.read',
									},
									id: 'call_groq_multi_1',
									type: 'function',
								},
								{
									function: {
										arguments: '{"path":"docs/vision.md"}',
										name: 'file.read',
									},
									id: 'call_groq_multi_2',
									type: 'function',
								},
							],
						},
					},
				],
				id: 'chatcmpl_tool_multi_123',
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		const response = await gateway.generate(groqRequest);

		expect(response.message).toEqual({
			content: 'Calling tools',
			role: 'assistant',
		});
		expect(response.tool_call_candidate).toEqual({
			call_id: 'call_groq_multi_1',
			tool_input: {
				path: 'src/example.ts',
			},
			tool_name: 'file.read',
		});
		expect(response.tool_call_candidates).toEqual([
			{
				call_id: 'call_groq_multi_1',
				tool_input: {
					path: 'src/example.ts',
				},
				tool_name: 'file.read',
			},
			{
				call_id: 'call_groq_multi_2',
				tool_input: {
					path: 'docs/vision.md',
				},
				tool_name: 'file.read',
			},
		]);
	});

	it('keeps valid Groq tool call candidates when a later candidate is malformed', async () => {
		installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'tool_calls',
						message: {
							content: null,
							role: 'assistant',
							tool_calls: [
								{
									function: {
										arguments: '{"path":"src/example.ts"}',
										name: 'file.read',
									},
									id: 'call_groq_partial_valid',
									type: 'function',
								},
								{
									function: {
										arguments: 'not-json',
										name: 'file.read',
									},
									id: 'call_groq_partial_invalid',
									type: 'function',
								},
							],
						},
					},
				],
				id: 'chatcmpl_tool_partial_123',
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		const response = await gateway.generate(groqRequest);

		expect(response.tool_call_candidate).toEqual({
			call_id: 'call_groq_partial_valid',
			tool_input: {
				path: 'src/example.ts',
			},
			tool_name: 'file.read',
		});
		expect(response.tool_call_candidates).toEqual([
			{
				call_id: 'call_groq_partial_valid',
				tool_input: {
					path: 'src/example.ts',
				},
				tool_name: 'file.read',
			},
		]);
	});

	it('keeps request-side tool enablement and response-side continuation seam aligned for Groq', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'tool_calls',
						message: {
							content: 'Calling file.read',
							role: 'assistant',
							tool_calls: [
								{
									function: {
										arguments: '{"path":"src/example.ts"}',
										name: 'file.read',
									},
									id: 'call_groq_roundtrip',
									type: 'function',
								},
							],
						},
					},
				],
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		const response = await gateway.generate({
			...groqRequest,
			available_tools: callableToolsRequest,
		});
		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(requestBody.tool_choice).toBe('auto');
		expect(requestBody.tools?.map((tool) => tool.function?.name)).toEqual([
			'file.read',
			'shell.exec',
		]);
		expect(response.message).toEqual({
			content: 'Calling file.read',
			role: 'assistant',
		});
		expect(response.tool_call_candidate).toEqual({
			call_id: 'call_groq_roundtrip',
			tool_input: {
				path: 'src/example.ts',
			},
			tool_name: 'file.read',
		});
	});

	it('keeps Groq tool-enabled text-only responses deterministic', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'No tool needed.',
							role: 'assistant',
						},
					},
				],
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		const response = await gateway.generate({
			...groqRequest,
			available_tools: callableToolsRequest,
		});
		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(requestBody.tool_choice).toBe('auto');
		expect(requestBody.temperature).toBe(0);
		expect(requestBody.tools).toBeDefined();
		expect(response.message).toEqual({
			content: 'No tool needed.',
			role: 'assistant',
		});
		expect(response.tool_call_candidate).toBeUndefined();
	});

	it('rejects an invalid Groq tool call candidate deterministically', async () => {
		installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'tool_calls',
						message: {
							content: null,
							role: 'assistant',
							tool_calls: [
								{
									function: {
										arguments: 'not-json',
										name: 'file.read',
									},
									id: 'call_groq_invalid_tool',
									type: 'function',
								},
							],
						},
					},
				],
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await expect(gateway.generate(groqRequest)).rejects.toThrowError(
			'Groq generate response contained only invalid tool call candidates.',
		);
	});

	it('rejects malformed Groq tool call payloads even when tools were enabled on the request', async () => {
		installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'tool_calls',
						message: {
							content: null,
							role: 'assistant',
							tool_calls: [
								{
									function: {
										arguments: 'not-json',
										name: 'file.read',
									},
									id: 'call_groq_invalid_roundtrip',
									type: 'function',
								},
							],
						},
					},
				],
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await expect(
			gateway.generate({
				...groqRequest,
				available_tools: callableToolsRequest,
			}),
		).rejects.toThrowError('Groq generate response contained only invalid tool call candidates.');
	});

	it('logs structured provider debug context with run and trace correlation when enabled', async () => {
		gatewayTestEnvironment.RUNA_DEBUG_PROVIDER_ERRORS = '1';
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		installFetchMock(
			mockJsonResponse(400, {
				error: {
					message: 'Bad Request',
				},
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await expect(gateway.generate(groqRequest)).rejects.toThrowError(GatewayResponseError);

		const loggedEntries = consoleErrorSpy.mock.calls
			.map(([entry]) => (typeof entry === 'string' ? (JSON.parse(entry) as LoggedEntry) : null))
			.filter((entry): entry is LoggedEntry => entry !== null);
		const providerDebugEntry = loggedEntries.find(
			(entry) => entry.message === 'provider.error.debug',
		);

		expect(providerDebugEntry).toMatchObject({
			component: 'gateway.provider_http',
			level: 'error',
			message: 'provider.error.debug',
			provider: 'groq',
			request_summary: {
				model: 'llama-3.3-70b-versatile',
				run_id: 'run_groq',
				trace_id: 'trace_groq',
			},
			status_code: 400,
		});
	});

	it('streams Groq text deltas and returns a terminal response chunk', async () => {
		const { calls } = installFetchMock(
			mockSseResponse([
				'data: {"id":"chatcmpl_stream_123","model":"llama-3.3-70b-versatile","choices":[{"delta":{"role":"assistant","content":"Hello "},"finish_reason":null}]}',
				'data: {"id":"chatcmpl_stream_123","model":"llama-3.3-70b-versatile","choices":[{"delta":{"content":"from Groq"},"finish_reason":"stop"}],"usage":{"prompt_tokens":8,"completion_tokens":12,"total_tokens":20}}',
				'data: [DONE]',
			]),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		const chunks = [];

		for await (const chunk of gateway.stream(groqRequest)) {
			chunks.push(chunk);
		}

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(requestBody.stream).toBe(true);
		expect(chunks).toEqual([
			{
				text_delta: 'Hello ',
				type: 'text.delta',
			},
			{
				text_delta: 'from Groq',
				type: 'text.delta',
			},
			{
				response: {
					finish_reason: 'stop',
					message: {
						content: 'Hello from Groq',
						role: 'assistant',
					},
					model: 'llama-3.3-70b-versatile',
					provider: 'groq',
					response_id: 'chatcmpl_stream_123',
					usage: {
						input_tokens: 8,
						output_tokens: 12,
						total_tokens: 20,
					},
				},
				type: 'response.completed',
			},
		]);
	});

	it('streams multiple Groq tool calls into additive candidate lists', async () => {
		installFetchMock(
			mockSseResponse([
				'data: {"id":"chatcmpl_stream_tool_123","model":"llama-3.3-70b-versatile","choices":[{"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_stream_groq_1","type":"function","function":{"name":"file.read","arguments":"{\\"path\\":\\"src/example.ts\\"}"}},{"index":1,"id":"call_stream_groq_2","type":"function","function":{"name":"file.read","arguments":"{\\"path\\":\\"docs/vision.md\\"}"}}]},"finish_reason":null}]}',
				'data: {"id":"chatcmpl_stream_tool_123","model":"llama-3.3-70b-versatile","choices":[{"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":8,"completion_tokens":12,"total_tokens":20}}',
				'data: [DONE]',
			]),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		const chunks = [];

		for await (const chunk of gateway.stream(groqRequest)) {
			chunks.push(chunk);
		}

		expect(chunks).toEqual([
			{
				response: {
					finish_reason: 'stop',
					message: {
						content: '',
						role: 'assistant',
					},
					model: 'llama-3.3-70b-versatile',
					provider: 'groq',
					response_id: 'chatcmpl_stream_tool_123',
					tool_call_candidate: {
						call_id: 'call_stream_groq_1',
						tool_input: {
							path: 'src/example.ts',
						},
						tool_name: 'file.read',
					},
					tool_call_candidates: [
						{
							call_id: 'call_stream_groq_1',
							tool_input: {
								path: 'src/example.ts',
							},
							tool_name: 'file.read',
						},
						{
							call_id: 'call_stream_groq_2',
							tool_input: {
								path: 'docs/vision.md',
							},
							tool_name: 'file.read',
						},
					],
					usage: {
						input_tokens: 8,
						output_tokens: 12,
						total_tokens: 20,
					},
				},
				type: 'response.completed',
			},
		]);
	});

	it('maps additive multimodal attachments onto the last Groq user message', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Attachment processed',
							role: 'assistant',
						},
					},
				],
				model: 'llama-3.3-70b-versatile',
			}),
		);
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await gateway.generate({
			...groqRequest,
			attachments: [
				{
					blob_id: 'blob_image_1',
					data_url: 'data:image/png;base64,ZmFrZS1pbWFnZQ==',
					filename: 'capture.png',
					kind: 'image',
					media_type: 'image/png',
					size_bytes: 10,
				},
				{
					blob_id: 'blob_text_1',
					filename: 'notes.txt',
					kind: 'text',
					media_type: 'text/plain',
					size_bytes: 12,
					text_content: 'Merhaba Runa',
				},
				{
					blob_id: 'blob_doc_1',
					filename: 'brief.pdf',
					kind: 'document',
					media_type: 'application/pdf',
					size_bytes: 4096,
					storage_ref: 'blob_doc_1',
				},
			],
		});

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;
		const lastMessageContent = requestBody.messages?.[1]?.content as readonly Record<
			string,
			unknown
		>[];

		expect(Array.isArray(lastMessageContent)).toBe(true);
		expect(lastMessageContent).toEqual([
			{
				text: 'Hello',
				type: 'text',
			},
			{
				image_url: {
					url: 'data:image/png;base64,ZmFrZS1pbWFnZQ==',
				},
				type: 'image_url',
			},
			{
				text: 'Attached text file (notes.txt, text/plain):\nMerhaba Runa',
				type: 'text',
			},
			{
				text: [
					'Attached document artifact (brief.pdf, application/pdf, 4096 bytes).',
					'Storage reference: blob_doc_1.',
					'No document text preview is available in this phase; do not assume the document body was parsed.',
				].join('\n'),
				type: 'text',
			},
		]);
	});
});

describe('ClaudeGateway', () => {
	it('maps the internal request and response shapes for generate()', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				content: [{ text: 'Hello from Claude', type: 'text' }],
				id: 'msg_123',
				model: 'claude-sonnet-4-5',
				role: 'assistant',
				stop_reason: 'end_turn',
				usage: {
					input_tokens: 10,
					output_tokens: 14,
				},
			}),
		);
		const gateway = new ClaudeGateway({ apiKey: 'claude-key' });

		const response = await gateway.generate(claudeRequest);
		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as ClaudeRequestBodyAssertion;

		expect(calls[0]?.url).toBe('https://api.anthropic.com/v1/messages');
		expect(calls[0]?.headers['x-api-key']).toBe('claude-key');
		expect(calls[0]?.headers['anthropic-version']).toBe('2023-06-01');
		expect(requestBody.model).toBe('claude-sonnet-4-5');
		expect(requestBody.max_tokens).toBe(128);
		expect(requestBody.system).toBe('You are helpful.');
		expect(requestBody.messages).toEqual([{ content: 'Hello Claude', role: 'user' }]);
		expect(response).toEqual({
			finish_reason: 'stop',
			message: {
				content: 'Hello from Claude',
				role: 'assistant',
			},
			model: 'claude-sonnet-4-5',
			provider: 'claude',
			response_id: 'msg_123',
			usage: {
				input_tokens: 10,
				output_tokens: 14,
				total_tokens: 24,
			},
		});
		expect(response.tool_call_candidate).toBeUndefined();
	});

	it('includes compiled_context in the Claude system field while keeping conversation messages separate', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				content: [{ text: 'Hello from Claude', type: 'text' }],
				model: 'claude-sonnet-4-5',
				role: 'assistant',
			}),
		);
		const gateway = new ClaudeGateway({ apiKey: 'claude-key' });

		await gateway.generate({
			...claudeRequest,
			compiled_context: compiledContextRequest,
		});

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as ClaudeRequestBodyAssertion;

		expect(requestBody.system).toContain('[core_rules:instruction]');
		expect(requestBody.system).toContain('[run_layer:runtime]');
		expect(requestBody.system?.indexOf('[core_rules:instruction]') ?? -1).toBeLessThan(
			requestBody.system?.indexOf('[run_layer:runtime]') ?? -1,
		);
		expect(requestBody.system).toContain('You are helpful.');
		expect(requestBody.messages).toEqual([{ content: 'Hello Claude', role: 'user' }]);
	});

	it('includes available_tools in the Claude request body when present', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				content: [{ text: 'Hello from Claude', type: 'text' }],
				model: 'claude-sonnet-4-5',
				role: 'assistant',
			}),
		);
		const gateway = new ClaudeGateway({ apiKey: 'claude-key' });

		await gateway.generate({
			...claudeRequest,
			available_tools: callableToolsRequest,
		});

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as ClaudeRequestBodyAssertion;

		expect(requestBody.tools).toEqual([
			{
				description: 'Read a UTF-8 text file from the workspace.',
				input_schema: {
					properties: {
						encoding: {
							description: 'Optional text encoding.',
							type: 'string',
						},
						path: {
							description: 'Path to read.',
							type: 'string',
						},
					},
					required: ['path'],
					type: 'object',
				},
				name: 'file.read',
			},
			{
				description: 'Execute a non-interactive shell command.',
				input_schema: {
					properties: {
						args: {
							description: 'Argument list.',
							items: {
								type: 'string',
							},
							type: 'array',
						},
						command: {
							description: 'Executable to run.',
							type: 'string',
						},
						timeout_ms: {
							description: 'Execution timeout in milliseconds.',
							type: 'number',
						},
					},
					required: ['command'],
					type: 'object',
				},
				name: 'shell.exec',
			},
		]);
	});

	it('turns a non-2xx response into a typed response error', async () => {
		installFetchMock(mockJsonResponse(400, { error: { message: 'Bad Request' } }));
		const gateway = new ClaudeGateway({ apiKey: 'claude-key' });

		await expect(gateway.generate(claudeRequest)).rejects.toThrowError(GatewayResponseError);
	});

	it('maps a Claude tool use block into tool_call_candidate while preserving text', async () => {
		installFetchMock(
			mockJsonResponse(200, {
				content: [
					{ text: 'Calling file.read', type: 'text' },
					{
						id: 'toolu_123',
						input: {
							path: 'src/example.ts',
						},
						name: 'file.read',
						type: 'tool_use',
					},
				],
				id: 'msg_tool_123',
				model: 'claude-sonnet-4-5',
				role: 'assistant',
				stop_reason: 'end_turn',
			}),
		);
		const gateway = new ClaudeGateway({ apiKey: 'claude-key' });

		const response = await gateway.generate(claudeRequest);

		expect(response.message).toEqual({
			content: 'Calling file.read',
			role: 'assistant',
		});
		expect(response.tool_call_candidate).toEqual({
			call_id: 'toolu_123',
			tool_input: {
				path: 'src/example.ts',
			},
			tool_name: 'file.read',
		});
	});

	it('keeps request-side tool enablement and response-side continuation seam aligned for Claude', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				content: [
					{ text: 'Calling file.read', type: 'text' },
					{
						id: 'toolu_roundtrip_123',
						input: {
							path: 'src/example.ts',
						},
						name: 'file.read',
						type: 'tool_use',
					},
				],
				model: 'claude-sonnet-4-5',
				role: 'assistant',
				stop_reason: 'end_turn',
			}),
		);
		const gateway = new ClaudeGateway({ apiKey: 'claude-key' });

		const response = await gateway.generate({
			...claudeRequest,
			available_tools: callableToolsRequest,
		});
		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as ClaudeRequestBodyAssertion;

		expect(requestBody.tools?.map((tool) => tool.name)).toEqual(['file.read', 'shell.exec']);
		expect(response.message).toEqual({
			content: 'Calling file.read',
			role: 'assistant',
		});
		expect(response.tool_call_candidate).toEqual({
			call_id: 'toolu_roundtrip_123',
			tool_input: {
				path: 'src/example.ts',
			},
			tool_name: 'file.read',
		});
	});

	it('keeps Claude tool-enabled text-only responses deterministic', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				content: [{ text: 'No tool needed.', type: 'text' }],
				model: 'claude-sonnet-4-5',
				role: 'assistant',
				stop_reason: 'end_turn',
			}),
		);
		const gateway = new ClaudeGateway({ apiKey: 'claude-key' });

		const response = await gateway.generate({
			...claudeRequest,
			available_tools: callableToolsRequest,
		});
		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as ClaudeRequestBodyAssertion;

		expect(requestBody.tools).toBeDefined();
		expect(response.message).toEqual({
			content: 'No tool needed.',
			role: 'assistant',
		});
		expect(response.tool_call_candidate).toBeUndefined();
	});

	it('rejects an invalid Claude tool call candidate deterministically', async () => {
		installFetchMock(
			mockJsonResponse(200, {
				content: [
					{
						id: 'toolu_invalid_123',
						input: 'not-an-object',
						name: 'file.read',
						type: 'tool_use',
					},
				],
				model: 'claude-sonnet-4-5',
				role: 'assistant',
			}),
		);
		const gateway = new ClaudeGateway({ apiKey: 'claude-key' });

		await expect(gateway.generate(claudeRequest)).rejects.toThrowError(
			'Claude response contained an invalid tool call candidate.',
		);
	});

	it('rejects malformed Claude tool use payloads even when tools were enabled on the request', async () => {
		installFetchMock(
			mockJsonResponse(200, {
				content: [
					{
						id: 'toolu_invalid_roundtrip_123',
						input: 'not-an-object',
						name: 'file.read',
						type: 'tool_use',
					},
				],
				model: 'claude-sonnet-4-5',
				role: 'assistant',
			}),
		);
		const gateway = new ClaudeGateway({ apiKey: 'claude-key' });

		await expect(
			gateway.generate({
				...claudeRequest,
				available_tools: callableToolsRequest,
			}),
		).rejects.toThrowError('Claude response contained an invalid tool call candidate.');
	});

	it('streams Claude text deltas and returns a terminal response chunk', async () => {
		const { calls } = installFetchMock(
			mockSseResponse([
				'event: message_start\ndata: {"message":{"id":"msg_stream_123","model":"claude-sonnet-4-5","usage":{"input_tokens":10}}}',
				'event: content_block_delta\ndata: {"index":0,"delta":{"type":"text_delta","text":"Hello "}}',
				'event: content_block_delta\ndata: {"index":0,"delta":{"type":"text_delta","text":"from Claude"}}',
				'event: message_delta\ndata: {"delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":14}}',
				'event: message_stop\ndata: {}',
			]),
		);
		const gateway = new ClaudeGateway({ apiKey: 'claude-key' });

		const chunks = [];

		for await (const chunk of gateway.stream(claudeRequest)) {
			chunks.push(chunk);
		}

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as ClaudeRequestBodyAssertion;

		expect(requestBody.stream).toBe(true);
		expect(chunks).toEqual([
			{
				text_delta: 'Hello ',
				type: 'text.delta',
			},
			{
				text_delta: 'from Claude',
				type: 'text.delta',
			},
			{
				response: {
					finish_reason: 'stop',
					message: {
						content: 'Hello from Claude',
						role: 'assistant',
					},
					model: 'claude-sonnet-4-5',
					provider: 'claude',
					response_id: 'msg_stream_123',
					usage: {
						input_tokens: 10,
						output_tokens: 14,
						total_tokens: 24,
					},
				},
				type: 'response.completed',
			},
		]);
	});

	it('maps additive multimodal attachments onto the last Claude user message', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				content: [{ text: 'Hello from Claude', type: 'text' }],
				model: 'claude-sonnet-4-5',
				role: 'assistant',
			}),
		);
		const gateway = new ClaudeGateway({ apiKey: 'claude-key' });

		await gateway.generate({
			...claudeRequest,
			attachments: [
				{
					blob_id: 'blob_image_1',
					data_url: 'data:image/png;base64,ZmFrZS1pbWFnZQ==',
					filename: 'capture.png',
					kind: 'image',
					media_type: 'image/png',
					size_bytes: 10,
				},
				{
					blob_id: 'blob_text_1',
					filename: 'notes.txt',
					kind: 'text',
					media_type: 'text/plain',
					size_bytes: 12,
					text_content: 'Merhaba Runa',
				},
			],
		});

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as ClaudeRequestBodyAssertion;
		const lastMessageContent = requestBody.messages?.[0]?.content as readonly Record<
			string,
			unknown
		>[];

		expect(lastMessageContent).toEqual([
			{
				text: 'Hello Claude',
				type: 'text',
			},
			{
				source: {
					data: 'ZmFrZS1pbWFnZQ==',
					media_type: 'image/png',
					type: 'base64',
				},
				type: 'image',
			},
			{
				text: 'Attached text file (notes.txt, text/plain):\nMerhaba Runa',
				type: 'text',
			},
		]);
	});
});

describe('OpenAiGateway', () => {
	it('maps the internal request and response shapes for generate()', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Hello from OpenAI',
							role: 'assistant',
						},
					},
				],
				id: 'chatcmpl_openai_123',
				model: 'gpt-4.1-mini',
				usage: {
					completion_tokens: 9,
					prompt_tokens: 7,
					total_tokens: 16,
				},
			}),
		);
		const gateway = new OpenAiGateway({ apiKey: 'openai-key' });

		const response = await gateway.generate(openAiRequest);
		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(calls[0]?.url).toBe('https://api.openai.com/v1/chat/completions');
		expect(calls[0]?.headers.Authorization).toBe('Bearer openai-key');
		expect(requestBody.model).toBe('gpt-4.1-mini');
		expect(requestBody.max_completion_tokens).toBe(96);
		expect(requestBody.messages).toEqual([
			{ content: 'You are helpful.', role: 'system' },
			{ content: 'Hello OpenAI', role: 'user' },
		]);
		expect(response).toEqual({
			finish_reason: 'stop',
			message: {
				content: 'Hello from OpenAI',
				role: 'assistant',
			},
			model: 'gpt-4.1-mini',
			provider: 'openai',
			response_id: 'chatcmpl_openai_123',
			usage: {
				input_tokens: 7,
				output_tokens: 9,
				total_tokens: 16,
			},
		});
	});

	it('includes available_tools and tool call parsing for generate()', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'tool_calls',
						message: {
							content: null,
							role: 'assistant',
							tool_calls: [
								{
									function: {
										arguments: '{"path":"README.md"}',
										name: 'file.read',
									},
									id: 'call_openai_tool',
									type: 'function',
								},
							],
						},
					},
				],
				id: 'chatcmpl_openai_tool',
				model: 'gpt-4.1-mini',
			}),
		);
		const gateway = new OpenAiGateway({ apiKey: 'openai-key' });

		const response = await gateway.generate({
			...openAiRequest,
			available_tools: callableToolsRequest,
		});
		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(requestBody.tool_choice).toBe('auto');
		expect(requestBody.tools?.map((tool) => tool.function?.name)).toEqual([
			'file.read',
			'shell.exec',
		]);
		expect(response.tool_call_candidate).toEqual({
			call_id: 'call_openai_tool',
			tool_input: {
				path: 'README.md',
			},
			tool_name: 'file.read',
		});
	});

	it('streams OpenAI text deltas and returns a terminal response chunk', async () => {
		const { calls } = installFetchMock(
			mockSseResponse([
				'data: {"id":"chatcmpl_openai_stream","model":"gpt-4.1-mini","choices":[{"delta":{"role":"assistant","content":"Hello "},"finish_reason":null}]}',
				'data: {"id":"chatcmpl_openai_stream","model":"gpt-4.1-mini","choices":[{"delta":{"content":"from OpenAI"},"finish_reason":"stop"}],"usage":{"prompt_tokens":7,"completion_tokens":9,"total_tokens":16}}',
				'data: [DONE]',
			]),
		);
		const gateway = new OpenAiGateway({ apiKey: 'openai-key' });

		const chunks = [];

		for await (const chunk of gateway.stream(openAiRequest)) {
			chunks.push(chunk);
		}

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(requestBody.stream).toBe(true);
		expect(chunks).toEqual([
			{
				text_delta: 'Hello ',
				type: 'text.delta',
			},
			{
				text_delta: 'from OpenAI',
				type: 'text.delta',
			},
			{
				response: {
					finish_reason: 'stop',
					message: {
						content: 'Hello from OpenAI',
						role: 'assistant',
					},
					model: 'gpt-4.1-mini',
					provider: 'openai',
					response_id: 'chatcmpl_openai_stream',
					usage: {
						input_tokens: 7,
						output_tokens: 9,
						total_tokens: 16,
					},
				},
				type: 'response.completed',
			},
		]);
	});

	it('maps additive multimodal attachments onto the last OpenAI user message', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Hello from OpenAI',
							role: 'assistant',
						},
					},
				],
				id: 'chatcmpl_openai_123',
				model: 'gpt-4.1-mini',
			}),
		);
		const gateway = new OpenAiGateway({ apiKey: 'openai-key' });

		await gateway.generate({
			...openAiRequest,
			attachments: [
				{
					blob_id: 'blob_image_1',
					data_url: 'data:image/png;base64,ZmFrZS1pbWFnZQ==',
					filename: 'capture.png',
					kind: 'image',
					media_type: 'image/png',
					size_bytes: 10,
				},
				{
					blob_id: 'blob_text_1',
					filename: 'notes.txt',
					kind: 'text',
					media_type: 'text/plain',
					size_bytes: 12,
					text_content: 'Merhaba Runa',
				},
			],
		});

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;
		const lastMessageContent = requestBody.messages?.[1]?.content as readonly Record<
			string,
			unknown
		>[];

		expect(lastMessageContent).toEqual([
			{
				text: 'Hello OpenAI',
				type: 'text',
			},
			{
				image_url: {
					url: 'data:image/png;base64,ZmFrZS1pbWFnZQ==',
				},
				type: 'image_url',
			},
			{
				text: 'Attached text file (notes.txt, text/plain):\nMerhaba Runa',
				type: 'text',
			},
		]);
	});
});

describe('GeminiGateway', () => {
	it('maps the internal request and response shapes for generate()', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Hello from Gemini',
							role: 'assistant',
						},
					},
				],
				id: 'chatcmpl_gemini_123',
				model: 'gemini-3-flash-preview',
				usage: {
					completion_tokens: 11,
					prompt_tokens: 6,
					total_tokens: 17,
				},
			}),
		);
		const gateway = new GeminiGateway({ apiKey: 'gemini-key' });

		const response = await gateway.generate(geminiRequest);
		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(calls[0]?.url).toBe(
			'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
		);
		expect(calls[0]?.headers.Authorization).toBe('Bearer gemini-key');
		expect(requestBody.model).toBe('gemini-3-flash-preview');
		expect(requestBody.max_completion_tokens).toBe(96);
		expect(requestBody.messages).toEqual([
			{ content: 'You are helpful.', role: 'system' },
			{ content: 'Hello Gemini', role: 'user' },
		]);
		expect(response).toEqual({
			finish_reason: 'stop',
			message: {
				content: 'Hello from Gemini',
				role: 'assistant',
			},
			model: 'gemini-3-flash-preview',
			provider: 'gemini',
			response_id: 'chatcmpl_gemini_123',
			usage: {
				input_tokens: 6,
				output_tokens: 11,
				total_tokens: 17,
			},
		});
	});

	it('includes available_tools and tool call parsing for generate()', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'tool_calls',
						message: {
							content: null,
							role: 'assistant',
							tool_calls: [
								{
									function: {
										arguments: '{"path":"README.md"}',
										name: 'file.read',
									},
									id: 'call_gemini_tool',
									type: 'function',
								},
							],
						},
					},
				],
				id: 'chatcmpl_gemini_tool',
				model: 'gemini-3-flash-preview',
			}),
		);
		const gateway = new GeminiGateway({ apiKey: 'gemini-key' });

		const response = await gateway.generate({
			...geminiRequest,
			available_tools: callableToolsRequest,
		});
		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(requestBody.tool_choice).toBe('auto');
		expect(requestBody.tools?.map((tool) => tool.function?.name)).toEqual([
			'file.read',
			'shell.exec',
		]);
		expect(response.tool_call_candidate).toEqual({
			call_id: 'call_gemini_tool',
			tool_input: {
				path: 'README.md',
			},
			tool_name: 'file.read',
		});
	});

	it('streams Gemini text deltas and returns a terminal response chunk', async () => {
		const { calls } = installFetchMock(
			mockSseResponse([
				'data: {"id":"chatcmpl_gemini_stream","model":"gemini-3-flash-preview","choices":[{"delta":{"role":"assistant","content":"Hello "},"finish_reason":null}]}',
				'data: {"id":"chatcmpl_gemini_stream","model":"gemini-3-flash-preview","choices":[{"delta":{"content":"from Gemini"},"finish_reason":"stop"}],"usage":{"prompt_tokens":6,"completion_tokens":11,"total_tokens":17}}',
				'data: [DONE]',
			]),
		);
		const gateway = new GeminiGateway({ apiKey: 'gemini-key' });

		const chunks = [];

		for await (const chunk of gateway.stream(geminiRequest)) {
			chunks.push(chunk);
		}

		const requestBody = JSON.parse(calls[0]?.body ?? '{}') as GroqRequestBodyAssertion;

		expect(requestBody.stream).toBe(true);
		expect(chunks).toEqual([
			{
				text_delta: 'Hello ',
				type: 'text.delta',
			},
			{
				text_delta: 'from Gemini',
				type: 'text.delta',
			},
			{
				response: {
					finish_reason: 'stop',
					message: {
						content: 'Hello from Gemini',
						role: 'assistant',
					},
					model: 'gemini-3-flash-preview',
					provider: 'gemini',
					response_id: 'chatcmpl_gemini_stream',
					usage: {
						input_tokens: 6,
						output_tokens: 11,
						total_tokens: 17,
					},
				},
				type: 'response.completed',
			},
		]);
	});
});
