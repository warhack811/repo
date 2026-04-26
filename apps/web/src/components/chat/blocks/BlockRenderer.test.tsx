import type { RenderBlock } from '@runa/types';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BlockRenderer } from './BlockRenderer.js';

const createdAt = '2026-04-25T12:00:00.000Z';

const sampleBlocks: readonly RenderBlock[] = [
	{
		created_at: createdAt,
		id: 'text:block',
		payload: { text: 'Hello **Runa**' },
		schema_version: 1,
		type: 'text',
	},
	{
		created_at: createdAt,
		id: 'status:block',
		payload: { level: 'info', message: 'Runtime is preparing a response.' },
		schema_version: 1,
		type: 'status',
	},
	{
		created_at: createdAt,
		id: 'event:block',
		payload: { events: [], run_id: 'run_renderer', trace_id: 'trace_renderer' },
		schema_version: 1,
		type: 'event_list',
	},
	{
		created_at: createdAt,
		id: 'code:block',
		payload: {
			content: 'export const value = 1;',
			language: 'typescript',
			path: 'apps/web/src/example.ts',
			title: 'example.ts',
		},
		schema_version: 1,
		type: 'code_block',
	},
	{
		created_at: createdAt,
		id: 'code-artifact:block',
		payload: {
			content: 'export const artifact = true;',
			filename: 'artifact.ts',
			is_truncated: false,
			language: 'typescript',
			line_count: 1,
		},
		schema_version: 1,
		type: 'code_artifact',
	},
	{
		created_at: createdAt,
		id: 'diff:block',
		payload: {
			changed_paths: ['apps/web/src/example.ts'],
			diff_text: '+export const value = 1;',
			is_truncated: false,
			summary: 'One file changed.',
		},
		schema_version: 1,
		type: 'diff_block',
	},
	{
		created_at: createdAt,
		id: 'file-reference:block',
		payload: {
			line_end: 12,
			line_start: 10,
			path: 'apps/web/src/example.ts',
		},
		schema_version: 1,
		type: 'file_reference',
	},
	{
		created_at: createdAt,
		id: 'file-download:block',
		payload: {
			expires_at: '2026-04-25T12:15:00.000Z',
			filename: 'report.md',
			size_bytes: 42,
			url: '/storage/download/blob_report?expires_at=2026-04-25T12%3A15%3A00.000Z&signature=sig',
		},
		schema_version: 1,
		type: 'file_download',
	},
	{
		created_at: createdAt,
		id: 'inspection:block',
		payload: {
			detail_items: [{ label: 'Path', value: 'apps/web/src/example.ts' }],
			summary: 'Detail opened from a summary card.',
			target_kind: 'diff',
			title: 'Diff detail',
		},
		schema_version: 1,
		type: 'inspection_detail_block',
	},
	{
		created_at: createdAt,
		id: 'plan:block',
		payload: {
			steps: [
				{ status: 'done', text: 'Read the file' },
				{ status: 'pending', text: 'Patch the renderer' },
			],
			title: 'Plan',
		},
		schema_version: 1,
		type: 'plan',
	},
	{
		created_at: createdAt,
		id: 'timeline:block',
		payload: {
			items: [{ kind: 'run_started', label: 'Run started', state: 'active' }],
			summary: 'Runa started the work.',
			title: 'Run timeline',
		},
		schema_version: 1,
		type: 'run_timeline_block',
	},
	{
		created_at: createdAt,
		id: 'search:block',
		payload: {
			is_truncated: false,
			matches: [{ line_number: 12, line_text: 'export function demo() {}', path: 'demo.ts' }],
			query: 'demo',
			searched_root: 'D:\\ai\\Runa',
			summary: 'One local match found.',
			title: 'Code search',
			total_matches: 1,
		},
		schema_version: 1,
		type: 'search_result_block',
	},
	{
		created_at: createdAt,
		id: 'table:block',
		payload: {
			headers: ['File', 'Status'],
			rows: [['example.ts', 'done']],
		},
		schema_version: 1,
		type: 'table',
	},
	{
		created_at: createdAt,
		id: 'web-search:block',
		payload: {
			is_truncated: false,
			query: 'Runa',
			results: [
				{
					snippet: 'Public source snippet.',
					source: 'example.com',
					title: 'Example result',
					trust_tier: 'general',
					url: 'https://example.com/',
				},
			],
			search_provider: 'serper',
			summary: 'One public result kept.',
			title: 'Web search',
		},
		schema_version: 1,
		type: 'web_search_result_block',
	},
	{
		created_at: createdAt,
		id: 'trace:block',
		payload: {
			run_state: 'COMPLETED',
			summary: 'Trace completed.',
			title: 'Trace debug',
		},
		schema_version: 1,
		type: 'trace_debug_block',
	},
	{
		created_at: createdAt,
		id: 'workspace:block',
		payload: {
			project_type_hints: ['vite'],
			summary: 'Workspace looks like a React app.',
			title: 'Workspace summary',
			top_level_signals: ['apps/web'],
		},
		schema_version: 1,
		type: 'workspace_inspection_block',
	},
	{
		created_at: createdAt,
		id: 'approval:block',
		payload: {
			action_kind: 'tool_execution',
			approval_id: 'approval_renderer',
			status: 'pending',
			summary: 'Approve file write.',
			title: 'Approval required',
			tool_name: 'file.write',
		},
		schema_version: 1,
		type: 'approval_block',
	},
	{
		created_at: createdAt,
		id: 'tool:block',
		payload: {
			call_id: 'call_renderer',
			result_preview: { kind: 'object', summary_text: 'Object{ok}' },
			status: 'success',
			summary: 'file.read completed successfully.',
			tool_name: 'file.read',
		},
		schema_version: 1,
		type: 'tool_result',
	},
];

describe('BlockRenderer', () => {
	it('renders every current RenderBlock type in developer mode', () => {
		for (const block of sampleBlocks) {
			const element = (
				<BlockRenderer
					block={block}
					isDeveloperMode
					onResolveApproval={() => undefined}
					renderInspectionDetailBlock={() => <article>inspection detail</article>}
				/>
			);
			const markup = renderToStaticMarkup(element);

			expect(markup.length).toBeGreaterThan(0);
			expect(markup).not.toContain('Unsupported block');
		}
	});

	it('keeps raw runtime/debug blocks out of the default chat surface', () => {
		const eventBlock = sampleBlocks.find((block) => block.type === 'event_list');
		const traceBlock = sampleBlocks.find((block) => block.type === 'trace_debug_block');

		expect(eventBlock).toBeDefined();
		expect(traceBlock).toBeDefined();

		if (!eventBlock || !traceBlock) {
			throw new Error('Expected developer-only fixture blocks.');
		}

		expect(BlockRenderer({ block: eventBlock })).toEqual(null);
		expect(BlockRenderer({ block: traceBlock })).toEqual(null);
	});

	it('renders code copy affordance and collapsed diff affordance', () => {
		const codeBlock = sampleBlocks.find((block) => block.type === 'code_block');
		const diffBlock = sampleBlocks.find((block) => block.type === 'diff_block');

		if (!codeBlock || !diffBlock) {
			throw new Error('Expected code and diff fixture blocks.');
		}

		expect(renderToStaticMarkup(<BlockRenderer block={codeBlock} />)).toContain('Copy');
		expect(renderToStaticMarkup(<BlockRenderer block={diffBlock} />)).toContain('View diff');
	});
});
