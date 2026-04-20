import type { RenderBlock, SearchResultBlock, WebSearchResultBlock } from '@runa/types';
import { describe, expect, it } from 'vitest';

import { hardenSearchRoutingPresentationBlocks } from './harden-search-routing-notes.js';

const createdAt = '2026-04-12T12:00:00.000Z';

function createSearchResultBlock(query = 'auth middleware'): SearchResultBlock {
	return {
		created_at: createdAt,
		id: `search_result_block:${query}`,
		payload: {
			is_truncated: false,
			matches: [
				{
					line_number: 12,
					line_text: 'export const middleware = true;',
					path: 'src/auth/middleware.ts',
				},
			],
			query,
			searched_root: 'd:\\ai\\Runa',
			summary: `Found 1 codebase match for "${query}".`,
			title: 'Codebase Search Results',
			total_matches: 1,
		},
		schema_version: 1,
		type: 'search_result_block',
	};
}

function createWebSearchResultBlock(
	query = 'latest auth middleware docs',
	options?: {
		readonly freshness_note?: string;
	},
): WebSearchResultBlock {
	return {
		created_at: createdAt,
		id: `web_search_result_block:${query}`,
		payload: {
			authority_note: 'Authority-first ordering keeps low-trust results out.',
			freshness_note: options?.freshness_note,
			is_truncated: false,
			query,
			results: [
				{
					authority_note: 'Docs-like or official project source.',
					snippet: 'Official docs.',
					source: 'docs.example.com',
					title: 'Auth Middleware Docs',
					trust_tier: 'official',
					url: 'https://docs.example.com/auth',
				},
			],
			search_provider: 'serper',
			summary: `Found 1 web result for "${query}" from prioritized public sources.`,
			title: 'Web Search Results',
		},
		schema_version: 1,
		type: 'web_search_result_block',
	};
}

describe('harden-search-routing-notes', () => {
	it('adds source-priority and freshness conflict notes when local and public search overlap', () => {
		const blocks: readonly RenderBlock[] = [
			createSearchResultBlock(),
			createWebSearchResultBlock('latest auth middleware docs', {
				freshness_note:
					'Freshness was requested; snippets and provider dates may still lag the live page.',
			}),
		];

		const hardenedBlocks = hardenSearchRoutingPresentationBlocks(blocks);
		const localBlock = hardenedBlocks[0];
		const webBlock = hardenedBlocks[1];

		expect(localBlock).toMatchObject({
			payload: {
				conflict_note:
					'Local and public sources were both consulted. Prefer workspace-local truth for implementation details; public results may be newer for latest or release details.',
				source_priority_note:
					'Prefer workspace-local results for repo code, config, and implementation truth.',
			},
			type: 'search_result_block',
		});
		expect(webBlock).toMatchObject({
			payload: {
				conflict_note:
					'Local and public sources were both consulted. Prefer workspace-local truth for implementation details; public results may be newer for latest or release details.',
				source_priority_note:
					'Public web results complement local truth for external docs, releases, vendor details, and latest verification.',
			},
			type: 'web_search_result_block',
		});
	});

	it('keeps the conflict note empty when local and public queries do not overlap', () => {
		const blocks: readonly RenderBlock[] = [
			createSearchResultBlock('auth middleware'),
			createWebSearchResultBlock('vite docs homepage'),
		];

		const hardenedBlocks = hardenSearchRoutingPresentationBlocks(blocks);

		expect(hardenedBlocks[0]).toMatchObject({
			payload: {
				source_priority_note:
					'Prefer workspace-local results for repo code, config, and implementation truth.',
			},
			type: 'search_result_block',
		});
		if (hardenedBlocks[0]?.type !== 'search_result_block') {
			throw new Error('Expected a local search block.');
		}
		expect(hardenedBlocks[0].payload.conflict_note).toBeUndefined();
		expect(hardenedBlocks[1]).toMatchObject({
			payload: {
				source_priority_note:
					'Public web results complement local truth for external docs, releases, vendor details, and latest verification.',
			},
			type: 'web_search_result_block',
		});
		if (hardenedBlocks[1]?.type !== 'web_search_result_block') {
			throw new Error('Expected a web search block.');
		}
		expect(hardenedBlocks[1].payload.conflict_note).toBeUndefined();
	});
});
