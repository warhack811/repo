import type {
	EvidencePack,
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
	WebSearchTrustTier,
} from '@runa/types';

import { compileEvidence } from '../evidence/compile.js';
import { toTrustTier } from '../evidence/trust-score.js';
import { classifySearchIntent } from '../search/intent.js';
import type { SearchIntent, SearchProviderEnvironment } from '../search/provider.js';
import { getDefaultProvider } from '../search/registry.js';
import { getTransportErrorCode } from '../transport/error-codes.js';

const DEFAULT_MAX_RESULTS = 8;
const MAX_MAX_RESULTS = 8;
const MAX_QUERY_LENGTH = 160;
const LOCALE_PATTERN = /^[a-z]{2}(?:-[a-z]{2})?$/iu;

export type WebSearchProvider = 'serper';

export type WebSearchArguments = ToolArguments & {
	readonly freshness_required?: boolean;
	readonly locale?: string;
	readonly max_results?: number;
	readonly query: string;
	readonly search_type?: string;
};

export interface WebSearchResultItem {
	readonly authority_note?: string;
	readonly canonical_url: string;
	readonly domain: string;
	readonly favicon: string;
	readonly freshness_hint?: string;
	readonly published_at: string | null;
	readonly snippet: string;
	readonly source: string;
	readonly title: string;
	readonly trust_score: number;
	readonly trust_tier: WebSearchTrustTier;
	readonly url: string;
}

export interface WebSearchSuccessData {
	readonly authority_note?: string;
	readonly evidence: EvidencePack;
	readonly freshness_note?: string;
	readonly is_truncated: boolean;
	readonly model_context: string;
	readonly result_count: number;
	readonly results: readonly WebSearchResultItem[];
	readonly search_provider: WebSearchProvider;
	readonly searches: number;
	readonly sources: EvidencePack['sources'];
	readonly truncated: boolean;
	readonly unreliable?: boolean;
}

export type WebSearchInput = ToolCallInput<'web.search', WebSearchArguments>;

export type WebSearchSuccessResult = ToolResultSuccess<'web.search', WebSearchSuccessData>;

export type WebSearchErrorResult = ToolResultError<'web.search'>;

export type WebSearchResult = ToolResult<'web.search', WebSearchSuccessData>;

interface WebSearchDependencies {
	readonly environment: SearchProviderEnvironment;
	readonly fetch: typeof fetch;
}

interface SearchSettings {
	readonly freshness: 'month' | null;
	readonly intent: SearchIntent;
	readonly locale?: string;
	readonly max_results: number;
	readonly query: string;
}

interface WebSearchErrorResultCandidate {
	readonly call_id?: unknown;
	readonly error_code?: unknown;
	readonly error_message?: unknown;
	readonly status?: unknown;
	readonly tool_name?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: string): string {
	return value.replace(/\s+/gu, ' ').trim();
}

function normalizeQuery(query: string): string | undefined {
	const normalizedQuery = normalizeText(query);

	if (normalizedQuery.length === 0 || normalizedQuery.length > MAX_QUERY_LENGTH) {
		return undefined;
	}

	return normalizedQuery;
}

function normalizeLocale(locale: string | undefined): string | undefined {
	if (locale === undefined) {
		return undefined;
	}

	const normalizedLocale = normalizeText(locale).toLocaleLowerCase();

	if (!LOCALE_PATTERN.test(normalizedLocale)) {
		return undefined;
	}

	return normalizedLocale;
}

function normalizeMaxResults(maxResults: number | undefined): number | undefined {
	if (maxResults === undefined) {
		return DEFAULT_MAX_RESULTS;
	}

	if (!Number.isInteger(maxResults) || maxResults < 1) {
		return undefined;
	}

	return Math.min(maxResults, MAX_MAX_RESULTS);
}

function normalizeSearchType(searchType: unknown): SearchIntent | undefined {
	if (searchType === undefined) {
		return undefined;
	}

	if (searchType === 'news') {
		return 'news';
	}

	if (searchType === 'organic' || searchType === 'general') {
		return 'general';
	}

	if (searchType === 'research') {
		return 'research';
	}

	return undefined;
}

function createErrorResult(
	input: WebSearchInput,
	error_code: WebSearchErrorResult['error_code'],
	error_message: string,
	details?: WebSearchErrorResult['details'],
	retryable?: boolean,
): WebSearchErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'web.search',
	};
}

function isWebSearchErrorResult(value: unknown): value is WebSearchErrorResult {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as WebSearchErrorResultCandidate;

	return (
		candidate.tool_name === 'web.search' &&
		candidate.status === 'error' &&
		typeof candidate.call_id === 'string' &&
		typeof candidate.error_code === 'string' &&
		typeof candidate.error_message === 'string'
	);
}

function normalizeSearchSettings(input: WebSearchInput): SearchSettings | WebSearchErrorResult {
	const query = input.arguments.query;
	const normalizedQuery = typeof query === 'string' ? normalizeQuery(query) : undefined;

	if (!normalizedQuery) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			`query must be a non-empty string with at most ${MAX_QUERY_LENGTH} characters.`,
			{ reason: 'invalid_query' },
			false,
		);
	}

	const explicitIntent = normalizeSearchType(input.arguments.search_type);

	if (input.arguments.search_type !== undefined && explicitIntent === undefined) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'search_type must be "organic", "general", "research", or "news" when provided.',
			{ reason: 'invalid_search_type' },
			false,
		);
	}

	if (
		input.arguments.freshness_required !== undefined &&
		typeof input.arguments.freshness_required !== 'boolean'
	) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'freshness_required must be a boolean when provided.',
			{ reason: 'invalid_freshness_required' },
			false,
		);
	}

	const maxResults = normalizeMaxResults(input.arguments.max_results);

	if (maxResults === undefined) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'max_results must be a positive integer when provided.',
			{ reason: 'invalid_max_results' },
			false,
		);
	}

	const localeArgument = input.arguments.locale;
	const normalizedLocale =
		localeArgument === undefined
			? undefined
			: typeof localeArgument === 'string'
				? normalizeLocale(localeArgument)
				: undefined;

	if (localeArgument !== undefined && !normalizedLocale) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'locale must be a language code such as "tr" or "tr-TR" when provided.',
			{ reason: 'invalid_locale' },
			false,
		);
	}

	return {
		freshness: input.arguments.freshness_required === true ? 'month' : null,
		intent: explicitIntent ?? classifySearchIntent(normalizedQuery),
		locale: normalizedLocale,
		max_results: maxResults,
		query: normalizedQuery,
	};
}

