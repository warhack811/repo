import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { discoverMcpToolsSync } from './registry-bridge.js';

const fakeServerPath = resolve(process.cwd(), 'src/mcp/test-fixtures/fake-mcp-server.mjs');

describe('discoverMcpToolsSync', () => {
	it('maps MCP tools into ToolDefinition instances without overriding built-ins', async () => {
		const tools = discoverMcpToolsSync([
			{
				args: [fakeServerPath],
				command: process.execPath,
				id: 'fixture',
			},
		]);

		expect(tools).toHaveLength(2);
		expect(tools.map((tool) => tool.name)).toEqual([
			'mcp.fixture.echo_text',
			'mcp.fixture.unsupported_object',
		]);
		expect(tools[0]?.metadata).toEqual({
			capability_class: 'external',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'execute',
			tags: ['external', 'mcp', 'fixture', 'echo_text'],
		});
		expect(tools[0]?.callable_schema).toEqual({
			parameters: {
				message: {
					description: 'Message to echo',
					required: true,
					type: 'string',
				},
			},
		});

		await expect(
			tools[0]?.execute(
				{
					arguments: {
						message: 'bridge',
					},
					call_id: 'call-1',
					tool_name: 'mcp.fixture.echo_text',
				},
				{
					run_id: 'run-1',
					trace_id: 'trace-1',
				},
			),
		).resolves.toEqual({
			call_id: 'call-1',
			metadata: {
				mcp_server_id: 'fixture',
				mcp_tool_name: 'echo_text',
				trace_id: 'trace-1',
			},
			output: {
				content: [
					{
						text: 'echo:bridge',
						type: 'text',
					},
				],
				structured_content: {
					echoed: 'bridge',
				},
			},
			status: 'success',
			tool_name: 'mcp.fixture.echo_text',
		});
	});
});
