import { afterEach, describe, expect, it, vi } from 'vitest';

import { executeMcpHttpSession, redactMcpHttpHeaders } from './http-transport.js';
import { McpTransportError } from './stdio-transport.js';

interface MockFetchCall {
	readonly body: string;
	readonly headers: Readonly<Record<string, string>>;
	readonly method: string;
	readonly signal: AbortSignal | undefined;
	readonly url: string;
}

function mockJsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		headers: {
			'content-type': 'application/json',
		},
		status,
	});
}

function mockEventStreamResponse(events: readonly string[]): Response {
	return new Response(events.join('\n\n'), {
		headers: {
			'content-type': 'text/event-stream',
		},
		status: 200,
	});
}

function installFetchMock(response: Response) {
	const calls: MockFetchCall[] = [];
	const fetchMock = vi.fn(
		async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
			const signal = init?.signal ?? undefined;

			if (signal?.aborted === true) {
				throw signal.reason;
			}

			calls.push({
				body: typeof init?.body === 'string' ? init.body : '',
				headers: (init?.headers ?? {}) as Readonly<Record<string, string>>,
				method: init?.method ?? 'GET',
				signal,
				url: String(input),
			});

			return response;
		},
	);

	vi.stubGlobal('fetch', fetchMock);
	return { calls, fetchMock };
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('executeMcpHttpSession', () => {
	it('posts JSON-RPC batches with MCP HTTP headers and parses JSON responses', async () => {
		const { calls } = installFetchMock(
			mockJsonResponse(200, [
				{
					id: 'runa.initialize',
					jsonrpc: '2.0',
					result: {
						protocolVersion: '2025-03-26',
					},
				},
				{
					id: 'runa.tools.call',
					jsonrpc: '2.0',
					result: {
						content: [{ text: 'ok', type: 'text' }],
						isError: false,
					},
				},
			]),
		);

		const result = await executeMcpHttpSession(
			{
				headers: {
					Authorization: 'Bearer secret',
					'x-runa-client': 'test',
				},
				id: 'remote',
				transport: 'http',
				url: 'https://mcp.example.com/rpc',
			},
			[
				{ id: 'runa.initialize', jsonrpc: '2.0', method: 'initialize' },
				{ id: 'runa.tools.call', jsonrpc: '2.0', method: 'tools/call' },
			],
		);

		expect(calls[0]?.method).toBe('POST');
		expect(calls[0]?.url).toBe('https://mcp.example.com/rpc');
		expect(calls[0]?.headers).toMatchObject({
			Accept: 'application/json, text/event-stream',
			Authorization: 'Bearer secret',
			'Content-Type': 'application/json',
			'x-runa-client': 'test',
		});
		expect(JSON.parse(calls[0]?.body ?? '[]')).toEqual([
			{ id: 'runa.initialize', jsonrpc: '2.0', method: 'initialize' },
			{ id: 'runa.tools.call', jsonrpc: '2.0', method: 'tools/call' },
		]);
		expect(result).toEqual({
			responses: [
				{
					id: 'runa.initialize',
					jsonrpc: '2.0',
					result: {
						protocolVersion: '2025-03-26',
					},
				},
				{
					id: 'runa.tools.call',
					jsonrpc: '2.0',
					result: {
						content: [{ text: 'ok', type: 'text' }],
						isError: false,
					},
				},
			],
			stderr: '',
		});
	});

	it('parses JSON-RPC responses from text/event-stream frames', async () => {
		installFetchMock(
			mockEventStreamResponse([
				'event: message\ndata: {"jsonrpc":"2.0","id":"runa.initialize","result":{"protocolVersion":"2025-03-26"}}',
				'event: message\ndata: {"jsonrpc":"2.0","id":"runa.tools.list","result":{"tools":[]}}',
				'event: done\ndata: [DONE]',
			]),
		);

		await expect(
			executeMcpHttpSession(
				{
					id: 'remote',
					transport: 'http',
					url: 'https://mcp.example.com/rpc',
				},
				[{ id: 'runa.tools.list', jsonrpc: '2.0', method: 'tools/list' }],
			),
		).resolves.toEqual({
			responses: [
				{
					id: 'runa.initialize',
					jsonrpc: '2.0',
					result: { protocolVersion: '2025-03-26' },
				},
				{
					id: 'runa.tools.list',
					jsonrpc: '2.0',
					result: { tools: [] },
				},
			],
			stderr: '',
		});
	});

	it('redacts secret headers in transport error details', async () => {
		installFetchMock(mockJsonResponse(401, { error: 'unauthorized' }));

		await expect(
			executeMcpHttpSession(
				{
					headers: {
						Authorization: 'Bearer secret',
						'X-Api-Key': 'secret-key',
						'x-runa-client': 'safe-client',
					},
					id: 'remote',
					transport: 'http',
					url: 'https://mcp.example.com/rpc',
				},
				[],
			),
		).rejects.toMatchObject({
			details: {
				headers: {
					Authorization: '[REDACTED]',
					'X-Api-Key': '[REDACTED]',
					'x-runa-client': 'safe-client',
				},
				status: 401,
			},
		});

		expect(
			redactMcpHttpHeaders({
				Cookie: 'session=secret',
				'x-public': 'visible',
			}),
		).toEqual({
			Cookie: '[REDACTED]',
			'x-public': 'visible',
		});
	});

	it.each([
		'file:///tmp/mcp.sock',
		'http://localhost:8080/mcp',
		'http://127.0.0.1:8080/mcp',
		'http://10.0.0.2/mcp',
		'http://169.254.169.254/latest/meta-data',
		'http://user:pass@mcp.example.com/rpc',
	])('blocks unsafe HTTP MCP urls: %s', async (url) => {
		const { fetchMock } = installFetchMock(mockJsonResponse(200, {}));

		await expect(
			executeMcpHttpSession(
				{
					id: 'remote',
					transport: 'http',
					url,
				},
				[],
			),
		).rejects.toThrowError(McpTransportError);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('passes aborted signals through to fetch', async () => {
		const { fetchMock } = installFetchMock(mockJsonResponse(200, {}));
		const controller = new AbortController();
		controller.abort(new Error('cancelled'));

		await expect(
			executeMcpHttpSession(
				{
					id: 'remote',
					transport: 'http',
					url: 'https://mcp.example.com/rpc',
				},
				[],
				{
					signal: controller.signal,
				},
			),
		).rejects.toThrow('HTTP request failed');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
