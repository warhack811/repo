import type {
	ModelAttachment,
	ModelGateway,
	ModelRequest,
	ModelResponse,
	ModelStreamChunk,
} from '@runa/types';

import { createLogger } from '../utils/logger.js';
import { formatCompiledContext } from './compiled-context.js';
import { GatewayConfigurationError, GatewayRequestError, GatewayResponseError } from './errors.js';
import { postJson } from './provider-http.js';
import type { GatewayProviderConfig } from './providers.js';
import type { ToolJsonSchemaObject } from './request-tools.js';
import { prioritizeToolsForPrompt, serializeCallableTool } from './request-tools.js';
import { parseToolCallCandidateParts } from './tool-call-candidate.js';

interface GroqChatCompletionRequest {
	readonly max_completion_tokens?: number;
	readonly messages: ReadonlyArray<{
		readonly content:
			| string
			| ReadonlyArray<
					| {
							readonly text: string;
							readonly type: 'text';
					  }
					| {
							readonly image_url: {
								readonly url: string;
							};
							readonly type: 'image_url';
					  }
			  >;
		readonly role: 'assistant' | 'system' | 'user';
	}>;
	readonly model: string;
	readonly stream?: boolean;
	readonly temperature?: number;
	readonly tool_choice?: 'auto';
	readonly tools?: ReadonlyArray<{
		readonly function: {
			readonly description?: string;
			readonly name: string;
			readonly parameters: ToolJsonSchemaObject;
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

interface GroqStreamChoiceDeltaToolCall {
	readonly function?: {
		readonly arguments?: string;
		readonly name?: string;
	};
	readonly id?: string;
	readonly index?: number;
	readonly type?: string;
}

interface GroqChatCompletionStreamChunk {
	readonly choices?: ReadonlyArray<{
		readonly delta?: {
			readonly content?: string | null;
			readonly role?: string;
			readonly tool_calls?: readonly GroqStreamChoiceDeltaToolCall[];
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

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_STRICT_TOOL_ARGUMENTS_INSTRUCTION =
	'When calling tools, emit strict JSON arguments that match the declared schema exactly. Do not quote booleans or numbers. Omit optional arguments unless they are necessary.';
const groqLogger = createLogger({
	context: {
		component: 'gateway.groq',
		provider: 'groq',
	},
});

type GroqContextSerializationMode = 'legacy_split_system' | 'merged_system';
type GroqToolSerializationMode =
	| 'full'
	| 'minimal_all'
	| 'minimal_non_primary'
	| 'strip_descriptions';

interface GroqRequestHygieneOptions {
	readonly context_mode: GroqContextSerializationMode;
	readonly tool_serialization: GroqToolSerializationMode;
}

interface GroqRequestHygieneMetadata {
	readonly context_mode?: unknown;
	readonly tool_serialization?: unknown;
}

interface GroqMetadata {
	readonly groq_request_hygiene?: GroqRequestHygieneMetadata;
}

interface GroqToolCallAccumulator {
	arguments_text: string;
	call_id?: string;
	tool_name?: string;
}

function buildAttachmentTextPart(attachment: Extract<ModelAttachment, { readonly kind: 'text' }>): {
	readonly text: string;
	readonly type: 'text';
} {
	return {
		text: `Attached text file (${attachment.filename ?? attachment.blob_id}, ${attachment.media_type}):\n${attachment.text_content}`,
		type: 'text',
	};
}

function buildGroqUserContent(
	message: ModelRequest['messages'][number],
	attachments: readonly ModelAttachment[],
): GroqChatCompletionRequest['messages'][number]['content'] {
	if (message.role !== 'user' || attachments.length === 0) {
		return message.content;
	}

	return [
		...(message.content.trim().length > 0
			? [
					{
						text: message.content,
						type: 'text' as const,
					},
				]
			: []),
		...attachments.map((attachment) =>
			attachment.kind === 'image'
				? {
						image_url: {
							url: attachment.data_url,
						},
						type: 'image_url' as const,
					}
				: buildAttachmentTextPart(attachment),
		),
	];
}

function mapGroqMessages(request: ModelRequest): GroqChatCompletionRequest['messages'] {
	const lastUserMessageIndex = [...request.messages]
		.map((message, index) => ({ index, role: message.role }))
		.reverse()
		.find((entry) => entry.role === 'user')?.index;

	return request.messages.map((message, index) => ({
		content:
			lastUserMessageIndex === index
				? buildGroqUserContent(message, request.attachments ?? [])
				: message.content,
		role: message.role,
	}));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseGroqContextMode(value: unknown): GroqContextSerializationMode | undefined {
	return value === 'legacy_split_system' || value === 'merged_system' ? value : undefined;
}

function parseGroqToolSerializationMode(value: unknown): GroqToolSerializationMode | undefined {
	return value === 'full' ||
		value === 'minimal_all' ||
		value === 'minimal_non_primary' ||
		value === 'strip_descriptions'
		? value
		: undefined;
}

function isGroqRequestHygieneMetadata(value: unknown): value is GroqRequestHygieneMetadata {
	return isRecord(value);
}

function isGroqMetadata(value: unknown): value is GroqMetadata {
	return isRecord(value);
}

function countToolParameters(
	tools: readonly NonNullable<ModelRequest['available_tools']>[number][],
): number {
	return tools.reduce((total, tool) => total + Object.keys(tool.parameters ?? {}).length, 0);
}

function getLastUserMessage(request: ModelRequest): string | undefined {
	return [...request.messages]
		.reverse()
		.find((message) => message.role === 'user' && message.content.trim().length > 0)?.content;
}

function resolveDefaultGroqRequestHygieneOptions(request: ModelRequest): GroqRequestHygieneOptions {
	const toolCount = request.available_tools?.length ?? 0;
	const totalParameterCount = countToolParameters(request.available_tools ?? []);
	const hasDenseToolSurface = toolCount >= 8 || totalParameterCount >= 16;
	const prioritizedTools = prioritizeToolsForPrompt(
		request.available_tools ?? [],
		getLastUserMessage(request),
	);
	const primaryToolName = prioritizedTools[0]?.name;

	return {
		context_mode:
			hasDenseToolSurface && primaryToolName !== 'file.read'
				? 'merged_system'
				: 'legacy_split_system',
		tool_serialization: toolCount >= 4 ? 'minimal_non_primary' : 'full',
	};
}

function resolveGroqRequestHygieneOptions(request: ModelRequest): GroqRequestHygieneOptions {
	const defaults = resolveDefaultGroqRequestHygieneOptions(request);
	const metadata = request.metadata;

	if (!isGroqMetadata(metadata) || !isGroqRequestHygieneMetadata(metadata.groq_request_hygiene)) {
		return defaults;
	}

	const groqRequestHygiene = metadata.groq_request_hygiene;
	const contextMode = parseGroqContextMode(groqRequestHygiene.context_mode);
	const toolSerialization = parseGroqToolSerializationMode(groqRequestHygiene.tool_serialization);

	return {
		context_mode: contextMode ?? defaults.context_mode,
		tool_serialization: toolSerialization ?? defaults.tool_serialization,
	};
}

function buildGroqMessages(
	request: ModelRequest,
	compiledContext: string | undefined,
	contextMode: GroqContextSerializationMode,
): GroqChatCompletionRequest['messages'] {
	const systemMessages = request.messages.filter((message) => message.role === 'system');

	if (contextMode === 'legacy_split_system') {
		return [
			...(compiledContext
				? [
						{
							content: compiledContext,
							role: 'system' as const,
						},
					]
				: []),
			...mapGroqMessages(request),
		];
	}

	const mergedSystemContent = [compiledContext, ...systemMessages.map((message) => message.content)]
		.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
		.join('\n\n');
	const mergedSystemSegments = [
		mergedSystemContent,
		request.available_tools && request.available_tools.length > 0
			? GROQ_STRICT_TOOL_ARGUMENTS_INSTRUCTION
			: undefined,
	].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

	return [
		...(mergedSystemSegments.length > 0
			? [
					{
						content: mergedSystemSegments.join('\n\n'),
						role: 'system' as const,
					},
				]
			: []),
		...mapGroqMessages(request).filter((message) => message.role !== 'system'),
	];
}

function serializeGroqTools(
	tools: readonly NonNullable<ModelRequest['available_tools']>[number][],
	mode: GroqToolSerializationMode,
): NonNullable<GroqChatCompletionRequest['tools']> {
	return tools.map((tool, index) => {
		const isPrimaryTool = index === 0;
		const serializedTool =
			mode === 'full'
				? serializeCallableTool(tool)
				: mode === 'strip_descriptions'
					? serializeCallableTool(tool, {
							include_parameter_descriptions: false,
							include_tool_description: false,
						})
					: mode === 'minimal_all'
						? serializeCallableTool(tool, {
								include_parameter_descriptions: false,
								include_tool_description: false,
							})
						: serializeCallableTool(tool, {
								include_parameter_descriptions: isPrimaryTool,
								include_tool_description: isPrimaryTool,
							});

		return {
			function: serializedTool,
			type: 'function' as const,
		};
	});
}

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
	const hygiene = resolveGroqRequestHygieneOptions(request);
	const lastUserMessage = getLastUserMessage(request);
	const prioritizedTools = prioritizeToolsForPrompt(request.available_tools ?? [], lastUserMessage);

	if (!model) {
		throw new GatewayConfigurationError('Groq gateway requires a model in the request or config.');
	}

	const hasTools = prioritizedTools.length > 0;

	return {
		max_completion_tokens: request.max_output_tokens,
		messages: buildGroqMessages(request, compiledContext, hygiene.context_mode),
		model,
		temperature: request.temperature ?? (hasTools ? 0 : undefined),
		tool_choice: hasTools ? 'auto' : undefined,
		tools: hasTools ? serializeGroqTools(prioritizedTools, hygiene.tool_serialization) : undefined,
	};
}

function buildGroqDebugContext(
	request: ModelRequest,
	requestBody: GroqChatCompletionRequest,
): Readonly<{
	readonly compiled_context_chars: number;
	readonly has_compiled_context: boolean;
	readonly last_user_message_chars?: number;
	readonly max_output_tokens?: number;
	readonly message_count: number;
	readonly message_roles: readonly string[];
	readonly model: string;
	readonly request_hygiene_context_mode: GroqContextSerializationMode;
	readonly request_hygiene_tool_serialization: GroqToolSerializationMode;
	readonly run_id: string;
	readonly requested_tool_names: readonly string[];
	readonly serialized_tool_names: readonly string[];
	readonly trace_id: string;
	readonly tool_count: number;
	readonly tool_names: readonly string[];
}> {
	const compiledContext = formatCompiledContext(request.compiled_context);
	const hygiene = resolveGroqRequestHygieneOptions(request);
	const lastUserMessage = getLastUserMessage(request);

	return {
		compiled_context_chars: compiledContext?.length ?? 0,
		has_compiled_context: request.compiled_context !== undefined,
		last_user_message_chars: lastUserMessage?.length,
		max_output_tokens: request.max_output_tokens,
		message_count: requestBody.messages.length,
		message_roles: requestBody.messages.map((message) => message.role),
		model: requestBody.model,
		request_hygiene_context_mode: hygiene.context_mode,
		request_hygiene_tool_serialization: hygiene.tool_serialization,
		run_id: request.run_id,
		requested_tool_names: request.available_tools?.map((tool) => tool.name) ?? [],
		serialized_tool_names: requestBody.tools?.map((tool) => tool.function.name) ?? [],
		trace_id: request.trace_id,
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

async function* parseGroqSseEvents(body: NonNullable<Response['body']>): AsyncIterable<string> {
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

function parseGroqToolCallAccumulator(
	toolCallsByIndex: ReadonlyMap<number, GroqToolCallAccumulator>,
): ModelResponse['tool_call_candidate'] {
	const firstToolCall = [...toolCallsByIndex.entries()]
		.sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
		.map(([, toolCall]) => toolCall)[0];

	if (!firstToolCall) {
		return undefined;
	}

	const candidate = parseToolCallCandidateParts({
		call_id: firstToolCall.call_id,
		tool_input: firstToolCall.arguments_text,
		tool_name: firstToolCall.tool_name,
	});

	if (!candidate) {
		throw new GatewayResponseError(
			'groq',
			'Groq streaming response contained an invalid tool call candidate.',
		);
	}

	return candidate;
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
			groqLogger.error('gateway.generate.failed', {
				error: error instanceof Error ? error : String(error),
				model: requestBody.model,
				run_id: request.run_id,
				trace_id: request.trace_id,
			});
			throw error;
		}
	}

	async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		const requestBody: GroqChatCompletionRequest = {
			...buildGroqRequestBody(this.#config, request),
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
			response = await fetchImplementation(GROQ_CHAT_COMPLETIONS_URL, {
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
				throw new GatewayResponseError(this.provider, 'Groq returned invalid JSON.', {
					cause: error,
					response_body: responseText,
					status_code: response.status,
				});
			}

			yield {
				response: parseGroqResponse(parsedPayload),
				type: 'response.completed',
			};
			return;
		}

		if (!response.body) {
			throw new GatewayResponseError(
				this.provider,
				'Groq streaming response did not include a body.',
			);
		}

		const toolCallsByIndex = new Map<number, GroqToolCallAccumulator>();
		let completionTokens: number | undefined;
		let finishReason: string | null | undefined;
		let inputTokens: number | undefined;
		let outputText = '';
		let responseId: string | undefined;
		let responseModel: string | undefined;
		let totalTokens: number | undefined;

		for await (const eventData of parseGroqSseEvents(response.body)) {
			if (eventData === '[DONE]') {
				break;
			}

			let parsedChunk: GroqChatCompletionStreamChunk;

			try {
				parsedChunk = JSON.parse(eventData) as GroqChatCompletionStreamChunk;
			} catch (error: unknown) {
				throw new GatewayResponseError(
					this.provider,
					'Groq streaming response returned invalid JSON.',
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

		const toolCallCandidate = parseGroqToolCallAccumulator(toolCallsByIndex);
		const resolvedModel = responseModel ?? request.model ?? this.#config.defaultModel;

		if (!resolvedModel) {
			throw new GatewayResponseError(
				this.provider,
				'Groq streaming response did not resolve a model identifier.',
			);
		}

		yield {
			response: {
				finish_reason: mapGroqFinishReason(finishReason),
				message: {
					content: outputText.length > 0 ? outputText : toolCallCandidate ? '' : outputText,
					role: 'assistant',
				},
				model: resolvedModel,
				provider: this.provider,
				response_id: responseId,
				tool_call_candidate: toolCallCandidate,
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
