import type {
	ApprovalBlock,
	DiffBlock,
	EventEnvelope,
	EventPayload,
	EventType,
	SearchResultBlock,
	ToolResultBlock,
	WebSearchResultBlock,
} from '@runa/types';
import { describe, expect, it } from 'vitest';

import { mapRunTimelineToBlock } from './map-run-timeline.js';

const createdAt = '2026-04-11T14:00:00.000Z';

function createEvent<TType extends EventType>(
	eventType: TType,
	payload: EventPayload<TType>,
	sequenceNo: number,
): EventEnvelope<TType> {
	return {
		actor: {
			type: 'system',
		},
		event_id: `event_${sequenceNo}`,
		event_type: eventType,
		event_version: 1,
		payload,
		run_id: 'run_timeline_test',
		sequence_no: sequenceNo,
		source: {
			kind: 'runtime',
		},
		timestamp: `2026-04-11T14:00:${String(sequenceNo).padStart(2, '0')}.000Z`,
		trace_id: 'trace_timeline_test',
	};
}

function createToolResultBlock(
	callId: string,
	toolName: ToolResultBlock['payload']['tool_name'],
	status: ToolResultBlock['payload']['status'],
): ToolResultBlock {
	return {
		created_at: createdAt,
		id: `tool_result:${callId}`,
		payload: {
			call_id: callId,
			status,
			summary: `${toolName} ${status === 'success' ? 'completed successfully.' : 'failed.'}`,
			tool_name: toolName,
		},
		schema_version: 1,
		type: 'tool_result',
	};
}

function createApprovalBlock(
	approvalId: string,
	status: ApprovalBlock['payload']['status'],
	toolName: ApprovalBlock['payload']['tool_name'] = 'file.write',
): ApprovalBlock {
	return {
		created_at: createdAt,
		id: `approval_block:${approvalId}:${status}`,
		payload: {
			action_kind: 'file_write',
			approval_id: approvalId,
			call_id: `call_${approvalId}`,
			decision: status === 'pending' ? undefined : 'approved',
			note: status === 'pending' ? undefined : 'Approved by reviewer',
			status,
			summary: 'Write changes to src/example.ts',
			title: 'Approve file write',
			tool_name: toolName,
		},
		schema_version: 1,
		type: 'approval_block',
	};
}

function createSearchResultBlock(summary: string): SearchResultBlock {
	return {
		created_at: createdAt,
		id: 'search_result_block:call_search',
		payload: {
			is_truncated: false,
			matches: [
				{
					line_number: 12,
					line_text: 'const needle = true;',
					path: 'src/example.ts',
				},
			],
			query: 'needle',
			searched_root: 'd:\\ai\\Runa',
			summary,
			title: 'Codebase Search Results',
			total_matches: 1,
		},
		schema_version: 1,
		type: 'search_result_block',
	};
}

function createWebSearchResultBlock(summary: string): WebSearchResultBlock {
	return {
		created_at: createdAt,
		id: 'web_search_result_block:call_web_search',
		payload: {
			authority_note: 'Authority-first ordering keeps low-trust results out.',
			is_truncated: false,
			query: 'latest example release',
			results: [
				{
					authority_note: 'Docs-like or official project source.',
					snippet: 'Latest release notes.',
					source: 'docs.example.com',
					title: 'Release Notes',
					trust_tier: 'official',
					url: 'https://docs.example.com/releases',
				},
			],
			search_provider: 'serper',
			summary,
			title: 'Web Search Results',
		},
		schema_version: 1,
		type: 'web_search_result_block',
	};
}

function createDiffBlock(summary: string): DiffBlock {
	return {
		created_at: createdAt,
		id: 'diff_block:src/example.ts:call_diff',
		payload: {
			changed_paths: ['src/example.ts'],
			diff_text: '@@ -1 +1 @@\n-old\n+new\n',
			path: 'src/example.ts',
			summary,
			title: 'src/example.ts',
		},
		schema_version: 1,
		type: 'diff_block',
	};
}

