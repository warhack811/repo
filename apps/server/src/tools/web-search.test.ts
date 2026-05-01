import { describe, expect, it, vi } from 'vitest';

import { createWebSearchTool } from './web-search.js';

function createInput(
	query: string,
	options?: {
		readonly freshness_required?: boolean;
		readonly locale?: string;
		readonly max_results?: number;
		readonly search_type?: string;
	},
) {
	return {
		arguments: {
			freshness_required: options?.freshness_required,
			locale: options?.locale,
			max_results: options?.max_results,
			query,
			search_type: options?.search_type,
		},
		call_id: 'call_web_search',
		tool_name: 'web.search' as const,
	};
}

describe('webSearchTool', () => {
	it('returns a typed transport-compatible error when SERPER_API_KEY is missing', async () => {
		const tool = createWebSearchTool({
			environment: {},
			fetch: vi.fn(),
		});

		const result = await tool.execute(createInput('latest runa release'), {
			run_id: 'run_web_search_missing_key',
			trace_id: 'trace_web_search_missing_key',
		});

		expect(result).toMatchObject({
			details: {
				reason: 'provider_request_failed',
				transport_error_code: 'network-cut',
			},
			error_code: 'EXECUTION_FAILED',
			retryable: false,
			status: 'error',
			tool_name: 'web.search',
		});
	});

	it('rejects blank queries, oversized query text, invalid search_type, and invalid locale', async () => {
		const tool = createWebSearchTool({
			environment: {
				SERPER_API_KEY: 'serper-key',
			},
			fetch: vi.fn(),
		});

		const blankQueryResult = await tool.execute(createInput('   '), {
			run_id: 'run_web_search_blank',
			trace_id: 'trace_web_search_blank',
		});
		const oversizedQueryResult = await tool.execute(createInput('x'.repeat(161)), {
			run_id: 'run_web_search_oversized',
			trace_id: 'trace_web_search_oversized',
		});
		const invalidSearchTypeResult = await tool.execute(
			createInput('latest runa release', {
				search_type: 'images',
			}),
			{
				run_id: 'run_web_search_invalid_search_type',
				trace_id: 'trace_web_search_invalid_search_type',
			},
		);
		const invalidLocaleResult = await tool.execute(
			createInput('latest runa release', {
				locale: 'turkish',
			}),
			{
				run_id: 'run_web_search_invalid_locale',
				trace_id: 'trace_web_search_invalid_locale',
			},
		);

		expect(blankQueryResult).toMatchObject({
			details: {
				reason: 'invalid_query',
			},
			error_code: 'INVALID_INPUT',
		});
		expect(oversizedQueryResult).toMatchObject({
			details: {
				reason: 'invalid_query',
			},
			error_code: 'INVALID_INPUT',
		});
		expect(invalidSearchTypeResult).toMatchObject({
			details: {
				reason: 'invalid_search_type',
			},
			error_code: 'INVALID_INPUT',
		});
		expect(invalidLocaleResult).toMatchObject({
			details: {
				reason: 'invalid_locale',
			},
			error_code: 'INVALID_INPUT',
		});
	});

	it('routes general searches through EvidenceCompiler and returns EvidencePack-shaped output', async () => {
		const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
			const bodyText = typeof init?.body === 'string' ? init.body : '';

			expect(bodyText).toContain('"hl":"tr"');
			expect(bodyText).toContain('"gl":"tr"');

			return new Response(
				JSON.stringify({
					organic: [
						{
							date: '2 days ago',
							displayedLink: 'https://www.wikipedia.org/wiki/Runa?utm_source=x',
							link: 'https://www.wikipedia.org/wiki/Runa?utm_source=x&gclid=bad',
							position: 1,
							snippet: 'Runa background.',
							title: 'Runa - Wikipedia',
						},
						{
							link: 'https://example.com/post',
							position: 2,
							snippet: 'General article.',
							title: 'Runa article',
						},
					],
				}),
				{ status: 200 },
			);
		});
		const tool = createWebSearchTool({
			environment: {
				SERPER_API_KEY: 'serper-key',
			},
			fetch: fetchMock,
		});

		const result = await tool.execute(createInput('Runa nedir', { max_results: 2 }), {
			run_id: 'run_web_search_evidence',
			trace_id: 'trace_web_search_evidence',
		});

		expect(result.status).toBe('success');

		if (result.status !== 'success') {
			throw new Error('Expected web.search to succeed.');
		}

		expect(result.output.evidence).toMatchObject({
			query: 'Runa nedir',
			results: 2,
			searches: 1,
			truncated: false,
		});
		expect(result.output.evidence.sources[0]).toMatchObject({
			canonical_url: 'https://wikipedia.org/wiki/Runa',
			domain: 'wikipedia.org',
			published_at: expect.any(String),
			trust_score: 0.95,
		});
		expect(result.output.results[0]).toMatchObject({
			canonical_url: 'https://wikipedia.org/wiki/Runa',
			trust_tier: 'official',
		});
		expect(result.output.model_context).toContain('Runa - Wikipedia');
	});

	it('uses news endpoint and freshness parameters for news intent', async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			expect(String(url)).toBe('https://serper.example/news');

			const bodyText = typeof init?.body === 'string' ? init.body : '';

			expect(bodyText).toContain('"tbs":"qdr:m"');
			expect(bodyText).toContain('"q":"son dakika Runa"');

			return new Response(
				JSON.stringify({
					news: [
						{
							date: '1 hour ago',
							link: 'https://www.reuters.com/world/runa-update',
							position: 1,
							snippet: 'Fresh update.',
							source: 'Reuters',
							title: 'Runa update',
						},
					],
				}),
				{ status: 200 },
			);
		});
		const tool = createWebSearchTool({
			environment: {
				SERPER_API_KEY: 'serper-key',
				SERPER_ENDPOINT: 'https://serper.example/search',
			},
			fetch: fetchMock,
		});

		const result = await tool.execute(
			createInput('son dakika Runa', {
				freshness_required: true,
				locale: 'tr-TR',
			}),
			{
				run_id: 'run_web_search_news',
				trace_id: 'trace_web_search_news',
			},
		);

		expect(result.status).toBe('success');

		if (result.status !== 'success') {
			throw new Error('Expected news search to succeed.');
		}

		expect(result.output.freshness_note).toBe(
			'News intent detected; recency ranking penalizes missing or stale provider dates.',
		);
		expect(result.output.sources[0]?.domain).toBe('reuters.com');
	});

	it('surfaces provider rate limits as catalog-compatible transport details', async () => {
		const tool = createWebSearchTool({
			environment: {
				SERPER_API_KEY: 'serper-key',
			},
			fetch: vi.fn(async () => new Response('Too many requests', { status: 429 })),
		});

		const result = await tool.execute(createInput('latest runa release'), {
			run_id: 'run_web_search_rate_limit',
			trace_id: 'trace_web_search_rate_limit',
		});

		expect(result).toMatchObject({
			details: {
				transport_error_code: 'rate-limit',
			},
			error_code: 'EXECUTION_FAILED',
			retryable: true,
			status: 'error',
		});
	});
});
