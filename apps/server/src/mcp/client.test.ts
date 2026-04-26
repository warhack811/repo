import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { McpClient, McpClientError } from './client.js';
import { McpConfigurationError, readMcpServerConfigsFromEnvironment } from './config.js';

const fakeServerPath = resolve(process.cwd(), 'src/mcp/test-fixtures/fake-mcp-server.mjs');

interface MockFetchCall {
	readonly body: string;
	readonly method: string;
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

function installFetchMock(response: Response) {
	const calls: MockFetchCall[] = [];
	const fetchMock = vi.fn(
		async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
			calls.push({
				body: typeof init?.body === 'string' ? init.body : '',
				method: init?.method ?? 'GET',
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

describe('McpClient', () => {
	it('lists tools from a stdio MCP server', () => {
		const client = new McpClient({
			args: [fakeServerPath],
			command: process.execPath,
			id: 'fixture',
		});

		expect(client.listToolsSync()).toEqual([
			{
				description: 'Echoes a text message back to the client.',
				input_schema: {
					parameters: {
						message: {
							description: 'Message to echo',
							required: true,
							type: 'string',
						},
					},
				},
				name: 'echo_text',
			},
			{
				description: 'Uses a nested object schema that the bridge should skip for now.',
				input_schema: {
					parameters: {},
				},
				name: 'unsupported_object',
			},
		]);
	});

	it('calls an MCP tool over stdio', async () => {
		const client = new McpClient({
			args: [fakeServerPath],
			command: process.execPath,
			id: 'fixture',
		});

		await expect(
			client.callTool({
				arguments: {
					message: 'hello',
				},
				name: 'echo_text',
			}),
		).resolves.toEqual({
			content: [
				{
					text: 'echo:hello',
					type: 'text',
				},
			],
			is_error: false,
			structured_content: {
				echoed: 'hello',
			},
		});
	});

	it('parses stdio and HTTP MCP config from the environment', () => {
		expect(
			readMcpServerConfigsFromEnvironment({
				RUNA_MCP_SERVERS: JSON.stringify([
					{
						args: ['server.mjs'],
						command: 'node',
						id: 'stdio-fixture',
					},
					{
						headers: {
							Authorization: 'Bearer secret',
							'x-runa-client': 'test',
						},
						id: 'http-fixture',
						transport: 'http',
						url: 'https://mcp.example.com/rpc',
					},
				]),
			}),
		).toEqual([
			{
				args: ['server.mjs'],
				command: 'node',
				env: undefined,
				headers: undefined,
				id: 'stdio-fixture',
				timeout_ms: undefined,
				transport: 'stdio',
			},
			{
				args: undefined,
				command: undefined,
				cwd: undefined,
				env: undefined,
				headers: {
					Authorization: 'Bearer secret',
					'x-runa-client': 'test',
				},
				id: 'http-fixture',
				timeout_ms: undefined,
				transport: 'http',
				url: 'https://mcp.example.com/rpc',
			},
		]);
	});

	it('rejects incomplete MCP transport configs', () => {
		expect(() =>
			readMcpServerConfigsFromEnvironment({
				RUNA_MCP_SERVERS: JSON.stringify([
					{
						id: 'missing-url',
						transport: 'http',
					},
				]),
			}),
		).toThrowError(McpConfigurationError);

		expect(() =>
			readMcpServerConfigsFromEnvironment({
				RUNA_MCP_SERVERS: JSON.stringify([
					{
						id: 'missing-command',
						transport: 'stdio',
					},
				]),
			}),
		).toThrowError(McpConfigurationError);
	});

	it('lists tools over HTTP with async listTools and keeps sync listing stdio-only', async () => {
		installFetchMock(
			mockJsonResponse(200, [
				{
					id: 'runa.initialize',
					jsonrpc: '2.0',
					result: {
						protocolVersion: '2025-03-26',
					},
				},
				{
					id: 'runa.tools.list',
					jsonrpc: '2.0',
					result: {
						tools: [
							{
								description: 'Remote echo',
								inputSchema: {
									properties: {
										message: {
											type: 'string',
										},
									},
									required: ['message'],
									type: 'object',
								},
								name: 'echo_text',
							},
						],
					},
				},
			]),
		);
		const client = new McpClient({
			id: 'remote',
			transport: 'http',
			url: 'https://mcp.example.com/rpc',
		});

		expect(() => client.listToolsSync()).toThrowError(McpClientError);
		await expect(client.listTools()).resolves.toEqual([
			{
				description: 'Remote echo',
				input_schema: {
					parameters: {
						message: {
							required: true,
							type: 'string',
						},
					},
				},
				name: 'echo_text',
			},
		]);
	});

	it('calls an MCP tool over HTTP', async () => {
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
						content: [
							{
								text: 'echo:http',
								type: 'text',
							},
						],
						isError: false,
						structuredContent: {
							echoed: 'http',
						},
					},
				},
			]),
		);
		const client = new McpClient({
			id: 'remote',
			transport: 'http',
			url: 'https://mcp.example.com/rpc',
		});

		await expect(
			client.callTool({
				arguments: {
					message: 'http',
				},
				name: 'echo_text',
			}),
		).resolves.toEqual({
			content: [
				{
					text: 'echo:http',
					type: 'text',
				},
			],
			is_error: false,
			structured_content: {
				echoed: 'http',
			},
		});

		const requestBody = JSON.parse(calls[0]?.body ?? '[]') as readonly {
			readonly method?: string;
		}[];
		expect(calls[0]?.method).toBe('POST');
		expect(requestBody.map((entry) => entry.method)).toEqual([
			'initialize',
			'notifications/initialized',
			'tools/call',
		]);
	});
});
