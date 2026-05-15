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
			items: [{ kind: 'run_started', label: 'Runa işi başlattı', state: 'active' }],
			summary: 'Runa started the work.',
			title: 'Çalışma akışı',
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
	{
		created_at: createdAt,
		id: 'work-narration:block',
		payload: {
			locale: 'tr',
			run_id: 'run_renderer',
			sequence_no: 7,
			status: 'completed',
			text: 'package.json dosyasını kontrol ediyorum.',
			turn_index: 1,
			linked_tool_call_id: 'call_renderer',
		},
		schema_version: 1,
		type: 'work_narration',
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
		expect(renderToStaticMarkup(<BlockRenderer block={timelineBlock} />)).toContain(
			'Çalışma etkinlikleri',
		);
		expect(BlockRenderer({ block: workspaceBlock })).toEqual(null);
	});

	it('renders tool results as single-line activity outside developer mode', () => {
		const toolBlock = sampleBlocks.find((block) => block.type === 'tool_result');

		if (!toolBlock) {
			throw new Error('Expected tool result fixture block.');
		}

		const markup = renderToStaticMarkup(<BlockRenderer block={toolBlock} />);
		const developerMarkup = renderToStaticMarkup(
			<BlockRenderer block={toolBlock} isDeveloperMode />,
		);

		expect(markup).toContain('data-activity-kind="tool"');
		expect(markup).toContain('Dosya okuma');
		expect(markup).toContain('Dosya okuma tamamlandı.');
		expect(markup).not.toContain('İşlem sonucu');
		expect(markup).not.toContain('Hata kodu:');
		expect(markup).not.toContain('file.read');
		expect(markup).not.toContain('call_renderer');
		expect(markup).not.toContain('Object{ok}');
		expect(developerMarkup).toContain('Ayrıntılar');
	});

	it('keeps terminal details collapsed by default in non-developer mode', () => {
		const toolPayload = {
			call_id: 'call_terminal_hidden',
			command: 'npm run secret-task',
			status: 'success',
			stderr: 'stderr trace',
			stdout: 'stdout trace',
			summary: 'shell.exec completed successfully.',
			tool_name: 'shell.exec',
			user_label_tr: 'Komut çalıştırma',
		} as Extract<RenderBlock, { type: 'tool_result' }>['payload'] & {
			command: string;
			stderr: string;
			stdout: string;
		};

		const toolBlock: RenderBlock = {
			created_at: createdAt,
			id: 'tool:block:terminal',
			payload: toolPayload,
			schema_version: 1,
			type: 'tool_result',
		};

		const markup = renderToStaticMarkup(<BlockRenderer block={toolBlock} />);
		expect(markup).toContain('Ayrıntılar');
		expect(markup).not.toContain('npm run secret-task');
		expect(markup).not.toContain('stdout trace');
		expect(markup).not.toContain('stderr trace');
		expect(markup).not.toContain('call_terminal_hidden');
	});

	it('renders work narration without exposing technical identifiers', () => {
		const narrationBlock = sampleBlocks.find((block) => block.type === 'work_narration');

		if (!narrationBlock || narrationBlock.type !== 'work_narration') {
			throw new Error('Expected work narration fixture block.');
		}

		const markup = renderToStaticMarkup(<BlockRenderer block={narrationBlock} replayMode />);

		expect(markup).toContain('package.json dosyasını kontrol ediyorum.');
		expect(markup).toContain('_replay_');
		expect(markup).not.toContain('run_renderer');
		expect(markup).not.toContain('call_renderer');
		expect(markup).not.toContain('work-narration:block');

		const supersededMarkup = renderToStaticMarkup(
			<BlockRenderer
				block={{
					...narrationBlock,
					payload: { ...narrationBlock.payload, status: 'superseded' },
				}}
			/>,
		);

		expect(supersededMarkup).toBe('');
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
		expect(markup).toContain('Kaynaklar');
		expect(markup).toContain('2 arama');
		expect(markup).toContain('3 sonuç');
		expect(markup).toContain('Bazı sonuçlar kısaltıldı');
		expect(markup).toContain('Kaynak güveni sınırlı');
		expect(markup).not.toContain(['Web', 'Search', 'Results'].join(' '));
		expect(markup).not.toContain(['Show', 'ing 1 web results'].join(''));
	});

	it('keeps timeline tool labels user-facing', () => {
		const timelineBlock: RenderBlock = {
			created_at: createdAt,
			id: 'timeline:file-write',
			payload: {
				items: [
					{
						call_id: 'call_file_write',
						detail: 'file.write completed successfully.',
						kind: 'tool_completed',
						label: 'Dosya güncellendi',
						state: 'success',
						tool_name: 'file.write',
					},
				],
				summary: 'Runa dosya yazma onayı aldı.',
				title: 'Çalışma akışı',
			},
			schema_version: 1,
			type: 'run_timeline_block',
		};

		const markup = renderToStaticMarkup(<BlockRenderer block={timelineBlock} isDeveloperMode />);

		expect(markup).toContain('Dosya yazma');
		expect(markup).not.toContain('file.write');
	});

	it('keeps approval decisions user-facing while preserving technical details', () => {
		const approvalBlock = sampleBlocks.find((block) => block.type === 'approval_block');

		if (!approvalBlock) {
			throw new Error('Expected approval fixture block.');
		}

		const markup = renderToStaticMarkup(
			<BlockRenderer block={approvalBlock} onResolveApproval={() => undefined} />,
		);

		expect(markup).toContain('İzin gerekiyor');
		expect(markup).toContain('Dosyaya yazma izni gerekiyor.');
		expect(markup).toContain('Dosya yazma');
		expect(markup).toContain('Onayla');
		expect(markup).toContain('Reddet');
		expect(markup).not.toContain('file.write');
		expect(markup).not.toContain('Approval required');
		expect(markup).not.toContain('Approve file write.');

		const developerMarkup = renderToStaticMarkup(
			<BlockRenderer block={approvalBlock} isDeveloperMode onResolveApproval={() => undefined} />,
		);
		expect(developerMarkup).toContain('Ayrıntılar');
	});

	it('keeps desktop approval targets user-facing in normal mode', () => {
		const approvalBlock = sampleBlocks.find((block) => block.type === 'approval_block');

		if (!approvalBlock || approvalBlock.type !== 'approval_block') {
			throw new Error('Expected approval fixture block.');
		}

		const clipboardReadBlock: RenderBlock = {
			...approvalBlock,
			payload: {
				...approvalBlock.payload,
				approval_id: 'approval_desktop_clipboard_read',
				summary: 'Allow desktop.clipboard.read.',
				target_kind: 'tool_call',
				target_label: 'desktop.clipboard.read',
				title: 'Allow desktop.clipboard.read?',
				tool_name: 'desktop.clipboard.read',
			},
		};

		const markup = renderToStaticMarkup(
			<BlockRenderer block={clipboardReadBlock} onResolveApproval={() => undefined} />,
		);

		expect(markup).toContain('Pano okuma izni gerekiyor.');
		expect(markup).toContain('Pano okuma');
		expect(markup).not.toContain('desktop.clipboard.read');
		expect(markup).not.toContain('Allow desktop.clipboard.read');
	});

	it('infers desktop approval copy from the target when tool name is omitted', () => {
		const approvalBlock = sampleBlocks.find((block) => block.type === 'approval_block');

		if (!approvalBlock || approvalBlock.type !== 'approval_block') {
			throw new Error('Expected approval fixture block.');
		}

		const keypressBlock: RenderBlock = {
			...approvalBlock,
			payload: {
				...approvalBlock.payload,
				approval_id: 'approval_desktop_keypress',
				target_kind: 'tool_call',
				target_label: 'desktop.keypress',
				title: 'Araç çalıştırma isteği',
				tool_name: undefined,
			},
		};

		const markup = renderToStaticMarkup(
			<BlockRenderer block={keypressBlock} onResolveApproval={() => undefined} />,
		);

		expect(markup).toContain('Masaüstü kısayolu çalıştırma izni gerekiyor.');
		expect(markup).toContain('Klavye kısayolu');
		expect(markup).not.toContain('desktop.keypress');
	});

	it('does not offer actions for historical pending approval cards', () => {
		const approvalBlock = sampleBlocks.find((block) => block.type === 'approval_block');

		if (!approvalBlock) {
			throw new Error('Expected approval fixture block.');
		}

		const markup = renderToStaticMarkup(<BlockRenderer block={approvalBlock} />);

		expect(markup).not.toContain('Onayla</button>');
		expect(markup).not.toContain('Reddet</button>');
		expect(markup).toContain('İzin gerekiyor');
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

		expect(approvedMarkup).toContain('İzin verildi');
		expect(approvedMarkup).not.toContain('Onayla</button>');
		expect(rejectedMarkup).toContain('Reddedildi');
		expect(rejectedMarkup).not.toContain('Reddet</button>');
	});

	it('uses danger variant only for high-risk approval confirms', () => {
		const approvalBlock = sampleBlocks.find((block) => block.type === 'approval_block');

		if (!approvalBlock || approvalBlock.type !== 'approval_block') {
			throw new Error('Expected approval fixture block.');
		}

		const mediumRiskMarkup = renderToStaticMarkup(
			<BlockRenderer block={approvalBlock} onResolveApproval={() => undefined} />,
		);
		const highRiskBlock: RenderBlock = {
			...approvalBlock,
			payload: {
				...approvalBlock.payload,
				tool_name: 'shell.exec',
			},
		};
		const highRiskMarkup = renderToStaticMarkup(
			<BlockRenderer block={highRiskBlock} onResolveApproval={() => undefined} />,
		);

		expect(mediumRiskMarkup).toContain('_primary_');
		expect(mediumRiskMarkup).not.toContain('Yine de devam et');
		expect(highRiskMarkup).toContain('_danger_');
		expect(highRiskMarkup).toContain('Yine de devam et');
	});
});
