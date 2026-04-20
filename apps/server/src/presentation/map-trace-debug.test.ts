import type {
	ApprovalBlock,
	DiffBlock,
	EventEnvelope,
	EventMetadata,
	EventPayload,
	EventType,
	SearchResultBlock,
	ToolResultBlock,
	WebSearchResultBlock,
	WorkspaceInspectionBlock,
} from '@runa/types';
import { describe, expect, it } from 'vitest';

import { buildModelUsageEventMetadata } from '../runtime/model-usage-accounting.js';
import { mapTraceDebugToBlock } from './map-trace-debug.js';

const createdAt = '2026-04-11T16:00:00.000Z';

function createEvent<TType extends EventType>(
	eventType: TType,
	payload: EventPayload<TType>,
	sequenceNo: number,
	metadata?: EventMetadata,
): EventEnvelope<TType> {
	return {
		actor: {
			type: 'system',
		},
		event_id: `event_${sequenceNo}`,
		event_type: eventType,
		event_version: 1,
		payload,
		run_id: 'run_debug_1',
		sequence_no: sequenceNo,
		source: {
			kind: 'runtime',
		},
		timestamp: `2026-04-11T16:00:${String(sequenceNo).padStart(2, '0')}.000Z`,
		trace_id: 'trace_debug_1',
		metadata,
	};
}

function createModelUsageMetadata(): EventMetadata {
	return buildModelUsageEventMetadata({
		model_request: {
			compiled_context: {
				layers: [
					{
						content: {
							instruction: 'Stay focused.',
						},
						kind: 'instruction',
						name: 'core_rules',
					},
					{
						content: {
							memories: ['Remember Sprint 5.'],
						},
						kind: 'memory',
						name: 'memory_layer',
					},
				],
			},
			messages: [
				{
					content: 'Track usage for this turn.',
					role: 'user',
				},
			],
			run_id: 'run_debug_1',
			trace_id: 'trace_debug_1',
		},
		model_response: {
			finish_reason: 'stop',
			message: {
				content: 'Usage traced.',
				role: 'assistant',
			},
			model: 'groq/test-model',
			provider: 'groq',
			usage: {
				input_tokens: 24,
				output_tokens: 8,
				total_tokens: 32,
			},
		},
	});
}

function createToolResultBlock(
	callId: string,
	toolName: ToolResultBlock['payload']['tool_name'],
	status: ToolResultBlock['payload']['status'],
	summary: string,
): ToolResultBlock {
	return {
		created_at: createdAt,
		id: `tool_result:${callId}`,
		payload: {
			call_id: callId,
			status,
			summary,
			tool_name: toolName,
		},
		schema_version: 1,
		type: 'tool_result',
	};
}

function createApprovalBlock(
	status: ApprovalBlock['payload']['status'],
	toolName: ApprovalBlock['payload']['tool_name'],
	note?: string,
): ApprovalBlock {
	return {
		created_at: createdAt,
		id: `approval_block:${status}`,
		payload: {
			action_kind: toolName === 'shell.exec' ? 'shell_execution' : 'file_write',
			approval_id: 'approval_debug_1',
			call_id: 'call_file_write',
			decision: status === 'pending' ? undefined : status,
			note,
			status,
			summary: 'Write changes to src/example.ts',
			title: 'Approve file write',
			tool_name: toolName,
		},
		schema_version: 1,
		type: 'approval_block',
	};
}

