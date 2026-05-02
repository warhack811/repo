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
import {
	type ToolCallCandidateRejectionReason,
	parseToolCallCandidatePartsDetailed,
} from './tool-call-candidate.js';

type SambaNovaContentPart =
	| {
			readonly text: string;
			readonly type: 'text';
	  }
	| {
			readonly image_url: {
				readonly url: string;
			};
			readonly type: 'image_url';
	  };

interface SambaNovaChatCompletionRequest {
	readonly max_tokens?: number;
	readonly messages: ReadonlyArray<{
		readonly content: string | readonly SambaNovaContentPart[];
		readonly role: 'assistant' | 'system' | 'user';
	}>;
	readonly model: string;
	readonly stream?: boolean;
	readonly temperature?: number;
	readonly tool_choice?: 'auto';
	readonly tools?: ReadonlyArray<{
		readonly function: ReturnType<typeof serializeCallableTool>;
		readonly type: 'function';
	}>;
}

interface SambaNovaChatCompletionResponse {
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

interface SambaNovaStreamChoiceDeltaToolCall {
	readonly function?: {
		readonly arguments?: string;
		readonly name?: string;
	};
	readonly id?: string;
	readonly index?: number;
	readonly type?: string;
}

interface SambaNovaChatCompletionStreamChunk {
	readonly choices?: ReadonlyArray<{
		readonly delta?: {
			readonly content?: string | null;
			readonly role?: string;
			readonly tool_calls?: readonly SambaNovaStreamChoiceDeltaToolCall[];
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

interface SambaNovaToolCallAccumulator {
	arguments_text: string;
	call_id?: string;
	tool_name?: string;
}

const SAMBANOVA_CHAT_COMPLETIONS_URL = 'https://api.sambanova.ai/v1/chat/completions';

function buildAttachmentTextPart(
	attachment: Exclude<ModelAttachment, { readonly kind: 'image' }>,
): SambaNovaContentPart {
	return {
		text: describeAttachmentForTextPart(attachment),
		type: 'text',
	};
}

function buildSambaNovaUserContent(
	message: ModelRequest['messages'][number],
	attachments: readonly ModelAttachment[],
): SambaNovaChatCompletionRequest['messages'][number]['content'] {
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

function mapSambaNovaMessages(request: ModelRequest): SambaNovaChatCompletionRequest['messages'] {
	const lastUserMessageIndex = [...request.messages]
		.map((message, index) => ({ index, role: message.role }))
		.reverse()
		.find((entry) => entry.role === 'user')?.index;

	return request.messages.map((message, index) => ({
		content:
			lastUserMessageIndex === index
				? buildSambaNovaUserContent(message, request.attachments ?? [])
				: message.content,
		role: message.role,
	}));
}

function mapSambaNovaFinishReason(finishReason?: string | null): ModelResponse['finish_reason'] {
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

function getSambaNovaToolArgumentsLength(value: unknown): number {
	if (typeof value === 'string') {
		return value.length;
	}

	if (value === undefined || value === null) {
		return 0;
	}

	try {
		return JSON.stringify(value).length;
	} catch {
		return 0;
	}
}

function buildSambaNovaToolCallRejectionDetails(input: {
	readonly arguments_text: unknown;
	readonly call_id: unknown;
	readonly reason: ToolCallCandidateRejectionReason | undefined;
	readonly tool_name_raw: unknown;
	readonly tool_name_resolved: unknown;
}): Record<string, unknown> {
	return {
		arguments_length: getSambaNovaToolArgumentsLength(input.arguments_text),
		call_id_present: typeof input.call_id === 'string' && input.call_id.length > 0,
		reason: input.reason,
		tool_name_raw: input.tool_name_raw,
		tool_name_resolved: input.tool_name_resolved,
	};
}

function buildSambaNovaRequestBody(
	config: GatewayProviderConfig,
	request: ModelRequest,
): SambaNovaChatCompletionRequest {
	const model = request.model ?? config.defaultModel;
	const compiledContext = formatCompiledContext(request.compiled_context);
	const tools = request.available_tools?.map((tool) => ({
		function: serializeCallableTool(tool),
		type: 'function' as const,
	}));

	if (!model) {
		throw new GatewayConfigurationError(
			'SambaNova gateway requires a model in the request or config.',
		);
	}

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
			...mapSambaNovaMessages(request),
		],
		model,
		temperature: request.temperature,
		tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
		tools,
	};
}

function parseSambaNovaToolCallCandidate(
	response: SambaNovaChatCompletionResponse,
): ModelResponse['tool_call_candidate'] {
	const firstToolCall = response.choices?.[0]?.message?.tool_calls?.[0];

	if (!firstToolCall) {
		return undefined;
	}

	const toolNameRaw = firstToolCall.function?.name;
	const parseResult = parseToolCallCandidatePartsDetailed({
		call_id: firstToolCall.id,
		tool_input: firstToolCall.function?.arguments,
		tool_name: toolNameRaw,
	});

	if (!parseResult.candidate) {
		const reason = parseResult.rejection_reason;

		throw new GatewayResponseError(
			'sambanova',
			`SambaNova response contained an invalid tool call candidate (${reason}).`,
			buildSambaNovaToolCallRejectionDetails({
				arguments_text: firstToolCall.function?.arguments,
				call_id: firstToolCall.id,
				reason,
				tool_name_raw: toolNameRaw,
				tool_name_resolved: toolNameRaw,
			}),
		);
	}

	return parseResult.candidate;
}

function parseSambaNovaResponse(payload: unknown): ModelResponse {
	if (!payload || typeof payload !== 'object') {
		throw new GatewayResponseError('sambanova', 'SambaNova response must be an object.');
	}

	const response = payload as SambaNovaChatCompletionResponse;
	const choice = response.choices?.[0];
	const content = choice?.message?.content;
	const role = choice?.message?.role;
	const toolCallCandidate = parseSambaNovaToolCallCandidate(response);
	const messageContent =
		typeof content === 'string' ? content : toolCallCandidate !== undefined ? '' : undefined;

	if (!response.model || !choice || typeof messageContent !== 'string' || role !== 'assistant') {
		throw new GatewayResponseError(
			'sambanova',
			'SambaNova response did not contain a valid assistant message.',
		);
	}

	return {
		finish_reason: mapSambaNovaFinishReason(choice.finish_reason),
		message: {
			content: messageContent,
			role: 'assistant',
		},
		model: response.model,
		provider: 'sambanova',
		response_id: response.id,
		tool_call_candidate: toolCallCandidate,
		usage: {
			input_tokens: response.usage?.prompt_tokens,
			output_tokens: response.usage?.completion_tokens,
			total_tokens: response.usage?.total_tokens,
		},
	};
}

async function* parseSambaNovaSseEvents(
	body: NonNullable<Response['body']>,
): AsyncIterable<string> {
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

function parseSambaNovaToolCallAccumulator(
	toolCallsByIndex: ReadonlyMap<number, SambaNovaToolCallAccumulator>,
): ModelResponse['tool_call_candidate'] {
	const firstToolCall = [...toolCallsByIndex.entries()]
		.sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
		.map(([, toolCall]) => toolCall)[0];

	if (!firstToolCall) {
		return undefined;
	}

	const toolNameRaw = firstToolCall.tool_name;
	const parseResult = parseToolCallCandidatePartsDetailed({
		call_id: firstToolCall.call_id,
		tool_input: firstToolCall.arguments_text,
		tool_name: toolNameRaw,
	});

	if (!parseResult.candidate) {
		const reason = parseResult.rejection_reason;

		throw new GatewayResponseError(
			'sambanova',
			`SambaNova streaming response contained an invalid tool call candidate (${reason}).`,
			buildSambaNovaToolCallRejectionDetails({
				arguments_text: firstToolCall.arguments_text,
				call_id: firstToolCall.call_id,
				reason,
				tool_name_raw: toolNameRaw,
				tool_name_resolved: toolNameRaw,
			}),
		);
	}

	return parseResult.candidate;
}

export class SambaNovaGateway implements ModelGateway {
	readonly provider = 'sambanova';
	readonly #config: GatewayProviderConfig;

	constructor(config: GatewayProviderConfig) {
		this.#config = config;
	}

	async generate(request: ModelRequest): Promise<ModelResponse> {
		const payload = await postJson({
			body: buildSambaNovaRequestBody(this.#config, request),
			headers: {
				Authorization: `Bearer ${this.#config.apiKey}`,
			},
			provider: this.provider,
			url: SAMBANOVA_CHAT_COMPLETIONS_URL,
		});

		return parseSambaNovaResponse(payload);
	}

	async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		const requestBody: SambaNovaChatCompletionRequest = {
			...buildSambaNovaRequestBody(this.#config, request),
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
			response = await fetchImplementation(SAMBANOVA_CHAT_COMPLETIONS_URL, {
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
				throw new GatewayResponseError(this.provider, 'SambaNova returned invalid JSON.', {
					cause: error,
					response_body: responseText,
					status_code: response.status,
				});
			}

			yield {
				response: parseSambaNovaResponse(parsedPayload),
				type: 'response.completed',
			};
			return;
		}

		if (!response.body) {
			throw new GatewayResponseError(
				this.provider,
				'SambaNova streaming response did not include a body.',
			);
		}

		const toolCallsByIndex = new Map<number, SambaNovaToolCallAccumulator>();
		let completionTokens: number | undefined;
		let finishReason: string | null | undefined;
		let inputTokens: number | undefined;
		let outputText = '';
		let responseId: string | undefined;
		let responseModel: string | undefined;
		let totalTokens: number | undefined;

		for await (const eventData of parseSambaNovaSseEvents(response.body)) {
			if (eventData === '[DONE]') {
				break;
			}

			let parsedChunk: SambaNovaChatCompletionStreamChunk;

			try {
				parsedChunk = JSON.parse(eventData) as SambaNovaChatCompletionStreamChunk;
			} catch (error: unknown) {
				throw new GatewayResponseError(
					this.provider,
					'SambaNova streaming response returned invalid JSON.',
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

		const toolCallCandidate = parseSambaNovaToolCallAccumulator(toolCallsByIndex);
		const resolvedModel = responseModel ?? request.model ?? this.#config.defaultModel;

		if (!resolvedModel) {
			throw new GatewayResponseError(
				this.provider,
				'SambaNova streaming response did not resolve a model identifier.',
			);
		}

		yield {
			response: {
				finish_reason: mapSambaNovaFinishReason(finishReason),
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
