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

export interface PessimisticStreamingStrategyResult {
	readonly classifier_output: ClassifierOutput;
	readonly flush_text: string;
	readonly warnings: readonly StreamingStrategyWarning[];
}

export class PessimisticNarrationStreamingStrategy {
	readonly #config: StreamingStrategyConfig;
	readonly #parts: ModelContentPart[] = [];
	readonly #startedAt: number;

	constructor(config: Partial<StreamingStrategyConfig> = {}, now: number = Date.now()) {
		this.#config = {
			...defaultStreamingStrategyConfig,
			...config,
			mode: 'pessimistic',
		};
		this.#startedAt = now;
	}

	observePart(part: ModelContentPart): void {
		this.#parts.push(part);
	}

	checkTimeout(now: number = Date.now()): readonly StreamingStrategyWarning[] {
		const elapsedMs = now - this.#startedAt;
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
