import type {
	AnyRuntimeEvent,
	DiffBlock,
	InspectionDetailBlock,
	RenderBlock,
	RunTimelineBlock,
	TraceDebugBlock,
	WorkspaceInspectionBlock,
} from '@runa/types';
import { describe, expect, it } from 'vitest';

import type { WorkspaceLayer } from '../context/compose-workspace-context.js';
import { buildModelUsageEventMetadata } from '../runtime/model-usage-accounting.js';
import { mapInspectionDetailToBlock } from './map-inspection-detail.js';

const createdAt = '2026-04-11T18:00:00.000Z';

function createWorkspaceLayer(): WorkspaceLayer {
	return {
		content: {
			dependency_hints: ['react', 'vite', 'fastify', 'typescript'],
			layer_type: 'workspace_layer',
			project_name: 'runa',
			project_type_hints: ['monorepo', 'react', 'vite', 'typescript'],
			scripts: ['dev', 'build', 'test', 'lint', 'typecheck'],
			summary: 'runa is a TypeScript workspace with React and Fastify signals.',
			title: 'Workspace Overview',
			top_level_signals: ['apps', 'packages', 'pnpm-workspace.yaml', 'turbo.json'],
		},
		kind: 'workspace',
		name: 'workspace_layer',
	};
}

function createWorkspaceInspectionBlock(): WorkspaceInspectionBlock {
	return {
		created_at: createdAt,
		id: 'workspace_inspection_block:run_1',
		payload: {
			inspection_notes: ['Key scripts look healthy.', 'Workspace context prepared.'],
			last_search_summary: 'Found 2 codebase matches for "inspection".',
			project_name: 'runa',
			project_type_hints: ['monorepo', 'react', 'vite', 'typescript'],
			summary: 'runa is a TypeScript workspace with React and Fastify signals.',
			title: 'Workspace Overview',
			top_level_signals: ['apps', 'packages', 'pnpm-workspace.yaml', 'turbo.json'],
		},
		schema_version: 1,
		type: 'workspace_inspection_block',
	};
}

function createTraceDebugBlock(): TraceDebugBlock {
	return {
		created_at: createdAt,
		id: 'trace_debug_block:run_1',
		payload: {
			approval_summary: 'Approval granted for file write.',
			debug_notes: ['Workspace context prepared before codebase search.'],
			run_state: 'TOOL_RESULT_INGESTING',
			summary: 'Run replayed file write after approval.',
			title: 'Trace / Debug',
			tool_chain_summary: 'Tool chain: Codebase search -> File write.',
			trace_label: 'run run_1 / trace trace_1',
			warning_notes: ['Search results were truncated.'],
		},
		schema_version: 1,
		type: 'trace_debug_block',
	};
}

function createSearchResultBlock(): Extract<RenderBlock, { type: 'search_result_block' }> {
	return {
		created_at: createdAt,
		id: 'search_result_block:call_search_1',
		payload: {
			is_truncated: true,
			matches: [
				{
					line_number: 4,
					line_text: 'const inspectionAlpha = true;',
					path: 'src/alpha.ts',
				},
				{
					line_number: 8,
					line_text: 'const inspectionBeta = true;',
					path: 'src/beta.ts',
				},
				{
					line_number: 12,
					line_text: 'const inspectionGamma = true;',
					path: 'src/gamma.ts',
				},
				{
					line_number: 18,
					line_text: 'const inspectionDelta = true;',
					path: 'src/delta.ts',
				},
			],
			query: 'inspection',
			searched_root: 'd:\\ai\\Runa',
			summary: 'Found 8 codebase matches for "inspection"; showing 4.',
			title: 'Codebase Search Results',
			total_matches: 8,
		},
		schema_version: 1,
		type: 'search_result_block',
	};
}

