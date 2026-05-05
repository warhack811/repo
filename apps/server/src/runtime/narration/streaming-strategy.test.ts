import type { ModelContentPart } from '@runa/types';
import { describe, expect, it } from 'vitest';

import { PessimisticNarrationStreamingStrategy } from './streaming-strategy.js';

function text(index: number, value: string): ModelContentPart {
	return {
		index,
		kind: 'text',
		ordering_origin: 'wire_streaming',
		text: value,
	};
}

function tool(index: number, callId: string): ModelContentPart {
	return {
		index,
		input: {},
		kind: 'tool_use',
		ordering_origin: 'wire_streaming',
		tool_call_id: callId,
		tool_name: 'file.read',
	};
}

describe('PessimisticNarrationStreamingStrategy', () => {
	it('buffers text until a tool use appears and then flushes narration text', () => {
		const strategy = new PessimisticNarrationStreamingStrategy({}, 0);
		strategy.observePart(text(0, 'Reading package.json.'));
		strategy.observePart(tool(1, 'call_1'));

		expect(
			strategy.finish({
				narration_strategy: 'temporal_stream',
				ordering_origin: 'wire_streaming',
				turn_intent: 'continuing',
			}),
		).toMatchObject({
			flush_text: 'Reading package.json.',
			warnings: [],
		});
	});

	it('keeps waiting in pessimistic mode after the timeout and reports a warning', () => {
		const strategy = new PessimisticNarrationStreamingStrategy({ buffer_timeout_ms: 200 }, 0);
		strategy.observePart(text(0, 'Still deciding placement.'));

		expect(strategy.checkTimeout(250)).toEqual([
			{
				elapsed_ms: 250,
				reason: 'buffer_timeout',
			},
		]);
	});

	it('classifies turn end without tool use as final answer', () => {
		const strategy = new PessimisticNarrationStreamingStrategy({}, 0);
		strategy.observePart(text(0, 'Final answer.'));

		expect(
			strategy.finish({
				narration_strategy: 'temporal_stream',
				ordering_origin: 'wire_streaming',
				turn_intent: 'done',
			}).classifier_output,
		).toMatchObject({
			final_answer_text: 'Final answer.',
			narrations: [],
		});
	});

	it('delegates tool-containing turn end to the classifier', () => {
		const strategy = new PessimisticNarrationStreamingStrategy({}, 0);
		strategy.observePart(text(0, 'Reading package.json.'));
		strategy.observePart(tool(1, 'call_1'));
		strategy.observePart(text(2, 'Continuing analysis.'));

		expect(
			strategy.finish({
				narration_strategy: 'temporal_stream',
				ordering_origin: 'wire_streaming',
				turn_intent: 'continuing',
			}).classifier_output,
		).toMatchObject({
			final_answer_text: null,
			narrations: [
				{ linked_tool_call_id: 'call_1', text: 'Reading package.json.' },
				{ text: 'Continuing analysis.' },
			],
		});
	});
});
