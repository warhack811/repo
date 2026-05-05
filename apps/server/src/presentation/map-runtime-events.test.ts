import type { RenderBlock, RuntimeEvent, WorkNarrationBlock } from '@runa/types';
import { describe, expect, it } from 'vitest';

import {
	buildModelCompletedEvent,
	buildNarrationCompletedEvent,
	buildNarrationStartedEvent,
	buildNarrationSupersededEvent,
	buildNarrationTokenEvent,
	buildNarrationToolOutcomeLinkedEvent,
	buildRunCompletedEvent,
	buildRunFailedEvent,
	buildRunStartedEvent,
	buildStateEnteredEvent,
} from '../runtime/runtime-events.js';
import { mapRuntimeEventsToRenderBlocks } from './map-runtime-events.js';

interface EventContext {
	readonly run_id: string;
	readonly sequence_no: number;
	readonly timestamp?: string;
	readonly trace_id: string;
}

function createEventContext(sequence_no: number, timestamp?: string): EventContext {
	return {
		run_id: 'run_presentation_1',
		sequence_no,
		timestamp,
		trace_id: 'trace_presentation_1',
	};
}

function createSuccessfulRuntimeEvents(outputText = 'Hello from mapper'): readonly RuntimeEvent[] {
	return [
		buildRunStartedEvent(
			{
				entry_state: 'INIT',
				trigger: 'user_message',
			},
			createEventContext(1),
		),
		buildStateEnteredEvent(
			{
				previous_state: 'INIT',
				reason: 'model-step-started',
				state: 'MODEL_THINKING',
			},
			{
				...createEventContext(2),
				state_after: 'MODEL_THINKING',
				state_before: 'INIT',
			},
		),
		buildModelCompletedEvent(
			{
				finish_reason: 'stop',
				model: 'llama-test',
				output_text: outputText,
				provider: 'groq',
			},
			{
				...createEventContext(3),
				state_after: 'MODEL_THINKING',
				state_before: 'MODEL_THINKING',
			},
		),
		buildStateEnteredEvent(
			{
				previous_state: 'MODEL_THINKING',
				reason: 'model-step-succeeded',
				state: 'COMPLETED',
			},
			{
				...createEventContext(4),
				state_after: 'COMPLETED',
				state_before: 'MODEL_THINKING',
			},
		),
		buildRunCompletedEvent(
			{
				final_state: 'COMPLETED',
				output_text: outputText,
			},
			{
				...createEventContext(5),
				state_after: 'COMPLETED',
				state_before: 'MODEL_THINKING',
			},
		),
	];
}

function createFailedRuntimeEvents(): readonly RuntimeEvent[] {
	return [
		buildRunStartedEvent(
			{
				entry_state: 'INIT',
				trigger: 'user_message',
			},
			createEventContext(1),
		),
		buildStateEnteredEvent(
			{
				previous_state: 'INIT',
				reason: 'model-step-started',
				state: 'MODEL_THINKING',
			},
			{
				...createEventContext(2),
				state_after: 'MODEL_THINKING',
				state_before: 'INIT',
			},
		),
		buildStateEnteredEvent(
			{
				previous_state: 'MODEL_THINKING',
				reason: 'model-step-failed',
				state: 'FAILED',
			},
			{
				...createEventContext(3),
				state_after: 'FAILED',
				state_before: 'MODEL_THINKING',
			},
		),
		buildRunFailedEvent(
			{
				error_message: 'Gateway unavailable',
				final_state: 'FAILED',
				retryable: false,
			},
			{
				...createEventContext(4),
				state_after: 'FAILED',
				state_before: 'MODEL_THINKING',
			},
		),
	];
}

function getWorkNarrationBlocks(blocks: readonly RenderBlock[]): readonly WorkNarrationBlock[] {
	return blocks.filter((block): block is WorkNarrationBlock => block.type === 'work_narration');
}

