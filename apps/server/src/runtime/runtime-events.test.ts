import { describe, expect, it } from 'vitest';

import {
	buildModelCompletedEvent,
	buildRunCompletedEvent,
	buildRunFailedEvent,
	buildRunStartedEvent,
	buildStateEnteredEvent,
} from './runtime-events.js';

describe('runtime-events', () => {
	it('builds run.started with deterministic event base metadata', () => {
		const metadata = {
			origin: 'demo-repeatability',
		};

		const event = buildRunStartedEvent(
			{
				entry_state: 'INIT',
				message_id: 'message_runtime_started_1',
				trigger: 'user_message',
			},
			{
				actor: {
					id: 'user_runtime_started_1',
					type: 'user',
				},
				metadata,
				parent_event_id: 'event_parent_runtime_started_1',
				run_id: 'run_runtime_started_1',
				sequence_no: 1,
				session_id: 'session_runtime_started_1',
				source: {
					id: 'register-ws',
					kind: 'websocket',
				},
				timestamp: '2026-04-12T16:10:00.000Z',
				trace_id: 'trace_runtime_started_1',
			},
		);

		expect(event).toEqual({
			actor: {
				id: 'user_runtime_started_1',
				type: 'user',
			},
			event_id: 'run_runtime_started_1:run.started:1',
			event_type: 'run.started',
			event_version: 1,
			metadata,
			parent_event_id: 'event_parent_runtime_started_1',
			payload: {
				entry_state: 'INIT',
				message_id: 'message_runtime_started_1',
				trigger: 'user_message',
			},
			run_id: 'run_runtime_started_1',
			sequence_no: 1,
			session_id: 'session_runtime_started_1',
			source: {
				id: 'register-ws',
				kind: 'websocket',
			},
			timestamp: '2026-04-12T16:10:00.000Z',
			trace_id: 'trace_runtime_started_1',
		});
	});

	it('builds state.entered with explicit before/after states', () => {
		const event = buildStateEnteredEvent(
			{
				previous_state: 'INIT',
				reason: 'gateway request prepared',
				state: 'MODEL_THINKING',
			},
			{
				run_id: 'run_state_entered_1',
				sequence_no: 2,
				state_after: 'MODEL_THINKING',
				state_before: 'INIT',
				timestamp: '2026-04-12T16:12:00.000Z',
				trace_id: 'trace_state_entered_1',
			},
		);

		expect(event).toEqual({
			event_id: 'run_state_entered_1:state.entered:2',
			event_type: 'state.entered',
			event_version: 1,
			payload: {
				previous_state: 'INIT',
				reason: 'gateway request prepared',
				state: 'MODEL_THINKING',
			},
			run_id: 'run_state_entered_1',
			sequence_no: 2,
			state_after: 'MODEL_THINKING',
			state_before: 'INIT',
			timestamp: '2026-04-12T16:12:00.000Z',
			trace_id: 'trace_state_entered_1',
		});
	});

	it('builds model completion and terminal runtime events', () => {
		const modelCompleted = buildModelCompletedEvent(
			{
				finish_reason: 'stop',
				model: 'llama-3.3-70b',
				output_text: 'Auth bug fixed.',
				provider: 'groq',
			},
			{
				run_id: 'run_runtime_terminal_1',
				sequence_no: 3,
				state_after: 'MODEL_THINKING',
				state_before: 'MODEL_THINKING',
				timestamp: '2026-04-12T16:15:00.000Z',
				trace_id: 'trace_runtime_terminal_1',
			},
		);
		const runCompleted = buildRunCompletedEvent(
			{
				final_state: 'COMPLETED',
				output_text: 'Patch applied successfully.',
			},
			{
				run_id: 'run_runtime_terminal_1',
				sequence_no: 4,
				state_after: 'COMPLETED',
				state_before: 'MODEL_THINKING',
				timestamp: '2026-04-12T16:15:01.000Z',
				trace_id: 'trace_runtime_terminal_1',
			},
		);
		const runFailed = buildRunFailedEvent(
			{
				error_code: 'MODEL_TIMEOUT',
				error_message: 'Model request timed out.',
				final_state: 'FAILED',
				retryable: true,
			},
			{
				run_id: 'run_runtime_terminal_2',
				sequence_no: 5,
				state_after: 'FAILED',
				state_before: 'MODEL_THINKING',
				timestamp: '2026-04-12T16:16:00.000Z',
				trace_id: 'trace_runtime_terminal_2',
			},
		);

		expect(modelCompleted).toEqual({
			event_id: 'run_runtime_terminal_1:model.completed:3',
			event_type: 'model.completed',
			event_version: 1,
			payload: {
				finish_reason: 'stop',
				model: 'llama-3.3-70b',
				output_text: 'Auth bug fixed.',
				provider: 'groq',
			},
			run_id: 'run_runtime_terminal_1',
			sequence_no: 3,
			state_after: 'MODEL_THINKING',
			state_before: 'MODEL_THINKING',
			timestamp: '2026-04-12T16:15:00.000Z',
			trace_id: 'trace_runtime_terminal_1',
		});
		expect(runCompleted).toEqual({
			event_id: 'run_runtime_terminal_1:run.completed:4',
			event_type: 'run.completed',
			event_version: 1,
			payload: {
				final_state: 'COMPLETED',
				output_text: 'Patch applied successfully.',
			},
			run_id: 'run_runtime_terminal_1',
			sequence_no: 4,
			state_after: 'COMPLETED',
			state_before: 'MODEL_THINKING',
			timestamp: '2026-04-12T16:15:01.000Z',
			trace_id: 'trace_runtime_terminal_1',
		});
		expect(runFailed).toEqual({
			event_id: 'run_runtime_terminal_2:run.failed:5',
			event_type: 'run.failed',
			event_version: 1,
			payload: {
				error_code: 'MODEL_TIMEOUT',
				error_message: 'Model request timed out.',
				final_state: 'FAILED',
				retryable: true,
			},
			run_id: 'run_runtime_terminal_2',
			sequence_no: 5,
			state_after: 'FAILED',
			state_before: 'MODEL_THINKING',
			timestamp: '2026-04-12T16:16:00.000Z',
			trace_id: 'trace_runtime_terminal_2',
		});
	});
});
