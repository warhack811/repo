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
const DEFAULT_SERPER_NEWS_ENDPOINT = 'https://google.serper.dev/news';
const MAX_MAX_RESULTS = 5;
const MAX_QUERY_LENGTH = 160;
const MAX_SNIPPET_LENGTH = 280;
const LOCALE_PATTERN = /^[a-z]{2}$/iu;
const PROVIDER_RESULT_MULTIPLIER = 2;
const REQUEST_TIMEOUT_MS = 8_000;

const COMMUNITY_RESEARCH_HOST_SUFFIXES = ['researchgate.net', 'scholar.google.com'] as const;
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

const OFFICIAL_SOURCE_HOST_SUFFIXES = [
	'europa.eu',
	'gov.tr',
	'meb.gov.tr',
	'nih.gov',
	'who.int',
] as const;

const REPUTABLE_RESEARCH_HOST_SUFFIXES = [
	'arxiv.org',
	'acm.org',
	'doi.org',
	'ieee.org',
	'jstor.org',
	'ncbi.nlm.nih.gov',
	'nature.com',
	'pubmed.ncbi.nlm.nih.gov',
	'sciencedirect.com',
	'wikipedia.org',
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
const COMMUNITY_HOST_SEGMENTS = ['community', 'discourse', 'discuss', 'forum', 'forums'];
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
	readonly locale?: string;
	readonly max_results?: number;
	readonly query: string;
	readonly search_type?: string;
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

export interface WebSearchAnswerBoxData {
	readonly snippet: string;
	readonly source?: string;
	readonly title?: string;
}

export interface WebSearchKnowledgeGraphData {
	readonly description?: string;
	readonly source?: string;
	readonly title?: string;
}

export interface WebSearchSuccessData {
	readonly answer_box?: WebSearchAnswerBoxData;
	readonly authority_note?: string;
	readonly freshness_note?: string;
	readonly is_truncated: boolean;
	readonly knowledge_graph?: WebSearchKnowledgeGraphData;
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

type SearchType = 'news' | 'organic';

interface SearchSettings {
	readonly locale?: string;
	readonly max_results: number;
	readonly query: string;
	readonly search_type: SearchType;
}

interface SerperAnswerBoxCandidate {
	readonly answer?: unknown;
	readonly link?: unknown;
	readonly snippet?: unknown;
	readonly source?: unknown;
	readonly title?: unknown;
}

interface SerperKnowledgeGraphCandidate {
	readonly description?: unknown;
	readonly source?: unknown;
	readonly title?: unknown;
	readonly website?: unknown;
}

interface SerperNewsResultCandidate {
	readonly date?: unknown;
	readonly link?: unknown;
	readonly position?: unknown;
	readonly snippet?: unknown;
	readonly source?: unknown;
	readonly title?: unknown;
}

interface SerperOrganicResultCandidate {
	readonly date?: unknown;
	readonly link?: unknown;
	readonly position?: unknown;
	readonly snippet?: unknown;
	readonly source?: unknown;
	readonly title?: unknown;
}

interface SerperResponseCandidate {
	readonly answerBox?: unknown;
	readonly answer_box?: unknown;
	readonly knowledgeGraph?: unknown;
	readonly knowledge_graph?: unknown;
	readonly news?: unknown;
	readonly organic?: unknown;
}

interface SerperSearchResult {
	readonly date?: string;
	readonly link: string;
	readonly position?: number;
	readonly snippet?: string;
	readonly source?: string;
	readonly title: string;
}

interface SerperParsedResponse {
	readonly answer_box?: WebSearchAnswerBoxData;
	readonly knowledge_graph?: WebSearchKnowledgeGraphData;
	readonly results: readonly SerperSearchResult[];
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

function isCommunityResearchHost(hostname: string): boolean {
	return COMMUNITY_RESEARCH_HOST_SUFFIXES.some((suffix) => matchesHostSuffix(hostname, suffix));
}

function isCommunityLikeHost(hostname: string): boolean {
	return hostname.split('.').some((segment) => COMMUNITY_HOST_SEGMENTS.includes(segment));
}

function isOfficialInstitutionHost(hostname: string): boolean {
	return (
		OFFICIAL_SOURCE_HOST_SUFFIXES.some((suffix) => matchesHostSuffix(hostname, suffix)) ||
		hostname.endsWith('.gov') ||
		hostname.includes('.gov.') ||
		hostname.endsWith('.edu') ||
		hostname.includes('.edu.')
	);
}

function isReputableResearchHost(hostname: string): boolean {
	return REPUTABLE_RESEARCH_HOST_SUFFIXES.some((suffix) => matchesHostSuffix(hostname, suffix));
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
		!hostSegments.some((segment) => COMMUNITY_HOST_SEGMENTS.includes(segment)) &&
		(hostSegments.some((segment) => DOCS_LIKE_SUBDOMAINS.includes(segment)) ||
			pathSegments.some((segment) => DOCS_LIKE_PATH_SEGMENTS.includes(segment)))
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

	if (isCommunityResearchHost(hostname) || isCommunityLikeHost(hostname)) {
		return 'general';
	}

	if (isOfficialInstitutionHost(hostname)) {
		return 'official';
	}

	if (hasDocsLikeSignal(hostname, url.pathname)) {
		return 'official';
	}

	if (isReputableResearchHost(hostname)) {
		return 'reputable';
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
			return 'General web result, aggregator, or community-uploaded source; treat as lower-trust context.';
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

function normalizeOptionalText(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const normalizedValue = normalizeText(value);

	return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function normalizeSourceLabel(rawSource: unknown, rawUrl: unknown): string | undefined {
	const normalizedSource = normalizeOptionalText(rawSource);

	if (normalizedSource) {
		return sanitizePromptContent(normalizedSource);
	}

	const normalizedUrl = normalizeOptionalText(rawUrl);

	if (!normalizedUrl) {
		return undefined;
	}

	try {
		return normalizeHostname(new URL(normalizedUrl).hostname);
	} catch {
		return sanitizePromptContent(normalizedUrl);
	}
}

function isSerperSearchResult(value: unknown): value is SerperSearchResult {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as SerperOrganicResultCandidate | SerperNewsResultCandidate;

	return (
		typeof candidate.title === 'string' &&
		typeof candidate.link === 'string' &&
		(candidate.snippet === undefined || typeof candidate.snippet === 'string') &&
		(candidate.date === undefined || typeof candidate.date === 'string') &&
		(candidate.position === undefined || typeof candidate.position === 'number') &&
		(candidate.source === undefined || typeof candidate.source === 'string')
	);
}

function parseSerperSearchResults(
	payload: unknown,
	searchType: SearchType,
): readonly SerperSearchResult[] {
	if (!isRecord(payload)) {
		return [];
	}

	const candidate = payload as SerperResponseCandidate;
	const rawResults = searchType === 'news' ? candidate.news : candidate.organic;

	if (!Array.isArray(rawResults)) {
		return [];
	}

	return rawResults.filter((result) => isSerperSearchResult(result));
}

function parseSerperAnswerBox(payload: unknown): WebSearchAnswerBoxData | undefined {
	if (!isRecord(payload)) {
		return undefined;
	}

	const candidate = payload as SerperAnswerBoxCandidate;
	const snippetCandidate =
		normalizeOptionalText(candidate.snippet) ?? normalizeOptionalText(candidate.answer);

	if (!snippetCandidate) {
		return undefined;
	}

	return {
		snippet: sanitizePromptContent(normalizeSnippet(snippetCandidate)),
		source: normalizeSourceLabel(candidate.source, candidate.link),
		title: sanitizeOptionalPromptContent(normalizeOptionalText(candidate.title)),
	};
}

function parseSerperKnowledgeGraph(payload: unknown): WebSearchKnowledgeGraphData | undefined {
	if (!isRecord(payload)) {
		return undefined;
	}

	const candidate = payload as SerperKnowledgeGraphCandidate;
	const title = normalizeOptionalText(candidate.title);
	const description = normalizeOptionalText(candidate.description);
	const source = normalizeSourceLabel(candidate.source, candidate.website);

	if (!title && !description && !source) {
		return undefined;
	}

	return {
		description: sanitizeOptionalPromptContent(description),
		source,
		title: sanitizeOptionalPromptContent(title),
	};
}

function parseSerperResponse(payload: unknown, searchType: SearchType): SerperParsedResponse {
	if (!isRecord(payload)) {
		return {
			results: [],
		};
	}

	const candidate = payload as SerperResponseCandidate;
	const answerBox = parseSerperAnswerBox(candidate.answerBox ?? candidate.answer_box);
	const knowledgeGraph = parseSerperKnowledgeGraph(
		candidate.knowledgeGraph ?? candidate.knowledge_graph,
	);

	return {
		...(answerBox ? { answer_box: answerBox } : {}),
		...(knowledgeGraph ? { knowledge_graph: knowledgeGraph } : {}),
		results: parseSerperSearchResults(candidate, searchType),
	};
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

function getSearchEndpoint(environment: SearchEnvironment, searchType: SearchType): string {
	const configuredEndpoint = environment.SERPER_ENDPOINT?.trim();

	if (!configuredEndpoint || configuredEndpoint.length === 0) {
		return searchType === 'news' ? DEFAULT_SERPER_NEWS_ENDPOINT : DEFAULT_SERPER_ENDPOINT;
	}

	if (searchType === 'organic') {
		return configuredEndpoint;
	}

	try {
		const parsedEndpoint = new URL(configuredEndpoint);
		const normalizedPath = parsedEndpoint.pathname.replace(/\/+$/u, '');

		parsedEndpoint.pathname = normalizedPath.endsWith('/search')
			? `${normalizedPath.slice(0, -'/search'.length)}/news`
			: `${normalizedPath}/news`;

		return parsedEndpoint.toString();
	} catch {
		return DEFAULT_SERPER_NEWS_ENDPOINT;
	}
}

function getSearchApiKey(environment: SearchEnvironment): string | undefined {
	const value = environment.SERPER_API_KEY?.trim();

	return value && value.length > 0 ? value : undefined;
}

async function requestSerperResults(
	dependencies: WebSearchDependencies,
	input: WebSearchInput,
	settings: SearchSettings,
): Promise<SerperParsedResponse> {
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
		const response = await dependencies.fetch(
			getSearchEndpoint(dependencies.environment, settings.search_type),
			{
				body: JSON.stringify({
					hl: settings.locale,
					num: Math.min(settings.max_results * PROVIDER_RESULT_MULTIPLIER, 10),
					q: settings.query,
					tbs:
						settings.search_type === 'organic' && input.arguments.freshness_required === true
							? 'qdr:m'
							: undefined,
				}),
				headers: {
					'content-type': 'application/json',
					'X-API-KEY': apiKey,
				},
				method: 'POST',
				signal: controller.signal,
			},
		);

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

		return parseSerperResponse((await response.json()) as unknown, settings.search_type);
	} finally {
		clearTimeout(timeoutHandle);
	}
}

function shapeResults(
	searchResults: readonly SerperSearchResult[],
	maxResults: number,
): Readonly<{
	readonly is_truncated: boolean;
	readonly results: readonly WebSearchResultItem[];
}> {
	const shapedResults = searchResults
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
						source: normalizeSourceLabel(result.source, result.link) ?? hostname,
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

function getFreshnessNote(
	searchType: SearchType,
	freshnessRequired: boolean | undefined,
): string | undefined {
	if (searchType === 'news') {
		return 'News search was requested; provider dates and snippets may lag the source article page.';
	}

	if (freshnessRequired === true) {
		return 'Freshness was requested; snippets and provider dates may still lag the live page.';
	}

	return undefined;
}

function normalizeSearchSettings(input: WebSearchInput): SearchSettings | WebSearchErrorResult {
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

	const searchTypeArgument = input.arguments.search_type;
	const normalizedSearchType =
		searchTypeArgument === undefined
			? 'organic'
			: typeof searchTypeArgument === 'string' &&
					(searchTypeArgument === 'organic' || searchTypeArgument === 'news')
				? searchTypeArgument
				: undefined;

	if (!normalizedSearchType) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'search_type must be "organic" or "news" when provided.',
			{
				reason: 'invalid_search_type',
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
			'locale must be a two-letter language code such as "tr" or "en" when provided.',
			{
				reason: 'invalid_locale',
			},
			false,
		);
	}

	return {
		locale: normalizedLocale,
		max_results: maxResults,
		query: normalizedQuery,
		search_type: normalizedSearchType,
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
				locale: {
					description: 'Two-letter language code such as "tr" or "en".',
					type: 'string',
				},
				query: {
					description:
						'Short public-web search query for fresh, external, vendor, release, or latest information. Do not use when repo or local sources already answer the implementation question.',
					required: true,
					type: 'string',
				},
				search_type: {
					description: 'Type of search: "organic" (default) or "news" for recent news articles.',
					type: 'string',
				},
			},
		},
		description:
			'Performs a small, read-only public web search for external or freshness-sensitive questions with authority-first shaping, provenance-aware results, answer-box and knowledge-graph capture, conservative low-trust filtering, optional locale hints, and news-mode support. It complements local truth rather than replacing it.',
		async execute(input): Promise<WebSearchResult> {
			const normalizedSettings = normalizeSearchSettings(input);

			if (isWebSearchErrorResult(normalizedSettings)) {
				return normalizedSettings;
			}

			try {
				const serperResponse = await requestSerperResults(dependencies, input, normalizedSettings);
				const shapedResults = shapeResults(serperResponse.results, normalizedSettings.max_results);

				return {
					call_id: input.call_id,
					output: {
						answer_box: serperResponse.answer_box,
						authority_note:
							'Authority-first ordering prioritizes official, vendor, and reputable sources; high-signal answer surfaces retain provenance and lower-trust general web results are filtered only when clearly noisy.',
						freshness_note: getFreshnessNote(
							normalizedSettings.search_type,
							input.arguments.freshness_required,
						),
						is_truncated: shapedResults.is_truncated,
						knowledge_graph: serperResponse.knowledge_graph,
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
