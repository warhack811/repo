import { describe, expect, it, vi } from 'vitest';

import { SerperProvider } from './serper.js';

describe('SerperProvider', () => {
	it('maps general results into RawSearchResult records', async () => {
		const fetchMock = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					organic: [
						{
							date: 'Apr 30, 2026',
							displayedLink: 'example.com/page',
							link: 'https://example.com/page',
							position: 2,
							snippet: 'Snippet.',
							title: 'Example',
						},
					],
				}),
				{ status: 200 },
			);
		});
		const provider = new SerperProvider({
			environment: {
				SERPER_API_KEY: 'serper-key',
			},
			fetch: fetchMock,
		});

		await expect(
			provider.search('Python nedir', {
				intent: 'general',
				top_k: 3,
			}),
		).resolves.toEqual([
			{
				displayed_url: 'example.com/page',
				position: 2,
				provider: 'serper',
				raw: expect.any(Object),
				raw_date: 'Apr 30, 2026',
				snippet: 'Snippet.',
				source: 'example.com',
				title: 'Example',
				url: 'https://example.com/page',
			},
		]);
	});

	it('uses the news endpoint for news intent and forwards Turkish locale options', async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			expect(String(url)).toBe('https://serper.example/news');

			const bodyText = typeof init?.body === 'string' ? init.body : '';

			expect(bodyText).toContain('"hl":"tr"');
			expect(bodyText).toContain('"gl":"tr"');
			expect(bodyText).toContain('"tbs":"qdr:d"');

			return new Response(JSON.stringify({ news: [] }), { status: 200 });
		});
		const provider = new SerperProvider({
			environment: {
				SERPER_API_KEY: 'serper-key',
				SERPER_ENDPOINT: 'https://serper.example/search',
			},
			fetch: fetchMock,
		});

		await provider.search('bugün hava', {
			country: 'tr',
			freshness: 'day',
			intent: 'news',
			locale: 'tr-TR',
			top_k: 5,
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('maps 401, 429, timeout, and network failures to transport errors', async () => {
		const unauthorizedProvider = new SerperProvider({
			environment: { SERPER_API_KEY: 'serper-key' },
			fetch: vi.fn(async () => new Response('Unauthorized', { status: 401 })),
		});
		const rateLimitedProvider = new SerperProvider({
			environment: { SERPER_API_KEY: 'serper-key' },
			fetch: vi.fn(async () => new Response('Rate limit', { status: 429 })),
		});
		const timeoutProvider = new SerperProvider({
			environment: { SERPER_API_KEY: 'serper-key' },
			fetch: vi.fn(
				async (_url: string | URL | Request, init?: RequestInit) =>
					new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener('abort', () => {
							reject(new DOMException('Aborted', 'AbortError'));
						});
					}),
			),
			timeout_ms: 1,
		});
		const networkProvider = new SerperProvider({
			environment: { SERPER_API_KEY: 'serper-key' },
			fetch: vi.fn(async () => {
				throw new TypeError('fetch failed');
			}),
		});
		const input = {
			intent: 'general' as const,
			top_k: 1,
		};

		await expect(unauthorizedProvider.search('x', input)).rejects.toMatchObject({
			transport_error_code: 'network-cut',
		});
		await expect(rateLimitedProvider.search('x', input)).rejects.toMatchObject({
			transport_error_code: 'rate-limit',
		});
		await expect(timeoutProvider.search('x', input)).rejects.toMatchObject({
			transport_error_code: 'timeout',
		});
		await expect(networkProvider.search('x', input)).rejects.toMatchObject({
			transport_error_code: 'network-cut',
		});
	});
});