function createRunTimelineBlock(): RunTimelineBlock {
	return {
		created_at: createdAt,
		id: 'run_timeline_block:run_1',
		payload: {
			items: [
				{
					kind: 'run_started',
					label: 'Run started',
				},
				{
					detail: 'groq / llama-3.3-70b-versatile',
					kind: 'model_completed',
					label: 'Model planned the next step',
					state: 'completed',
				},
				{
					call_id: 'call_search_1',
					kind: 'tool_requested',
					label: 'Requested codebase search',
					state: 'requested',
					tool_name: 'search.codebase',
				},
				{
					call_id: 'call_search_1',
					detail: 'Found 5 codebase matches for "inspection".',
					kind: 'tool_completed',
					label: 'Searched the codebase',
					state: 'success',
					tool_name: 'search.codebase',
				},
				{
					call_id: 'call_write_1',
					detail: 'Approved after diff review.',
					kind: 'approval_resolved',
					label: 'Approval approved for file.write',
					state: 'approved',
					tool_name: 'file.write',
				},
				{
					call_id: 'call_write_1',
					kind: 'tool_requested',
					label: 'Requested file write',
					state: 'requested',
					tool_name: 'file.write',
				},
				{
					call_id: 'call_write_1',
					kind: 'tool_completed',
					label: 'Wrote file changes',
					state: 'success',
					tool_name: 'file.write',
				},
				{
					kind: 'assistant_completed',
					label: 'Assistant finished the turn',
					state: 'completed',
				},
			],
			summary: 'Run completed after approval replay and tool execution.',
			title: 'Run Timeline',
		},
		schema_version: 1,
		type: 'run_timeline_block',
	};
}

function createDiffBlock(): DiffBlock {
	return {
		created_at: createdAt,
		id: 'diff_block:src/alpha.ts:call_diff_1',
		payload: {
			changed_paths: ['src/alpha.ts', 'src/beta.ts', 'src/gamma.ts', 'src/delta.ts'],
			diff_text: [
				'diff --git a/src/alpha.ts b/src/alpha.ts',
				'index 123..456 100644',
				'--- a/src/alpha.ts',
				'+++ b/src/alpha.ts',
				'@@ -1,2 +1,3 @@',
				'-const oldValue = 1;',
				'+const oldValue = 2;',
				'+const newValue = true;',
				' const contextLine = true;',
			].join('\n'),
			is_truncated: true,
			path: 'src/alpha.ts',
			summary: 'Diff preview for 4 changed paths.',
			title: 'src/alpha.ts',
		},
		schema_version: 1,
		type: 'diff_block',
	};
}

function createTraceDebugEvents(): readonly AnyRuntimeEvent[] {
	return [
		{
			actor: {
				type: 'assistant',
			},
			event_id: 'event_trace_debug_1',
			event_type: 'model.completed',
			event_version: 1,
			metadata: buildModelUsageEventMetadata({
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
									summary: 'Latest memory note.',
								},
								kind: 'memory',
								name: 'memory_layer',
							},
						],
					},
					messages: [
						{
							content: 'Inspect this run.',
							role: 'user',
						},
					],
					run_id: 'run_1',
					trace_id: 'trace_1',
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
						input_tokens: 21,
						output_tokens: 9,
						total_tokens: 30,
					},
				},
			}),
			payload: {
				finish_reason: 'stop',
				model: 'groq/test-model',
				output_text: 'Usage traced.',
				provider: 'groq',
			},
			run_id: 'run_1',
			sequence_no: 3,
			source: {
				kind: 'runtime',
			},
			timestamp: '2026-04-11T18:00:03.000Z',
			trace_id: 'trace_1',
		},
	];
}

