import { describe, expect, it } from 'vitest';

import type { SearchProvider } from '../search/provider.js';
import { compileEvidence } from './compile.js';

const provider: SearchProvider = {
	name: 'fixture',
	async search() {
		return [
			{
				displayed_url: null,
				position: 1,
				provider: 'fixture',
				raw: {},
				raw_date: '1 hour ago',
				snippet: 'Official snippet.',
				source: 'Reuters',
				title: 'Official Result',
				url: 'https://www.reuters.com/world/story?utm_source=x&gclid=bad',
			},
			{
				displayed_url: null,
				position: 2,
				provider: 'fixture',
				raw: {},
				raw_date: '1 hour ago',
				snippet: 'Official snippet.',
				source: 'Reuters Copy',
				title: 'Official Result',
				url: 'https://reuters.com/world/story',
			},
			{
				displayed_url: null,
				position: 3,
				provider: 'fixture',
				raw: {},
				raw_date: null,
				snippet: 'Low quality.',
				source: 'Content Farm',
				title: 'Farm',
				url: 'https://contentfarm.example/story',
			},
		];
	},
};

describe('compileEvidence', () => {
	it('normalizes URLs, deduplicates similar results, scores trust, and ranks recency', async () => {
		const compiled = await compileEvidence('bugün haber', {
			intent: 'news',
			limit: 8,
			now: new Date('2026-05-01T10:00:00.000Z'),
			provider,
		});

		expect(compiled.evidence).toMatchObject({
			query: 'bugün haber',
			results: 2,
			searches: 1,
			truncated: false,
		});
		expect(compiled.evidence.sources[0]).toMatchObject({
			canonical_url: 'https://reuters.com/world/story',
			domain: 'reuters.com',
			published_at: '2026-05-01T09:00:00.000Z',
			trust_score: 0.95,
		});
		expect(compiled.model_context).toContain('Official Result');
	});

	it('marks all low-trust results as unreliable without failing the tool', async () => {
		const lowTrustProvider: SearchProvider = {
			name: 'fixture',
			async search() {
				return [
					{
						displayed_url: null,
						position: 1,
						provider: 'fixture',
						raw: {},
						raw_date: null,
						snippet: 'Low quality.',
						source: 'Content Farm',
						title: 'Farm',
						url: 'https://contentfarm.example/story',
					},
				];
			},
		};

		const compiled = await compileEvidence('edge query', {
			intent: 'general',
			provider: lowTrustProvider,
		});

		expect(compiled.evidence).toEqual({
			query: 'edge query',
			results: 0,
			searches: 1,
			sources: [],
			truncated: true,
			unreliable: true,
		});
		expect(compiled.model_context).toBe(
			'Güvenilir güncel kaynak bulamadım. Kaynak yokken güncel bilgi sentezleme.',
		);
	});
});
