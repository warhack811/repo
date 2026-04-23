import type { ModelAttachment, ModelMessage } from '@runa/types';
import { uiCopy } from '../../localization/copy.js';
import type { GatewayProvider, RunRequestPayload } from '../../ws-types.js';

export interface CreateRunRequestPayloadInput {
	readonly apiKey: string;
	readonly attachments?: readonly ModelAttachment[];
	readonly conversationId?: string | null;
	readonly desktopTargetConnectionId?: string | null;
	readonly includePresentationBlocks: boolean;
	readonly model: string;
	readonly messages?: readonly ModelMessage[];
	readonly prompt: string;
	readonly provider: GatewayProvider;
	readonly runId: string;
	readonly traceId: string;
}

export function createRunRequestPayload(input: CreateRunRequestPayloadInput): RunRequestPayload {
	const promptText = input.prompt.trim();
	const modelName = input.model.trim();
	const apiKeyValue = input.apiKey.trim();
	const attachments = input.attachments?.filter((attachment) => attachment.size_bytes > 0) ?? [];
	const providedMessages = input.messages?.filter((message) => message.content.trim().length > 0);

	if (promptText.length === 0) {
		throw new Error(uiCopy.runtime.promptRequired);
	}

	if (modelName.length === 0) {
		throw new Error(uiCopy.runtime.modelRequired);
	}

	return {
		attachments: attachments.length > 0 ? attachments : undefined,
		include_presentation_blocks: input.includePresentationBlocks,
		conversation_id: input.conversationId?.trim() || undefined,
		desktop_target_connection_id: input.desktopTargetConnectionId?.trim() || undefined,
		provider: input.provider,
		provider_config: {
			apiKey: apiKeyValue,
		},
		request: {
			max_output_tokens: 256,
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