function createSearchResultBlock(summary: string, isTruncated = false): SearchResultBlock {
	return {
		created_at: createdAt,
		id: 'search_result_block:call_search',
		payload: {
			is_truncated: isTruncated,
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

function createWebSearchResultBlock(
	summary: string,
	options?: {
		readonly isTruncated?: boolean;
	},
): WebSearchResultBlock {
	return {
		created_at: createdAt,
		id: 'web_search_result_block:call_web_search',
		payload: {
			authority_note: 'Authority-first ordering keeps low-trust results out.',
			is_truncated: options?.isTruncated ?? false,
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

function createDiffBlock(summary: string, isTruncated = false): DiffBlock {
	return {
		created_at: createdAt,
		id: 'diff_block:src/example.ts:call_diff',
		payload: {
			changed_paths: ['src/example.ts'],
			diff_text: '@@ -1 +1 @@\n-old\n+new\n',
			is_truncated: isTruncated,
			path: 'src/example.ts',
			summary,
			title: 'src/example.ts',
		},
		schema_version: 1,
		type: 'diff_block',
	};
}

function createWorkspaceInspectionBlock(): WorkspaceInspectionBlock {
	return {
		created_at: createdAt,
		id: 'workspace_inspection_block:run_debug_1',
		payload: {
			project_name: 'Runa',
			project_type_hints: ['TypeScript', 'Turborepo'],
			summary: 'Workspace summary.',
			title: 'Workspace Inspection',
			top_level_signals: ['apps', 'packages'],
		},
		schema_version: 1,
		type: 'workspace_inspection_block',
	};
}

describe('map-trace-debug', () => {
	it('keeps no-tool assistant runs deterministic and compact', () => {
		const block = mapTraceDebugToBlock({
			created_at: createdAt,
			events: [
				createEvent('run.started', { entry_state: 'INIT', trigger: 'user_message' }, 1),
				createEvent(
					'run.completed',
					{
						final_state: 'COMPLETED',
						output_text: 'Answer only.',
					},
					2,
				),
			],
			run_state: 'COMPLETED',
		});

		expect(block?.payload).toEqual({
			approval_summary: undefined,
			debug_notes: undefined,
			run_state: 'COMPLETED',
			summary: 'Run completed without tool use.',
			title: 'Trace / Debug',
			tool_chain_summary: undefined,
			trace_label: undefined,
			warning_notes: undefined,
		});
	});

	it('summarizes approval waits around the critical action and keeps inspection notes selective', () => {
		const block = mapTraceDebugToBlock({
			blocks: [
				createToolResultBlock(
					'call_search',
					'search.codebase',
					'success',
					'search.codebase completed successfully.',
				),
				createSearchResultBlock('Found 1 codebase match for "needle".'),
				createToolResultBlock(
					'call_diff',
					'git.diff',
					'success',
					'git.diff completed successfully.',
				),
				createDiffBlock('Diff preview for 1 changed path.'),
				createApprovalBlock('pending', 'file.write'),
				createWorkspaceInspectionBlock(),
			],
			created_at: createdAt,
			events: [
				createEvent('run.started', { entry_state: 'INIT', trigger: 'user_message' }, 1),
				createEvent(
					'approval.requested',
					{
						action_kind: 'file_write',
						approval_id: 'approval_debug_1',
						call_id: 'call_file_write',
						summary: 'Write changes to src/example.ts',
						title: 'Approve file write',
						tool_name: 'file.write',
					},
					2,
				),
			],
			run_id: 'run_debug_1',
			run_state: 'WAITING_APPROVAL',
			trace_id: 'trace_debug_1',
		});

		expect(block?.payload).toEqual({
			approval_summary: 'Approval gate active before file write.',
			debug_notes: ['Workspace context prepared before codebase search and diff inspection.'],
			run_state: 'WAITING_APPROVAL',
			summary: 'Run paused at approval gate before file write.',
			title: 'Trace / Debug',
			tool_chain_summary: 'Tool chain: Codebase search -> Git diff.',
			trace_label: 'run run_debug_1 / trace trace_debug_1',
			warning_notes: ['Pending approval is blocking file write.'],
		});
	});

	it('distinguishes codebase and public web search in inspection summaries', () => {
		const block = mapTraceDebugToBlock({
			blocks: [
				createSearchResultBlock('Found 1 codebase match for "auth middleware".'),
				createWebSearchResultBlock(
					'Found 1 web result for "latest auth middleware docs" from prioritized public sources.',
				),
				createWorkspaceInspectionBlock(),
			],
			created_at: createdAt,
			run_id: 'run_debug_1',
			run_state: 'MODEL_THINKING',
			trace_id: 'trace_debug_1',
		});

		expect(block?.payload).toMatchObject({
			debug_notes: ['Workspace context prepared before codebase search and public web search.'],
			run_state: 'MODEL_THINKING',
			summary: 'Run returned to model thinking after codebase search and public web search.',
			title: 'Trace / Debug',
		});
	});

	it('makes approval replay summaries clearer without expanding the payload shape', () => {
		const block = mapTraceDebugToBlock({
			blocks: [
				createApprovalBlock('approved', 'file.write', 'Approved by reviewer'),
				createToolResultBlock(
					'call_file_write',
					'file.write',
					'success',
					'file.write completed successfully.',
				),
			],
			created_at: createdAt,
			events: [
				createEvent(
					'approval.resolved',
					{
						approval_id: 'approval_debug_1',
						decision: 'approved',
						note: 'Approved by reviewer',
						resolved_at: '2026-04-11T16:00:05.000Z',
					},
					1,
				),
			],
			run_id: 'run_debug_1',
			run_state: 'TOOL_RESULT_INGESTING',
			trace_id: 'trace_debug_1',
		});

		expect(block?.payload).toEqual({
			approval_summary: 'Approval granted; replay executed for file write.',
			debug_notes: undefined,
			run_state: 'TOOL_RESULT_INGESTING',
			summary: 'Run replayed file write after approval.',
			title: 'Trace / Debug',
			tool_chain_summary: 'Tool chain: File write.',
			trace_label: 'run run_debug_1 / trace trace_debug_1',
			warning_notes: undefined,
		});
	});

	it('preserves approval context from events when a replayed tool run fails', () => {
		const block = mapTraceDebugToBlock({
			created_at: createdAt,
			events: [
				createEvent(
					'approval.requested',
					{
						action_kind: 'file_write',
						approval_id: 'approval_debug_1',
						call_id: 'call_file_write',
						summary: 'Write changes to src/example.ts',
						title: 'Approve file write',
						tool_name: 'file.write',
					},
					1,
				),
				createEvent(
					'approval.resolved',
					{
						approval_id: 'approval_debug_1',
						decision: 'approved',
						note: 'Approved by reviewer',
						resolved_at: '2026-04-11T16:00:04.000Z',
					},
					2,
				),
				createEvent(
					'tool.call.failed',
					{
						call_id: 'call_file_write',
						error_message: 'Write could not be applied.',
						tool_name: 'file.write',
					},
					3,
				),
				createEvent(
					'run.failed',
					{
						error_code: 'RUNTIME_ERROR',
						error_message: 'Write could not be applied.',
						final_state: 'FAILED',
						retryable: false,
					},
					4,
				),
			],
			run_state: 'FAILED',
		});

		expect(block?.payload).toEqual({
			approval_summary: 'Approval granted; replay executed for file write.',
			debug_notes: undefined,
			run_state: 'FAILED',
			summary: 'Run failed during tool execution after approval.',
			title: 'Trace / Debug',
			tool_chain_summary: 'Tool chain: File write.',
			trace_label: undefined,
			warning_notes: ['Tool failure: Write could not be applied.'],
		});
	});

	it('reflects search, diff and workspace correlation without overlapping the timeline role', () => {
		const block = mapTraceDebugToBlock({
			blocks: [
				createToolResultBlock(
					'call_search',
					'search.codebase',
					'success',
					'search.codebase completed successfully.',
				),
				createSearchResultBlock('Found 4 codebase matches for "auth".'),
				createToolResultBlock(
					'call_diff',
					'git.diff',
					'success',
					'git.diff completed successfully.',
				),
				createDiffBlock('Diff preview for 2 changed paths.'),
				createWorkspaceInspectionBlock(),
			],
			created_at: createdAt,
			events: [
				createEvent('run.started', { entry_state: 'INIT', trigger: 'user_message' }, 1),
				createEvent(
					'run.completed',
					{
						final_state: 'COMPLETED',
						output_text: 'I checked the repo.',
					},
					2,
				),
			],
			run_state: 'COMPLETED',
		});

		expect(block?.payload).toEqual({
			approval_summary: undefined,
			debug_notes: ['Workspace context prepared.'],
			run_state: 'COMPLETED',
			summary: 'Run completed after codebase search and diff inspection.',
			title: 'Trace / Debug',
			tool_chain_summary: 'Tool chain: Codebase search -> Git diff.',
			trace_label: undefined,
			warning_notes: undefined,
		});
	});

	it('deduplicates noisy tool signals and combines truncation warnings compactly', () => {
		const block = mapTraceDebugToBlock({
			blocks: [
				createToolResultBlock(
					'call_diff_failed',
					'git.diff',
					'error',
					'git.diff failed: Diff could not be prepared.',
				),
				createSearchResultBlock('Found 8 codebase matches for "diff".', true),
				createDiffBlock('Diff preview for 4 changed paths.', true),
			],
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
			run_state: 'FAILED',
		});

		expect(block?.payload.summary).toBe('Run failed during tool execution.');
		expect(block?.payload.tool_chain_summary).toBe('Tool chain: Git diff.');
		expect(block?.payload.debug_notes).toEqual([
			'Codebase search and diff inspection informed this run.',
		]);
		expect(block?.payload.warning_notes).toEqual([
			'Tool failure: Diff could not be prepared.',
			'Search results and diff preview were truncated.',
		]);
		expect(block?.payload.warning_notes).toHaveLength(2);
	});

	it('surfaces compact context accounting and response usage notes when model metadata is present', () => {
		const block = mapTraceDebugToBlock({
			created_at: createdAt,
			events: [
				createEvent('run.started', { entry_state: 'INIT', trigger: 'user_message' }, 1),
				createEvent(
					'model.completed',
					{
						finish_reason: 'stop',
						model: 'groq/test-model',
						output_text: 'Usage traced.',
						provider: 'groq',
					},
					2,
					createModelUsageMetadata(),
				),
				createEvent(
					'run.completed',
					{
						final_state: 'COMPLETED',
						output_text: 'Usage traced.',
					},
					3,
				),
			],
			run_state: 'COMPLETED',
		});

		expect(block?.payload.debug_notes).toEqual(
			expect.arrayContaining([
				expect.stringContaining('Context accounting:'),
				expect.stringContaining('Model usage: request'),
			]),
		);
		expect(block?.payload.debug_notes).toEqual(
			expect.arrayContaining([
				expect.stringContaining('core_rules'),
				expect.stringContaining('memory_layer'),
				expect.stringContaining('provider response 32 tok'),
			]),
		);
	});
});
