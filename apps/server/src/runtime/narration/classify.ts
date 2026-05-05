import type { ModelContentOrderingOrigin, ModelContentPart, NarrationStrategy } from '@runa/types';

export type TurnIntent = 'awaiting_user' | 'continuing' | 'done';

export interface ClassifierInput {
	readonly ordered_content: readonly ModelContentPart[];
	readonly ordering_origin: ModelContentOrderingOrigin;
	readonly narration_strategy: NarrationStrategy;
	readonly turn_intent: TurnIntent;
}

export interface NarrationCandidate {
	readonly narration_eligible: boolean;
	readonly sequence_no: number;
	readonly text: string;
	readonly linked_tool_call_id?: string;
}

export interface ClassifierOutput {
	readonly emission_decision: 'emit' | 'skip_synthetic' | 'skip_unsupported';
	readonly final_answer_text: string | null;
	readonly narrations: readonly NarrationCandidate[];
}

function joinText(parts: readonly ModelContentPart[]): string | null {
	const text = parts
		.filter((part) => part.kind === 'text')
		.map((part) => part.text)
		.join('');

	return text.length > 0 ? text : null;
}

function assertNoFallthroughHighPseudoPart(parts: readonly ModelContentPart[]): void {
	for (const part of parts) {
		const kind = (part as { readonly kind?: unknown }).kind;

		if (kind === 'fallthrough_high') {
			throw new Error('fallthrough_high pseudo-part must not reach narration classifier.');
		}
	}
}

function getEmissionDecision(
	input: Pick<ClassifierInput, 'narration_strategy' | 'ordering_origin'>,
): ClassifierOutput['emission_decision'] {
	if (input.narration_strategy === 'unsupported') {
		return 'skip_unsupported';
	}

	if (input.ordering_origin === 'synthetic_non_streaming') {
		return 'skip_synthetic';
	}

	return 'emit';
}

function getNextToolCallId(
	parts: readonly ModelContentPart[],
	startIndex: number,
): string | undefined {
	for (let index = startIndex + 1; index < parts.length; index += 1) {
		const part = parts[index];

		if (part?.kind === 'tool_use') {
			return part.tool_call_id;
		}
	}

	return undefined;
}

function hasToolUse(parts: readonly ModelContentPart[]): boolean {
	return parts.some((part) => part.kind === 'tool_use');
}

function createNarration(
	part: Extract<ModelContentPart, { kind: 'text' }>,
	sequenceNo: number,
	linkedToolCallId?: string,
): NarrationCandidate | null {
	if (part.narration_eligible === false) {
		return null;
	}

	return {
		...(linkedToolCallId !== undefined ? { linked_tool_call_id: linkedToolCallId } : {}),
		narration_eligible: true,
		sequence_no: sequenceNo,
		text: part.text,
	};
}

export function classifyNarration(input: ClassifierInput): ClassifierOutput {
	assertNoFallthroughHighPseudoPart(input.ordered_content);

	const emissionDecision = getEmissionDecision(input);

	if (emissionDecision !== 'emit') {
		return {
			emission_decision: emissionDecision,
			final_answer_text: joinText(input.ordered_content),
			narrations: [],
		};
	}

	if (input.ordered_content.length === 0) {
		return {
			emission_decision: 'emit',
			final_answer_text: null,
			narrations: [],
		};
	}

	const narrations: NarrationCandidate[] = [];
	const finalAnswerParts: string[] = [];
	const contentHasToolUse = hasToolUse(input.ordered_content);
	let sequenceNo = 1;

	for (let index = 0; index < input.ordered_content.length; index += 1) {
		const part = input.ordered_content[index];

		if (part?.kind !== 'text' || part.text.length === 0) {
			continue;
		}

		const nextToolCallId = getNextToolCallId(input.ordered_content, index);

		if (nextToolCallId !== undefined) {
			const narration = createNarration(part, sequenceNo, nextToolCallId);

			if (narration) {
				narrations.push(narration);
				sequenceNo += 1;
			}
			continue;
		}

		if (!contentHasToolUse && input.turn_intent === 'continuing') {
			const narration = createNarration(part, sequenceNo);

			if (narration) {
				narrations.push(narration);
				sequenceNo += 1;
			}
			continue;
		}

		if (contentHasToolUse && input.turn_intent === 'continuing') {
			const narration = createNarration(part, sequenceNo);

			if (narration) {
				narrations.push(narration);
				sequenceNo += 1;
			}
			continue;
		}

		finalAnswerParts.push(part.text);
	}

	return {
		emission_decision: 'emit',
		final_answer_text: finalAnswerParts.length > 0 ? finalAnswerParts.join('') : null,
		narrations,
	};
}
