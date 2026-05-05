import {
	isNarrationCompletedServerMessage,
	isNarrationDeltaServerMessage,
	isNarrationSupersededServerMessage,
	isRenderBlock,
	isWebSocketServerBridgeMessage,
} from '@runa/types';
import { describe, expect, it } from 'vitest';

describe('ws-guards narration contracts', () => {
	it('accepts narration server messages through dedicated and bridge guards', () => {
		const deltaMessage = {
			payload: {
				locale: 'tr',
				narration_id: 'narration_guard_1',
				run_id: 'run_guard_1',
				sequence_no: 1,
				text_delta: 'Dosyayi okuyorum.',
				trace_id: 'trace_guard_1',
				turn_index: 0,
			},
			type: 'narration.delta',
		};
		const completedMessage = {
			payload: {
				full_text: 'Dosyayi okuyorum.',
				linked_tool_call_id: 'call_guard_1',
				narration_id: 'narration_guard_1',
				run_id: 'run_guard_1',
				trace_id: 'trace_guard_1',
			},
			type: 'narration.completed',
		};
		const supersededMessage = {
			payload: {
				narration_id: 'narration_guard_1',
				run_id: 'run_guard_1',
				trace_id: 'trace_guard_1',
			},
			type: 'narration.superseded',
		};

		expect(isNarrationDeltaServerMessage(deltaMessage)).toBe(true);
		expect(isNarrationCompletedServerMessage(completedMessage)).toBe(true);
		expect(isNarrationSupersededServerMessage(supersededMessage)).toBe(true);
		expect(isWebSocketServerBridgeMessage(deltaMessage)).toBe(true);
		expect(isWebSocketServerBridgeMessage(completedMessage)).toBe(true);
		expect(isWebSocketServerBridgeMessage(supersededMessage)).toBe(true);
	});

	it('rejects narration deltas with unsupported locale values', () => {
		expect(
			isNarrationDeltaServerMessage({
				payload: {
					locale: 'de',
					narration_id: 'narration_guard_2',
					run_id: 'run_guard_2',
					sequence_no: 1,
					text_delta: 'Reading.',
					trace_id: 'trace_guard_2',
					turn_index: 0,
				},
				type: 'narration.delta',
			}),
		).toBe(false);
	});

	it('accepts work_narration render blocks', () => {
		expect(
			isRenderBlock({
				created_at: '2026-05-05T09:30:00.000Z',
				id: 'narration_guard_block_1',
				payload: {
					linked_tool_call_id: 'call_guard_1',
					locale: 'tr',
					run_id: 'run_guard_1',
					sequence_no: 1,
					status: 'completed',
					text: 'Dosyayi okuyorum.',
					turn_index: 0,
				},
				schema_version: 1,
				type: 'work_narration',
			}),
		).toBe(true);
	});
});
