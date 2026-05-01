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
			evidence: {
				query: 'Runa',
				results: 3,
				searches: 2,
				sources: [
					{
						canonical_url: 'https://example.com/runa',
						domain: 'example.com',
						favicon: 'https://example.com/favicon.ico',
						id: 'source_1',
						published_at: '2026-04-20T00:00:00.000Z',
						snippet: 'Canonical source snippet.',
						title: 'Canonical source',
						trust_score: 0.82,
						url: 'https://example.com/runa?utm_source=newsletter',
					},
					{
						canonical_url: 'https://docs.example.org/search',
						domain: 'docs.example.org',
						favicon: 'https://docs.example.org/favicon.ico',
						id: 'source_2',
						published_at: null,
						snippet: 'Second canonical source snippet.',
						title: 'Docs source',
						trust_score: 0.71,
						url: 'https://docs.example.org/search',
					},
				],
				truncated: true,
				unreliable: true,
			},
			is_truncated: false,
			query: 'Runa',
			result_count: 3,
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
		const statusBlock = sampleBlocks.find((block) => block.type === 'status');
		const traceBlock = sampleBlocks.find((block) => block.type === 'trace_debug_block');
		const timelineBlock = sampleBlocks.find((block) => block.type === 'run_timeline_block');
		const workspaceBlock = sampleBlocks.find(
			(block) => block.type === 'workspace_inspection_block',
		);

		expect(eventBlock).toBeDefined();
		expect(statusBlock).toBeDefined();
		expect(traceBlock).toBeDefined();
		expect(timelineBlock).toBeDefined();
		expect(workspaceBlock).toBeDefined();

		if (!eventBlock || !statusBlock || !traceBlock || !timelineBlock || !workspaceBlock) {
			throw new Error('Expected developer-only fixture blocks.');
		}

		expect(BlockRenderer({ block: eventBlock })).toEqual(null);
		expect(BlockRenderer({ block: statusBlock })).toEqual(null);
		expect(BlockRenderer({ block: traceBlock })).toEqual(null);
		expect(BlockRenderer({ block: timelineBlock })).toEqual(null);
		expect(BlockRenderer({ block: workspaceBlock })).toEqual(null);
	});

	it('renders code copy affordance and collapsed diff affordance', () => {
		const codeBlock = sampleBlocks.find((block) => block.type === 'code_block');
		const diffBlock = sampleBlocks.find((block) => block.type === 'diff_block');

		if (!codeBlock || !diffBlock) {
			throw new Error('Expected code and diff fixture blocks.');
		}

		expect(renderToStaticMarkup(<BlockRenderer block={codeBlock} />)).toContain('Kopyala');
		expect(renderToStaticMarkup(<BlockRenderer block={diffBlock} />)).toContain('View diff');
	});

	it('localizes web search source panel copy', () => {
		const webSearchBlock = sampleBlocks.find((block) => block.type === 'web_search_result_block');

		if (!webSearchBlock) {
			throw new Error('Expected web search fixture block.');
		}

		const markup = renderToStaticMarkup(<BlockRenderer block={webSearchBlock} />);

		expect(markup).toContain('Web arama sonuçları');
		expect(markup).toContain('3 web sonucu gösteriliyor');
		expect(markup).toContain('2 kaynak kullanıldı');
		expect(markup).toContain('2 arama');
		expect(markup).toContain('3 sonuç');
		expect(markup).toContain('Bazı sonuçlar kısaltıldı');
		expect(markup).toContain('Kaynak güveni sınırlı');
		expect(markup).not.toContain(['Web', 'Search', 'Results'].join(' '));
		expect(markup).not.toContain(['Show', 'ing 1 web results'].join(''));
	});

	it('keeps approval decisions user-facing while preserving technical details', () => {
		const approvalBlock = sampleBlocks.find((block) => block.type === 'approval_block');

		if (!approvalBlock) {
			throw new Error('Expected approval fixture block.');
		}

		const markup = renderToStaticMarkup(
			<BlockRenderer block={approvalBlock} onResolveApproval={() => undefined} />,
		);

		expect(markup).toContain('Runa şunu yapmak istiyor');
		expect(markup).toContain('Dosyaya yazma isteği');
		expect(markup).toContain('Bu onayda net hedef bilgisi gönderilmedi.');
		expect(markup).not.toContain('Ayrıntılar');
		expect(markup).not.toContain('file.write');
		expect(markup).not.toContain('Approval required');
		expect(markup).not.toContain('Approve file write.');

		const developerMarkup = renderToStaticMarkup(
			<BlockRenderer block={approvalBlock} isDeveloperMode onResolveApproval={() => undefined} />,
		);
		expect(developerMarkup).toContain('Ayrıntılar');
		expect(developerMarkup).toContain('Approve file write.');
	});

	it('announces resolved approval state without pending actions', () => {
		const approvalBlock = sampleBlocks.find((block) => block.type === 'approval_block');

		if (!approvalBlock || approvalBlock.type !== 'approval_block') {
			throw new Error('Expected approval fixture block.');
		}

		const approvedBlock: RenderBlock = {
			...approvalBlock,
			payload: {
				...approvalBlock.payload,
				status: 'approved',
			},
		};
		const rejectedBlock: RenderBlock = {
			...approvalBlock,
			payload: {
				...approvalBlock.payload,
				status: 'rejected',
			},
		};

		const approvedMarkup = renderToStaticMarkup(
			<BlockRenderer block={approvedBlock} onResolveApproval={() => undefined} />,
		);
		const rejectedMarkup = renderToStaticMarkup(
			<BlockRenderer block={rejectedBlock} onResolveApproval={() => undefined} />,
		);

		expect(approvedMarkup).toContain('<output');
		expect(approvedMarkup).toContain('aria-live="polite"');
		expect(approvedMarkup).toContain('İzin verildi');
		expect(approvedMarkup).not.toContain('Onayla</button>');
		expect(rejectedMarkup).toContain('<output');
		expect(rejectedMarkup).toContain('aria-live="polite"');
		expect(rejectedMarkup).toContain('Bu adım reddedildi');
		expect(rejectedMarkup).not.toContain('Reddet</button>');
	});

	it('keeps risky approval actions visually calmer than primary product actions', () => {
		const approvalBlock = sampleBlocks.find((block) => block.type === 'approval_block');

		if (!approvalBlock || approvalBlock.type !== 'approval_block') {
			throw new Error('Expected approval fixture block.');
		}

		const riskyMarkup = renderToStaticMarkup(
			<BlockRenderer block={approvalBlock} onResolveApproval={() => undefined} />,
		);
		const readOnlyBlock: RenderBlock = {
			...approvalBlock,
			payload: {
				...approvalBlock.payload,
				tool_name: 'file.read',
			},
		};
		const readOnlyMarkup = renderToStaticMarkup(
			<BlockRenderer block={readOnlyBlock} onResolveApproval={() => undefined} />,
		);

		expect(riskyMarkup).not.toContain('_primary_');
		expect(riskyMarkup).toContain('_secondary_');
		expect(readOnlyMarkup).toContain('_primary_');
	});
});
