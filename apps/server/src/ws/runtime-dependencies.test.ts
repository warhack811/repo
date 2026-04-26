import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLUGIN_MANIFEST_FILE_NAME, RUNA_PLUGIN_DIRS_ENV_KEY } from '../plugins/manifest.js';
import {
	createToolRegistryFromEnvironment,
	createToolRegistryFromEnvironmentAsync,
} from './runtime-dependencies.js';

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('createToolRegistryFromEnvironment', () => {
	it('adds plugin tools from RUNA_PLUGIN_DIRS without replacing built-ins', () => {
		const pluginRoot = mkdtempSync(join(tmpdir(), 'runa-runtime-plugin-'));
		const fixturePath = resolve(process.cwd(), 'src/plugins/test-fixtures/echo-plugin.mjs');

		writeFileSync(
			join(pluginRoot, PLUGIN_MANIFEST_FILE_NAME),
			JSON.stringify({
				plugin_id: 'runtime-fixture',
				schema_version: 1,
				tools: [
					{
						description: 'Runtime dependency plugin fixture.',
						entry: './echo-plugin.mjs',
						name: 'plugin.runtime_fixture.echo',
					},
				],
			}),
			'utf8',
		);
		writeFileSync(join(pluginRoot, 'echo-plugin.mjs'), readFileSync(fixturePath, 'utf8'), 'utf8');

		try {
			const registry = createToolRegistryFromEnvironment({
				[RUNA_PLUGIN_DIRS_ENV_KEY]: pluginRoot,
			});

			expect(registry.has('file.read')).toBe(true);
			expect(registry.has('plugin.runtime_fixture.echo')).toBe(true);
		} finally {
			rmSync(pluginRoot, {
				force: true,
				recursive: true,
			});
		}
	});

	it('adds HTTP MCP tools through the async environment registry path', async () => {
		const fetchMock = vi.fn(async () => {
			return new Response(
				JSON.stringify([
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
				{
					headers: {
						'content-type': 'application/json',
					},
					status: 200,
				},
			);
		});
		vi.stubGlobal('fetch', fetchMock);

		const registry = await createToolRegistryFromEnvironmentAsync({
			RUNA_MCP_SERVERS: JSON.stringify([
				{
					id: 'remote',
					transport: 'http',
					url: 'https://mcp.example.com/rpc',
				},
			]),
		});

		expect(registry.has('file.read')).toBe(true);
		expect(registry.has('mcp.remote.echo_text')).toBe(true);
		expect(registry.get('mcp.remote.echo_text')?.metadata).toEqual({
			capability_class: 'external',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'execute',
			tags: ['external', 'mcp', 'remote', 'echo_text'],
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
