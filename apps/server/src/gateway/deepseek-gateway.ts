import type {
	ModelAttachment,
	ModelGateway,
	ModelRequest,
	ModelResponse,
	ModelStreamChunk,
} from '@runa/types';

import { describeAttachmentForTextPart } from './attachment-text.js';
import { formatCompiledContext } from './compiled-context.js';
import { GatewayConfigurationError, GatewayRequestError, GatewayResponseError } from './errors.js';
import { postJson } from './provider-http.js';
import type { GatewayProviderConfig } from './providers.js';
import { serializeCallableTool } from './request-tools.js';
import { parseToolCallCandidateParts } from './tool-call-candidate.js';

type DeepSeekThinkingType = 'disabled' | 'enabled';
type DeepSeekReasoningEffort = 'high' | 'max';

interface DeepSeekMetadataContainer {
	readonly deepseek?: unknown;
}

interface DeepSeekMetadataCandidate {
	readonly reasoning_effort?: unknown;
	readonly thinking?: unknown;
}

interface DeepSeekChatCompletionRequest {
	readonly max_tokens?: number;
	readonly messages: ReadonlyArray<{
		readonly content: string;
		readonly role: 'assistant' | 'system' | 'user';
	}>;
	readonly model: string;
	readonly reasoning_effort?: DeepSeekReasoningEffort;
	readonly stream?: boolean;
	readonly temperature?: number;
	readonly thinking?: {
		readonly type: DeepSeekThinkingType;
	};
	readonly tool_choice?: 'auto';
	readonly tools?: ReadonlyArray<{
		readonly function: ReturnType<typeof serializeCallableTool>;
		readonly type: 'function';
	}>;
}

