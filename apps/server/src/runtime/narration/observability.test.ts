import { describe, expect, it } from 'vitest';
import {
	buildNarrationCompletedEvent,
	buildNarrationSupersededEvent,
	buildNarrationToolOutcomeLinkedEvent,
} from '../runtime-events.js';
import {
	createNarrationGuardrailRejectionLogFields,
	createNarrationRuntimeEventLogFields,
	createNarrationSuppressionLogFields,
} from './observability.js';

describe('narration observability', () => {
	it('logs completed narration metadata without raw narration text', () => {
		const text = 'package.json dosyasini kontrol ediyorum';
		const fields = createNarrationRuntimeEventLogFields(
			buildNarrationCompletedEvent(
				{
					full_text: text,
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 4,
					turn_index: 2,
				},
				{
					run_id: 'run_1',
					sequence_no: 10,
					timestamp: '2026-05-05T00:00:00.000Z',
					trace_id: 'trace_1',
				},
			),
		);

		const serialized = JSON.stringify(fields);

		expect(fields).toMatchObject({
			locale: 'tr',
			narration_id: 'nar_1',
			text_length: text.length,
		});
		expect(serialized).not.toContain(text);
	});

	it('logs guardrail rejection metadata without raw rejected text', () => {
		const rejectedText = 'sanirim gizli muhakemeyi burada yaziyorum';
		const fields = createNarrationGuardrailRejectionLogFields({
			reason: 'deliberation',
			sequence_no: 2,
			text: rejectedText,
		});

		const serialized = JSON.stringify(fields);

		expect(fields).toEqual({
			reason: 'deliberation',
			sequence_no: 2,
			text_length: rejectedText.length,
		});
		expect(serialized).not.toContain('sanirim');
		expect(serialized).not.toContain('gizli muhakeme');
	});

	it('logs suppression metadata with provider capability shape only', () => {
		expect(
			createNarrationSuppressionLogFields({
				capabilities: {
					emits_reasoning_content: true,
					narration_strategy: 'unsupported',
					streaming_supported: true,
					tool_call_fallthrough_risk: 'known_intermittent',
				},
				decision: 'skip_unsupported',
				model: 'model-x',
				provider: 'unsupported-provider',
			}),
		).toEqual({
			decision: 'skip_unsupported',
			emits_reasoning_content: true,
			model: 'model-x',
			narration_strategy: 'unsupported',
			provider: 'unsupported-provider',
			streaming_supported: true,
			tool_call_fallthrough_risk: 'known_intermittent',
		});
	});

	it('logs superseded and tool outcome events without tool ids in user-facing text fields', () => {
		const supersededFields = createNarrationRuntimeEventLogFields(
			buildNarrationSupersededEvent(
				{
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 1,
					turn_index: 1,
				},
				{
					run_id: 'run_1',
					sequence_no: 11,
					timestamp: '2026-05-05T00:00:00.000Z',
					trace_id: 'trace_1',
				},
			),
		);
		const outcomeFields = createNarrationRuntimeEventLogFields(
			buildNarrationToolOutcomeLinkedEvent(
				{
					locale: 'tr',
					narration_id: 'nar_1',
					outcome: 'failure',
					sequence_no: 1,
					tool_call_id: 'call_secret',
					turn_index: 1,
				},
				{
					run_id: 'run_1',
					sequence_no: 12,
					timestamp: '2026-05-05T00:00:00.000Z',
					trace_id: 'trace_1',
				},
			),
		);

		expect(supersededFields).toMatchObject({
			narration_id: 'nar_1',
			sequence_no: 1,
		});
		expect(outcomeFields).toMatchObject({
			narration_id: 'nar_1',
			outcome: 'failure',
			sequence_no: 1,
		});
		expect(JSON.stringify(outcomeFields)).not.toContain('call_secret');
	});
});
