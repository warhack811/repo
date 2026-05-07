import type { NarrationRuntimeEvent, ProviderCapabilities, RuntimeEvent } from '@runa/types';

import type { NarrationEmissionRejection } from './emission.js';

export interface NarrationSuppressionLogInput {
	readonly capabilities?: ProviderCapabilities;
	readonly decision: 'skip_synthetic' | 'skip_unsupported';
	readonly model?: string;
	readonly provider?: string;
}

function baseEventFields(event: NarrationRuntimeEvent): Record<string, unknown> {
	return {
		narration_id: event.payload.narration_id,
		sequence_no: event.payload.sequence_no,
		turn_index: event.payload.turn_index,
	};
}

export function createNarrationRuntimeEventLogFields(
	event: RuntimeEvent,
): Record<string, unknown> | null {
	switch (event.event_type) {
		case 'narration.started':
			return {
				...baseEventFields(event),
				locale: event.payload.locale,
				linked_tool_call_id_present: event.payload.linked_tool_call_id !== undefined,
			};
		case 'narration.completed':
			return {
				...baseEventFields(event),
				locale: event.payload.locale,
				linked_tool_call_id_present: event.payload.linked_tool_call_id !== undefined,
				text_length: event.payload.full_text.length,
			};
		case 'narration.superseded':
			return {
				...baseEventFields(event),
			};
		case 'narration.tool_outcome_linked':
			return {
				...baseEventFields(event),
				locale: event.payload.locale,
				outcome: event.payload.outcome,
			};
		default:
			return null;
	}
}

export function createNarrationGuardrailRejectionLogFields(
	rejection: NarrationEmissionRejection,
): Record<string, unknown> {
	return {
		reason: rejection.reason,
		sequence_no: rejection.sequence_no,
		text_length: rejection.text.length,
	};
}

export function createNarrationSuppressionLogFields(
	input: NarrationSuppressionLogInput,
): Record<string, unknown> {
	return {
		decision: input.decision,
		emits_reasoning_content: input.capabilities?.emits_reasoning_content ?? false,
		model: input.model,
		narration_strategy: input.capabilities?.narration_strategy ?? 'unsupported',
		provider: input.provider,
		streaming_supported: input.capabilities?.streaming_supported ?? false,
		tool_call_fallthrough_risk: input.capabilities?.tool_call_fallthrough_risk ?? 'none',
	};
}
