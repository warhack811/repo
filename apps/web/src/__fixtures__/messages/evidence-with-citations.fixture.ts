import type { EvidencePack } from '../../lib/evidence/types';

export const evidenceWithCitationsFixture: EvidencePack = {
	query: 'Runa UI stack',
	results: 3,
	searches: 1,
	sources: [
		{
			canonical_url: 'https://techcrunch.com/',
			domain: 'techcrunch.com',
			favicon: 'https://www.google.com/s2/favicons?domain=techcrunch.com&sz=64',
			id: '1',
			published_at: null,
			snippet: 'Example technology source.',
			title: 'TechCrunch',
			trust_score: 0.8,
			url: 'https://techcrunch.com/',
		},
		{
			canonical_url: 'https://github.com/',
			domain: 'github.com',
			favicon: 'https://www.google.com/s2/favicons?domain=github.com&sz=64',
			id: '2',
			published_at: null,
			snippet: 'Example repository source.',
			title: 'GitHub',
			trust_score: 0.9,
			url: 'https://github.com/',
		},
		{
			canonical_url: 'https://news.ycombinator.com/',
			domain: 'news.ycombinator.com',
			favicon: 'https://www.google.com/s2/favicons?domain=news.ycombinator.com&sz=64',
			id: '3',
			published_at: null,
			snippet: 'Example discussion source.',
			title: 'Hacker News',
			trust_score: 0.7,
			url: 'https://news.ycombinator.com/',
		},
	],
	truncated: false,
};
