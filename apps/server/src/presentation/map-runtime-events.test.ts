import type { RenderBlock, RuntimeEvent } from '@runa/types';
import { describe, expect, it } from 'vitest';

import {
	buildModelCompletedEvent,
	buildNarrationCompletedEvent,
	buildNarrationSupersededEvent,
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
	readonly trace_id: string;
}

function createEventContext(sequence_no: number): EventContext {
	return {
		run_id: 'run_presentation_1',
		sequence_no,
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
				status: 'tool_failed',
			},
		});
	});
});
