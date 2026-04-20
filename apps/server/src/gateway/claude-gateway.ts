import type { ModelGateway, ModelRequest, ModelResponse, ModelStreamChunk } from '@runa/types';

import { formatCompiledContext } from './compiled-context.js';
import {
	GatewayConfigurationError,
	GatewayRequestError,
	GatewayResponseError,
	GatewayUnsupportedOperationError,
} from './errors.js';
import { postJson } from './provider-http.js';
import type { GatewayProviderConfig } from './providers.js';
import { buildToolJsonSchema } from './request-tools.js';
import { parseToolCallCandidateParts } from './tool-call-candidate.js';

interface ClaudeMessageRequest {
	readonly content: string;
	readonly role: 'assistant' | 'user';
}

function isClaudeConversationMessage(
	message: ModelRequest['messages'][number],
): message is ModelRequest['messages'][number] & ClaudeMessageRequest {
	return message.role === 'assistant' || message.role === 'user';
}

interface ClaudeMessagesRequest {
	readonly max_tokens: number;
	readonly messages: readonly ClaudeMessageRequest[];
	readonly model: string;
	readonly system?: string;
	readonly temperature?: number;
	readonly tools?: ReadonlyArray<{
		readonly description: string;
		readonly input_schema: ReturnType<typeof buildToolJsonSchema>;
		readonly name: string;
	}>;
}

interface ClaudeMessagesResponse {
	readonly content?: ReadonlyArray<{
		readonly id?: unknown;
		readonly input?: unknown;
		readonly name?: unknown;
		readonly text?: string;
		readonly type?: string;
	}>;
	readonly id?: string;
	readonly model?: string;
	readonly role?: string;
	readonly stop_reason?: string | null;
	readonly usage?: {
		readonly input_tokens?: number;
		readonly output_tokens?: number;
	};
}

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

function mapClaudeFinishReason(stopReason?: string | null): ModelResponse['finish_reason'] {
	switch (stopReason) {
		case 'max_tokens':
			return 'max_tokens';
		case 'end_turn':
		case 'stop_sequence':
			return 'stop';
		default:
			return 'error';
	}
}

function buildClaudeRequestBody(
	config: GatewayProviderConfig,
	request: ModelRequest,
): ClaudeMessagesRequest {
	const model = request.model ?? config.defaultModel;
	const maxTokens = request.max_output_tokens ?? config.defaultMaxOutputTokens;
	const compiledContext = formatCompiledContext(request.compiled_context);
	const systemMessages = request.messages
		.filter((message) => message.role === 'system')
		.map((message) => message.content);
	const conversationMessages = request.messages
		.filter(isClaudeConversationMessage)
		.map((message) => ({
			content: message.content,
			role: message.role,
		})) satisfies ClaudeMessageRequest[];

	if (!model) {
		throw new GatewayConfigurationError(
			'Claude gateway requires a model in the request or config.',
		);
	}

	if (!maxTokens) {
		throw new GatewayConfigurationError(
			'Claude gateway requires max_output_tokens in the request or a defaultMaxOutputTokens config value.',
		);
	}

	if (conversationMessages.length === 0) {
		throw new GatewayRequestError(
			'claude',
			'Claude Messages API requires at least one non-system message.',
		);
	}

	return {
		max_tokens: maxTokens,
		messages: conversationMessages,
		model,
		system:
			compiledContext || systemMessages.length > 0
				? [compiledContext, ...systemMessages]
						.filter((message): message is string => typeof message === 'string')
						.join('\n\n')
				: undefined,
		temperature: request.temperature,
		tools:
			request.available_tools && request.available_tools.length > 0
				? request.available_tools.map((tool) => ({
						description: tool.description,
						input_schema: buildToolJsonSchema(tool),
						name: tool.name,
					}))
				: undefined,
	};
}

function parseClaudeToolCallCandidate(
	response: ClaudeMessagesResponse,
): ModelResponse['tool_call_candidate'] {
	const toolUseBlock = response.content?.find((block) => block.type === 'tool_use');

	if (!toolUseBlock) {
		return undefined;
	}

	const candidate = parseToolCallCandidateParts({
		call_id: toolUseBlock.id,
		tool_input: toolUseBlock.input,
		tool_name: toolUseBlock.name,
	});

	if (!candidate) {
		throw new GatewayResponseError(
			'claude',
			'Claude response contained an invalid tool call candidate.',
		);
	}

	return candidate;
}

function parseClaudeResponse(payload: unknown): ModelResponse {
	if (!payload || typeof payload !== 'object') {
		throw new GatewayResponseError('claude', 'Claude response must be an object.');
	}

	const response = payload as ClaudeMessagesResponse;
	const toolCallCandidate = parseClaudeToolCallCandidate(response);
	const textContent = response.content
		?.filter((block) => block.type === 'text' && typeof block.text === 'string')
		.map((block) => block.text)
		.join('\n');
	const messageContent = textContent ?? (toolCallCandidate !== undefined ? '' : undefined);

	if (!response.model || response.role !== 'assistant' || messageContent === undefined) {
		throw new GatewayResponseError(
			'claude',
			'Claude response did not contain a valid assistant text message.',
		);
	}

	const inputTokens = response.usage?.input_tokens;
	const outputTokens = response.usage?.output_tokens;
	const totalTokens =
		typeof inputTokens === 'number' && typeof outputTokens === 'number'
			? inputTokens + outputTokens
			: undefined;

	return {
		finish_reason: mapClaudeFinishReason(response.stop_reason),
		message: {
			content: messageContent,
			role: 'assistant',
		},
		model: response.model,
		provider: 'claude',
		response_id: response.id,
		tool_call_candidate: toolCallCandidate,
		usage: {
			input_tokens: inputTokens,
			output_tokens: outputTokens,
			total_tokens: totalTokens,
		},
	};
}

export class ClaudeGateway implements ModelGateway {
	readonly provider = 'claude';
	readonly #config: GatewayProviderConfig;

	constructor(config: GatewayProviderConfig) {
		this.#config = config;
	}

	async generate(request: ModelRequest): Promise<ModelResponse> {
		const payload = await postJson({
			body: buildClaudeRequestBody(this.#config, request),
			headers: {
				'anthropic-version': ANTHROPIC_VERSION,
				'x-api-key': this.#config.apiKey,
			},
			provider: this.provider,
			url: ANTHROPIC_MESSAGES_URL,
		});

		return parseClaudeResponse(payload);
	}

	stream(_request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		throw new GatewayUnsupportedOperationError(
			this.provider,
			'stream',
			'Claude streaming is not implemented in this task.',
		);
	}
}
