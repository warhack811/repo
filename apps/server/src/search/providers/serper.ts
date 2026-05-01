import { createTransportMappedError } from '../../transport/error-codes.js';
import type {
	RawSearchResult,
	SearchFreshness,
	SearchOptions,
	SearchProvider,
	SearchProviderEnvironment,
} from '../provider.js';

const DEFAULT_SERPER_ENDPOINT = 'https://google.serper.dev/search';
const DEFAULT_SERPER_NEWS_ENDPOINT = 'https://google.serper.dev/news';
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_SERPER_RESULTS = 10;

interface SerperProviderDependencies {
	readonly environment?: SearchProviderEnvironment;
	readonly fetch?: typeof fetch;
	readonly timeout_ms?: number;
}

interface SerperResultCandidate {
	readonly date?: unknown;
	readonly displayedLink?: unknown;
	readonly imageUrl?: unknown;
	readonly link?: unknown;
	readonly position?: unknown;
	readonly snippet?: unknown;
	readonly source?: unknown;
	readonly title?: unknown;
}

interface SerperResponseCandidate {
	readonly news?: unknown;
	readonly organic?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: string): string {
	return value.replace(/\s+/gu, ' ').trim();
}

function normalizeOptionalText(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}

	const normalizedValue = normalizeText(value);
	return normalizedValue.length > 0 ? normalizedValue : null;
}

function getHostname(url: string): string | null {
	try {
		return new URL(url).hostname.replace(/^www\./u, '').toLocaleLowerCase();
	} catch {
		return null;
	}
}

function isSerperResultCandidate(value: unknown): value is SerperResultCandidate {
	if (!isRecord(value)) {
		return false;
	}

	return typeof value['title'] === 'string' && typeof value['link'] === 'string';
}

function toFreshnessTbs(freshness: SearchFreshness | null | undefined): string | undefined {
	switch (freshness) {
		case 'hour':
			return 'qdr:h';
		case 'day':
			return 'qdr:d';
		case 'week':
			return 'qdr:w';
		case 'month':
			return 'qdr:m';
		case 'year':
			return 'qdr:y';
		case null:
		case undefined:
			return undefined;
	}
}

function toLanguage(locale: string | undefined): string | undefined {
	if (!locale) {
		return undefined;
	}

	const language = locale.split('-')[0]?.trim().toLocaleLowerCase();
	return language && /^[a-z]{2}$/u.test(language) ? language : undefined;
}

function toCountry(country: string | undefined): string | undefined {
	const normalizedCountry = country?.trim().toLocaleLowerCase();
	return normalizedCountry && /^[a-z]{2}$/u.test(normalizedCountry) ? normalizedCountry : undefined;
}

function resolveEndpoint(environment: SearchProviderEnvironment, isNews: boolean): string {
	if (isNews) {
		const explicitNewsEndpoint = environment.SERPER_NEWS_ENDPOINT?.trim();

		if (explicitNewsEndpoint) {
			return explicitNewsEndpoint;
		}
	}

	const configuredEndpoint = environment.SERPER_ENDPOINT?.trim();

	if (!configuredEndpoint) {
		return isNews ? DEFAULT_SERPER_NEWS_ENDPOINT : DEFAULT_SERPER_ENDPOINT;
	}

	if (!isNews) {
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

function parseSerperResults(payload: unknown, isNews: boolean): readonly SerperResultCandidate[] {
	if (!isRecord(payload)) {
		return [];
	}

	const candidate = payload as SerperResponseCandidate;
	const rawResults = isNews ? candidate.news : candidate.organic;

	if (!Array.isArray(rawResults)) {
		return [];
	}

	return rawResults.filter((result) => isSerperResultCandidate(result));
}

async function readProviderBody(response: Response): Promise<string> {
	try {
		return (await response.text()).slice(0, 500);
	} catch {
		return '';
	}
}

export class SerperProvider implements SearchProvider {
	readonly name = 'serper';

	readonly #environment: SearchProviderEnvironment;
	readonly #fetch: typeof fetch;
	readonly #timeoutMs: number;

	constructor(dependencies: SerperProviderDependencies = {}) {
		this.#environment = dependencies.environment ?? (process.env as SearchProviderEnvironment);
		this.#fetch = dependencies.fetch ?? ((input, init) => globalThis.fetch(input, init));
		this.#timeoutMs = dependencies.timeout_ms ?? DEFAULT_TIMEOUT_MS;
	}

	async search(query: string, options: SearchOptions): Promise<RawSearchResult[]> {
		const apiKey = this.#environment.SERPER_API_KEY?.trim();

		if (!apiKey) {
			throw createTransportMappedError('SERPER_API_KEY is required for web search.', {
				reason: 'provider_unavailable',
				retryable: false,
			});
		}

		const isNews = options.intent === 'news';
		const controller = new AbortController();
		const timeoutHandle = setTimeout(() => controller.abort(), this.#timeoutMs);

		try {
			const response = await this.#fetch(resolveEndpoint(this.#environment, isNews), {
				body: JSON.stringify({
					gl: toCountry(options.country ?? 'tr'),
					hl: toLanguage(options.locale ?? 'tr-TR'),
					num: Math.min(options.top_k, MAX_SERPER_RESULTS),
					q: query,
					tbs: toFreshnessTbs(options.freshness),
				}),
				headers: {
					'content-type': 'application/json',
					'X-API-KEY': apiKey,
				},
				method: 'POST',
				signal: controller.signal,
			});

			if (!response.ok) {
				const providerBody = await readProviderBody(response);

				if (response.status === 429) {
					throw createTransportMappedError('Serper rate limit exceeded.', {
						reason: 'rate_limit',
						retryable: true,
					});
				}

				if (response.status === 401 || response.status === 403) {
					throw createTransportMappedError('Serper rejected the configured API key.', {
						reason: 'provider_unavailable',
						retryable: false,
					});
				}

				throw createTransportMappedError(
					`Serper request failed with status ${response.status}${providerBody ? `: ${providerBody}` : ''}`,
					{
						reason: response.status >= 500 ? 'server_error' : 'provider_unavailable',
						retryable: response.status >= 500,
					},
				);
			}

			return parseSerperResults((await response.json()) as unknown, isNews).map((result, index) => {
				const url = normalizeOptionalText(result.link) ?? '';
				const source = normalizeOptionalText(result.source) ?? getHostname(url) ?? 'unknown';

				return {
					displayed_url: normalizeOptionalText(result.displayedLink),
					position: typeof result.position === 'number' ? result.position : index + 1,
					provider: this.name,
					raw: { ...result },
					raw_date: normalizeOptionalText(result.date),
					snippet: normalizeOptionalText(result.snippet) ?? '',
					source,
					title: normalizeOptionalText(result.title) ?? '',
					url,
				};
			});
		} catch (error: unknown) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw createTransportMappedError('Serper request timed out.', {
					cause: error,
					reason: 'timeout',
					retryable: true,
				});
			}

			if (error instanceof Error && 'transport_error_code' in error) {
				throw error;
			}

			throw createTransportMappedError('Serper request failed before a provider response.', {
				cause: error,
				reason: 'provider_unavailable',
				retryable: true,
			});
		} finally {
			clearTimeout(timeoutHandle);
		}
	}
}
