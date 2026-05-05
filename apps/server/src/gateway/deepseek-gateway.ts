import {
	type ModelAttachment,
	type ModelContentPart,
	type ModelGateway,
	type ModelRequest,
	type ModelResponse,
	type ModelStreamChunk,
	type ModelToolCallFallthroughSignal,
	type ProviderCapabilities,
	redact,
	unwrapRedacted,
} from '@runa/types';

import { createLogger } from '../utils/logger.js';
import { describeAttachmentForTextPart } from './attachment-text.js';
import { formatCompiledContext } from './compiled-context.js';
import { GatewayConfigurationError, GatewayRequestError, GatewayResponseError } from './errors.js';
import { detectToolCallFallthrough } from './fallthrough-detector.js';
import {
	createOrderedContentFromTextAndToolCalls,
	getOrderedToolCallCandidates,
} from './model-content.js';
import { postJson } from './provider-http.js';
import type { GatewayProviderConfig } from './providers.js';
import { appendReasoningContent, joinReasoningContent } from './reasoning-isolation.js';
import { type SerializedCallableTool, serializeCallableTool } from './request-tools.js';
import {
	type ToolCallCandidateRejectionReason,
	parseToolCallCandidatePartsDetailed,
} from './tool-call-candidate.js';

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
		readonly reasoning_content?: string;
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

