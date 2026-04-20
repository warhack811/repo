import { uiCopy } from '../../localization/copy.js';
import type { GatewayProvider, RunRequestPayload } from '../../ws-types.js';

export interface CreateRunRequestPayloadInput {
	readonly apiKey: string;
	readonly includePresentationBlocks: boolean;
	readonly model: string;
	readonly prompt: string;
	readonly provider: GatewayProvider;
	readonly runId: string;
	readonly traceId: string;
}

export function createRunRequestPayload(input: CreateRunRequestPayloadInput): RunRequestPayload {
	const promptText = input.prompt.trim();
	const modelName = input.model.trim();
	const apiKeyValue = input.apiKey.trim();

	if (promptText.length === 0) {
		throw new Error(uiCopy.runtime.promptRequired);
	}

	if (modelName.length === 0) {
		throw new Error(uiCopy.runtime.modelRequired);
	}

	return {
		include_presentation_blocks: input.includePresentationBlocks,
		provider: input.provider,
		provider_config: {
			apiKey: apiKeyValue,
		},
		request: {
			max_output_tokens: 256,
			messages: [
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