interface DeepSeekChatCompletionResponse {
	readonly choices: ReadonlyArray<{
		readonly finish_reason?: string | null;
		readonly message?: {
			readonly content?: string | null;
			readonly reasoning_content?: string | null;
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

type DeepSeekResponseToolCall = NonNullable<
	NonNullable<DeepSeekChatCompletionResponse['choices'][number]['message']>['tool_calls']
>[number];

interface DeepSeekStreamChoiceDeltaToolCall {
	readonly function?: {
		readonly arguments?: string;
		readonly name?: string;
	};
	readonly id?: string;
	readonly index?: number;
	readonly type?: string;
}

interface DeepSeekChatCompletionStreamChunk {
	readonly choices?: ReadonlyArray<{
		readonly delta?: {
			readonly content?: string | null;
			readonly reasoning_content?: string | null;
			readonly role?: string;
			readonly tool_calls?: readonly DeepSeekStreamChoiceDeltaToolCall[];
		};
		readonly finish_reason?: string | null;
	}>;
	readonly id?: string;
	readonly model?: string;
	readonly usage?: {
		readonly completion_tokens?: number;
		readonly prompt_tokens?: number;
		readonly total_tokens?: number;
	};
}

interface DeepSeekToolCallAccumulator {
	arguments_text: string;
	call_id?: string;
	tool_name?: string;
}

const DEEPSEEK_CHAT_COMPLETIONS_URL = 'https://api.deepseek.com/chat/completions';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readDeepSeekMetadata(request: ModelRequest): DeepSeekMetadataCandidate | null {
	const metadata = request.metadata as DeepSeekMetadataContainer | undefined;
	const deepSeekMetadata = metadata?.deepseek;

	return isRecord(deepSeekMetadata) ? deepSeekMetadata : null;
}

function isDeepSeekThinkingType(value: unknown): value is DeepSeekThinkingType {
	return value === 'disabled' || value === 'enabled';
}

function isDeepSeekReasoningEffort(value: unknown): value is DeepSeekReasoningEffort {
	return value === 'high' || value === 'max';
}

function resolveThinkingType(request: ModelRequest, model: string): DeepSeekThinkingType {
	const metadataThinking = readDeepSeekMetadata(request)?.thinking;

	if (isDeepSeekThinkingType(metadataThinking)) {
		return metadataThinking;
	}

	return model === 'deepseek-v4-pro' ? 'enabled' : 'disabled';
}

function resolveReasoningEffort(request: ModelRequest): DeepSeekReasoningEffort {
	const metadataReasoningEffort = readDeepSeekMetadata(request)?.reasoning_effort;

	return isDeepSeekReasoningEffort(metadataReasoningEffort) ? metadataReasoningEffort : 'high';
}

function assertSupportedAttachments(request: ModelRequest): void {
	const imageAttachment = request.attachments?.find((attachment) => attachment.kind === 'image');

	if (!imageAttachment) {
		return;
	}

	throw new GatewayRequestError(
		'deepseek',
		'DeepSeek gateway currently supports text/document attachments only; image attachments require a validated vision-capable provider.',
	);
}

function buildAttachmentText(attachments: readonly ModelAttachment[]): string {
	const textAttachments = attachments.filter(
		(attachment): attachment is Exclude<ModelAttachment, { readonly kind: 'image' }> =>
			attachment.kind !== 'image',
	);

	return textAttachments
		.map((attachment) => describeAttachmentForTextPart(attachment))
		.join('\n\n');
}

function appendAttachmentsToLastUserMessage(
	request: ModelRequest,
): DeepSeekChatCompletionRequest['messages'] {
	const attachments = request.attachments ?? [];
	const attachmentText = buildAttachmentText(attachments);
	const lastUserMessageIndex = [...request.messages]
		.map((message, index) => ({ index, role: message.role }))
		.reverse()
		.find((entry) => entry.role === 'user')?.index;

	return request.messages.map((message, index) => ({
		content:
			lastUserMessageIndex === index && attachmentText.length > 0
				? [message.content, attachmentText].filter((part) => part.trim().length > 0).join('\n\n')
				: message.content,
		role: message.role,
	}));
}

function mapDeepSeekFinishReason(finishReason?: string | null): ModelResponse['finish_reason'] {
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

function buildDebugContext(request: ModelRequest): Parameters<typeof postJson>[0]['debug_context'] {
	const compiledContext = formatCompiledContext(request.compiled_context) ?? '';

	return {
		compiled_context_chars: compiledContext.length,
		has_compiled_context: request.compiled_context !== undefined,
		max_output_tokens: request.max_output_tokens,
		message_count: request.messages.length,
		message_roles: request.messages.map((message) => message.role),
		model: request.model,
		requested_tool_names: request.available_tools?.map((tool) => tool.name),
		run_id: request.run_id,
		trace_id: request.trace_id,
		tool_count: request.available_tools?.length ?? 0,
		tool_names: request.available_tools?.map((tool) => tool.name),
	};
}

function buildDeepSeekRequestBody(
	config: GatewayProviderConfig,
	request: ModelRequest,
): DeepSeekChatCompletionRequest {
	assertSupportedAttachments(request);

	const model = request.model ?? config.defaultModel;
	const compiledContext = formatCompiledContext(request.compiled_context);
	const tools = request.available_tools?.map((tool) => ({
		function: serializeCallableTool(tool),
		type: 'function' as const,
	}));

	if (!model) {
		throw new GatewayConfigurationError(
			'DeepSeek gateway requires a model in the request or config.',
		);
	}

	const thinkingType = resolveThinkingType(request, model);

	return {
		max_tokens: request.max_output_tokens,
		messages: [
			...(compiledContext
				? [
						{
							content: compiledContext,
							role: 'system' as const,
						},
					]
				: []),
			...appendAttachmentsToLastUserMessage(request),
		],
		model,
		reasoning_effort: thinkingType === 'enabled' ? resolveReasoningEffort(request) : undefined,
		temperature: request.temperature ?? (tools && tools.length > 0 ? 0 : undefined),
		thinking: {
			type: thinkingType,
		},
		tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
		tools,
	};
}

function parseDeepSeekToolCallCandidates(
	toolCalls: readonly DeepSeekResponseToolCall[] | undefined,
): Pick<ModelResponse, 'tool_call_candidate' | 'tool_call_candidates'> {
	const candidates = [...(toolCalls ?? [])].map((toolCall) => {
		const candidate = parseToolCallCandidateParts({
			call_id: toolCall.id,
			tool_input: toolCall.function?.arguments,
			tool_name: toolCall.function?.name,
		});

		if (!candidate) {
			throw new GatewayResponseError(
				'deepseek',
				'DeepSeek response contained an invalid tool call candidate.',
			);
		}

		return candidate;
	});

	return {
		tool_call_candidate: candidates[0],
		tool_call_candidates: candidates.length > 1 ? candidates : undefined,
	};
}

function parseDeepSeekResponse(payload: unknown): ModelResponse {
	if (!payload || typeof payload !== 'object') {
		throw new GatewayResponseError('deepseek', 'DeepSeek response must be an object.');
	}

	const response = payload as DeepSeekChatCompletionResponse;
	const choice = response.choices?.[0];
	const content = choice?.message?.content;
	const role = choice?.message?.role;
	const toolCalls = parseDeepSeekToolCallCandidates(choice?.message?.tool_calls);
	const messageContent =
		typeof content === 'string'
			? content
			: toolCalls.tool_call_candidate !== undefined
				? ''
				: undefined;

	if (!response.model || !choice || typeof messageContent !== 'string' || role !== 'assistant') {
		throw new GatewayResponseError(
			'deepseek',
			'DeepSeek response did not contain a valid assistant message.',
		);
	}

	return {
		finish_reason: mapDeepSeekFinishReason(choice.finish_reason),
		message: {
			content: messageContent,
			role: 'assistant',
		},
		model: response.model,
		provider: 'deepseek',
		response_id: response.id,
		...toolCalls,
		usage: {
			input_tokens: response.usage?.prompt_tokens,
			output_tokens: response.usage?.completion_tokens,
			total_tokens: response.usage?.total_tokens,
		},
	};
}

async function* parseDeepSeekSseEvents(body: NonNullable<Response['body']>): AsyncIterable<string> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				break;
			}

			buffer += decoder.decode(value, { stream: true });

			while (true) {
				const separatorIndex = buffer.indexOf('\n\n');

				if (separatorIndex < 0) {
					break;
				}

				const eventBlock = buffer.slice(0, separatorIndex);
				buffer = buffer.slice(separatorIndex + 2);

				const dataLines = eventBlock
					.split(/\r?\n/u)
					.filter((line) => line.startsWith('data:'))
					.map((line) => line.slice(5).trim())
					.filter((line) => line.length > 0);

				if (dataLines.length > 0) {
					yield dataLines.join('\n');
				}
			}
		}

		buffer += decoder.decode();
		const trailingDataLines = buffer
			.split(/\r?\n/u)
			.filter((line) => line.startsWith('data:'))
			.map((line) => line.slice(5).trim())
			.filter((line) => line.length > 0);

		if (trailingDataLines.length > 0) {
			yield trailingDataLines.join('\n');
		}
	} finally {
		reader.releaseLock();
	}
}

