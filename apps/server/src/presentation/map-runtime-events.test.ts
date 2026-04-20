import type { RenderBlock, RuntimeEvent } from '@runa/types';
import { describe, expect, it } from 'vitest';

import {
	buildModelCompletedEvent,
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

function createSuccessfulRuntimeEvents(): readonly RuntimeEvent[] {
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
				output_text: 'Hello from mapper',
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
				output_text: 'Hello from mapper',
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
});
