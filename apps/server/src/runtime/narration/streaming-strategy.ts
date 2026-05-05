import type { ModelContentPart } from '@runa/types';

import { type ClassifierOutput, type TurnIntent, classifyNarration } from './classify.js';

export interface StreamingStrategyConfig {
	readonly buffer_timeout_ms: number;
	readonly mode: 'optimistic' | 'pessimistic';
}

export const defaultStreamingStrategyConfig: StreamingStrategyConfig = {
	buffer_timeout_ms: 200,
	mode: 'pessimistic',
};

export interface StreamingStrategyWarning {
	readonly elapsed_ms: number;
	readonly reason: 'buffer_timeout';
}

export interface CreateStrategyOptions {
	readonly buffer_timeout_ms?: number;
	readonly locale?: string;
	readonly narration_strategy?: string;
	readonly ordering_origin?: string;
	readonly run_id: string;
	readonly trace_id: string;
	readonly turn_index: number;
}

export function createPessimisticNarrationStrategy(
	options: CreateStrategyOptions,
): PessimisticNarrationStreamingStrategy {
	return new PessimisticNarrationStreamingStrategy({
		buffer_timeout_ms: options.buffer_timeout_ms ?? 200,
		mode: 'pessimistic',
	});
}

export interface PessimisticStreamingStrategyResult {
	readonly classifier_output: ClassifierOutput;
	readonly flush_text: string;
	readonly warnings: readonly StreamingStrategyWarning[];
}

export type DecisionKind = 'buffered' | 'final_answer_token' | 'narration_token';

export interface SingleDecision {
	readonly kind: DecisionKind;
	readonly linked_tool_call_id?: string;
	readonly text_delta: string;
}

export class PessimisticNarrationStreamingStrategy {
	readonly #config: StreamingStrategyConfig;
	readonly #parts: ModelContentPart[] = [];
	readonly #startedAt: number;
	#lastActivityAt: number;
	#flushSequence = 0;

	constructor(config: Partial<StreamingStrategyConfig> = {}, now: number = Date.now()) {
		this.#config = {
			...defaultStreamingStrategyConfig,
			...config,
			mode: 'pessimistic',
		};
		this.#startedAt = now;
		this.#lastActivityAt = now;
	}

	onTextDelta(
		textDelta: string,
		contentPartIndex?: number,
		now: number = Date.now(),
	): SingleDecision {
		this.#lastActivityAt = now;

		const part: ModelContentPart = {
			index: contentPartIndex ?? this.#parts.length,
			kind: 'text',
			ordering_origin: 'wire_streaming',
			text: textDelta,
		};
		this.#parts.push(part);

		const hasPendingToolUse = this.#parts.some((p) => p.kind === 'tool_use');

		if (hasPendingToolUse) {
			this.#flushSequence += 1;
			const linkedToolUse = this.#parts.filter((p) => p.kind === 'tool_use').pop();
			return {
				kind: 'narration_token',
				linked_tool_call_id: linkedToolUse?.tool_call_id,
				text_delta: textDelta,
			};
		}

		return {
			kind: 'buffered',
			text_delta: textDelta,
		};
	}

	/**
	 * Deferred: Reserved for future real-time tool flush. Currently tool_use flushes only at response.completed.
	 * See work-narration.md for architecture and Phase 6+ timeline.
	 */
	onToolUseStart(
		toolName: string,
		toolCallId: string,
		contentPartIndex?: number,
		now: number = Date.now(),
	): SingleDecision {
		this.#lastActivityAt = now;

		const part: ModelContentPart = {
			index: contentPartIndex ?? this.#parts.length,
			input: {},
			kind: 'tool_use',
			ordering_origin: 'wire_streaming',
			tool_call_id: toolCallId,
			tool_name: toolName,
		};
		this.#parts.push(part);

		this.#flushSequence += 1;
		return {
			kind: 'narration_token',
			text_delta: '',
		};
	}

	hasPendingNarration(): boolean {
		return this.#parts.some((p) => p.kind === 'text' && p.text.length > 0);
	}

	checkTimeout(now: number = Date.now()): readonly StreamingStrategyWarning[] {
		const elapsedMs = now - this.#lastActivityAt;
		const hasText = this.#parts.some((part) => part.kind === 'text' && part.text.length > 0);
		const hasToolUse = this.#parts.some((part) => part.kind === 'tool_use');

		if (hasText && !hasToolUse && elapsedMs >= this.#config.buffer_timeout_ms) {
			return [
				{
					elapsed_ms: elapsedMs,
					reason: 'buffer_timeout',
				},
			];
		}

		return [];
	}

	async sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	finish(input: {
		readonly narration_strategy: Parameters<typeof classifyNarration>[0]['narration_strategy'];
		readonly ordering_origin: Parameters<typeof classifyNarration>[0]['ordering_origin'];
		readonly turn_intent: TurnIntent;
	}): PessimisticStreamingStrategyResult {
		const classifierOutput = classifyNarration({
			narration_strategy: input.narration_strategy,
			ordered_content: this.#parts,
			ordering_origin: input.ordering_origin,
			turn_intent: input.turn_intent,
		});

		return {
			classifier_output: classifierOutput,
			flush_text: classifierOutput.narrations.map((narration) => narration.text).join(''),
			warnings: this.checkTimeout(),
		};
	}
}