function parseDeepSeekToolCallAccumulator(
	toolCallsByIndex: ReadonlyMap<number, DeepSeekToolCallAccumulator>,
): Pick<ModelResponse, 'tool_call_candidate' | 'tool_call_candidates'> {
	const candidates = [...toolCallsByIndex.entries()]
		.sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
		.map(([, toolCall]) => {
			const candidate = parseToolCallCandidateParts({
				call_id: toolCall.call_id,
				tool_input: toolCall.arguments_text,
				tool_name: toolCall.tool_name,
			});

			if (!candidate) {
				throw new GatewayResponseError(
					'deepseek',
					'DeepSeek streaming response contained an invalid tool call candidate.',
				);
			}

			return candidate;
		});

	return {
		tool_call_candidate: candidates[0],
		tool_call_candidates: candidates.length > 1 ? candidates : undefined,
	};
}

export class DeepSeekGateway implements ModelGateway {
	readonly provider = 'deepseek';
	readonly #config: GatewayProviderConfig;

	constructor(config: GatewayProviderConfig) {
		this.#config = config;
	}

	async generate(request: ModelRequest): Promise<ModelResponse> {
		const payload = await postJson({
			body: buildDeepSeekRequestBody(this.#config, request),
			debug_context: buildDebugContext(request),
			headers: {
				Authorization: `Bearer ${this.#config.apiKey}`,
			},
			provider: this.provider,
			url: DEEPSEEK_CHAT_COMPLETIONS_URL,
		});

		return parseDeepSeekResponse(payload);
	}

	async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		const requestBody: DeepSeekChatCompletionRequest = {
			...buildDeepSeekRequestBody(this.#config, request),
			stream: true,
		};
		const fetchImplementation = globalThis.fetch;

		if (!fetchImplementation) {
			throw new GatewayRequestError(
				this.provider,
				'Global fetch is not available in this runtime.',
			);
		}

		let response: Response;

		try {
			response = await fetchImplementation(DEEPSEEK_CHAT_COMPLETIONS_URL, {
				body: JSON.stringify(requestBody),
				headers: {
					Authorization: `Bearer ${this.#config.apiKey}`,
					'content-type': 'application/json',
				},
				method: 'POST',
			});
		} catch (error: unknown) {
			throw new GatewayRequestError(
				this.provider,
				error instanceof Error
					? `${this.provider} request failed: ${error.message}`
					: `${this.provider} request failed with an unknown network error.`,
				error,
			);
		}

		if (!response.ok) {
			const responseText = await response.text();
			throw new GatewayResponseError(
				this.provider,
				`${this.provider} returned HTTP ${response.status}.`,
				{
					response_body: responseText,
					status_code: response.status,
				},
			);
		}

		const contentType = response.headers.get('content-type') ?? '';

		if (!contentType.includes('text/event-stream')) {
			const responseText = await response.text();
			let parsedPayload: unknown;

			try {
				parsedPayload = JSON.parse(responseText) as unknown;
			} catch (error: unknown) {
				throw new GatewayResponseError(this.provider, 'DeepSeek returned invalid JSON.', {
					cause: error,
					response_body: responseText,
					status_code: response.status,
				});
			}

			yield {
				response: parseDeepSeekResponse(parsedPayload),
				type: 'response.completed',
			};
			return;
		}

		if (!response.body) {
			throw new GatewayResponseError(
				this.provider,
				'DeepSeek streaming response did not include a body.',
			);
		}

		const toolCallsByIndex = new Map<number, DeepSeekToolCallAccumulator>();
		let completionTokens: number | undefined;
		let finishReason: string | null | undefined;
		let inputTokens: number | undefined;
		let outputText = '';
		let responseId: string | undefined;
		let responseModel: string | undefined;
		let totalTokens: number | undefined;

		for await (const eventData of parseDeepSeekSseEvents(response.body)) {
			if (eventData === '[DONE]') {
				break;
			}

			let parsedChunk: DeepSeekChatCompletionStreamChunk;

			try {
				parsedChunk = JSON.parse(eventData) as DeepSeekChatCompletionStreamChunk;
			} catch (error: unknown) {
				throw new GatewayResponseError(
					this.provider,
					'DeepSeek streaming response returned invalid JSON.',
					{
						cause: error,
						response_body: eventData,
					},
				);
			}

			responseId ??= parsedChunk.id;
			responseModel ??= parsedChunk.model;
			inputTokens = parsedChunk.usage?.prompt_tokens ?? inputTokens;
			completionTokens = parsedChunk.usage?.completion_tokens ?? completionTokens;
			totalTokens = parsedChunk.usage?.total_tokens ?? totalTokens;

			const firstChoice = parsedChunk.choices?.[0];
			const delta = firstChoice?.delta;

			if (typeof delta?.content === 'string' && delta.content.length > 0) {
				outputText += delta.content;
				yield {
					text_delta: delta.content,
					type: 'text.delta',
				};
			}

			for (const toolCall of delta?.tool_calls ?? []) {
				const toolCallIndex = toolCall.index ?? 0;
				const existingToolCall = toolCallsByIndex.get(toolCallIndex) ?? {
					arguments_text: '',
				};

				existingToolCall.call_id = toolCall.id ?? existingToolCall.call_id;
				existingToolCall.tool_name = toolCall.function?.name ?? existingToolCall.tool_name;
				existingToolCall.arguments_text += toolCall.function?.arguments ?? '';
				toolCallsByIndex.set(toolCallIndex, existingToolCall);
			}

			finishReason = firstChoice?.finish_reason ?? finishReason;
		}

		const parsedToolCalls = parseDeepSeekToolCallAccumulator(toolCallsByIndex);
		const resolvedModel = responseModel ?? request.model ?? this.#config.defaultModel;

		if (!resolvedModel) {
			throw new GatewayResponseError(
				this.provider,
				'DeepSeek streaming response did not resolve a model identifier.',
			);
		}

		yield {
			response: {
				finish_reason: mapDeepSeekFinishReason(finishReason),
				message: {
					content:
						outputText.length > 0
							? outputText
							: parsedToolCalls.tool_call_candidate
								? ''
								: outputText,
					role: 'assistant',
				},
				model: resolvedModel,
				provider: this.provider,
				response_id: responseId,
				...parsedToolCalls,
				usage: {
					input_tokens: inputTokens,
					output_tokens: completionTokens,
					total_tokens: totalTokens,
				},
			},
			type: 'response.completed',
		};
	}
}