describe('map-inspection-detail', () => {
	it('maps workspace detail with a tighter standard payload and a richer expanded payload', () => {
		const baseInput = {
			blocks: [createWorkspaceInspectionBlock()],
			created_at: createdAt,
			run_id: 'run_1',
			target_kind: 'workspace',
			workspace_layer: createWorkspaceLayer(),
		} as const;

		const standardBlock = mapInspectionDetailToBlock({
			...baseInput,
			detail_level: 'standard',
		});
		const expandedBlock = mapInspectionDetailToBlock({
			...baseInput,
			detail_level: 'expanded',
		});

		expect(standardBlock).toEqual({
			created_at: createdAt,
			id: 'inspection_detail_block:run_1:workspace:workspace_inspection_block:run_1',
			payload: {
				detail_items: [
					{ label: 'Project name', value: 'runa' },
					{ label: 'Project type', value: 'monorepo, react, vite +1 more' },
					{ label: 'Top-level signals', value: 'apps, packages, pnpm-workspace.yaml +1 more' },
					{ label: 'Key scripts', value: 'dev, build, test, lint +1 more' },
					{ label: 'Latest search', value: 'Found 2 codebase matches for "inspection".' },
				],
				summary:
					'Focused workspace detail with project signals, scripts, and latest search context.',
				target_kind: 'workspace',
				title: 'Workspace Overview Details',
			},
			schema_version: 1,
			type: 'inspection_detail_block',
		} satisfies InspectionDetailBlock);

		expect(expandedBlock?.payload).toEqual({
			detail_items: [
				{ label: 'Project name', value: 'runa' },
				{ label: 'Project type', value: 'monorepo, react, vite, typescript' },
				{ label: 'Top-level signals', value: 'apps, packages, pnpm-workspace.yaml, turbo.json' },
				{ label: 'Key scripts', value: 'dev, build, test, lint, typecheck' },
				{ label: 'Latest search', value: 'Found 2 codebase matches for "inspection".' },
				{ label: 'Dependency hints', value: 'react, vite, fastify, typescript' },
				{
					label: 'Workspace notes',
					value: 'Key scripts look healthy., Workspace context prepared.',
				},
			],
			summary: 'Expanded workspace detail with project signals, scripts, and dependency hints.',
			target_kind: 'workspace',
			title: 'Workspace Overview Details',
		});
	});

	it('maps trace/debug detail with clearer standard vs expanded semantics and less summary reuse', () => {
		const standardBlock = mapInspectionDetailToBlock({
			blocks: [createTraceDebugBlock()],
			created_at: createdAt,
			detail_level: 'standard',
			events: createTraceDebugEvents(),
			run_id: 'run_1',
			target_kind: 'trace_debug',
			trace_id: 'trace_1',
		});
		const expandedBlock = mapInspectionDetailToBlock({
			blocks: [createTraceDebugBlock()],
			created_at: createdAt,
			detail_level: 'expanded',
			events: createTraceDebugEvents(),
			run_id: 'run_1',
			target_kind: 'trace_debug',
			trace_id: 'trace_1',
		});

		expect(standardBlock?.payload).toEqual({
			detail_items: [
				{ label: 'Run context', value: 'run run_1 / trace trace_1' },
				{ label: 'Execution state', value: 'TOOL_RESULT_INGESTING' },
				{ label: 'Tool path', value: 'Codebase search -> File write' },
				{ label: 'Approval signal', value: 'Approval granted for file write.' },
				{ label: 'Warning signals', value: 'Search results were truncated.' },
				{
					label: 'Debug signals',
					value: 'Workspace context prepared before codebase search.',
				},
				expect.objectContaining({
					label: 'Context accounting',
					value: expect.stringContaining('~'),
				}),
				expect.objectContaining({
					label: 'Request usage',
					value: expect.stringContaining('messages ~'),
				}),
				expect.objectContaining({
					label: 'Response usage',
					value: expect.stringContaining('provider 30 tok'),
				}),
			],
			summary:
				'Focused trace / debug detail with execution state, tool path, and operational signals.',
			target_kind: 'trace_debug',
			title: 'Trace / Debug Details',
		});
		expect(expandedBlock?.payload.detail_items).toEqual([
			{ label: 'Run context', value: 'run run_1 / trace trace_1' },
			{ label: 'Execution state', value: 'TOOL_RESULT_INGESTING' },
			{ label: 'Tool path', value: 'Codebase search -> File write' },
			{ label: 'Approval signal', value: 'Approval granted for file write.' },
			{ label: 'Warning signals', value: 'Search results were truncated.' },
			{
				label: 'Debug signals',
				value: 'Workspace context prepared before codebase search.',
			},
			expect.objectContaining({
				label: 'Context accounting',
				value: expect.stringContaining('~'),
			}),
			expect.objectContaining({
				label: 'Request usage',
				value: expect.stringContaining('messages ~'),
			}),
			expect.objectContaining({
				label: 'Response usage',
				value: expect.stringContaining('provider 30 tok'),
			}),
			{ label: 'Trace label', value: 'run run_1 / trace trace_1' },
			expect.objectContaining({
				label: 'Context layers',
				value: expect.stringContaining('core_rules'),
			}),
		]);
		expect(standardBlock?.payload.summary).not.toBe(createTraceDebugBlock().payload.summary);
	});

	it('orders timeline detail items by outcome, latest step, tool activity, and approval gate', () => {
		const block = mapInspectionDetailToBlock({
			blocks: [createRunTimelineBlock()],
			created_at: createdAt,
			detail_level: 'standard',
			run_id: 'run_1',
			target_kind: 'timeline',
			trace_id: 'trace_1',
		});

		expect(block?.payload).toEqual({
			detail_items: [
				{ label: 'Run context', value: 'run run_1 / trace trace_1' },
				{ label: 'Outcome', value: 'Assistant finished the turn' },
				{ label: 'Latest step', value: 'Wrote file changes' },
				{
					label: 'Tool activity',
					value:
						'Requested codebase search -> Searched the codebase -> Requested file write +1 more',
				},
				{
					label: 'Approval gate',
					value: 'Approval approved for file.write - Approved after diff review. - state: approved',
				},
			],
			summary: 'Focused timeline detail with outcome, latest step, and tool activity.',
			target_kind: 'timeline',
			title: 'Run Timeline Details',
		});
	});

	it('maps search_result meta and truncation into a compact deterministic payload', () => {
		const standardBlock = mapInspectionDetailToBlock({
			blocks: [createSearchResultBlock()],
			created_at: createdAt,
			detail_level: 'standard',
			run_id: 'run_1',
			target_kind: 'search_result',
			trace_id: 'trace_1',
		});
		const expandedBlock = mapInspectionDetailToBlock({
			blocks: [createSearchResultBlock()],
			created_at: createdAt,
			detail_level: 'expanded',
			run_id: 'run_1',
			target_kind: 'search_result',
			trace_id: 'trace_1',
		});

		expect(standardBlock?.payload.detail_items).toEqual([
			{ label: 'Run context', value: 'run run_1 / trace trace_1' },
			{ label: 'Query', value: 'inspection' },
			{ label: 'Search root', value: 'd:\\ai\\Runa' },
			{ label: 'Result window', value: 'showing 4 of 8 matches; truncated' },
			{ label: 'Sample 1', value: 'src/alpha.ts:4 - const inspectionAlpha = true;' },
			{ label: 'Sample 2', value: 'src/beta.ts:8 - const inspectionBeta = true;' },
		]);
		expect(expandedBlock?.payload.detail_items).toEqual([
			{ label: 'Run context', value: 'run run_1 / trace trace_1' },
			{ label: 'Query', value: 'inspection' },
			{ label: 'Search root', value: 'd:\\ai\\Runa' },
			{ label: 'Result window', value: 'showing 4 of 8 matches; truncated' },
			{ label: 'Sample 1', value: 'src/alpha.ts:4 - const inspectionAlpha = true;' },
			{ label: 'Sample 2', value: 'src/beta.ts:8 - const inspectionBeta = true;' },
			{ label: 'Sample 3', value: 'src/gamma.ts:12 - const inspectionGamma = true;' },
			{ label: 'Sample 4', value: 'src/delta.ts:18 - const inspectionDelta = true;' },
		]);
		expect(standardBlock?.payload.summary).toBe(
			'Focused search detail with result window and key sample matches.',
		);
	});

	it('maps diff detail into focused path scope, footprint, and preview status', () => {
		const standardBlock = mapInspectionDetailToBlock({
			blocks: [createDiffBlock()],
			created_at: createdAt,
			detail_level: 'standard',
			run_id: 'run_1',
			target_kind: 'diff',
			trace_id: 'trace_1',
		});
		const expandedBlock = mapInspectionDetailToBlock({
			blocks: [createDiffBlock()],
			created_at: createdAt,
			detail_level: 'expanded',
			run_id: 'run_1',
			target_kind: 'diff',
			trace_id: 'trace_1',
		});

		expect(standardBlock?.payload.detail_items).toEqual([
			{ label: 'Run context', value: 'run run_1 / trace trace_1' },
			{ label: 'Focus path', value: 'src/alpha.ts' },
			{ label: 'Changed paths', value: 'src/beta.ts, src/gamma.ts, src/delta.ts' },
			{ label: 'Diff footprint', value: '2 additions and 1 deletions in 9 preview lines' },
			{ label: 'Preview status', value: 'truncated after 9 preview lines' },
		]);
		expect(expandedBlock?.payload.detail_items).toEqual([
			{ label: 'Run context', value: 'run run_1 / trace trace_1' },
			{ label: 'Focus path', value: 'src/alpha.ts' },
			{ label: 'Changed path count', value: '4' },
			{ label: 'Changed paths', value: 'src/beta.ts, src/gamma.ts, src/delta.ts' },
			{ label: 'Diff footprint', value: '2 additions and 1 deletions in 9 preview lines' },
			{ label: 'Preview status', value: 'truncated after 9 preview lines' },
		]);
	});

	it('keeps refined detail payloads small and deterministic across repeated calls', () => {
		const workspaceInput = {
			blocks: [createWorkspaceInspectionBlock()],
			created_at: createdAt,
			detail_level: 'expanded',
			run_id: 'run_repeat',
			target_kind: 'workspace',
			workspace_layer: createWorkspaceLayer(),
		} as const;
		const timelineInput = {
			blocks: [createRunTimelineBlock()],
			created_at: createdAt,
			detail_level: 'expanded',
			run_id: 'run_repeat',
			target_kind: 'timeline',
			trace_id: 'trace_repeat',
		} as const;
		const searchInput = {
			blocks: [createSearchResultBlock()],
			created_at: createdAt,
			detail_level: 'expanded',
			run_id: 'run_repeat',
			target_kind: 'search_result',
			trace_id: 'trace_repeat',
		} as const;

		const firstWorkspace = mapInspectionDetailToBlock(workspaceInput);
		const secondWorkspace = mapInspectionDetailToBlock(workspaceInput);
		const firstTimeline = mapInspectionDetailToBlock(timelineInput);
		const secondTimeline = mapInspectionDetailToBlock(timelineInput);
		const firstSearch = mapInspectionDetailToBlock(searchInput);
		const secondSearch = mapInspectionDetailToBlock(searchInput);

		expect(firstWorkspace).toEqual(secondWorkspace);
		expect(firstTimeline).toEqual(secondTimeline);
		expect(firstSearch).toEqual(secondSearch);
		expect(firstWorkspace?.payload.detail_items.length).toBeLessThanOrEqual(7);
		expect(firstTimeline?.payload.detail_items.length).toBeLessThanOrEqual(9);
		expect(firstSearch?.payload.detail_items.length).toBeLessThanOrEqual(8);
	});
});
