import type {
	ModelAttachment,
	ModelGateway,
	ModelRequest,
	ModelResponse,
	ModelStreamChunk,
} from '@runa/types';

import { formatCompiledContext } from './compiled-context.js';
import { GatewayConfigurationError, GatewayRequestError, GatewayResponseError } from './errors.js';
import { postJson } from './provider-http.js';
import type { GatewayProviderConfig } from './providers.js';
import { buildToolJsonSchema } from './request-tools.js';
import { parseToolCallCandidateParts } from './tool-call-candidate.js';

interface ClaudeMessageRequest {
	readonly content:
		| string
		| ReadonlyArray<
				| {
						readonly text: string;
						readonly type: 'text';
				  }
				| {
						readonly source: {
							readonly data: string;
							readonly media_type: string;
							readonly type: 'base64';
						};
						readonly type: 'image';
				  }
		  >;
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
	readonly stream?: boolean;
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

interface ClaudeMessageStartEvent {
	readonly message?: {
		readonly id?: string;
		readonly model?: string;
		readonly usage?: {
			readonly input_tokens?: number;
			readonly output_tokens?: number;
		};
	};
}

interface ClaudeContentBlockStartEvent {
	readonly content_block?: {
		readonly id?: string;
		readonly input?: unknown;
		readonly name?: string;
		readonly text?: string;
		readonly type?: string;
	};
	readonly index?: number;
}

interface ClaudeContentBlockDeltaEvent {
	readonly delta?: {
		readonly partial_json?: string;
		readonly text?: string;
		readonly type?: string;
	};
	readonly index?: number;
}

interface ClaudeMessageDeltaEvent {
	readonly delta?: {
		readonly stop_reason?: string | null;
	};
	readonly usage?: {
		readonly input_tokens?: number;
		readonly output_tokens?: number;
	};
}

interface ClaudeStreamToolUseAccumulator {
	call_id?: string;
	input_object?: unknown;
	input_text: string;
	tool_name?: string;
}

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

function readBase64DataUrlPayload(dataUrl: string): {
	readonly data: string;
	readonly media_type: string;
} {
	const match = /^data:(.+);base64,(.+)$/u.exec(dataUrl);

	if (!match) {
		throw new GatewayRequestError('claude', 'Claude image attachments require a valid data URL.');
	}

	const [, mediaType, data] = match;

	if (mediaType === undefined || data === undefined) {
		throw new GatewayRequestError('claude', 'Claude image attachments require a valid data URL.');
	}

	return {
		data,
		media_type: mediaType,
	};
}

function buildClaudeAttachmentContent(
	attachments: readonly ModelAttachment[],
): Exclude<ClaudeMessageRequest['content'], string> {
	return attachments.map((attachment) => {
		if (attachment.kind === 'image') {
			const source = readBase64DataUrlPayload(attachment.data_url);

			return {
				source: {
					data: source.data,
					media_type: source.media_type,
					type: 'base64' as const,
				},
				type: 'image' as const,
			};
		}

		return {
			text: `Attached text file (${attachment.filename ?? attachment.blob_id}, ${attachment.media_type}):\n${attachment.text_content}`,
			type: 'text' as const,
		};
	});
}

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
	const lastUserMessageIndex = [...request.messages]
		.map((message, index) => ({ index, role: message.role }))
		.reverse()
		.find((entry) => entry.role === 'user')?.index;
	const conversationMessages = request.messages.flatMap((message, index) => {
		if (!isClaudeConversationMessage(message)) {
			return [];
		}

		return [
			{
				content:
					index === lastUserMessageIndex && (request.attachments?.length ?? 0) > 0
						? [
								...(message.content.trim().length > 0
									? [
											{
												text: message.content,
												type: 'text' as const,
											},
										]
									: []),
								...buildClaudeAttachmentContent(request.attachments ?? []),
							]
						: message.content,
				role: message.role,
			} satisfies ClaudeMessageRequest,
		];
	});

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

async function* parseClaudeSseEvents(
	body: NonNullable<Response['body']>,
): AsyncIterable<Readonly<{ data: string; event?: string }>> {
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
				const lines = eventBlock.split(/\r?\n/u);
				const eventName = lines
					.find((line) => line.startsWith('event:'))
					?.slice(6)
					.trim();
				const data = lines
					.filter((line) => line.startsWith('data:'))
					.map((line) => line.slice(5).trim())
					.join('\n');

				if (data.length > 0) {
					yield { data, event: eventName };
				}
			}
		}

		buffer += decoder.decode();
		const lines = buffer.split(/\r?\n/u);
		const trailingData = lines
			.filter((line) => line.startsWith('data:'))
			.map((line) => line.slice(5).trim())
			.join('\n');

		if (trailingData.length > 0) {
			yield {
				data: trailingData,
				event: lines
					.find((line) => line.startsWith('event:'))
					?.slice(6)
					.trim(),
			};
		}
	} finally {
		reader.releaseLock();
	}
}

