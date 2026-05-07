import { describe, expect, it } from 'vitest';

import {
	buildNarrationCompletedEvent,
	buildNarrationSupersededEvent,
	buildNarrationTokenEvent,
} from '../runtime/runtime-events.js';
import {
	createNarrationCompletedMessage,
	createNarrationDeltaMessage,
	createNarrationSupersededMessage,
} from './transport.js';

const payload = {
	run_id: 'run_ws_narration_1',
	trace_id: 'trace_ws_narration_1',
} as const;

describe('narration websocket transport messages', () => {
	it('maps narration token events to narration.delta messages', () => {
		const event = buildNarrationTokenEvent(
			{
				linked_tool_call_id: 'call_1',
				locale: 'tr',
				narration_id: 'nar_1',
				sequence_no: 3,
				text_delta: 'package.json kontrol ediyorum',
				turn_index: 2,
			},
			{
				run_id: payload.run_id,
				sequence_no: 11,
				trace_id: payload.trace_id,
			},
		);

		expect(createNarrationDeltaMessage(payload, event)).toEqual({
			payload: {
				locale: 'tr',
				narration_id: 'nar_1',
				run_id: payload.run_id,
				sequence_no: 3,
				text_delta: 'package.json kontrol ediyorum',
				trace_id: payload.trace_id,
				turn_index: 2,
			},
			type: 'narration.delta',
		});
	});

	it('maps completed and superseded narration events to dedicated server messages', () => {
		const completed = buildNarrationCompletedEvent(
			{
				full_text: 'komutu calistiriyorum',
				linked_tool_call_id: 'call_1',
				locale: 'tr',
				narration_id: 'nar_1',
				sequence_no: 1,
				turn_index: 1,
			},
			{
				run_id: payload.run_id,
				sequence_no: 12,
				trace_id: payload.trace_id,
			},
		);
		const superseded = buildNarrationSupersededEvent(
			{
				locale: 'tr',
				narration_id: 'nar_1',
				sequence_no: 1,
				turn_index: 1,
			},
			{
				run_id: payload.run_id,
				sequence_no: 13,
				trace_id: payload.trace_id,
			},
		);

		expect(createNarrationCompletedMessage(payload, completed)).toMatchObject({
			payload: {
				full_text: 'komutu calistiriyorum',
				linked_tool_call_id: 'call_1',
				narration_id: 'nar_1',
			},
			type: 'narration.completed',
		});
		expect(createNarrationSupersededMessage(payload, superseded)).toEqual({
			payload: {
				narration_id: 'nar_1',
				run_id: payload.run_id,
				trace_id: payload.trace_id,
			},
			type: 'narration.superseded',
		});
	});
});
