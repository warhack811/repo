import type { ModelGateway, ModelRequest, ModelResponse, ModelStreamChunk } from '@runa/types';

import { formatCompiledContext } from './compiled-context.js';
import {
	GatewayConfigurationError,
	GatewayResponseError,
	GatewayUnsupportedOperationError,
} from './errors.js';
import { postJson } from './provider-http.js';
import type { GatewayProviderConfig } from './providers.js';
import { buildToolJsonSchema } from './request-tools.js';
import { parseToolCallCandidateParts } from './tool-call-candidate.js';

interface GroqChatCompletionRequest {
	readonly max_completion_tokens?: number;
	readonly messages: ReadonlyArray<{
		readonly content: string;
		readonly role: 'assistant' | 'system' | 'user';
	}>;
	readonly model: string;
	readonly temperature?: number;
	readonly tool_choice?: 'auto';
	readonly tools?: ReadonlyArray<{
		readonly function: {
			readonly description: string;
			readonly name: string;
			readonly parameters: ReturnType<typeof buildToolJsonSchema>;
		};
		readonly type: 'function';
	}>;
}

interface GroqChatCompletionResponse {
	readonly choices: ReadonlyArray<{
		readonly finish_reason?: string | null;
		readonly message?: {
			readonly content?: string | null;
			readonly role?: string;
			readonly tool_calls?: ReadonlyArray<{
				readonly function?: {
					readonly arguments?: unknown;
					readonly name?: unknown;
				};
				readonly id?: unknown;
				readonly type?: string;
			}>;
		};
	}>;
	readonly id?: string;
	readonly model?: string;
	readonly usage?: {
		readonly completion_tokens?: number;
		readonly prompt_tokens?: number;
		readonly total_tokens?: number;
	};
}

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';

function mapGroqFinishReason(finishReason?: string | null): ModelResponse['finish_reason'] {
	switch (finishReason) {
		case 'length':
			return 'max_tokens';
		case 'stop':
		case 'tool_calls':
			return 'stop';
		default:
			return 'error';
	}
}

function buildGroqRequestBody(
	config: GatewayProviderConfig,
	request: ModelRequest,
): GroqChatCompletionRequest {
	const model = request.model ?? config.defaultModel;
	const compiledContext = formatCompiledContext(request.compiled_context);

	if (!model) {
		throw new GatewayConfigurationError('Groq gateway requires a model in the request or config.');
	}

	return {
		max_completion_tokens: request.max_output_tokens,
		messages: [
			...(compiledContext
				? [
						{
							content: compiledContext,
							role: 'system' as const,
						},
					]
				: []),
			...request.messages.map((message) => ({
				content: message.content,
				role: message.role,
			})),
		],
		model,
		temperature: request.temperature,
		tool_choice: request.available_tools && request.available_tools.length > 0 ? 'auto' : undefined,
		tools:
			request.available_tools && request.available_tools.length > 0
				? request.available_tools.map((tool) => ({
						function: {
							description: tool.description,
							name: tool.name,
							parameters: buildToolJsonSchema(tool),
						},
						type: 'function' as const,
					}))
				: undefined,
	};
}

function buildGroqDebugContext(
	request: ModelRequest,
	requestBody: GroqChatCompletionRequest,
): Readonly<{
	readonly compiled_context_chars: number;
	readonly has_compiled_context: boolean;
	readonly max_output_tokens?: number;
	readonly message_count: number;
	readonly message_roles: readonly string[];
	readonly model: string;
	readonly tool_count: number;
	readonly tool_names: readonly string[];
}> {
	const compiledContext = formatCompiledContext(request.compiled_context);

	return {
		compiled_context_chars: compiledContext?.length ?? 0,
		has_compiled_context: request.compiled_context !== undefined,
		max_output_tokens: request.max_output_tokens,
		message_count: requestBody.messages.length,
		message_roles: requestBody.messages.map((message) => message.role),
		model: requestBody.model,
		tool_count: requestBody.tools?.length ?? 0,
		tool_names: request.available_tools?.map((tool) => tool.name) ?? [],
	};
}

function parseGroqToolCallCandidate(
	response: GroqChatCompletionResponse,
): ModelResponse['tool_call_candidate'] {
	const firstToolCall = response.choices?.[0]?.message?.tool_calls?.[0];

	if (!firstToolCall) {
		return undefined;
	}

	const candidate = parseToolCallCandidateParts({
		call_id: firstToolCall.id,
		tool_input: firstToolCall.function?.arguments,
		tool_name: firstToolCall.function?.name,
	});

	if (!candidate) {
		throw new GatewayResponseError(
			'groq',
			'Groq response contained an invalid tool call candidate.',
		);
	}

	return candidate;
}

function parseGroqResponse(payload: unknown): ModelResponse {
	if (!payload || typeof payload !== 'object') {
		throw new GatewayResponseError('groq', 'Groq response must be an object.');
	}

	const response = payload as GroqChatCompletionResponse;
	const choice = response.choices?.[0];
	const content = choice?.message?.content;
	const role = choice?.message?.role;
	const toolCallCandidate = parseGroqToolCallCandidate(response);
	const messageContent =
		typeof content === 'string' ? content : toolCallCandidate !== undefined ? '' : undefined;

	if (!response.model || !choice || typeof messageContent !== 'string' || role !== 'assistant') {
		throw new GatewayResponseError(
			'groq',
			'Groq response did not contain a valid assistant message.',
		);
	}

	return {
		finish_reason: mapGroqFinishReason(choice.finish_reason),
		message: {
			content: messageContent,
			role: 'assistant',
		},
		model: response.model,
		provider: 'groq',
		response_id: response.id,
		tool_call_candidate: toolCallCandidate,
		usage: {
			input_tokens: response.usage?.prompt_tokens,
			output_tokens: response.usage?.completion_tokens,
			total_tokens: response.usage?.total_tokens,
		},
	};
}

export class GroqGateway implements ModelGateway {
	readonly provider = 'groq';
	readonly #config: GatewayProviderConfig;

	constructor(config: GatewayProviderConfig) {
		this.#config = config;
	}

	async generate(request: ModelRequest): Promise<ModelResponse> {
		const requestBody = buildGroqRequestBody(this.#config, request);

		try {
			const payload = await postJson({
				body: requestBody,
				debug_context: buildGroqDebugContext(request, requestBody),
				headers: {
					Authorization: `Bearer ${this.#config.apiKey}`,
				},
				provider: this.provider,
				url: GROQ_CHAT_COMPLETIONS_URL,
			});

			return parseGroqResponse(payload);
		} catch (error: unknown) {
			const err = error as Record<string, unknown>;
			// biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
			console.error('[Groq Error Details]:', err?.['response'] || err?.['message'] || error);
			throw error;
		}
	}

	stream(_request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		throw new GatewayUnsupportedOperationError(
			this.provider,
			'stream',
			'Groq streaming is not implemented in this task.',
		);
	}
}
