import type { ModelResponse, ProviderCapabilities } from '@runa/types';
import { describe, expect, it } from 'vitest';

import { buildNarrationEmissionEvents } from './emission.js';

const temporalCapabilities: ProviderCapabilities = {
	emits_reasoning_content: true,
	narration_strategy: 'temporal_stream',
	streaming_supported: true,
	tool_call_fallthrough_risk: 'known_intermittent',
};

function createModelResponse(overrides: Partial<ModelResponse['message']> = {}): ModelResponse {
	return {
		finish_reason: 'stop',
		message: {
			content: 'Final',
			role: 'assistant',
			ordered_content: [
				{
					index: 0,
					kind: 'text',
					ordering_origin: 'wire_streaming',
					text: 'package.json kontrol ediyorum',
				},
				{
					index: 1,
					input: {},
					kind: 'tool_use',
					ordering_origin: 'wire_streaming',
					tool_call_id: 'call_1',
					tool_name: 'file.read',
				},
			],
			...overrides,
		},
		model: 'deepseek-v4-flash',
		provider: 'deepseek',
	};
}

describe('buildNarrationEmissionEvents', () => {
	it('emits started, token and completed events for accepted narration candidates', () => {
		const output = buildNarrationEmissionEvents({
			base_runtime_sequence_no: 10,
			capabilities: temporalCapabilities,
			model_response: createModelResponse(),
			run_id: 'run_1',
			trace_id: 'trace_1',
			turn_index: 2,
			turn_intent: 'continuing',
		});

		expect(output.emission_decision).toBe('emit');
		expect(output.events.map((event) => event.event_type)).toEqual([
			'narration.started',
			'narration.token',
			'narration.completed',
		]);
		expect(output.events[2]).toMatchObject({
			payload: {
				full_text: 'package.json kontrol ediyorum',
				linked_tool_call_id: 'call_1',
				locale: 'tr',
				sequence_no: 1,
				turn_index: 2,
			},
			sequence_no: 12,
		});
		expect(output.linked_narrations).toEqual([
			{
				narration_id: 'run_1:turn:2:narration:1',
				sequence_no: 1,
				tool_call_id: 'call_1',
			},
		]);
	});

	it('gates unsupported providers to zero narration events', () => {
		const output = buildNarrationEmissionEvents({
			base_runtime_sequence_no: 1,
			capabilities: {
				...temporalCapabilities,
				narration_strategy: 'unsupported',
			},
			model_response: createModelResponse(),
			run_id: 'run_1',
			trace_id: 'trace_1',
			turn_index: 1,
			turn_intent: 'continuing',
		});

		expect(output.emission_decision).toBe('skip_unsupported');
		expect(output.events).toEqual([]);
	});

	it('counts high-confidence fallthrough signals for deterministic failure policy', () => {
		const output = buildNarrationEmissionEvents({
			base_runtime_sequence_no: 1,
			capabilities: temporalCapabilities,
			model_response: createModelResponse({
				fallthrough_detected: [
					{ confidence: 'high', matched_pattern: 'json' },
					{ confidence: 'high', matched_pattern: 'dsml' },
					{ confidence: 'low', matched_pattern: 'keyword' },
				],
			}),
			run_id: 'run_1',
			trace_id: 'trace_1',
			turn_index: 1,
			turn_intent: 'continuing',
		});

		expect(output.high_fallthrough_count).toBe(2);
	});
});
