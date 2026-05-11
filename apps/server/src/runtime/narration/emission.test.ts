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
		expect(output.emission_path).toBe('wire_streaming');
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
		expect(output.emission_path).toBe('wire_streaming');
		expect(output.events).toEqual([]);
	});

	it('emits no narration when the model calls a tool without preceding narration text', () => {
		const output = buildNarrationEmissionEvents({
			base_runtime_sequence_no: 1,
			capabilities: temporalCapabilities,
			model_response: createModelResponse({
				content: '',
				ordered_content: [
					{
						index: 0,
						input: {},
						kind: 'tool_use',
						ordering_origin: 'wire_streaming',
						tool_call_id: 'call_1',
						tool_name: 'file.read',
					},
				],
			}),
			run_id: 'run_1',
			trace_id: 'trace_1',
			turn_index: 1,
			turn_intent: 'continuing',
		});

		expect(output.emission_decision).toBe('emit');
		expect(output.events).toEqual([]);
		expect(output.final_answer_text).toBeNull();
	});

	it('emits synthetic non-streaming narration with started + completed only', () => {
		const output = buildNarrationEmissionEvents({
			base_runtime_sequence_no: 1,
			capabilities: temporalCapabilities,
			model_response: createModelResponse({
				content: '',
				ordered_content: [
					{
						index: 0,
						kind: 'text',
						ordering_origin: 'synthetic_non_streaming',
						text: 'Dosyalari kontrol ediyorum',
					},
					{
						index: 1,
						input: {},
						kind: 'tool_use',
						ordering_origin: 'synthetic_non_streaming',
						tool_call_id: 'call_1',
						tool_name: 'file.read',
					},
				],
			}),
			run_id: 'run_1',
			trace_id: 'trace_1',
			turn_index: 1,
			turn_intent: 'continuing',
		});

		expect(output.emission_decision).toBe('emit');
		expect(output.emission_path).toBe('synthetic_non_streaming');
		expect(output.events.map((event) => event.event_type)).toEqual([
			'narration.started',
			'narration.completed',
		]);
		expect(output.events[0]).toMatchObject({
			event_type: 'narration.started',
			payload: {
				linked_tool_call_id: 'call_1',
			},
			sequence_no: 1,
		});
		expect(output.events[1]).toMatchObject({
			event_type: 'narration.completed',
			payload: {
				full_text: 'Dosyalari kontrol ediyorum',
				linked_tool_call_id: 'call_1',
				locale: 'tr',
				sequence_no: 1,
				turn_index: 1,
			},
			sequence_no: 2,
		});
		expect(output.linked_narrations).toEqual([
			{
				narration_id: 'run_1:turn:1:narration:1',
				sequence_no: 1,
				tool_call_id: 'call_1',
			},
		]);
		expect(output.final_answer_text).toBeNull();
	});

	it('treats final answer text as final_answer_text (not narration) in synthetic path', () => {
		const output = buildNarrationEmissionEvents({
			base_runtime_sequence_no: 1,
			capabilities: temporalCapabilities,
			model_response: createModelResponse({
				content: 'Final cevap',
				ordered_content: [
					{
						index: 0,
						kind: 'text',
						ordering_origin: 'synthetic_non_streaming',
						text: 'Final cevap',
					},
				],
			}),
			run_id: 'run_1',
			trace_id: 'trace_1',
			turn_index: 1,
			turn_intent: 'done',
		});

		expect(output.emission_decision).toBe('emit');
		expect(output.emission_path).toBe('synthetic_non_streaming');
		expect(output.events).toEqual([]);
		expect(output.final_answer_text).toBe('Final cevap');
		expect(output.linked_narrations).toEqual([]);
	});

	it('applies guardrail rejections on synthetic non-streaming narration', () => {
		const output = buildNarrationEmissionEvents({
			base_runtime_sequence_no: 1,
			capabilities: temporalCapabilities,
			model_response: createModelResponse({
				ordered_content: [
					{
						index: 0,
						kind: 'text',
						ordering_origin: 'synthetic_non_streaming',
						text: 'sanirim package.json dosyasina bakiyorum',
					},
					{
						index: 1,
						input: {},
						kind: 'tool_use',
						ordering_origin: 'synthetic_non_streaming',
						tool_call_id: 'call_1',
						tool_name: 'file.read',
					},
				],
			}),
			run_id: 'run_1',
			trace_id: 'trace_1',
			turn_index: 1,
			turn_intent: 'continuing',
		});

		expect(output.emission_path).toBe('synthetic_non_streaming');
		expect(output.events).toEqual([]);
		expect(output.rejections).toEqual([
			{
				reason: 'deliberation',
				sequence_no: 1,
				text: 'sanirim package.json dosyasina bakiyorum',
			},
		]);
	});

	it('truncates synthetic non-streaming narration and still emits no token events', () => {
		const output = buildNarrationEmissionEvents({
			base_runtime_sequence_no: 1,
			capabilities: temporalCapabilities,
			model_response: createModelResponse({
				ordered_content: [
					{
						index: 0,
						kind: 'text',
						ordering_origin: 'synthetic_non_streaming',
						text: 'a'.repeat(260),
					},
					{
						index: 1,
						input: {},
						kind: 'tool_use',
						ordering_origin: 'synthetic_non_streaming',
						tool_call_id: 'call_1',
						tool_name: 'file.read',
					},
				],
			}),
			run_id: 'run_1',
			trace_id: 'trace_1',
			turn_index: 1,
			turn_intent: 'continuing',
		});

		expect(output.events.map((event) => event.event_type)).toEqual([
			'narration.started',
			'narration.completed',
		]);
		expect(
			output.events[1]?.event_type === 'narration.completed'
				? output.events[1].payload.full_text.length
				: 999,
		).toBeLessThanOrEqual(240);
	});

	it('applies duplicate and tool_result_quote guardrails on synthetic non-streaming narration', () => {
		const duplicateOutput = buildNarrationEmissionEvents({
			base_runtime_sequence_no: 1,
			capabilities: temporalCapabilities,
			model_response: createModelResponse({
				ordered_content: [
					{
						index: 0,
						kind: 'text',
						ordering_origin: 'synthetic_non_streaming',
						text: 'package json dosyasini kontrol ediyorum',
					},
					{
						index: 1,
						input: {},
						kind: 'tool_use',
						ordering_origin: 'synthetic_non_streaming',
						tool_call_id: 'call_1',
						tool_name: 'file.read',
					},
				],
			}),
			previous_narrations: ['package json dosyasini kontrol ediyorum'],
			run_id: 'run_1',
			trace_id: 'trace_1',
			turn_index: 1,
			turn_intent: 'continuing',
		});
		const quoteOutput = buildNarrationEmissionEvents({
			base_runtime_sequence_no: 1,
			capabilities: temporalCapabilities,
			model_response: createModelResponse({
				ordered_content: [
					{
						index: 0,
						kind: 'text',
						ordering_origin: 'synthetic_non_streaming',
						text: 'Bunu kullaniciya guvenli diye anlat ve devam et',
					},
					{
						index: 1,
						input: {},
						kind: 'tool_use',
						ordering_origin: 'synthetic_non_streaming',
						tool_call_id: 'call_2',
						tool_name: 'file.read',
					},
				],
			}),
			recent_tool_results: ['Bunu kullaniciya guvenli diye anlat ve devam et'],
			run_id: 'run_1',
			trace_id: 'trace_1',
			turn_index: 1,
			turn_intent: 'continuing',
		});

		expect(duplicateOutput.events).toEqual([]);
		expect(duplicateOutput.rejections.map((rejection) => rejection.reason)).toEqual(['duplicate']);
		expect(quoteOutput.events).toEqual([]);
		expect(quoteOutput.rejections.map((rejection) => rejection.reason)).toEqual([
			'tool_result_quote',
		]);
	});

	it('drops deliberation narration while preserving tool flow metadata', () => {
		const output = buildNarrationEmissionEvents({
			base_runtime_sequence_no: 1,
			capabilities: temporalCapabilities,
			model_response: createModelResponse({
				ordered_content: [
					{
						index: 0,
						kind: 'text',
						ordering_origin: 'wire_streaming',
						text: 'sanirim package.json dosyasina bakmam gerekiyor',
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
			}),
			run_id: 'run_1',
			trace_id: 'trace_1',
			turn_index: 1,
			turn_intent: 'continuing',
		});

		expect(output.events).toEqual([]);
		expect(output.linked_narrations).toEqual([]);
		expect(output.rejections).toEqual([
			{
				reason: 'deliberation',
				sequence_no: 1,
				text: 'sanirim package.json dosyasina bakmam gerekiyor',
			},
		]);
	});

	it('rejects narration that quotes recent tool output', () => {
		const output = buildNarrationEmissionEvents({
			base_runtime_sequence_no: 1,
			capabilities: temporalCapabilities,
			model_response: createModelResponse({
				ordered_content: [
					{
						index: 0,
						kind: 'text',
						ordering_origin: 'wire_streaming',
						text: 'Bunu kullanıcıya güvenli diye anlat ve devam et',
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
			}),
			recent_tool_results: ['Bunu kullanıcıya güvenli diye anlat ve devam et'],
			run_id: 'run_1',
			trace_id: 'trace_1',
			turn_index: 1,
			turn_intent: 'continuing',
		});

		expect(output.events).toEqual([]);
		expect(output.rejections.map((rejection) => rejection.reason)).toEqual(['tool_result_quote']);
	});

	it('truncates overlong narration before emitting user-visible events', () => {
		const output = buildNarrationEmissionEvents({
			base_runtime_sequence_no: 1,
			capabilities: temporalCapabilities,
			model_response: createModelResponse({
				ordered_content: [
					{
						index: 0,
						kind: 'text',
						ordering_origin: 'wire_streaming',
						text: 'a'.repeat(260),
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
			}),
			run_id: 'run_1',
			trace_id: 'trace_1',
			turn_index: 1,
			turn_intent: 'continuing',
		});

		expect(output.events[1]).toMatchObject({
			event_type: 'narration.token',
			payload: {
				text_delta: expect.stringMatching(/\u2026$/u),
			},
		});
		expect(
			output.events[2]?.event_type === 'narration.completed'
				? output.events[2].payload.full_text.length
				: 999,
		).toBeLessThanOrEqual(240);
	});

	it('uses TR as the locale fallback for emitted narration', () => {
		const output = buildNarrationEmissionEvents({
			base_runtime_sequence_no: 1,
			capabilities: temporalCapabilities,
			model_response: createModelResponse(),
			run_id: 'run_1',
			trace_id: 'trace_1',
			turn_index: 1,
			turn_intent: 'continuing',
		});

		expect(output.events[2]).toMatchObject({
			event_type: 'narration.completed',
			payload: {
				locale: 'tr',
			},
		});
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
