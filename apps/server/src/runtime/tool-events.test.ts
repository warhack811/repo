import { describe, expect, it } from 'vitest';

import {
	buildToolCallCompletedEvent,
	buildToolCallFailedEvent,
	buildToolCallStartedEvent,
} from './tool-events.js';

describe('tool-events', () => {
	it('builds tool.call.started with deterministic event identity', () => {
		const event = buildToolCallStartedEvent(
			{
				call_id: 'call_tool_started_1',
				tool_name: 'search.codebase',
			},
			{
				run_id: 'run_tool_started_1',
				sequence_no: 6,
				state_after: 'TOOL_EXECUTING',
				state_before: 'MODEL_THINKING',
				timestamp: '2026-04-12T16:20:00.000Z',
				trace_id: 'trace_tool_started_1',
			},
		);

		expect(event).toEqual({
			event_id: 'run_tool_started_1:tool.call.started:6',
			event_type: 'tool.call.started',
			event_version: 1,
			payload: {
				call_id: 'call_tool_started_1',
				tool_name: 'search.codebase',
			},
			run_id: 'run_tool_started_1',
			sequence_no: 6,
			state_after: 'TOOL_EXECUTING',
			state_before: 'MODEL_THINKING',
			timestamp: '2026-04-12T16:20:00.000Z',
			trace_id: 'trace_tool_started_1',
		});
	});

	it('builds tool.call.completed and tool.call.failed transitions', () => {
		const completedEvent = buildToolCallCompletedEvent(
			{
				call_id: 'call_tool_completed_1',
				result_status: 'success',
				tool_name: 'file.read',
			},
			{
				run_id: 'run_tool_completed_1',
				sequence_no: 7,
				state_after: 'TOOL_RESULT_INGESTING',
				state_before: 'TOOL_EXECUTING',
				timestamp: '2026-04-12T16:21:00.000Z',
				trace_id: 'trace_tool_completed_1',
			},
		);
		const failedEvent = buildToolCallFailedEvent(
			{
				call_id: 'call_tool_failed_1',
				error_code: 'EXECUTION_FAILED',
				error_message: 'git diff failed to execute.',
				retryable: false,
				tool_name: 'git.diff',
			},
			{
				run_id: 'run_tool_failed_1',
				sequence_no: 8,
				state_after: 'FAILED',
				state_before: 'TOOL_EXECUTING',
				timestamp: '2026-04-12T16:22:00.000Z',
				trace_id: 'trace_tool_failed_1',
			},
		);

		expect(completedEvent).toEqual({
			event_id: 'run_tool_completed_1:tool.call.completed:7',
			event_type: 'tool.call.completed',
			event_version: 1,
			payload: {
				call_id: 'call_tool_completed_1',
				result_status: 'success',
				tool_name: 'file.read',
			},
			run_id: 'run_tool_completed_1',
			sequence_no: 7,
			state_after: 'TOOL_RESULT_INGESTING',
			state_before: 'TOOL_EXECUTING',
			timestamp: '2026-04-12T16:21:00.000Z',
			trace_id: 'trace_tool_completed_1',
		});
		expect(failedEvent).toEqual({
			event_id: 'run_tool_failed_1:tool.call.failed:8',
			event_type: 'tool.call.failed',
			event_version: 1,
			payload: {
				call_id: 'call_tool_failed_1',
				error_code: 'EXECUTION_FAILED',
				error_message: 'git diff failed to execute.',
				retryable: false,
				tool_name: 'git.diff',
			},
			run_id: 'run_tool_failed_1',
			sequence_no: 8,
			state_after: 'FAILED',
			state_before: 'TOOL_EXECUTING',
			timestamp: '2026-04-12T16:22:00.000Z',
			trace_id: 'trace_tool_failed_1',
		});
	});
});
