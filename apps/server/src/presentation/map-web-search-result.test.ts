import type { ToolResult } from '@runa/types';
import { describe, expect, it } from 'vitest';

import {
	mapToolResultToWebSearchResultBlock,
	mapWebSearchResultToBlock,
} from './map-web-search-result.js';

const createdAt = '2026-04-12T10:00:00.000Z';

function createResult(index: number) {
	return {
		authority_note: index === 1 ? 'Docs-like or official project source.' : undefined,
		freshness_hint: index === 1 ? 'Provider date: 1 day ago' : undefined,
		snippet: `Snippet ${index}`,
		source: `docs-${index}.example.com`,
		title: `Result ${index}`,
		trust_tier: 'official' as const,
		url: `https://docs-${index}.example.com/${index}`,
	};
}

describe('map-web-search-result', () => {
	it('maps a web.search success result into a web_search_result_block', () => {
		const result: ToolResult<
			'web.search',
			{
				authority_note: string;
				freshness_note: string;
				is_truncated: boolean;
				results: readonly ReturnType<typeof createResult>[];
				search_provider: 'serper';
			}
		> = {
			call_id: 'call_web_search_success',
			output: {
				authority_note:
					'Authority-first ordering prioritizes docs-like and vendor sources; lower-trust general web results are filtered out.',
				freshness_note:
					'Freshness was requested; snippets and provider dates may still lag the live page.',
				is_truncated: false,
				results: [createResult(1)],
				search_provider: 'serper',
			},
			status: 'success',
			tool_name: 'web.search',
		};

		const block = mapToolResultToWebSearchResultBlock({
			call_id: 'call_web_search_success',
			created_at: createdAt,
			result,
			tool_arguments: {
				query: 'latest runa release',
			},
			tool_name: 'web.search',
		});

		expect(block).toMatchObject({
			created_at: createdAt,
			id: 'web_search_result_block:call_web_search_success',
			payload: {
				authority_note:
					'Authority-first ordering prioritizes docs-like and vendor sources; lower-trust general web results are filtered out.',
				freshness_note:
					'Freshness was requested; snippets and provider dates may still lag the live page.',
				is_truncated: false,
				query: 'latest runa release',
				result_count: 1,
				results: [createResult(1)],
				search_provider: 'serper',
				searches: 1,
				summary: 'Found 1 web result for "latest runa release" from prioritized public sources.',
				title: 'Web Search Results',
				truncated: false,
			},
			schema_version: 1,
			type: 'web_search_result_block',
		});
	});

	it('limits visible results while preserving deterministic truncation', () => {
		const results = Array.from({ length: 7 }, (_, index) => createResult(index + 1));

		const block = mapWebSearchResultToBlock({
			authority_note: 'Authority-first ordering keeps low-trust results out.',
			call_id: 'call_web_search_truncated',
			created_at: createdAt,
			is_truncated: false,
			query: 'runa docs',
			results,
			search_provider: 'serper',
		});

		expect(block.payload).toMatchObject({
			authority_note: 'Authority-first ordering keeps low-trust results out.',
			freshness_note: undefined,
			is_truncated: true,
			query: 'runa docs',
			result_count: 5,
			search_provider: 'serper',
			searches: 1,
			summary: 'Showing 5 web results for "runa docs" from prioritized public sources.',
			title: 'Web Search Results',
			truncated: true,
		});
		expect(block.payload.results).toHaveLength(5);
		expect(block.payload.results[0]).toEqual(createResult(1));
		expect(block.payload.results[4]).toEqual(createResult(5));
	});

	it('returns undefined when the query is missing from tool arguments', () => {
		const result: ToolResult<
			'web.search',
			{
				is_truncated: boolean;
				results: readonly ReturnType<typeof createResult>[];
				search_provider: 'serper';
			}
		> = {
			call_id: 'call_web_search_missing_query',
			output: {
				is_truncated: false,
				results: [createResult(1)],
				search_provider: 'serper',
			},
			status: 'success',
			tool_name: 'web.search',
		};

		expect(
			mapToolResultToWebSearchResultBlock({
				call_id: 'call_web_search_missing_query',
				created_at: createdAt,
				result,
				tool_name: 'web.search',
			}),
		).toBeUndefined();
	});
});
