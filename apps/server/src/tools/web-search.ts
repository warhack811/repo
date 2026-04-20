import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
	WebSearchTrustTier,
} from '@runa/types';

import {
	sanitizeOptionalPromptContent,
	sanitizePromptContent,
} from '../utils/sanitize-prompt-content.js';

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_SERPER_ENDPOINT = 'https://google.serper.dev/search';
const MAX_MAX_RESULTS = 5;
const MAX_QUERY_LENGTH = 160;
const MAX_SNIPPET_LENGTH = 280;
const PROVIDER_RESULT_MULTIPLIER = 2;
const REQUEST_TIMEOUT_MS = 8_000;

const GENERAL_WEB_HOST_SUFFIXES = [
	'dev.to',
	'facebook.com',
	'instagram.com',
	'linkedin.com',
	'medium.com',
	'pinterest.com',
	'quora.com',
	'reddit.com',
	'substack.com',
	'techcrunch.com',
	'tiktok.com',
	'twitter.com',
	'x.com',
	'youtube.com',
] as const;

const REPUTABLE_TECH_HOST_SUFFIXES = [
	'developer.mozilla.org',
	'docs.github.com',
	'github.com',
	'learn.microsoft.com',
	'microsoft.com',
	'nodejs.org',
	'npmjs.com',
	'stackoverflow.com',
	'stackexchange.com',
	'typescriptlang.org',
	'vite.dev',
	'vitest.dev',
] as const;

const DOCS_LIKE_PATH_SEGMENTS = [
	'api',
	'docs',
	'documentation',
	'guide',
	'guides',
	'manual',
	'reference',
];
const DOCS_LIKE_SUBDOMAINS = ['api', 'developer', 'developers', 'docs', 'learn', 'platform'];
const NON_VENDOR_PATH_SEGMENTS = [
	'article',
	'articles',
	'blog',
	'community',
	'forum',
	'news',
	'post',
	'posts',
];

export type WebSearchProvider = 'serper';

export type WebSearchArguments = ToolArguments & {
	readonly freshness_required?: boolean;
	readonly max_results?: number;
	readonly query: string;
};

export interface WebSearchResultItem {
	readonly authority_note?: string;
	readonly freshness_hint?: string;
	readonly snippet: string;
	readonly source: string;
	readonly title: string;
	readonly trust_tier: WebSearchTrustTier;
	readonly url: string;
}

export interface WebSearchSuccessData {
	readonly authority_note?: string;
	readonly freshness_note?: string;
	readonly is_truncated: boolean;
	readonly results: readonly WebSearchResultItem[];
	readonly search_provider: WebSearchProvider;
}

export type WebSearchInput = ToolCallInput<'web.search', WebSearchArguments>;

export type WebSearchSuccessResult = ToolResultSuccess<'web.search', WebSearchSuccessData>;

export type WebSearchErrorResult = ToolResultError<'web.search'>;

export type WebSearchResult = ToolResult<'web.search', WebSearchSuccessData>;

interface WebSearchDependencies {
	readonly environment: SearchEnvironment;
	readonly fetch: typeof fetch;
}

interface SearchEnvironment extends NodeJS.ProcessEnv {
	readonly SERPER_API_KEY?: string;
	readonly SERPER_ENDPOINT?: string;
}

interface SerperOrganicResultCandidate {
	readonly date?: unknown;
	readonly link?: unknown;
	readonly position?: unknown;
	readonly snippet?: unknown;
	readonly title?: unknown;
}

interface SerperResponseCandidate {
	readonly organic?: unknown;
}

