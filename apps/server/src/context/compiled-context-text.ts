import type { CompiledContextArtifact, CompiledContextLayer } from '@runa/types';

export interface TextUsageEstimate {
	readonly char_count: number;
	readonly token_count: number;
}

export interface CompiledContextLayerUsage extends TextUsageEstimate {
	readonly kind: string;
	readonly name: string;
}

export interface CompiledContextUsage {
	readonly layer_count: number;
	readonly layers: readonly CompiledContextLayerUsage[];
	readonly total: TextUsageEstimate;
}

function sortValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortValue);
	}

	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
				.map(([key, nestedValue]) => [key, sortValue(nestedValue)]),
		);
	}

	return value;
}

export function stableSerializeContextValue(value: unknown): string {
	return JSON.stringify(sortValue(value), null, 2);
}

export function estimateTokenCountFromCharCount(charCount: number): number {
	if (!Number.isFinite(charCount) || charCount <= 0) {
		return 0;
	}

	// Keep the approximation intentionally small, stable, and provider-agnostic.
	return Math.ceil(charCount / 4);
}

export function estimateTextUsage(text: string): TextUsageEstimate {
	return {
		char_count: text.length,
		token_count: estimateTokenCountFromCharCount(text.length),
	};
}

export function formatCompiledContextLayer(layer: CompiledContextLayer): string {
	return `[${layer.name}:${layer.kind}]\n${stableSerializeContextValue(layer.content)}`;
}

export function formatCompiledContextArtifact(
	compiledContext?: CompiledContextArtifact,
): string | undefined {
	if (!compiledContext || compiledContext.layers.length === 0) {
		return undefined;
	}

	return compiledContext.layers.map((layer) => formatCompiledContextLayer(layer)).join('\n\n');
}

export function measureCompiledContextUsage(
	compiledContext?: CompiledContextArtifact,
): CompiledContextUsage | undefined {
	if (!compiledContext || compiledContext.layers.length === 0) {
		return undefined;
	}

	const layers = compiledContext.layers.map((layer) => {
		const usage = estimateTextUsage(formatCompiledContextLayer(layer));

		return {
			...usage,
			kind: layer.kind,
			name: layer.name,
		};
	});

	return {
		layer_count: layers.length,
		layers,
		total: layers.reduce<TextUsageEstimate>(
			(total, layer) => ({
				char_count: total.char_count + layer.char_count,
				token_count: total.token_count + layer.token_count,
			}),
			{
				char_count: 0,
				token_count: 0,
			},
		),
	};
}
