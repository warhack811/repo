import type { ModelContentPart, NarrationStrategy } from '@runa/types';
import { describe, expect, it } from 'vitest';

import { type TurnIntent, classifyNarration } from './classify.js';

function text(
	index: number,
	value: string,
	options: { readonly narration_eligible?: boolean } = {},
): ModelContentPart {
	return {
		index,
		kind: 'text',
		...(options.narration_eligible !== undefined
			? { narration_eligible: options.narration_eligible }
			: {}),
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

function classify(
	orderedContent: readonly ModelContentPart[],
	options: {
		readonly narration_strategy?: NarrationStrategy;
		readonly ordering_origin?: ModelContentPart['ordering_origin'];
		readonly turn_intent?: TurnIntent;
	} = {},
) {
	return classifyNarration({
		narration_strategy: options.narration_strategy ?? 'temporal_stream',
		ordered_content: orderedContent,
		ordering_origin: options.ordering_origin ?? 'wire_streaming',
		turn_intent: options.turn_intent ?? 'done',
	});
}

describe('classifyNarration', () => {
	it('classifies tool-free done text as final answer', () => {
		expect(classify([text(0, 'Done.')])).toMatchObject({
			emission_decision: 'emit',
			final_answer_text: 'Done.',
			narrations: [],
		});
	});

	it('classifies tool-free awaiting_user text as final answer', () => {
		expect(classify([text(0, 'Which file?')], { turn_intent: 'awaiting_user' })).toMatchObject({
			final_answer_text: 'Which file?',
			narrations: [],
		});
	});

	it('classifies tool-free continuing text as orphan narration', () => {
		expect(classify([text(0, 'Checking the repo.')], { turn_intent: 'continuing' })).toMatchObject({
			final_answer_text: null,
			narrations: [
				{
					sequence_no: 1,
					text: 'Checking the repo.',
				},
			],
		});
	});

	it('links text before one tool to that tool call', () => {
		expect(classify([text(0, 'Reading package.json.'), tool(1, 'call_1')])).toMatchObject({
			final_answer_text: null,
			narrations: [
				{
					linked_tool_call_id: 'call_1',
					sequence_no: 1,
					text: 'Reading package.json.',
				},
			],
		});
	});

	it('keeps after-tool done text as final answer', () => {
		expect(
			classify([text(0, 'Reading package.json.'), tool(1, 'call_1'), text(2, 'Done.')]),
		).toMatchObject({
			final_answer_text: 'Done.',
			narrations: [
				{
					linked_tool_call_id: 'call_1',
					text: 'Reading package.json.',
				},
			],
		});
	});

	it('handles two interleaved tools and a final answer', () => {
		expect(
			classify([
				text(0, 'Reading package.json.'),
				tool(1, 'call_1'),
				text(2, 'Checking scripts.'),
				tool(3, 'call_2'),
				text(4, 'The scripts look fine.'),
			]),
		).toMatchObject({
			final_answer_text: 'The scripts look fine.',
			narrations: [
				{ linked_tool_call_id: 'call_1', sequence_no: 1, text: 'Reading package.json.' },
				{ linked_tool_call_id: 'call_2', sequence_no: 2, text: 'Checking scripts.' },
			],
		});
	});

	it('skips synthetic non-streaming content but preserves full text as final answer', () => {
		expect(
			classify([text(0, 'Synthetic text.'), tool(1, 'call_1'), text(2, 'Done.')], {
				ordering_origin: 'synthetic_non_streaming',
			}),
		).toEqual({
			emission_decision: 'skip_synthetic',
			final_answer_text: 'Synthetic text.Done.',
			narrations: [],
		});
	});

	it('skips unsupported provider strategies', () => {
		expect(
			classify([text(0, 'Unsupported text.'), tool(1, 'call_1')], {
				narration_strategy: 'unsupported',
			}),
		).toMatchObject({
			emission_decision: 'skip_unsupported',
			final_answer_text: 'Unsupported text.',
			narrations: [],
		});
	});

	it('emits native block narration', () => {
		expect(
			classify([text(0, 'Calling native tool.'), tool(1, 'call_native')], {
				narration_strategy: 'native_blocks',
				ordering_origin: 'native_blocks',
			}),
		).toMatchObject({
			emission_decision: 'emit',
			narrations: [{ linked_tool_call_id: 'call_native' }],
		});
	});

	it('keeps narration-ineligible text out of narrations while allowing final answer placement', () => {
		expect(
			classify(
				[
					text(0, 'I will call file.read with arguments {}', {
						narration_eligible: false,
					}),
					tool(1, 'call_1'),
					text(2, 'Final text.', { narration_eligible: false }),
				],
				{ turn_intent: 'done' },
			),
		).toEqual({
			emission_decision: 'emit',
			final_answer_text: 'Final text.',
			narrations: [],
		});
	});

	it('returns empty output for empty ordered content', () => {
		expect(classify([])).toEqual({
			emission_decision: 'emit',
			final_answer_text: null,
			narrations: [],
		});
	});

	it('returns empty output for tool-only ordered content', () => {
		expect(classify([tool(0, 'call_1')])).toEqual({
			emission_decision: 'emit',
			final_answer_text: null,
			narrations: [],
		});
	});

	it('defensively rejects fallthrough high pseudo-parts', () => {
		expect(() =>
			classify([{ index: 0, kind: 'fallthrough_high' } as unknown as ModelContentPart]),
		).toThrow(/fallthrough_high/iu);
	});
});
