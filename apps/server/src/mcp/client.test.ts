import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { McpClient } from './client.js';

const fakeServerPath = resolve(process.cwd(), 'src/mcp/test-fixtures/fake-mcp-server.mjs');

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
});
