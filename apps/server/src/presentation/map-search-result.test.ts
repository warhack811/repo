import type { ToolResult } from '@runa/types';
import { describe, expect, it } from 'vitest';

import type { IngestedToolResult } from '../runtime/ingest-tool-result.js';
import { mapSearchResultToBlock, mapToolResultToSearchResultBlock } from './map-search-result.js';

const createdAt = '2026-04-11T12:00:00.000Z';

function createMatch(index: number) {
	return {
		line_number: index,
		line_text: `const needle_${index} = true;`,
		path: `src/file-${index}.ts`,
	};
}

describe('map-search-result', () => {
	it('maps a search.codebase success result into a search_result_block', () => {
		const result: ToolResult<
			'search.codebase',
			{
				is_truncated: boolean;
				matches: readonly ReturnType<typeof createMatch>[];
				searched_root: string;
				total_matches: number;
			}
		> = {
			call_id: 'call_search_result_success',
			output: {
				is_truncated: false,
				matches: [createMatch(1)],
				searched_root: 'd:\\ai\\Runa',
				total_matches: 1,
			},
			status: 'success',
			tool_name: 'search.codebase',
		};

		const block = mapToolResultToSearchResultBlock({
			call_id: 'call_search_result_success',
			created_at: createdAt,
			result,
			tool_arguments: {
				query: 'needle',
			},
			tool_name: 'search.codebase',
		});

		expect(block).toEqual({
			created_at: createdAt,
			id: 'search_result_block:call_search_result_success',
			payload: {
				is_truncated: false,
				matches: [createMatch(1)],
				query: 'needle',
				searched_root: 'd:\\ai\\Runa',
				summary: 'Found 1 codebase match for "needle".',
				title: 'Codebase Search Results',
				total_matches: 1,
			},
			schema_version: 1,
			type: 'search_result_block',
		});
	});

	it('limits visible matches while preserving truncation metadata deterministically', () => {
		const matches = Array.from({ length: 12 }, (_, index) => createMatch(index + 1));

		const block = mapSearchResultToBlock({
			call_id: 'call_search_result_truncated',
			created_at: createdAt,
			is_truncated: false,
			matches,
			query: 'needle',
			searched_root: 'd:\\ai\\Runa',
			total_matches: 12,
		});

		expect(block.payload).toMatchObject({
			is_truncated: true,
			query: 'needle',
			searched_root: 'd:\\ai\\Runa',
			summary: 'Found 12 codebase matches for "needle"; showing 10.',
			title: 'Codebase Search Results',
			total_matches: 12,
		});
		expect(block.payload.matches).toHaveLength(10);
		expect(block.payload.matches[0]).toEqual(createMatch(1));
		expect(block.payload.matches[9]).toEqual(createMatch(10));
	});

	it('keeps truncated summary deterministic when the exact total is unavailable', () => {
		const result: IngestedToolResult = {
			call_id: 'call_search_result_ingested',
			kind: 'tool_result',
			output: {
				is_truncated: true,
				matches: [createMatch(1), createMatch(2)],
				searched_root: 'd:\\ai\\Runa\\src',
			},
			result_status: 'success',
			tool_name: 'search.codebase',
		};

		const block = mapToolResultToSearchResultBlock({
			call_id: 'call_search_result_ingested',
			created_at: createdAt,
			result,
			tool_arguments: {
				query: '  needle  ',
			},
			tool_name: 'search.codebase',
		});

		expect(block?.payload).toMatchObject({
			is_truncated: true,
			matches: [createMatch(1), createMatch(2)],
			query: 'needle',
			searched_root: 'd:\\ai\\Runa\\src',
			summary: 'Showing 2 codebase matches for "needle"; search was truncated.',
			title: 'Codebase Search Results',
			total_matches: undefined,
		});
	});

	it('returns undefined when the query is missing from tool arguments', () => {
		const result: ToolResult<
			'search.codebase',
			{
				is_truncated: boolean;
				matches: readonly ReturnType<typeof createMatch>[];
				searched_root: string;
			}
		> = {
			call_id: 'call_search_result_missing_query',
			output: {
				is_truncated: false,
				matches: [createMatch(1)],
				searched_root: 'd:\\ai\\Runa',
			},
			status: 'success',
			tool_name: 'search.codebase',
		};

		expect(
			mapToolResultToSearchResultBlock({
				call_id: 'call_search_result_missing_query',
				created_at: createdAt,
				result,
				tool_name: 'search.codebase',
			}),
		).toBeUndefined();
	});
});