describe('map-run-timeline', () => {
	it('builds a more meaningful summary and item labels for tool plus approval sequences', () => {
		const block = mapRunTimelineToBlock({
			blocks: [
				createToolResultBlock('call_tool_1', 'search.codebase', 'success'),
				createSearchResultBlock('Found 1 codebase match for "needle".'),
				createApprovalBlock('approval_1', 'pending'),
				createApprovalBlock('approval_1', 'approved'),
			],
			created_at: createdAt,
			events: [
				createEvent('run.started', { entry_state: 'INIT', trigger: 'user_message' }, 1),
				createEvent(
					'state.entered',
					{
						previous_state: 'INIT',
						reason: 'run-request-accepted',
						state: 'MODEL_THINKING',
					},
					2,
				),
				createEvent(
					'model.completed',
					{
						finish_reason: 'stop',
						model: 'gpt-5.4',
						output_text: 'I will inspect the codebase.',
						provider: 'openai',
					},
					3,
				),
			],
			run_id: 'run_timeline_test',
		});

		expect(block).toEqual({
			created_at: createdAt,
			id: 'run_timeline_block:run_timeline_test',
			payload: {
				items: [
					{
						kind: 'run_started',
						label: 'Runa işi başlattı',
					},
					{
						kind: 'model_completed',
						label: 'Sonraki adım belirlendi',
						state: 'completed',
					},
					{
						call_id: 'call_tool_1',
						detail: 'Found 1 codebase match for "needle".',
						kind: 'tool_completed',
						label: 'Kod tabanında arama yapıldı',
						state: 'success',
						tool_name: 'search.codebase',
					},
					{
						call_id: 'call_approval_1',
						detail: 'Write changes to src/example.ts',
						kind: 'approval_requested',
						label: 'Dosya yazma için onay bekleniyor',
						state: 'pending',
						tool_name: 'file.write',
					},
					{
						call_id: 'call_approval_1',
						detail: 'Approved by reviewer',
						kind: 'approval_resolved',
						label: 'Dosya yazma onaylandı',
						state: 'approved',
						tool_name: 'file.write',
					},
				],
				summary: 'Runa kod araması adımını yürüttü ve dosya yazma onayı aldı.',
				title: 'Çalışma akışı',
			},
			schema_version: 1,
			type: 'run_timeline_block',
		});
	});

	it('keeps simple no-tool runs concise and deterministic', () => {
		const block = mapRunTimelineToBlock({
			created_at: createdAt,
			events: [
				createEvent('run.started', { entry_state: 'INIT', trigger: 'user_message' }, 1),
				createEvent(
					'state.entered',
					{
						previous_state: 'INIT',
						reason: 'run-request-accepted',
						state: 'MODEL_THINKING',
					},
					2,
				),
				createEvent(
					'model.completed',
					{
						finish_reason: 'stop',
						model: 'gpt-5.4',
						output_text: 'Here is the answer.',
						provider: 'openai',
					},
					3,
				),
				createEvent(
					'run.completed',
					{
						final_state: 'COMPLETED',
						output_text: 'Here is the answer.',
					},
					4,
				),
			],
		});

		expect(block?.payload).toEqual({
			items: [
				{
					kind: 'run_started',
					label: 'Runa işi başlattı',
				},
				{
					kind: 'assistant_completed',
					label: 'Yanıt tamamlandı',
					state: 'completed',
				},
			],
			summary: 'Runa yanıtı doğrudan tamamladı.',
			title: 'Çalışma akışı',
		});
	});

	it('uses search and diff correlation to produce a more readable completed summary', () => {
		const block = mapRunTimelineToBlock({
			blocks: [
				createToolResultBlock('call_search', 'search.codebase', 'success'),
				createSearchResultBlock('Found 4 codebase matches for "auth".'),
				createToolResultBlock('call_diff', 'git.diff', 'success'),
				createDiffBlock('Diff preview for 2 changed paths.'),
			],
			created_at: createdAt,
			events: [
				createEvent('run.started', { entry_state: 'INIT', trigger: 'user_message' }, 1),
				createEvent(
					'state.entered',
					{
						previous_state: 'INIT',
						reason: 'run-request-accepted',
						state: 'MODEL_THINKING',
					},
					2,
				),
				createEvent(
					'model.completed',
					{
						finish_reason: 'stop',
						model: 'gpt-5.4',
						output_text: 'I checked the repo.',
						provider: 'openai',
					},
					3,
				),
				createEvent(
					'run.completed',
					{
						final_state: 'COMPLETED',
						output_text: 'I checked the repo.',
					},
					4,
				),
			],
		});

		expect(block?.payload.summary).toBe(
			'Runa kod araması yaptı, değişiklikleri inceledi ve yanıtı tamamladı.',
		);
		expect(block?.payload.items).toEqual([
			{
				kind: 'run_started',
				label: 'Runa işi başlattı',
			},
			{
				kind: 'assistant_completed',
				label: 'Yanıt tamamlandı',
				state: 'completed',
			},
			{
				call_id: 'call_search',
				detail: 'Found 4 codebase matches for "auth".',
				kind: 'tool_completed',
				label: 'Kod tabanında arama yapıldı',
				state: 'success',
				tool_name: 'search.codebase',
			},
			{
				call_id: 'call_diff',
				detail: 'Diff preview for 2 changed paths.',
				kind: 'tool_completed',
				label: 'Değişiklikler incelendi',
				state: 'success',
				tool_name: 'git.diff',
			},
		]);
	});

	it('surfaces codebase and public web search separately when both source classes are present', () => {
		const block = mapRunTimelineToBlock({
			blocks: [
				createToolResultBlock('call_web_search', 'web.search', 'success'),
				createSearchResultBlock('Found 1 codebase match for "auth middleware".'),
				createWebSearchResultBlock(
					'Found 1 web result for "latest auth middleware docs" from prioritized public sources.',
				),
			],
			created_at: createdAt,
			events: [createEvent('run.started', { entry_state: 'INIT', trigger: 'user_message' }, 1)],
			run_id: 'run_timeline_test',
		});

		expect(block?.payload.summary).toBe('Runa kod araması ve web araması yaptı.');
	});

	it('deduplicates tool-request noise and surfaces failed runs clearly', () => {
		const block = mapRunTimelineToBlock({
			blocks: [createToolResultBlock('call_diff_failed', 'git.diff', 'error')],
			created_at: createdAt,
			events: [
				createEvent('run.started', { entry_state: 'INIT', trigger: 'user_message' }, 1),
				createEvent(
					'tool.call.started',
					{
						call_id: 'call_diff_failed',
						tool_name: 'git.diff',
					},
					2,
				),
				createEvent(
					'tool.call.completed',
					{
						call_id: 'call_diff_failed',
						result_status: 'error',
						tool_name: 'git.diff',
					},
					3,
				),
				createEvent(
					'run.failed',
					{
						error_code: 'RUNTIME_ERROR',
						error_message: 'Diff could not be prepared.',
						final_state: 'FAILED',
						retryable: false,
					},
					4,
				),
			],
		});

		expect(block?.payload).toEqual({
			items: [
				{
					kind: 'run_started',
					label: 'Runa işi başlattı',
				},
				{
					call_id: 'call_diff_failed',
					detail: 'git.diff failed.',
					kind: 'tool_failed',
					label: 'Değişiklikler incelenemedi',
					state: 'error',
					tool_name: 'git.diff',
				},
				{
					detail: 'Diff could not be prepared.',
					kind: 'run_failed',
					label: 'Çalışma tamamlanamadı',
					state: 'failed',
				},
			],
			summary: 'Runa, çalışma durmadan önce git diff adımında sorunla karşılaştı.',
			title: 'Çalışma akışı',
		});
	});

	it('preserves the latest high-signal items when the timeline is truncated', () => {
		const toolBlocks = Array.from({ length: 11 }, (_, index) =>
			createToolResultBlock(`call_many_${index + 1}`, 'file.read', 'success'),
		);

		const block = mapRunTimelineToBlock({
			blocks: toolBlocks,
			created_at: createdAt,
			events: [
				createEvent('run.started', { entry_state: 'INIT', trigger: 'user_message' }, 1),
				createEvent(
					'state.entered',
					{
						previous_state: 'INIT',
						reason: 'run-request-accepted',
						state: 'MODEL_THINKING',
					},
					2,
				),
			],
		});

		expect(block?.payload.summary).toBe(
			'Runa araç kullanımı adımını yürüttü. Son 10/12 adım gösteriliyor.',
		);
		expect(block?.payload.items).toHaveLength(10);
		expect(block?.payload.items[0]).toMatchObject({
			kind: 'run_started',
			label: 'Runa işi başlattı',
		});
		expect(block?.payload.items[1]).toMatchObject({
			call_id: 'call_many_3',
			kind: 'tool_completed',
			label: 'Dosya okundu',
		});
		expect(block?.payload.items[9]).toMatchObject({
			call_id: 'call_many_11',
			kind: 'tool_completed',
			label: 'Dosya okundu',
		});
	});

	it('keeps approval-wait summaries chronological instead of diagnostic', () => {
		const block = mapRunTimelineToBlock({
			blocks: [createApprovalBlock('approval_wait', 'pending')],
			created_at: createdAt,
			events: [
				createEvent('run.started', { entry_state: 'INIT', trigger: 'user_message' }, 1),
				createEvent(
					'approval.requested',
					{
						action_kind: 'file_write',
						approval_id: 'approval_wait',
						call_id: 'call_approval_wait',
						summary: 'Write changes to src/example.ts',
						title: 'Approve file write',
						tool_name: 'file.write',
					},
					2,
				),
			],
		});

		expect(block?.payload.summary).toBe('Runa dosya yazma için onay bekleyişi durumunda.');
		expect(block?.payload.items).toEqual([
			{
				kind: 'run_started',
				label: 'Runa işi başlattı',
			},
			{
				call_id: 'call_approval_wait',
				detail: 'Write changes to src/example.ts',
				kind: 'approval_requested',
				label: 'Dosya yazma için onay bekleniyor',
				state: 'pending',
				tool_name: 'file.write',
			},
		]);
	});
});