describe('map-runtime-events', () => {
	it('maps a successful runtime event list to status, text and event_list blocks', () => {
		const events = createSuccessfulRuntimeEvents();
		const blocks: readonly RenderBlock[] = mapRuntimeEventsToRenderBlocks(events);

		expect(blocks.map((block) => block.type)).toEqual(['status', 'text', 'event_list']);
		expect(blocks[0]).toMatchObject({
			payload: {
				level: 'success',
				message: 'Run completed successfully.',
			},
			schema_version: 1,
			type: 'status',
		});
		expect(blocks[1]).toMatchObject({
			payload: {
				text: 'Hello from mapper',
			},
			schema_version: 1,
			type: 'text',
		});
		expect(blocks[2]).toMatchObject({
			payload: {
				events,
				run_id: 'run_presentation_1',
				trace_id: 'trace_presentation_1',
			},
			schema_version: 1,
			type: 'event_list',
		});
	});

	it('maps a failed runtime event list to error status, text and event_list blocks', () => {
		const events = createFailedRuntimeEvents();
		const blocks: readonly RenderBlock[] = mapRuntimeEventsToRenderBlocks(events);

		expect(blocks.map((block) => block.type)).toEqual(['status', 'text', 'event_list']);
		expect(blocks[0]).toMatchObject({
			payload: {
				level: 'error',
				message: 'Run failed.',
			},
			type: 'status',
		});
		expect(blocks[1]).toMatchObject({
			payload: {
				text: 'Gateway unavailable',
			},
			type: 'text',
		});
		expect(blocks[2]).toMatchObject({
			payload: {
				events,
				run_id: 'run_presentation_1',
				trace_id: 'trace_presentation_1',
			},
			type: 'event_list',
		});
	});

	it('returns an empty block list for an empty runtime event list', () => {
		const blocks: readonly RenderBlock[] = mapRuntimeEventsToRenderBlocks([]);

		expect(blocks).toEqual([]);
	});

	it('maps structured assistant output to typed presentation blocks with fallback text preserved', () => {
		const events = createSuccessfulRuntimeEvents(
			[
				'Plan:',
				'1. Read the file',
				'2. Apply the patch',
				'```ts apps/server/src/example.ts',
				'export const value = 1;',
				'```',
				'See apps/server/src/example.ts:10-12',
			].join('\n'),
		);
		const blocks: readonly RenderBlock[] = mapRuntimeEventsToRenderBlocks(events);

		expect(blocks.map((block) => block.type)).toEqual([
			'status',
			'text',
			'plan',
			'code_artifact',
			'file_reference',
			'text',
			'event_list',
		]);
		expect(blocks[2]).toMatchObject({
			payload: {
				steps: [
					{ status: 'pending', text: 'Read the file' },
					{ status: 'pending', text: 'Apply the patch' },
				],
				title: 'Plan',
			},
			type: 'plan',
		});
		expect(blocks[3]).toMatchObject({
			payload: {
				content: 'export const value = 1;',
				filename: 'apps/server/src/example.ts',
				language: 'ts',
				line_count: 1,
			},
			type: 'code_artifact',
		});
		expect(blocks[4]).toMatchObject({
			payload: {
				line_end: 12,
				line_start: 10,
				path: 'apps/server/src/example.ts',
			},
			type: 'file_reference',
		});
	});

	it('maps completed narration events to work narration blocks', () => {
		const events = [
			...createSuccessfulRuntimeEvents(),
			buildNarrationCompletedEvent(
				{
					full_text: 'package.json kontrol ediyorum',
					linked_tool_call_id: 'call_1',
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 2,
					turn_index: 1,
				},
				createEventContext(6),
			),
		];
		const blocks = mapRuntimeEventsToRenderBlocks(events);

		expect(blocks.map((block) => block.type)).toEqual([
			'status',
			'text',
			'work_narration',
			'event_list',
		]);
		expect(blocks[2]).toMatchObject({
			id: 'nar_1',
			payload: {
				linked_tool_call_id: 'call_1',
				locale: 'tr',
				sequence_no: 2,
				status: 'completed',
				text: 'package.json kontrol ediyorum',
				turn_index: 1,
			},
			type: 'work_narration',
		});
	});

	it('appends narration tokens and finalizes with completed full_text', () => {
		const events = [
			...createSuccessfulRuntimeEvents(),
			buildNarrationStartedEvent(
				{
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 10,
					turn_index: 2,
				},
				createEventContext(6, '2026-05-05T09:00:00.000Z'),
			),
			buildNarrationTokenEvent(
				{
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 11,
					text_delta: 'package.json',
					turn_index: 2,
				},
				createEventContext(7, '2026-05-05T09:00:01.000Z'),
			),
			buildNarrationTokenEvent(
				{
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 12,
					text_delta: ' kontrol ediyorum',
					turn_index: 2,
				},
				createEventContext(8, '2026-05-05T09:00:02.000Z'),
			),
			buildNarrationCompletedEvent(
				{
					full_text: 'package.json kontrol ediyorum.',
					linked_tool_call_id: 'call_1',
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 13,
					turn_index: 2,
				},
				createEventContext(9, '2026-05-05T09:00:03.000Z'),
			),
		];
		const [block] = getWorkNarrationBlocks(mapRuntimeEventsToRenderBlocks(events));

		expect(block).toMatchObject({
			created_at: '2026-05-05T09:00:00.000Z',
			id: 'nar_1',
			payload: {
				linked_tool_call_id: 'call_1',
				locale: 'tr',
				run_id: 'run_presentation_1',
				sequence_no: 13,
				status: 'completed',
				text: 'package.json kontrol ediyorum.',
				turn_index: 2,
			},
			type: 'work_narration',
		});
	});

	it('creates a completed narration block even when completed arrives without started', () => {
		const events = [
			...createSuccessfulRuntimeEvents(),
			buildNarrationCompletedEvent(
				{
					full_text: 'Checking package.json.',
					linked_tool_call_id: 'call_1',
					locale: 'en',
					narration_id: 'nar_1',
					sequence_no: 8,
					turn_index: 1,
				},
				createEventContext(6, '2026-05-05T10:00:00.000Z'),
			),
		];
		const [block] = getWorkNarrationBlocks(mapRuntimeEventsToRenderBlocks(events));

		expect(block).toMatchObject({
			created_at: '2026-05-05T10:00:00.000Z',
			payload: {
				locale: 'en',
				sequence_no: 8,
				status: 'completed',
				text: 'Checking package.json.',
			},
		});
	});

	it('ignores token events that arrive after a completed canonical text', () => {
		const events = [
			...createSuccessfulRuntimeEvents(),
			buildNarrationCompletedEvent(
				{
					full_text: 'canonical text',
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 1,
					turn_index: 1,
				},
				createEventContext(6),
			),
			buildNarrationTokenEvent(
				{
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 2,
					text_delta: ' late token',
					turn_index: 1,
				},
				createEventContext(7),
			),
		];
		const [block] = getWorkNarrationBlocks(mapRuntimeEventsToRenderBlocks(events));

		expect(block?.payload.text).toBe('canonical text');
	});

	it('marks narration blocks superseded when a superseded event arrives', () => {
		const events = [
			...createSuccessfulRuntimeEvents(),
			buildNarrationCompletedEvent(
				{
					full_text: 'temporary narration',
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 1,
					turn_index: 1,
				},
				createEventContext(6),
			),
			buildNarrationSupersededEvent(
				{
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 1,
					turn_index: 1,
				},
				createEventContext(7),
			),
		];
		const block = mapRuntimeEventsToRenderBlocks(events).find(
			(candidate) => candidate.type === 'work_narration',
		);

		expect(block).toMatchObject({
			payload: {
				status: 'superseded',
			},
		});
	});

	it('marks linked narration blocks tool_failed when the linked outcome fails', () => {
		const events = [
			...createSuccessfulRuntimeEvents(),
			buildNarrationCompletedEvent(
				{
					full_text: 'komutu calistiriyorum',
					linked_tool_call_id: 'call_1',
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 1,
					turn_index: 1,
				},
				createEventContext(6),
			),
			buildNarrationToolOutcomeLinkedEvent(
				{
					linked_tool_call_id: 'call_1',
					locale: 'tr',
					narration_id: 'nar_1',
					outcome: 'failure',
					sequence_no: 1,
					tool_call_id: 'call_1',
					turn_index: 1,
				},
				createEventContext(7),
			),
		];
		const block = mapRuntimeEventsToRenderBlocks(events).find(
			(candidate) => candidate.type === 'work_narration',
		);

		expect(block).toMatchObject({
			payload: {
				linked_tool_call_id: 'call_1',
				status: 'tool_failed',
			},
		});
	});

	it('leaves completed narration blocks completed when the linked outcome succeeds', () => {
		const events = [
			...createSuccessfulRuntimeEvents(),
			buildNarrationCompletedEvent(
				{
					full_text: 'komutu calistiriyorum',
					linked_tool_call_id: 'call_1',
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 1,
					turn_index: 1,
				},
				createEventContext(6),
			),
			buildNarrationToolOutcomeLinkedEvent(
				{
					linked_tool_call_id: 'call_1',
					locale: 'tr',
					narration_id: 'nar_1',
					outcome: 'success',
					sequence_no: 1,
					tool_call_id: 'call_1',
					turn_index: 1,
				},
				createEventContext(7),
			),
		];
		const [block] = getWorkNarrationBlocks(mapRuntimeEventsToRenderBlocks(events));

		expect(block?.payload.status).toBe('completed');
	});

	it('keeps multiple narration ids separate and ordered by turn and sequence', () => {
		const events = [
			...createSuccessfulRuntimeEvents(),
			buildNarrationCompletedEvent(
				{
					full_text: 'second turn',
					locale: 'en',
					narration_id: 'nar_2',
					sequence_no: 3,
					turn_index: 2,
				},
				createEventContext(6),
			),
			buildNarrationCompletedEvent(
				{
					full_text: 'first turn',
					locale: 'en',
					narration_id: 'nar_1',
					sequence_no: 2,
					turn_index: 1,
				},
				createEventContext(7),
			),
		];
		const blocks = getWorkNarrationBlocks(mapRuntimeEventsToRenderBlocks(events));

		expect(blocks.map((block) => block.id)).toEqual(['nar_1', 'nar_2']);
		expect(blocks.map((block) => block.payload.text)).toEqual(['first turn', 'second turn']);
	});

	it('deduplicates repeated completed events by narration id', () => {
		const events = [
			...createSuccessfulRuntimeEvents(),
			buildNarrationCompletedEvent(
				{
					full_text: 'first text',
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 1,
					turn_index: 1,
				},
				createEventContext(6),
			),
			buildNarrationCompletedEvent(
				{
					full_text: 'canonical text',
					linked_tool_call_id: 'call_1',
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 2,
					turn_index: 1,
				},
				createEventContext(7),
			),
		];
		const blocks = getWorkNarrationBlocks(mapRuntimeEventsToRenderBlocks(events));

		expect(blocks).toHaveLength(1);
		expect(blocks[0]?.payload).toMatchObject({
			linked_tool_call_id: 'call_1',
			sequence_no: 2,
			status: 'completed',
			text: 'canonical text',
		});
	});
});