interface SerperOrganicResult {
	readonly date?: string;
	readonly link: string;
	readonly position?: number;
	readonly snippet?: string;
	readonly title: string;
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

function normalizeMaxResults(maxResults: number | undefined): number | undefined {
	if (maxResults === undefined) {
		return DEFAULT_MAX_RESULTS;
	}

	if (!Number.isInteger(maxResults) || maxResults < 1) {
		return undefined;
	}

	return Math.min(maxResults, MAX_MAX_RESULTS);
}

function normalizeSnippet(snippet: string | undefined): string {
	if (!snippet) {
		return 'No snippet available from the search provider.';
	}

	const normalizedSnippet = normalizeText(snippet);

	if (normalizedSnippet.length <= MAX_SNIPPET_LENGTH) {
		return normalizedSnippet;
	}

	return `${normalizedSnippet.slice(0, MAX_SNIPPET_LENGTH - 3)}...`;
}

function matchesHostSuffix(hostname: string, suffix: string): boolean {
	return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

function normalizeHostname(hostname: string): string {
	return hostname.replace(/^www\./u, '').toLocaleLowerCase();
}

function isGeneralWebHost(hostname: string): boolean {
	return GENERAL_WEB_HOST_SUFFIXES.some((suffix) => matchesHostSuffix(hostname, suffix));
}

function isReputableTechHost(hostname: string): boolean {
	return REPUTABLE_TECH_HOST_SUFFIXES.some((suffix) => matchesHostSuffix(hostname, suffix));
}

function hasDocsLikeSignal(hostname: string, pathName: string): boolean {
	const hostSegments = hostname.split('.');
	const pathSegments = pathName
		.split('/')
		.map((segment) => segment.trim().toLocaleLowerCase())
		.filter((segment) => segment.length > 0);

	return (
		hostSegments.some((segment) => DOCS_LIKE_SUBDOMAINS.includes(segment)) ||
		pathSegments.some((segment) => DOCS_LIKE_PATH_SEGMENTS.includes(segment))
	);
}

function isVendorLikeHost(hostname: string, pathName: string): boolean {
	const hostSegments = hostname.split('.');
	const pathSegments = pathName
		.split('/')
		.map((segment) => segment.trim().toLocaleLowerCase())
		.filter((segment) => segment.length > 0);

	if (hostSegments.length > 3) {
		return false;
	}

	return !pathSegments.some((segment) => NON_VENDOR_PATH_SEGMENTS.includes(segment));
}

function detectTrustTier(url: URL): WebSearchTrustTier {
	const hostname = normalizeHostname(url.hostname);

	if (hasDocsLikeSignal(hostname, url.pathname)) {
		return 'official';
	}

	if (isReputableTechHost(hostname)) {
		return 'reputable';
	}

	if (!isGeneralWebHost(hostname) && isVendorLikeHost(hostname, url.pathname)) {
		return 'vendor';
	}

	return 'general';
}

function getAuthorityNote(trustTier: WebSearchTrustTier): string {
	switch (trustTier) {
		case 'official':
			return 'Docs-like or official project source.';
		case 'vendor':
			return 'Vendor or project-owned site; verify exact details on canonical docs when available.';
		case 'reputable':
			return 'Reputable technical source; still secondary to official docs.';
		case 'general':
			return 'General web result; treat as lower-trust context.';
	}
}

function getFreshnessHint(date: string | undefined): string | undefined {
	if (!date) {
		return undefined;
	}

	const normalizedDate = normalizeText(date);

	return normalizedDate.length > 0 ? `Provider date: ${normalizedDate}` : undefined;
}

function getTrustRank(trustTier: WebSearchTrustTier): number {
	switch (trustTier) {
		case 'official':
			return 0;
		case 'vendor':
			return 1;
		case 'reputable':
			return 2;
		case 'general':
			return 3;
	}
}

function isSerperOrganicResult(value: unknown): value is SerperOrganicResult {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as SerperOrganicResultCandidate;

	return (
		typeof candidate.title === 'string' &&
		typeof candidate.link === 'string' &&
		(candidate.snippet === undefined || typeof candidate.snippet === 'string') &&
		(candidate.date === undefined || typeof candidate.date === 'string') &&
		(candidate.position === undefined || typeof candidate.position === 'number')
	);
}

function parseSerperOrganicResults(payload: unknown): readonly SerperOrganicResult[] {
	if (!isRecord(payload)) {
		return [];
	}

	const candidate = payload as SerperResponseCandidate;

	if (!Array.isArray(candidate.organic)) {
		return [];
	}

	return candidate.organic.filter((result) => isSerperOrganicResult(result));
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

function toExecutionErrorResult(input: WebSearchInput, error: unknown): WebSearchErrorResult {
	if (error instanceof Error) {
		if (error.name === 'AbortError') {
			return createErrorResult(
				input,
				'TIMEOUT',
				'Web search provider request timed out.',
				{
					reason: 'provider_timeout',
				},
				true,
			);
		}

		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Web search failed: ${error.message}`,
			{
				reason: 'provider_request_failed',
			},
			true,
		);
	}

	return createErrorResult(
		input,
		'UNKNOWN',
		'Web search failed with an unknown error.',
		{
			reason: 'unknown_provider_error',
		},
		true,
	);
}

function getSearchEndpoint(environment: SearchEnvironment): string {
	const configuredEndpoint = environment.SERPER_ENDPOINT?.trim();

	return configuredEndpoint && configuredEndpoint.length > 0
		? configuredEndpoint
		: DEFAULT_SERPER_ENDPOINT;
}

function getSearchApiKey(environment: SearchEnvironment): string | undefined {
	const value = environment.SERPER_API_KEY?.trim();

	return value && value.length > 0 ? value : undefined;
}

async function requestSerperResults(
	dependencies: WebSearchDependencies,
	input: WebSearchInput,
	query: string,
	maxResults: number,
): Promise<readonly SerperOrganicResult[]> {
	const apiKey = getSearchApiKey(dependencies.environment);

	if (!apiKey) {
		throw createErrorResult(
			input,
			'EXECUTION_FAILED',
			'web.search requires SERPER_API_KEY in the server environment.',
			{
				reason: 'missing_serper_api_key',
			},
			false,
		);
	}

	const controller = new AbortController();
	const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const response = await dependencies.fetch(getSearchEndpoint(dependencies.environment), {
			body: JSON.stringify({
				num: Math.min(maxResults * PROVIDER_RESULT_MULTIPLIER, 10),
				q: query,
				tbs: input.arguments.freshness_required === true ? 'qdr:m' : undefined,
			}),
			headers: {
				'content-type': 'application/json',
				'X-API-KEY': apiKey,
			},
			method: 'POST',
			signal: controller.signal,
		});

		if (!response.ok) {
			const responseBody = normalizeSnippet(await response.text());
			throw createErrorResult(
				input,
				'EXECUTION_FAILED',
				`Web search provider request failed with status ${response.status}.`,
				{
					provider_body: responseBody,
					provider_status: response.status,
					reason: 'provider_http_error',
				},
				response.status >= 500,
			);
		}

		return parseSerperOrganicResults((await response.json()) as unknown);
	} finally {
		clearTimeout(timeoutHandle);
	}
}

function shapeResults(
	organicResults: readonly SerperOrganicResult[],
	maxResults: number,
): Readonly<{
	readonly is_truncated: boolean;
	readonly results: readonly WebSearchResultItem[];
}> {
	const shapedResults = organicResults
		.flatMap((result) => {
			try {
				const url = new URL(result.link);

				if (url.protocol !== 'http:' && url.protocol !== 'https:') {
					return [];
				}

				const hostname = normalizeHostname(url.hostname);
				const trustTier = detectTrustTier(url);

				if (isGeneralWebHost(hostname)) {
					return [];
				}

				return [
					{
						authority_note: sanitizePromptContent(getAuthorityNote(trustTier)),
						freshness_hint: sanitizeOptionalPromptContent(getFreshnessHint(result.date)),
						snippet: sanitizePromptContent(normalizeSnippet(result.snippet)),
						source: hostname,
						title: sanitizePromptContent(normalizeText(result.title)),
						trust_tier: trustTier,
						url: url.toString(),
					} satisfies WebSearchResultItem,
				];
			} catch {
				return [];
			}
		})
		.filter((result) => result.title.length > 0)
		.sort((left, right) => {
			const trustRank = getTrustRank(left.trust_tier) - getTrustRank(right.trust_tier);

			if (trustRank !== 0) {
				return trustRank;
			}

			const sourceComparison = left.source.localeCompare(right.source);

			if (sourceComparison !== 0) {
				return sourceComparison;
			}

			return left.url.localeCompare(right.url);
		});
	const visibleResults = shapedResults.slice(0, maxResults);

	return {
		is_truncated: shapedResults.length > visibleResults.length,
		results: visibleResults,
	};
}

export function createWebSearchTool(
	dependencies: WebSearchDependencies = {
		environment: process.env as SearchEnvironment,
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
						'Maximum number of authority-ranked public web results to return, capped to a small safe limit.',
					type: 'number',
				},
				query: {
					description:
						'Short public-web search query for fresh, external, vendor, release, or latest information. Do not use when repo or local sources already answer the implementation question.',
					required: true,
					type: 'string',
				},
			},
		},
		description:
			'Performs a small, read-only public web search for external or freshness-sensitive questions with authority-first shaping, provenance-aware results, conservative low-trust filtering, and optional freshness bias. It complements local truth rather than replacing it.',
		async execute(input): Promise<WebSearchResult> {
			const query = input.arguments.query;
			const normalizedQuery = typeof query === 'string' ? normalizeQuery(query) : undefined;

			if (!normalizedQuery) {
				return createErrorResult(
					input,
					'INVALID_INPUT',
					`query must be a non-empty string with at most ${MAX_QUERY_LENGTH} characters.`,
					{
						reason: 'invalid_query',
					},
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
					{
						reason: 'invalid_freshness_required',
					},
					false,
				);
			}

			const maxResults = normalizeMaxResults(input.arguments.max_results);

			if (maxResults === undefined) {
				return createErrorResult(
					input,
					'INVALID_INPUT',
					'max_results must be a positive integer when provided.',
					{
						reason: 'invalid_max_results',
					},
					false,
				);
			}

			try {
				const organicResults = await requestSerperResults(
					dependencies,
					input,
					normalizedQuery,
					maxResults,
				);
				const shapedResults = shapeResults(organicResults, maxResults);

				return {
					call_id: input.call_id,
					output: {
						authority_note:
							'Authority-first ordering prioritizes docs-like and vendor sources; lower-trust general web results are filtered out.',
						freshness_note:
							input.arguments.freshness_required === true
								? 'Freshness was requested; snippets and provider dates may still lag the live page.'
								: undefined,
						is_truncated: shapedResults.is_truncated,
						results: shapedResults.results,
						search_provider: 'serper',
					},
					status: 'success',
					tool_name: 'web.search',
				};
			} catch (error: unknown) {
				if (isWebSearchErrorResult(error)) {
					return error;
				}

				return toExecutionErrorResult(input, error);
			}
		},
		metadata: {
			capability_class: 'search',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			tags: ['authority-first', 'public-web', 'search', 'serper'],
		},
		name: 'web.search',
	};
}

export const webSearchTool = createWebSearchTool();
