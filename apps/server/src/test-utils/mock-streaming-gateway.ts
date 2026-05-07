import type {
	ModelGateway,
	ModelRequest,
	ModelResponse,
	ModelStreamChunk,
	ProviderCapabilities,
} from '@runa/types';

export interface MockStreamingGatewayInput {
	capabilities: ProviderCapabilities;
	chunks: readonly ModelStreamChunk[];
	finalResponse?: ModelResponse;
}

export function createMockStreamingGateway(input: MockStreamingGatewayInput): ModelGateway {
	const chunksFrozen = [...input.chunks];

	return {
		capabilities: input.capabilities,

		async *stream(_request: ModelRequest): AsyncIterableIterator<ModelStreamChunk> {
			for (const chunk of chunksFrozen) {
				yield chunk;
			}
		},

		async generate(_request: ModelRequest): Promise<ModelResponse> {
			if (input.finalResponse) {
				return input.finalResponse;
			}

			const completed = chunksFrozen.find(
				(c): c is Extract<ModelStreamChunk, { type: 'response.completed' }> =>
					c.type === 'response.completed',
			);

			if (completed) {
				return completed.response;
			}

			const textParts = chunksFrozen
				.filter(
					(c): c is Extract<ModelStreamChunk, { type: 'text.delta' }> => c.type === 'text.delta',
				)
				.map((c) => c.text_delta);

			return {
				message: {
					content: textParts.join(''),
					role: 'assistant',
					ordered_content: [],
				},
				finish_reason: 'stop',
				model: 'mock',
				provider: 'mock',
			};
		},
	};
}
