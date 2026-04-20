import type { CompiledContextArtifact, ModelMessage, ModelRequest } from '@runa/types';

import type { ComposedContext } from './compose-context.js';

export interface AdaptContextToModelRequestInput {
	readonly composed_context: ComposedContext;
	readonly max_output_tokens?: number;
	readonly messages?: readonly ModelMessage[];
	readonly metadata?: Readonly<Record<string, unknown>>;
	readonly model?: string;
	readonly temperature?: number;
	readonly trace_id: string;
	readonly user_turn: string;
	readonly run_id: string;
}

function toCompiledContextArtifact(composedContext: ComposedContext): CompiledContextArtifact {
	return {
		layers: composedContext.layers.map((layer) => ({
			content: layer.content,
			kind: layer.kind,
			name: layer.name,
		})),
	};
}

export function adaptContextToModelRequest(
	input: AdaptContextToModelRequestInput,
): ModelRequest & { readonly compiled_context: CompiledContextArtifact } {
	return {
		compiled_context: toCompiledContextArtifact(input.composed_context),
		max_output_tokens: input.max_output_tokens,
		messages: [
			...(input.messages ?? []),
			{
				content: input.user_turn,
				role: 'user',
			},
		],
		metadata: input.metadata,
		model: input.model,
		run_id: input.run_id,
		temperature: input.temperature,
		trace_id: input.trace_id,
	};
}
