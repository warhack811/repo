import type { RawSearchResult } from '../search/provider.js';

export interface ExtractedContent {
	readonly snippet: string;
}

export async function extractContent(result: RawSearchResult): Promise<ExtractedContent> {
	return {
		snippet: result.snippet,
	};
}
