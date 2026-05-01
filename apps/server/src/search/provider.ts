export type SearchIntent = 'news' | 'research' | 'general';

export type SearchFreshness = 'hour' | 'day' | 'week' | 'month' | 'year';

export type SearchOptions = {
	readonly intent: SearchIntent;
	readonly locale?: string;
	readonly country?: string;
	readonly freshness?: SearchFreshness | null;
	readonly top_k: number;
};

export type RawSearchResult = {
	readonly url: string;
	readonly title: string;
	readonly snippet: string;
	readonly displayed_url: string | null;
	readonly position: number;
	readonly raw_date: string | null;
	readonly source: string;
	readonly provider: string;
	readonly raw: Record<string, unknown>;
};

export interface SearchProvider {
	readonly name: string;
	search(query: string, options: SearchOptions): Promise<RawSearchResult[]>;
}

export interface SearchProviderEnvironment extends NodeJS.ProcessEnv {
	readonly SERPER_API_KEY?: string;
	readonly SERPER_ENDPOINT?: string;
	readonly SERPER_NEWS_ENDPOINT?: string;
}