function getAuthorityNote(unreliable: boolean | undefined): string {
	if (unreliable === true) {
		return 'EvidenceCompiler did not keep reliable current sources for this query.';
	}

	return 'EvidenceCompiler normalized, deduplicated, trust-scored, and recency-ranked public sources before returning them to the model.';
}

function getFreshnessNote(intent: SearchIntent): string | undefined {
	if (intent === 'news') {
		return 'News intent detected; recency ranking penalizes missing or stale provider dates.';
	}

	return undefined;
}

function toWebSearchResultItems(evidence: EvidencePack): readonly WebSearchResultItem[] {
	return evidence.sources.map((source) => ({
		authority_note: `Trust score: ${source.trust_score.toFixed(2)}`,
		canonical_url: source.canonical_url,
		domain: source.domain,
		favicon: source.favicon,
		freshness_hint: source.published_at ? `Published: ${source.published_at}` : undefined,
		published_at: source.published_at,
		snippet: source.snippet,
		source: source.domain,
		title: source.title,
		trust_score: source.trust_score,
		trust_tier: toTrustTier(source.trust_score),
		url: source.url,
	}));
}

function toExecutionErrorResult(input: WebSearchInput, error: unknown): WebSearchErrorResult {
	const transportErrorCode = getTransportErrorCode(error);

	if (error instanceof Error) {
		return createErrorResult(
			input,
			transportErrorCode === 'timeout' ? 'TIMEOUT' : 'EXECUTION_FAILED',
			`Web search failed: ${error.message}`,
			{
				reason: 'provider_request_failed',
				transport_error_code: transportErrorCode,
			},
			'retryable' in error && typeof error.retryable === 'boolean'
				? error.retryable
				: transportErrorCode !== undefined,
		);
	}

	return createErrorResult(
		input,
		'UNKNOWN',
		'Web search failed with an unknown error.',
		{
			reason: 'unknown_provider_error',
			transport_error_code: transportErrorCode,
		},
		true,
	);
}

export function createWebSearchTool(
	dependencies: WebSearchDependencies = {
		environment: process.env as SearchProviderEnvironment,
		fetch: (input, init) => globalThis.fetch(input, init),
	},
): ToolDefinition<WebSearchInput, WebSearchResult> {
	return {
		callable_schema: {
			parameters: {
				freshness_required: {
					description:
						'When true, bias the public search request toward recent results. Use only for latest/current requests.',
					type: 'boolean',
				},
				max_results: {
					description:
						'Maximum number of normalized evidence sources to return, capped to a small safe limit.',
					type: 'number',
				},
				locale: {
					description: 'Language code such as "tr", "tr-TR", "en", or "en-US".',
					type: 'string',
				},
				query: {
					description:
						'Short public-web search query for fresh, external, vendor, release, or latest information. Do not use when repo or local sources already answer the implementation question.',
					required: true,
					type: 'string',
				},
				search_type: {
					description:
						'Optional search intent: "organic", "general", "research", or "news". If omitted, Runa classifies intent heuristically.',
					type: 'string',
				},
			},
		},
		description:
			'Performs a small, read-only public web search and returns an EvidencePack with normalized URLs, deduped sources, trust scores, recency ranking, and compact model context.',
		async execute(input): Promise<WebSearchResult> {
			const normalizedSettings = normalizeSearchSettings(input);

			if (isWebSearchErrorResult(normalizedSettings)) {
				return normalizedSettings;
			}

			try {
				const compiledEvidence = await compileEvidence(normalizedSettings.query, {
					freshness: normalizedSettings.freshness,
					intent: normalizedSettings.intent,
					limit: normalizedSettings.max_results,
					locale: normalizedSettings.locale,
					provider: getDefaultProvider({
						environment: dependencies.environment,
						fetch: dependencies.fetch,
					}),
				});
				const evidence = compiledEvidence.evidence;
				const results = toWebSearchResultItems(evidence);

				return {
					call_id: input.call_id,
					output: {
						authority_note: getAuthorityNote(evidence.unreliable),
						evidence,
						freshness_note: getFreshnessNote(normalizedSettings.intent),
						is_truncated: evidence.truncated,
						model_context: compiledEvidence.model_context,
						result_count: evidence.results,
						results,
						search_provider: compiledEvidence.provider as WebSearchProvider,
						searches: evidence.searches,
						sources: evidence.sources,
						truncated: evidence.truncated,
						unreliable: evidence.unreliable,
					},
					status: 'success',
					tool_name: 'web.search',
				};
			} catch (error: unknown) {
				return toExecutionErrorResult(input, error);
			}
		},
		metadata: {
			capability_class: 'search',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			tags: ['evidence', 'public-web', 'search', 'serper'],
		},
		name: 'web.search',
	};
}

export const webSearchTool = createWebSearchTool();
