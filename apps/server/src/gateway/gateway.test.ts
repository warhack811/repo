import type { ModelRequest } from '@runa/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClaudeGateway } from './claude-gateway.js';
import {
	GatewayConfigurationError,
	GatewayResponseError,
	GatewayUnsupportedOperationError,
} from './errors.js';
import { createModelGateway } from './factory.js';
import { GroqGateway } from './groq-gateway.js';

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
	readonly max_completion_tokens?: number;
	readonly messages?: ReadonlyArray<{
		readonly content: string;
		readonly role: string;
	}>;
	readonly model?: string;
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
				>;
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
		readonly content: string;
		readonly role: string;
	}>;
	readonly model?: string;
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
});

describe('gateway factory', () => {
	it('returns a Groq gateway for the groq provider', () => {
		const gateway = createModelGateway({
			config: {
				apiKey: 'groq-key',
			},
			provider: 'groq',
		});

		expect(gateway).toBeInstanceOf(GroqGateway);
	});

	it('returns a Claude gateway for the claude provider', () => {
		const gateway = createModelGateway({
			config: {
				apiKey: 'claude-key',
			},
			provider: 'claude',
		});

		expect(gateway).toBeInstanceOf(ClaudeGateway);
	});

	it('throws a typed error when config is missing an api key', () => {
		expect(() =>
			createModelGateway({
				config: {
					apiKey: '   ',
				},
				provider: 'groq',
			}),
		).toThrowError(GatewayConfigurationError);
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

		expect(compiledContextMessage?.role).toBe('system');
		expect(compiledContextMessage?.content).toContain('[core_rules:instruction]');
		expect(compiledContextMessage?.content).toContain('[run_layer:runtime]');
		expect(compiledContextMessage?.content.indexOf('[core_rules:instruction]') ?? -1).toBeLessThan(
			compiledContextMessage?.content.indexOf('[run_layer:runtime]') ?? -1,
		);
		expect(requestBody.messages?.slice(1)).toEqual([
			{ content: 'You are helpful.', role: 'system' },
			{ content: 'Hello', role: 'user' },
		]);
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

	it('turns a non-2xx response into a typed response error', async () => {
		installFetchMock(mockJsonResponse(401, { error: { message: 'Unauthorized' } }));
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await expect(gateway.generate(groqRequest)).rejects.toThrowError(GatewayResponseError);
	});

	it('logs non-2xx Groq details to stderr only when debug env is enabled', async () => {
		const environment = process.env as NodeJS.ProcessEnv & {
			RUNA_DEBUG_PROVIDER_ERRORS?: string;
		};

		environment.RUNA_DEBUG_PROVIDER_ERRORS = '1';
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

		expect(consoleErrorSpy).toHaveBeenCalledWith('[provider.error.debug]', {
			provider: 'groq',
			request_summary: {
				compiled_context_chars: expect.any(Number),
				has_compiled_context: true,
				max_output_tokens: 64,
				message_count: 3,
				message_roles: ['system', 'system', 'user'],
				model: 'llama-3.3-70b-versatile',
				tool_count: 2,
				tool_names: ['file.read', 'shell.exec'],
			},
			response_body: JSON.stringify({ error: { message: 'Invalid model' } }),
			status_code: 400,
		});
		environment.RUNA_DEBUG_PROVIDER_ERRORS = undefined;
	});

	it('keeps Groq non-2xx stderr logging silent by default', async () => {
		installFetchMock(mockJsonResponse(400, { error: { message: 'Invalid model' } }));
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		await expect(gateway.generate(groqRequest)).rejects.toThrowError(GatewayResponseError);

		expect(consoleErrorSpy).not.toHaveBeenCalled();
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
			'Groq response contained an invalid tool call candidate.',
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
		).rejects.toThrowError('Groq response contained an invalid tool call candidate.');
	});

	it('keeps streaming as an explicit unsupported operation', () => {
		const gateway = new GroqGateway({ apiKey: 'groq-key' });

		expect(() => gateway.stream(groqRequest)).toThrowError(GatewayUnsupportedOperationError);
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

	it('keeps streaming as an explicit unsupported operation', () => {
		const gateway = new ClaudeGateway({ apiKey: 'claude-key' });

		expect(() => gateway.stream(claudeRequest)).toThrowError(GatewayUnsupportedOperationError);
	});
});
