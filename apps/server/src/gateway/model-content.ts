import type {
	ModelContentOrderingOrigin,
	ModelContentPart,
	ModelToolCallCandidate,
} from '@runa/types';

export function getOrderedToolCallCandidates(
	candidate: ModelToolCallCandidate | undefined,
	candidates: readonly ModelToolCallCandidate[] | undefined,
): readonly ModelToolCallCandidate[] {
	if (candidates !== undefined) {
		return candidates;
	}

	return candidate !== undefined ? [candidate] : [];
}

export function createOrderedContentFromTextAndToolCalls(
	text: string,
	toolCalls: readonly ModelToolCallCandidate[],
	orderingOrigin: ModelContentOrderingOrigin = 'synthetic_non_streaming',
): readonly ModelContentPart[] {
	const parts: ModelContentPart[] = [];
	let index = 0;

	if (text.length > 0) {
		parts.push({
			index,
			kind: 'text',
			ordering_origin: orderingOrigin,
			text,
		});
		index += 1;
	}

	for (const toolCall of toolCalls) {
		parts.push({
			index,
			input: toolCall.tool_input,
			kind: 'tool_use',
			ordering_origin: orderingOrigin,
			tool_call_id: toolCall.call_id,
			tool_name: toolCall.tool_name,
		});
		index += 1;
	}

	return parts;
}
