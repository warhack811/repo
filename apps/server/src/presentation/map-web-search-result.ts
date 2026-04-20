import type { ToolName, ToolResult, WebSearchResultBlock } from '@runa/types';

import type { IngestedToolResult } from '../runtime/ingest-tool-result.js';

const WEB_SEARCH_RESULT_BLOCK_TITLE = 'Web Search Results';
const WEB_SEARCH_VISIBLE_RESULT_LIMIT = 5;

interface WebSearchResultItem {
	readonly authority_note?: string;
	readonly freshness_hint?: string;
	readonly snippet: string;
	readonly source: string;
	readonly title: string;
	readonly trust_tier: 'general' | 'official' | 'reputable' | 'vendor';
	readonly url: string;
}

interface MapWebSearchResultInput {
	readonly authority_note?: string;
	readonly call_id?: string;
	readonly created_at: string;
	readonly freshness_note?: string;
	readonly is_truncated: boolean;
	readonly query: string;
	readonly results: readonly WebSearchResultItem[];
	readonly search_provider: string;
}

interface MapToolResultToWebSearchResultBlockInput {
	readonly call_id: string;
	readonly created_at: string;
	readonly result: IngestedToolResult | ToolResult;
	readonly tool_arguments?: unknown;
	readonly tool_name: ToolName;
}

interface WebSearchLikeResult {
	readonly authority_note?: string;
	readonly freshness_note?: string;
	readonly is_truncated: boolean;
	readonly results: readonly WebSearchResultItem[];
	readonly search_provider: string;
}

interface WebSearchResultItemCandidate {
	readonly authority_note?: unknown;
	readonly freshness_hint?: unknown;
	readonly snippet?: unknown;
	readonly source?: unknown;
	readonly title?: unknown;
	readonly trust_tier?: unknown;
	readonly url?: unknown;
}

interface WebSearchLikeResultCandidate {
	readonly authority_note?: unknown;
	readonly freshness_note?: unknown;
	readonly is_truncated?: unknown;
	readonly results?: unknown;
	readonly search_provider?: unknown;
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
	| Extract<ToolResult<'web.search'>, { status: 'success' }> {
	return (
		('status' in result && result.status === 'success') ||
		('result_status' in result && result.result_status === 'success')
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

function isWebSearchResultItem(value: unknown): value is WebSearchResultItem {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as WebSearchResultItemCandidate;

	return (
		typeof candidate.title === 'string' &&
		typeof candidate.url === 'string' &&
		typeof candidate.source === 'string' &&
		typeof candidate.snippet === 'string' &&
		(candidate.authority_note === undefined || typeof candidate.authority_note === 'string') &&
		(candidate.freshness_hint === undefined || typeof candidate.freshness_hint === 'string') &&
		(candidate.trust_tier === 'official' ||
			candidate.trust_tier === 'vendor' ||
			candidate.trust_tier === 'reputable' ||
			candidate.trust_tier === 'general')
	);
}

function isWebSearchLikeResult(value: unknown): value is WebSearchLikeResult {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as WebSearchLikeResultCandidate;

	return (
		typeof candidate.search_provider === 'string' &&
		typeof candidate.is_truncated === 'boolean' &&
		Array.isArray(candidate.results) &&
		candidate.results.every((result) => isWebSearchResultItem(result)) &&
		(candidate.authority_note === undefined || typeof candidate.authority_note === 'string') &&
		(candidate.freshness_note === undefined || typeof candidate.freshness_note === 'string')
	);
}

function createSummary(input: {
	readonly is_truncated: boolean;
	readonly query: string;
	readonly result_count: number;
}): string {
	const resultLabel =
		input.result_count === 1 ? '1 web result' : `${input.result_count} web results`;

	if (input.result_count === 0) {
		return `No authority-ranked web results were kept for "${input.query}".`;
	}

	if (input.is_truncated) {
		return `Showing ${resultLabel} for "${input.query}" from prioritized public sources.`;
	}

	return `Found ${resultLabel} for "${input.query}" from prioritized public sources.`;
}

export function mapWebSearchResultToBlock(input: MapWebSearchResultInput): WebSearchResultBlock {
	const visibleResults = input.results.slice(0, WEB_SEARCH_VISIBLE_RESULT_LIMIT);
	const isTruncated = input.is_truncated || visibleResults.length < input.results.length;
	const summary = createSummary({
		is_truncated: isTruncated,
		query: input.query,
		result_count: visibleResults.length,
	});
	const idSuffix = input.call_id ?? input.created_at;

	return {
		created_at: input.created_at,
		id: `web_search_result_block:${idSuffix}`,
		payload: {
			authority_note: input.authority_note,
			freshness_note: input.freshness_note,
			is_truncated: isTruncated,
			query: input.query,
			results: visibleResults,
			search_provider: input.search_provider,
			summary,
			title: WEB_SEARCH_RESULT_BLOCK_TITLE,
		},
		schema_version: 1,
		type: 'web_search_result_block',
	};
}

export function mapToolResultToWebSearchResultBlock(
	input: MapToolResultToWebSearchResultBlockInput,
): WebSearchResultBlock | undefined {
	if (input.tool_name !== 'web.search' || !isSuccessResult(input.result)) {
		return undefined;
	}

	if (!isWebSearchLikeResult(input.result.output)) {
		return undefined;
	}

	const query = extractSearchQuery(input.tool_arguments);

	if (!query) {
		return undefined;
	}

	return mapWebSearchResultToBlock({
		authority_note: input.result.output.authority_note,
		call_id: input.call_id,
		created_at: input.created_at,
		freshness_note: input.result.output.freshness_note,
		is_truncated: input.result.output.is_truncated,
		query,
		results: input.result.output.results,
		search_provider: input.result.output.search_provider,
	});
}
