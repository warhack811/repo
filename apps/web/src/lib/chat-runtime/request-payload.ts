import type { ModelAttachment, ModelMessage } from '@runa/types';
import { defaultLocale, uiCopy } from '../../localization/copy.js';
import type { SupportedLocale } from '../../localization/copy.js';
import type { ApprovalMode, GatewayProvider, RunRequestPayload } from '../../ws-types.js';

export const DEFAULT_CHAT_MAX_OUTPUT_TOKENS = 2048;

const TURKISH_SIGNAL_PATTERN =
	/[Ã§ÄŸÄ±Ã¶ÅŸÃ¼Ã‡ÄÄ°Ã–ÅÃœ]|\b(merhaba|lutfen|lÃ¼tfen|dosya|komut|kontrol|Ã§alÄ±ÅŸtÄ±r|calistir|proje|sunucu|oku|yaz|bul)\b/iu;
const ENGLISH_SIGNAL_PATTERN =
	/\b(hello|please|could|would|should|what|how|read|check|find|write|run|project|server|file|command)\b/iu;

export interface CreateRunRequestPayloadInput {
	readonly apiKey: string;
	readonly approvalMode?: ApprovalMode;
	readonly attachments?: readonly ModelAttachment[];
	readonly conversationId?: string | null;
	readonly desktopTargetConnectionId?: string | null;
	readonly includePresentationBlocks: boolean;
	readonly locale?: SupportedLocale;
	readonly model: string;
	readonly messages?: readonly ModelMessage[];
	readonly prompt: string;
	readonly provider: GatewayProvider;
	readonly runId: string;
	readonly traceId: string;
	readonly workingDirectory?: string | null;
}

function inferLocaleFromText(text: string): SupportedLocale {
	if (TURKISH_SIGNAL_PATTERN.test(text)) {
		return 'tr';
	}

	if (ENGLISH_SIGNAL_PATTERN.test(text)) {
		return 'en';
	}

	return defaultLocale;
}

function resolveRequestLocale(input: CreateRunRequestPayloadInput): SupportedLocale {
	if (input.locale) {
		return input.locale;
	}

	const lastUserMessage = [...(input.messages ?? [])]
		.reverse()
		.find((message) => message.role === 'user' && message.content.trim().length > 0);

	return inferLocaleFromText(lastUserMessage?.content ?? input.prompt);
}

export function createRunRequestPayload(input: CreateRunRequestPayloadInput): RunRequestPayload {
	const promptText = input.prompt.trim();
	const modelName = input.model.trim();
	const apiKeyValue = input.apiKey.trim();
	const attachments = input.attachments?.filter((attachment) => attachment.size_bytes > 0) ?? [];
	const providedMessages = input.messages?.filter((message) => message.content.trim().length > 0);
	const selectedWorkingDirectory = input.workingDirectory?.trim();

	if (promptText.length === 0) {
		throw new Error(uiCopy.runtime.promptRequired);
	}

	if (modelName.length === 0) {
		throw new Error(uiCopy.runtime.modelRequired);
	}

	return {
		approval_policy: {
			mode: input.approvalMode ?? 'standard',
		},
		attachments: attachments.length > 0 ? attachments : undefined,
		include_presentation_blocks: input.includePresentationBlocks,
		conversation_id: input.conversationId?.trim() || undefined,
		desktop_target_connection_id: input.desktopTargetConnectionId?.trim() || undefined,
		...(selectedWorkingDirectory && selectedWorkingDirectory.length > 0
			? {
					working_directory: selectedWorkingDirectory,
				}
			: {}),
		locale: resolveRequestLocale(input),
		provider: input.provider,
		provider_config: {
			apiKey: apiKeyValue,
		},
		request: {
			max_output_tokens: DEFAULT_CHAT_MAX_OUTPUT_TOKENS,
			messages:
				providedMessages && providedMessages.length > 0
					? providedMessages
					: [
							{
								content: promptText,
								role: 'user',
							},
						],
			model: modelName,
		},
		run_id: input.runId,
		trace_id: input.traceId,
	};
}
