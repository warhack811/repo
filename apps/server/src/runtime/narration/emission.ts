import type {
	ModelContentOrderingOrigin,
	ModelResponse,
	NarrationStrategy,
	ProviderCapabilities,
	RuntimeEvent,
	SupportedLocale,
} from '@runa/types';

import {
	buildNarrationCompletedEvent,
	buildNarrationStartedEvent,
	buildNarrationTokenEvent,
} from '../runtime-events.js';
import { type TurnIntent, classifyNarration } from './classify.js';
import { type GuardrailRejectReason, applyGuardrails } from './guardrails.js';

export interface NarrationEmissionInput {
	readonly base_runtime_sequence_no: number;
	readonly capabilities?: ProviderCapabilities;
	readonly locale?: SupportedLocale;
	readonly model_response: ModelResponse;
	readonly previous_narrations?: readonly string[];
	readonly recent_tool_results?: readonly string[];
	readonly run_id: string;
	readonly trace_id: string;
	readonly turn_index: number;
	readonly turn_intent: TurnIntent;
}

export interface NarrationEmissionRejection {
	readonly reason: GuardrailRejectReason;
	readonly sequence_no: number;
	readonly text: string;
}

export interface LinkedNarration {
	readonly narration_id: string;
	readonly sequence_no: number;
	readonly tool_call_id: string;
}

export interface NarrationEmissionOutput {
	readonly emission_decision: 'emit' | 'skip_synthetic' | 'skip_unsupported';
	readonly events: readonly RuntimeEvent[];
	readonly final_answer_text: string | null;
	readonly high_fallthrough_count: number;
	readonly linked_narrations: readonly LinkedNarration[];
	readonly rejections: readonly NarrationEmissionRejection[];
}

function resolveOrderingOrigin(modelResponse: ModelResponse): ModelContentOrderingOrigin {
	return modelResponse.message.ordered_content?.[0]?.ordering_origin ?? 'synthetic_non_streaming';
}

function resolveNarrationStrategy(capabilities?: ProviderCapabilities): NarrationStrategy {
	return capabilities?.narration_strategy ?? 'unsupported';
}

export function countHighFallthroughSignals(modelResponse: ModelResponse): number {
	return (
		modelResponse.message.fallthrough_detected?.filter((signal) => signal.confidence === 'high')
			.length ?? 0
	);
}

export function buildNarrationEmissionEvents(
	input: NarrationEmissionInput,
): NarrationEmissionOutput {
	const highFallthroughCount = countHighFallthroughSignals(input.model_response);
	const orderedContent = input.model_response.message.ordered_content ?? [];
	const classifierOutput = classifyNarration({
		narration_strategy: resolveNarrationStrategy(input.capabilities),
		ordered_content: orderedContent,
		ordering_origin: resolveOrderingOrigin(input.model_response),
		turn_intent: input.turn_intent,
	});

	if (classifierOutput.emission_decision !== 'emit') {
		return {
			emission_decision: classifierOutput.emission_decision,
			events: [],
			final_answer_text: classifierOutput.final_answer_text,
			high_fallthrough_count: highFallthroughCount,
			linked_narrations: [],
			rejections: [],
		};
	}

	const locale = input.locale ?? 'tr';
	const events: RuntimeEvent[] = [];
	const linkedNarrations: LinkedNarration[] = [];
	const rejections: NarrationEmissionRejection[] = [];
	let runtimeSequenceNo = input.base_runtime_sequence_no;

	for (const candidate of classifierOutput.narrations) {
		const guardrailResult = applyGuardrails(
			candidate.text,
			{
				locale,
				previous_narrations: input.previous_narrations ?? [],
			},
			input.recent_tool_results ?? [],
		);

		if (!guardrailResult.accepted || guardrailResult.sanitized === undefined) {
			rejections.push({
				reason: guardrailResult.reject_reason ?? 'empty',
				sequence_no: candidate.sequence_no,
				text: candidate.text,
			});
			continue;
		}

		const narrationId = `${input.run_id}:turn:${input.turn_index}:narration:${candidate.sequence_no}`;
		const payloadBase = {
			linked_tool_call_id: candidate.linked_tool_call_id,
			locale,
			narration_id: narrationId,
			sequence_no: candidate.sequence_no,
			turn_index: input.turn_index,
		};

		events.push(
			buildNarrationStartedEvent(payloadBase, {
				run_id: input.run_id,
				sequence_no: runtimeSequenceNo,
				trace_id: input.trace_id,
			}),
		);
		runtimeSequenceNo += 1;

		events.push(
			buildNarrationTokenEvent(
				{
					...payloadBase,
					text_delta: guardrailResult.sanitized,
				},
				{
					run_id: input.run_id,
					sequence_no: runtimeSequenceNo,
					trace_id: input.trace_id,
				},
			),
		);
		runtimeSequenceNo += 1;

		events.push(
			buildNarrationCompletedEvent(
				{
					...payloadBase,
					full_text: guardrailResult.sanitized,
				},
				{
					run_id: input.run_id,
					sequence_no: runtimeSequenceNo,
					trace_id: input.trace_id,
				},
			),
		);
		runtimeSequenceNo += 1;

		if (candidate.linked_tool_call_id !== undefined) {
			linkedNarrations.push({
				narration_id: narrationId,
				sequence_no: candidate.sequence_no,
				tool_call_id: candidate.linked_tool_call_id,
			});
		}
	}

	return {
		emission_decision: classifierOutput.emission_decision,
		events,
		final_answer_text: classifierOutput.final_answer_text,
		high_fallthrough_count: highFallthroughCount,
		linked_narrations: linkedNarrations,
		rejections,
	};
}