interface DeepSeekPreparedRequest {
	readonly body: DeepSeekChatCompletionRequest;
	readonly toolNameByAlias: ReadonlyMap<string, string>;
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
const deepSeekGatewayLogger = createLogger({
	context: {
		component: 'gateway.deepseek',
	},
});

export const deepSeekProviderCapabilities: ProviderCapabilities = {
	emits_reasoning_content: true,
	narration_strategy: 'temporal_stream',
	streaming_supported: true,
	tool_call_fallthrough_risk: 'known_intermittent',
};

type DeepSeekMutableContentPart =
	| {
			index: number;
			kind: 'text';
			text: string;
	  }
	| {
			arguments_text: string;
			call_id?: string;
			index: number;
			kind: 'tool_use';
			source_tool_call_index: number;
			tool_name?: string;
	  };

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
		...(message.role === 'assistant' && message.internal_reasoning !== undefined
			? {
					reasoning_content: unwrapRedacted(message.internal_reasoning),
				}
			: {}),
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

function buildDeepSeekToolAlias(toolName: string): string {
	return toolName.replace(/[^a-zA-Z0-9_-]/gu, '_');
}

function buildDeepSeekTools(request: ModelRequest): Readonly<{
	readonly toolNameByAlias: ReadonlyMap<string, string>;
	readonly tools?: DeepSeekChatCompletionRequest['tools'];
}> {
	const toolNameByAlias = new Map<string, string>();
	const tools = request.available_tools?.map((tool) => {
		const alias = buildDeepSeekToolAlias(tool.name);

		if (toolNameByAlias.has(alias)) {
			throw new GatewayRequestError(
				'deepseek',
				`DeepSeek tool alias collision for ${tool.name}; choose unique provider-safe tool names before sending the request.`,
			);
		}

		toolNameByAlias.set(alias, tool.name);

		const serializedTool: SerializedCallableTool = {
			...serializeCallableTool(tool),
			name: alias,
		};

		return {
			function: serializedTool,
			type: 'function' as const,
		};
	});

	return {
		toolNameByAlias,
		tools,
	};
}

function resolveDeepSeekToolName(
	toolName: unknown,
	toolNameByAlias: ReadonlyMap<string, string>,
): unknown {
	if (typeof toolName !== 'string') {
		return toolName;
	}

	const mappedToolName = toolNameByAlias.get(toolName);

	if (mappedToolName) {
		return mappedToolName;
	}

	if (toolName.includes('.')) {
		return toolName;
	}

	const rebuiltToolName = toolName.replace(/[_-]+/gu, '.');
	const matches = [...new Set(toolNameByAlias.values())].filter(
		(candidate) =>
			candidate === rebuiltToolName ||
			buildDeepSeekToolAlias(candidate).replace(/[_-]+/gu, '.') === rebuiltToolName,
	);

	return matches.length === 1 ? matches[0] : toolName;
}

function buildDeepSeekToolCallRejectionDetails(input: {
	readonly arguments_text: unknown;
	readonly call_id: unknown;
	readonly reason: ToolCallCandidateRejectionReason | undefined;
	readonly tool_name_raw: unknown;
	readonly tool_name_resolved: unknown;
}): Record<string, unknown> {
	return {
		arguments_length: typeof input.arguments_text === 'string' ? input.arguments_text.length : 0,
		call_id_present: typeof input.call_id === 'string' && input.call_id.length > 0,
		reason: input.reason,
		tool_name_raw: input.tool_name_raw,
		tool_name_resolved: input.tool_name_resolved,
	};
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

function buildDeepSeekRequest(
	config: GatewayProviderConfig,
	request: ModelRequest,
): DeepSeekPreparedRequest {
	assertSupportedAttachments(request);

	const model = request.model ?? config.defaultModel;
	const compiledContext = formatCompiledContext(request.compiled_context);
	const { toolNameByAlias, tools } = buildDeepSeekTools(request);

	if (!model) {
		throw new GatewayConfigurationError(
			'DeepSeek gateway requires a model in the request or config.',
		);
	}

	const thinkingType = resolveThinkingType(request, model);

	return {
		body: {
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
		},
		toolNameByAlias,
	};
}

function parseDeepSeekToolCallCandidates(
	toolCalls: readonly DeepSeekResponseToolCall[] | undefined,
	toolNameByAlias: ReadonlyMap<string, string>,
): Pick<ModelResponse, 'tool_call_candidate' | 'tool_call_candidates'> {
	const candidates = [...(toolCalls ?? [])].map((toolCall) => {
		const toolNameRaw = toolCall.function?.name;
		const toolNameResolved = resolveDeepSeekToolName(toolNameRaw, toolNameByAlias);
		const parseResult = parseToolCallCandidatePartsDetailed({
			call_id: toolCall.id,
			tool_input: toolCall.function?.arguments,
			tool_name: toolNameResolved,
		});

		if (!parseResult.candidate) {
			const reason = parseResult.rejection_reason;

			throw new GatewayResponseError(
				'deepseek',
				`DeepSeek response contained an invalid tool call candidate (${reason}).`,
				buildDeepSeekToolCallRejectionDetails({
					arguments_text: toolCall.function?.arguments,
					call_id: toolCall.id,
					reason,
					tool_name_raw: toolNameRaw,
					tool_name_resolved: toolNameResolved,
				}),
			);
		}

		return parseResult.candidate;
	});

	return {
		tool_call_candidate: candidates[0],
		tool_call_candidates: candidates.length > 1 ? candidates : undefined,
	};
}

function parseDeepSeekResponse(
	payload: unknown,
	toolNameByAlias: ReadonlyMap<string, string>,
): ModelResponse {
	if (!payload || typeof payload !== 'object') {
		throw new GatewayResponseError('deepseek', 'DeepSeek response must be an object.');
	}

	const response = payload as DeepSeekChatCompletionResponse;
	const choice = response.choices?.[0];
	const content = choice?.message?.content;
	const internalReasoning =
		typeof choice?.message?.reasoning_content === 'string' &&
		choice.message.reasoning_content.length > 0
			? choice.message.reasoning_content
			: undefined;
	const role = choice?.message?.role;
	const toolCalls = parseDeepSeekToolCallCandidates(choice?.message?.tool_calls, toolNameByAlias);
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
			internal_reasoning: internalReasoning !== undefined ? redact(internalReasoning) : undefined,
			ordered_content: createOrderedContentFromTextAndToolCalls(
				messageContent,
				getOrderedToolCallCandidates(toolCalls.tool_call_candidate, toolCalls.tool_call_candidates),
				'synthetic_non_streaming',
			),
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
	toolNameByAlias: ReadonlyMap<string, string>,
): Pick<ModelResponse, 'tool_call_candidate' | 'tool_call_candidates'> {
	const candidates = [...toolCallsByIndex.entries()]
		.sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
		.map(([, toolCall]) => {
			const toolNameRaw = toolCall.tool_name;
			const toolNameResolved = resolveDeepSeekToolName(toolNameRaw, toolNameByAlias);
			const parseResult = parseToolCallCandidatePartsDetailed({
				call_id: toolCall.call_id,
				tool_input: toolCall.arguments_text,
				tool_name: toolNameResolved,
			});

			if (!parseResult.candidate) {
				const reason = parseResult.rejection_reason;

				throw new GatewayResponseError(
					'deepseek',
					`DeepSeek streaming response contained an invalid tool call candidate (${reason}).`,
					buildDeepSeekToolCallRejectionDetails({
						arguments_text: toolCall.arguments_text,
						call_id: toolCall.call_id,
						reason,
						tool_name_raw: toolNameRaw,
						tool_name_resolved: toolNameResolved,
					}),
				);
			}

			return parseResult.candidate;
		});

	return {
		tool_call_candidate: candidates[0],
		tool_call_candidates: candidates.length > 1 ? candidates : undefined,
	};
}

function parseDeepSeekToolInputForOrderedContent(argumentsText: string): unknown {
	if (argumentsText.trim().length === 0) {
		return {};
	}

	try {
		return JSON.parse(argumentsText) as unknown;
	} catch {
		return argumentsText;
	}
}

function appendDeepSeekTextContentPart(parts: DeepSeekMutableContentPart[], text: string): number {
	const lastPart = parts.at(-1);

	if (lastPart?.kind === 'text') {
		lastPart.text += text;
		return lastPart.index;
	}

	const index = parts.length;

	parts.push({
		index,
		kind: 'text',
		text,
	});

	return index;
}

function upsertDeepSeekToolUseContentPart(
	parts: DeepSeekMutableContentPart[],
	toolCallIndex: number,
	toolCall: DeepSeekStreamChoiceDeltaToolCall,
): void {
	const existingPart = parts.find(
		(part) => part.kind === 'tool_use' && part.source_tool_call_index === toolCallIndex,
	);
	const toolUsePart: Extract<DeepSeekMutableContentPart, { kind: 'tool_use' }> =
		existingPart?.kind === 'tool_use'
			? existingPart
			: {
					arguments_text: '',
					index: parts.length,
					kind: 'tool_use',
					source_tool_call_index: toolCallIndex,
				};

	toolUsePart.call_id = toolCall.id ?? toolUsePart.call_id;
	toolUsePart.tool_name = toolCall.function?.name ?? toolUsePart.tool_name;
	toolUsePart.arguments_text += toolCall.function?.arguments ?? '';

	if (existingPart === undefined) {
		parts.push(toolUsePart);
	}
}

function finalizeDeepSeekStreamingContent(
	parts: readonly DeepSeekMutableContentPart[],
	toolNameByAlias: ReadonlyMap<string, string>,
	context: Readonly<{
		readonly run_id: string;
		readonly trace_id: string;
	}>,
): {
	readonly fallthrough_detected?: readonly ModelToolCallFallthroughSignal[];
	readonly ordered_content: readonly ModelContentPart[];
	readonly output_text: string;
} {
	const fallthroughSignals: ModelToolCallFallthroughSignal[] = [];
	const outputTextParts: string[] = [];
	const orderedContent = parts.flatMap((part): ModelContentPart[] => {
		if (part.kind === 'text') {
			if (part.text.length === 0) {
				return [];
			}

			const detection = detectToolCallFallthrough(part.text);

			if (detection.is_fallthrough && detection.confidence === 'high') {
				const signal: ModelToolCallFallthroughSignal = {
					confidence: detection.confidence,
					matched_pattern: detection.matched_pattern,
					suspected_tool_name: detection.suspected_tool_name,
				};
				fallthroughSignals.push(signal);
				deepSeekGatewayLogger.warn('fallthrough.high.blocked', {
					confidence: detection.confidence,
					matched_pattern: detection.matched_pattern,
					run_id: context.run_id,
					suspected_tool_name: detection.suspected_tool_name,
					trace_id: context.trace_id,
				});
				return [];
			}

			outputTextParts.push(part.text);

			if (detection.is_fallthrough && detection.confidence === 'medium') {
				const signal: ModelToolCallFallthroughSignal = {
					confidence: detection.confidence,
					matched_pattern: detection.matched_pattern,
					suspected_tool_name: detection.suspected_tool_name,
				};
				fallthroughSignals.push(signal);
				deepSeekGatewayLogger.info('fallthrough.medium.suppressed_narration', {
					confidence: detection.confidence,
					matched_pattern: detection.matched_pattern,
					run_id: context.run_id,
					suspected_tool_name: detection.suspected_tool_name,
					trace_id: context.trace_id,
				});
			} else if (detection.is_fallthrough && detection.confidence === 'low') {
				deepSeekGatewayLogger.debug('fallthrough.low.observed', {
					confidence: detection.confidence,
					matched_pattern: detection.matched_pattern,
					run_id: context.run_id,
					suspected_tool_name: detection.suspected_tool_name,
					trace_id: context.trace_id,
				});
			}

			return [
				{
					index: part.index,
					kind: 'text',
					...(detection.is_fallthrough && detection.confidence === 'medium'
						? { narration_eligible: false }
						: {}),
					ordering_origin: 'wire_streaming',
					text: part.text,
				},
			];
		}

		if (typeof part.call_id !== 'string' || typeof part.tool_name !== 'string') {
			return [];
		}

		return [
			{
				index: part.index,
				input: parseDeepSeekToolInputForOrderedContent(part.arguments_text),
				kind: 'tool_use',
				ordering_origin: 'wire_streaming',
				tool_call_id: part.call_id,
				tool_name: String(resolveDeepSeekToolName(part.tool_name, toolNameByAlias)),
			},
		];
	});

	return {
		fallthrough_detected: fallthroughSignals.length > 0 ? fallthroughSignals : undefined,
		ordered_content: orderedContent,
		output_text: outputTextParts.join(''),
	};
}

export class DeepSeekGateway implements ModelGateway {
	readonly capabilities = deepSeekProviderCapabilities;
	readonly provider = 'deepseek';
	readonly #config: GatewayProviderConfig;

	constructor(config: GatewayProviderConfig) {
		this.#config = config;
	}

	async generate(request: ModelRequest): Promise<ModelResponse> {
		const preparedRequest = buildDeepSeekRequest(this.#config, request);
		const payload = await postJson({
			body: preparedRequest.body,
			debug_context: buildDebugContext(request),
			headers: {
				Authorization: `Bearer ${this.#config.apiKey}`,
			},
			provider: this.provider,
			url: DEEPSEEK_CHAT_COMPLETIONS_URL,
		});

		return parseDeepSeekResponse(payload, preparedRequest.toolNameByAlias);
	}

	async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		const preparedRequest = buildDeepSeekRequest(this.#config, request);
		const requestBody: DeepSeekChatCompletionRequest = {
			...preparedRequest.body,
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
				response: parseDeepSeekResponse(parsedPayload, preparedRequest.toolNameByAlias),
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
		const orderedContentParts: DeepSeekMutableContentPart[] = [];
		const reasoningContentBuffer: string[] = [];
		let completionTokens: number | undefined;
		let finishReason: string | null | undefined;
		let inputTokens: number | undefined;
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
			const reasoningResult = appendReasoningContent(reasoningContentBuffer, parsedChunk);

			if (reasoningResult.appended_length > 0) {
				deepSeekGatewayLogger.info('deepseek.reasoning.isolated', {
					length: reasoningResult.appended_length,
					run_id: request.run_id,
					trace_id: request.trace_id,
				});
			}

			const firstChoice = parsedChunk.choices?.[0];
			const delta = firstChoice?.delta;

			if (typeof delta?.content === 'string' && delta.content.length > 0) {
				const contentPartIndex = appendDeepSeekTextContentPart(orderedContentParts, delta.content);
				yield {
					content_part_index: contentPartIndex,
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
				upsertDeepSeekToolUseContentPart(orderedContentParts, toolCallIndex, toolCall);
			}

			finishReason = firstChoice?.finish_reason ?? finishReason;
		}

		const parsedToolCalls = parseDeepSeekToolCallAccumulator(
			toolCallsByIndex,
			preparedRequest.toolNameByAlias,
		);
		const streamingContent =
			orderedContentParts.length > 0
				? finalizeDeepSeekStreamingContent(orderedContentParts, preparedRequest.toolNameByAlias, {
						run_id: request.run_id,
						trace_id: request.trace_id,
					})
				: {
						ordered_content: createOrderedContentFromTextAndToolCalls(
							'',
							getOrderedToolCallCandidates(
								parsedToolCalls.tool_call_candidate,
								parsedToolCalls.tool_call_candidates,
							),
							'wire_streaming',
						),
						output_text: '',
					};
		const internalReasoning = joinReasoningContent(reasoningContentBuffer);
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
						streamingContent.output_text.length > 0
							? streamingContent.output_text
							: parsedToolCalls.tool_call_candidate
								? ''
								: streamingContent.output_text,
					fallthrough_detected: streamingContent.fallthrough_detected,
					internal_reasoning:
						internalReasoning !== undefined ? redact(internalReasoning) : undefined,
					ordered_content:
						streamingContent.ordered_content.length > 0
							? streamingContent.ordered_content
							: createOrderedContentFromTextAndToolCalls(
									streamingContent.output_text,
									getOrderedToolCallCandidates(
										parsedToolCalls.tool_call_candidate,
										parsedToolCalls.tool_call_candidates,
									),
									'wire_streaming',
								),
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
