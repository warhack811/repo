import type { EvidencePack, ToolName, ToolResult, WebSearchResultBlock } from '@runa/types';

import type { IngestedToolResult } from '../runtime/ingest-tool-result.js';

const WEB_SEARCH_RESULT_BLOCK_TITLE = 'Web Search Results';
const WEB_SEARCH_VISIBLE_RESULT_LIMIT = 5;

interface WebSearchResultItem {
	readonly authority_note?: string;
	readonly canonical_url?: string;
	readonly domain?: string;
	readonly favicon?: string;
	readonly freshness_hint?: string;
	readonly published_at?: string | null;
	readonly snippet: string;
	readonly source: string;
	readonly title: string;
	readonly trust_score?: number;
	readonly trust_tier: 'general' | 'official' | 'reputable' | 'vendor';
	readonly url: string;
}

interface MapWebSearchResultInput {
	readonly authority_note?: string;
	readonly call_id?: string;
	readonly created_at: string;
	readonly evidence?: EvidencePack;
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
	readonly evidence?: EvidencePack;
	readonly freshness_note?: string;
	readonly is_truncated: boolean;
	readonly result_count?: number;
	readonly results: readonly WebSearchResultItem[];
	readonly search_provider: string;
	readonly searches?: number;
	readonly sources?: EvidencePack['sources'];
	readonly truncated?: boolean;
	readonly unreliable?: boolean;
}

interface WebSearchResultItemCandidate {
	readonly authority_note?: unknown;
	readonly canonical_url?: unknown;
	readonly domain?: unknown;
	readonly favicon?: unknown;
	readonly freshness_hint?: unknown;
	readonly published_at?: unknown;
	readonly snippet?: unknown;
	readonly source?: unknown;
	readonly title?: unknown;
	readonly trust_score?: unknown;
	readonly trust_tier?: unknown;
	readonly url?: unknown;
}

interface WebSearchLikeResultCandidate {
	readonly authority_note?: unknown;
	readonly evidence?: unknown;
	readonly freshness_note?: unknown;
	readonly is_truncated?: unknown;
	readonly result_count?: unknown;
	readonly results?: unknown;
	readonly search_provider?: unknown;
	readonly searches?: unknown;
	readonly sources?: unknown;
	readonly truncated?: unknown;
	readonly unreliable?: unknown;
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
		(candidate.canonical_url === undefined || typeof candidate.canonical_url === 'string') &&
		(candidate.domain === undefined || typeof candidate.domain === 'string') &&
		(candidate.favicon === undefined || typeof candidate.favicon === 'string') &&
		(candidate.freshness_hint === undefined || typeof candidate.freshness_hint === 'string') &&
		(candidate.published_at === undefined ||
			candidate.published_at === null ||
			typeof candidate.published_at === 'string') &&
		(candidate.trust_score === undefined || typeof candidate.trust_score === 'number') &&
		(candidate.trust_tier === 'official' ||
			candidate.trust_tier === 'vendor' ||
			candidate.trust_tier === 'reputable' ||
			candidate.trust_tier === 'general')
	);
}

function isEvidenceSource(value: unknown): value is EvidencePack['sources'][number] {
	if (!isRecord(value)) {
		return false;
	}

	return (
		typeof value['id'] === 'string' &&
		typeof value['url'] === 'string' &&
		typeof value['canonical_url'] === 'string' &&
		typeof value['title'] === 'string' &&
		typeof value['domain'] === 'string' &&
		typeof value['favicon'] === 'string' &&
		(value['published_at'] === null || typeof value['published_at'] === 'string') &&
		typeof value['snippet'] === 'string' &&
		typeof value['trust_score'] === 'number'
	);
}

function isEvidencePack(value: unknown): value is EvidencePack {
	if (!isRecord(value)) {
		return false;
	}

	return (
		typeof value['query'] === 'string' &&
		typeof value['searches'] === 'number' &&
		typeof value['results'] === 'number' &&
		typeof value['truncated'] === 'boolean' &&
		Array.isArray(value['sources']) &&
		value['sources'].every((source) => isEvidenceSource(source)) &&
		(value['unreliable'] === undefined || typeof value['unreliable'] === 'boolean')
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
		(candidate.evidence === undefined || isEvidencePack(candidate.evidence)) &&
		(candidate.freshness_note === undefined || typeof candidate.freshness_note === 'string') &&
		(candidate.result_count === undefined || typeof candidate.result_count === 'number') &&
		(candidate.searches === undefined || typeof candidate.searches === 'number') &&
		(candidate.sources === undefined ||
			(Array.isArray(candidate.sources) &&
				candidate.sources.every((source) => isEvidenceSource(source)))) &&
		(candidate.truncated === undefined || typeof candidate.truncated === 'boolean') &&
		(candidate.unreliable === undefined || typeof candidate.unreliable === 'boolean')
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
			evidence: input.evidence,
			freshness_note: input.freshness_note,
			is_truncated: isTruncated,
			query: input.query,
			result_count: input.evidence?.results ?? visibleResults.length,
			results: visibleResults,
			search_provider: input.search_provider,
			searches: input.evidence?.searches ?? 1,
			sources: input.evidence?.sources,
			summary,
			title: WEB_SEARCH_RESULT_BLOCK_TITLE,
			truncated: input.evidence?.truncated ?? isTruncated,
			unreliable: input.evidence?.unreliable,
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
		evidence: input.result.output.evidence,
		freshness_note: input.result.output.freshness_note,
		is_truncated: input.result.output.is_truncated,
		query,
		results: input.result.output.results,
		search_provider: input.result.output.search_provider,
	});
}