function parseClaudeStreamToolCallCandidate(
	toolUsesByIndex: ReadonlyMap<number, ClaudeStreamToolUseAccumulator>,
): ModelResponse['tool_call_candidate'] {
	const firstToolUse = [...toolUsesByIndex.entries()]
		.sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
		.map(([, toolUse]) => toolUse)[0];

	if (!firstToolUse) {
		return undefined;
	}

	const candidate = parseToolCallCandidateParts({
		call_id: firstToolUse.call_id,
		tool_input:
			firstToolUse.input_text.length > 0 ? firstToolUse.input_text : firstToolUse.input_object,
		tool_name: firstToolUse.tool_name,
	});

	if (!candidate) {
		throw new GatewayResponseError(
			'claude',
			'Claude streaming response contained an invalid tool call candidate.',
		);
	}

	return candidate;
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

	async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		const requestBody: ClaudeMessagesRequest = {
			...buildClaudeRequestBody(this.#config, request),
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
			response = await fetchImplementation(ANTHROPIC_MESSAGES_URL, {
				body: JSON.stringify(requestBody),
				headers: {
					'anthropic-version': ANTHROPIC_VERSION,
					'content-type': 'application/json',
					'x-api-key': this.#config.apiKey,
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
				throw new GatewayResponseError(this.provider, 'Claude returned invalid JSON.', {
					cause: error,
					response_body: responseText,
					status_code: response.status,
				});
			}

			yield {
				response: parseClaudeResponse(parsedPayload),
				type: 'response.completed',
			};
			return;
		}

		if (!response.body) {
			throw new GatewayResponseError(
				this.provider,
				'Claude streaming response did not include a body.',
			);
		}

		let inputTokens: number | undefined;
		let messageId: string | undefined;
		let outputText = '';
		let outputTokens: number | undefined;
		let responseModel: string | undefined;
		let stopReason: string | null | undefined;
		const toolUsesByIndex = new Map<number, ClaudeStreamToolUseAccumulator>();

		for await (const eventEnvelope of parseClaudeSseEvents(response.body)) {
			if (eventEnvelope.data === '[DONE]') {
				break;
			}

			switch (eventEnvelope.event) {
				case 'message_start': {
					const eventPayload = JSON.parse(eventEnvelope.data) as ClaudeMessageStartEvent;
					messageId ??= eventPayload.message?.id;
					responseModel ??= eventPayload.message?.model;
					inputTokens = eventPayload.message?.usage?.input_tokens ?? inputTokens;
					outputTokens = eventPayload.message?.usage?.output_tokens ?? outputTokens;
					break;
				}
				case 'content_block_start': {
					const eventPayload = JSON.parse(eventEnvelope.data) as ClaudeContentBlockStartEvent;
					const blockIndex = eventPayload.index ?? 0;

					if (eventPayload.content_block?.type !== 'tool_use') {
						break;
					}

					toolUsesByIndex.set(blockIndex, {
						call_id: eventPayload.content_block.id,
						input_object: eventPayload.content_block.input,
						input_text: '',
						tool_name: eventPayload.content_block.name,
					});
					break;
				}
				case 'content_block_delta': {
					const eventPayload = JSON.parse(eventEnvelope.data) as ClaudeContentBlockDeltaEvent;
					const delta = eventPayload.delta;

					if (
						delta?.type === 'text_delta' &&
						typeof delta.text === 'string' &&
						delta.text.length > 0
					) {
						outputText += delta.text;
						yield {
							text_delta: delta.text,
							type: 'text.delta',
						};
					}

					if (delta?.type === 'input_json_delta') {
						const blockIndex = eventPayload.index ?? 0;
						const existingToolUse = toolUsesByIndex.get(blockIndex) ?? {
							input_text: '',
						};

						existingToolUse.input_text += delta.partial_json ?? '';
						toolUsesByIndex.set(blockIndex, existingToolUse);
					}
					break;
				}
				case 'message_delta': {
					const eventPayload = JSON.parse(eventEnvelope.data) as ClaudeMessageDeltaEvent;
					stopReason = eventPayload.delta?.stop_reason ?? stopReason;
					inputTokens = eventPayload.usage?.input_tokens ?? inputTokens;
					outputTokens = eventPayload.usage?.output_tokens ?? outputTokens;
					break;
				}
				case 'ping':
				case 'content_block_stop':
				case 'message_stop':
					break;
				default:
					break;
			}
		}

		const toolCallCandidate = parseClaudeStreamToolCallCandidate(toolUsesByIndex);
		const resolvedModel = responseModel ?? request.model ?? this.#config.defaultModel;

		if (!resolvedModel) {
			throw new GatewayResponseError(
				this.provider,
				'Claude streaming response did not resolve a model identifier.',
			);
		}

		yield {
			response: {
				finish_reason: mapClaudeFinishReason(stopReason),
				message: {
					content: outputText.length > 0 ? outputText : toolCallCandidate ? '' : outputText,
					role: 'assistant',
				},
				model: resolvedModel,
				provider: this.provider,
				response_id: messageId,
				tool_call_candidate: toolCallCandidate,
				usage: {
					input_tokens: inputTokens,
					output_tokens: outputTokens,
					total_tokens:
						typeof inputTokens === 'number' && typeof outputTokens === 'number'
							? inputTokens + outputTokens
							: undefined,
				},
			},
			type: 'response.completed',
		};
	}
}
