import type { ModelContentPart, ModelToolCallCandidate } from '@runa/types';

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
): readonly ModelContentPart[] {
	const parts: ModelContentPart[] = [];
	let index = 0;

	if (text.length > 0) {
		parts.push({
			index,
			kind: 'text',
			text,
		});
		index += 1;
	}

	for (const toolCall of toolCalls) {
		parts.push({
			index,
			input: toolCall.tool_input,
			kind: 'tool_use',
			tool_call_id: toolCall.call_id,
			tool_name: toolCall.tool_name,
		});
		index += 1;
	}

	return parts;
}
