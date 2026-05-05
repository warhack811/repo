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

	it('builds narration runtime events with payload timestamps', () => {
		const started = buildNarrationStartedEvent(
			{
				linked_tool_call_id: 'call_narration_1',
				locale: 'tr',
				narration_id: 'narration_1',
				sequence_no: 1,
				turn_index: 2,
			},
			{
				run_id: 'run_narration_1',
				sequence_no: 10,
				timestamp: '2026-05-05T09:00:00.000Z',
				trace_id: 'trace_narration_1',
			},
		);
		const token = buildNarrationTokenEvent(
			{
				linked_tool_call_id: 'call_narration_1',
				locale: 'tr',
				narration_id: 'narration_1',
				sequence_no: 1,
				text_delta: 'Dosyayi okuyorum.',
				turn_index: 2,
			},
			{
				run_id: 'run_narration_1',
				sequence_no: 11,
				timestamp: '2026-05-05T09:00:01.000Z',
				trace_id: 'trace_narration_1',
			},
		);
		const completed = buildNarrationCompletedEvent(
			{
				full_text: 'Dosyayi okuyorum.',
				linked_tool_call_id: 'call_narration_1',
				locale: 'tr',
				narration_id: 'narration_1',
				sequence_no: 1,
				turn_index: 2,
			},
			{
				run_id: 'run_narration_1',
				sequence_no: 12,
				timestamp: '2026-05-05T09:00:02.000Z',
				trace_id: 'trace_narration_1',
			},
		);
		const superseded = buildNarrationSupersededEvent(
			{
				locale: 'tr',
				narration_id: 'narration_2',
				sequence_no: 2,
				turn_index: 2,
			},
			{
				run_id: 'run_narration_1',
				sequence_no: 13,
				timestamp: '2026-05-05T09:00:03.000Z',
				trace_id: 'trace_narration_1',
			},
		);
		const linked = buildNarrationToolOutcomeLinkedEvent(
			{
				linked_tool_call_id: 'call_narration_1',
				locale: 'tr',
				narration_id: 'narration_1',
				outcome: 'success',
				sequence_no: 1,
				tool_call_id: 'call_narration_1',
				turn_index: 2,
			},
			{
				run_id: 'run_narration_1',
				sequence_no: 14,
				timestamp: '2026-05-05T09:00:04.000Z',
				trace_id: 'trace_narration_1',
			},
		);

		expect(started).toEqual({
			event_id: 'run_narration_1:narration.started:narration_1:10',
			event_type: 'narration.started',
			event_version: 1,
			payload: {
				linked_tool_call_id: 'call_narration_1',
				locale: 'tr',
				narration_id: 'narration_1',
				run_id: 'run_narration_1',
				sequence_no: 1,
				timestamp: '2026-05-05T09:00:00.000Z',
				turn_index: 2,
			},
			run_id: 'run_narration_1',
			sequence_no: 10,
			timestamp: '2026-05-05T09:00:00.000Z',
			trace_id: 'trace_narration_1',
		});
		expect(token.payload).toEqual({
			linked_tool_call_id: 'call_narration_1',
			locale: 'tr',
			narration_id: 'narration_1',
			run_id: 'run_narration_1',
			sequence_no: 1,
			text_delta: 'Dosyayi okuyorum.',
			timestamp: '2026-05-05T09:00:01.000Z',
			turn_index: 2,
		});
		expect(completed.payload).toEqual({
			full_text: 'Dosyayi okuyorum.',
			linked_tool_call_id: 'call_narration_1',
			locale: 'tr',
			narration_id: 'narration_1',
			run_id: 'run_narration_1',
			sequence_no: 1,
			timestamp: '2026-05-05T09:00:02.000Z',
			turn_index: 2,
		});
		expect(superseded.payload).toEqual({
			locale: 'tr',
			narration_id: 'narration_2',
			run_id: 'run_narration_1',
			sequence_no: 2,
			timestamp: '2026-05-05T09:00:03.000Z',
			turn_index: 2,
		});
		expect(linked.payload).toEqual({
			linked_tool_call_id: 'call_narration_1',
			locale: 'tr',
			narration_id: 'narration_1',
			outcome: 'success',
			run_id: 'run_narration_1',
			sequence_no: 1,
			timestamp: '2026-05-05T09:00:04.000Z',
			tool_call_id: 'call_narration_1',
			turn_index: 2,
		});
	});
});
