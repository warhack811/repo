export interface EvidencePack {
	readonly query: string;
	readonly searches: number;
	readonly results: number;
	readonly truncated: boolean;
	readonly sources: readonly EvidenceSource[];
	readonly unreliable?: boolean;
}

export interface EvidenceSource {
	readonly id: string;
	readonly url: string;
	readonly canonical_url: string;
	readonly title: string;
	readonly domain: string;
	readonly favicon: string;
	readonly published_at: string | null;
	readonly snippet: string;
	readonly trust_score: number;
}
