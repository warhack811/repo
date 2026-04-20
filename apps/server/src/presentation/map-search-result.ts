import type { SearchResultBlock, ToolName, ToolResult } from '@runa/types';

import type { IngestedToolResult } from '../runtime/ingest-tool-result.js';

const SEARCH_RESULT_BLOCK_TITLE = 'Codebase Search Results';
const SEARCH_RESULT_VISIBLE_MATCH_LIMIT = 10;

interface MapSearchResultInput {
	readonly call_id?: string;
	readonly created_at: string;
	readonly is_truncated: boolean;
	readonly matches: readonly SearchResultMatch[];
	readonly query: string;
	readonly searched_root: string;
	readonly total_matches?: number;
}

interface MapToolResultToSearchResultBlockInput {
	readonly call_id: string;
	readonly created_at: string;
	readonly result: IngestedToolResult | ToolResult;
	readonly tool_arguments?: unknown;
	readonly tool_name: ToolName;
}

interface SearchResultMatch {
	readonly line_number: number;
	readonly line_text: string;
	readonly path: string;
}

interface SearchCodebaseLikeResult {
	readonly is_truncated: boolean;
	readonly matches: readonly SearchResultMatch[];
	readonly searched_root: string;
	readonly total_matches?: number;
}

interface SearchResultMatchCandidate {
	readonly line_number?: unknown;
	readonly line_text?: unknown;
	readonly path?: unknown;
}

interface SearchCodebaseLikeResultCandidate {
	readonly is_truncated?: unknown;
	readonly matches?: unknown;
	readonly searched_root?: unknown;
	readonly total_matches?: unknown;
}

interface SearchToolArgumentsCandidate {
	readonly query?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSuccessResult(
	result: IngestedToolResult | ToolResult,
): result is
	| Extract<IngestedToolResult, { result_status: 'success' }>
	| Extract<ToolResult<'search.codebase'>, { status: 'success' }> {
	return (
		('status' in result && result.status === 'success') ||
		('result_status' in result && result.result_status === 'success')
	);
}

function isSearchResultMatch(value: unknown): value is SearchResultMatch {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as SearchResultMatchCandidate;

	return (
		typeof candidate.path === 'string' &&
		typeof candidate.line_text === 'string' &&
		typeof candidate.line_number === 'number' &&
		Number.isInteger(candidate.line_number) &&
		candidate.line_number > 0
	);
}

function isSearchCodebaseLikeResult(value: unknown): value is SearchCodebaseLikeResult {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as SearchCodebaseLikeResultCandidate;

	return (
		typeof candidate.searched_root === 'string' &&
		typeof candidate.is_truncated === 'boolean' &&
		Array.isArray(candidate.matches) &&
		candidate.matches.every((match) => isSearchResultMatch(match)) &&
		(candidate.total_matches === undefined || Number.isInteger(candidate.total_matches))
	);
}

function normalizeQuery(value: string): string | undefined {
	const trimmedValue = value.trim();

	return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function extractSearchQuery(toolArguments: unknown): string | undefined {
	if (!isRecord(toolArguments)) {
		return undefined;
	}

	const candidate = toolArguments as SearchToolArgumentsCandidate;

	return typeof candidate.query === 'string' ? normalizeQuery(candidate.query) : undefined;
}

function formatMatchCount(count: number): string {
	return count === 1 ? '1 codebase match' : `${count} codebase matches`;
}

function buildSearchSummary(input: {
	readonly is_truncated: boolean;
	readonly query: string;
	readonly returned_match_count: number;
	readonly total_matches?: number;
}): string {
	const totalMatches = input.total_matches;

	if (totalMatches !== undefined) {
		if (totalMatches === 0) {
			return `Found 0 codebase matches for "${input.query}".`;
		}

		if (input.is_truncated && totalMatches > input.returned_match_count) {
			return `Found ${formatMatchCount(totalMatches)} for "${input.query}"; showing ${input.returned_match_count}.`;
		}

		return `Found ${formatMatchCount(totalMatches)} for "${input.query}".`;
	}

	if (input.is_truncated) {
		return `Showing ${formatMatchCount(input.returned_match_count)} for "${input.query}"; search was truncated.`;
	}

	return `Found ${formatMatchCount(input.returned_match_count)} for "${input.query}".`;
}

export function mapSearchResultToBlock(input: MapSearchResultInput): SearchResultBlock {
	const visibleMatches = input.matches.slice(0, SEARCH_RESULT_VISIBLE_MATCH_LIMIT);
	const isTruncated = input.is_truncated || visibleMatches.length < input.matches.length;
	const summary = buildSearchSummary({
		is_truncated: isTruncated,
		query: input.query,
		returned_match_count: visibleMatches.length,
		total_matches: input.total_matches,
	});
	const idSuffix = input.call_id ?? input.created_at;

	return {
		created_at: input.created_at,
		id: `search_result_block:${idSuffix}`,
		payload: {
			is_truncated: isTruncated,
			matches: visibleMatches,
			query: input.query,
			searched_root: input.searched_root,
			summary,
			title: SEARCH_RESULT_BLOCK_TITLE,
			total_matches: input.total_matches,
		},
		schema_version: 1,
		type: 'search_result_block',
	};
}

export function mapToolResultToSearchResultBlock(
	input: MapToolResultToSearchResultBlockInput,
): SearchResultBlock | undefined {
	if (input.tool_name !== 'search.codebase' || !isSuccessResult(input.result)) {
		return undefined;
	}

	if (!isSearchCodebaseLikeResult(input.result.output)) {
		return undefined;
	}

	const query = extractSearchQuery(input.tool_arguments);

	if (!query) {
		return undefined;
	}

	return mapSearchResultToBlock({
		call_id: input.call_id,
		created_at: input.created_at,
		is_truncated: input.result.output.is_truncated,
		matches: input.result.output.matches,
		query,
		searched_root: input.result.output.searched_root,
		total_matches: input.result.output.total_matches,
	});
}
