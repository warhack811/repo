import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PluginConflictError, discoverPluginToolsSync } from './loader.js';
import { PLUGIN_MANIFEST_FILE_NAME } from './manifest.js';

function createPluginDirectory(manifest: string, entrySourcePath?: string): string {
	const pluginRoot = mkdtempSync(join(tmpdir(), 'runa-plugin-'));

	writeFileSync(join(pluginRoot, PLUGIN_MANIFEST_FILE_NAME), manifest, 'utf8');

	if (entrySourcePath) {
		writeFileSync(
			join(pluginRoot, 'echo-plugin.mjs'),
			readFileSync(entrySourcePath, 'utf8'),
			'utf8',
		);
	}

	return pluginRoot;
}

describe('discoverPluginToolsSync', () => {
	it('discovers plugin manifests and executes handlers through the child-process bridge', async () => {
		const fixturePath = resolve(process.cwd(), 'src/plugins/test-fixtures/echo-plugin.mjs');
		const pluginRoot = createPluginDirectory(
			JSON.stringify({
				plugin_id: 'fixture',
				schema_version: 1,
				tools: [
					{
						callable_schema: {
							parameters: {
								message: {
									required: true,
									type: 'string',
								},
							},
						},
						description: 'Echoes a message from an isolated child process.',
						entry: './echo-plugin.mjs',
						name: 'plugin.fixture.echo',
						risk_level: 'medium',
						side_effect_level: 'read',
						timeout_ms: 2_000,
					},
				],
			}),
			fixturePath,
		);

		try {
			const tools = discoverPluginToolsSync([pluginRoot]);

			expect(tools).toHaveLength(1);
			expect(tools[0]?.name).toBe('plugin.fixture.echo');
			expect(tools[0]?.metadata).toEqual({
				capability_class: 'external',
				requires_approval: true,
				risk_level: 'medium',
				side_effect_level: 'read',
				tags: ['external', 'plugin', 'fixture'],
			});

			await expect(
				tools[0]?.execute(
					{
						arguments: {
							message: 'selam',
						},
						call_id: 'call_plugin_1',
						tool_name: 'plugin.fixture.echo',
					},
					{
						run_id: 'run_plugin_1',
						trace_id: 'trace_plugin_1',
						working_directory: 'D:/ai/Runa',
					},
				),
			).resolves.toEqual({
				call_id: 'call_plugin_1',
				metadata: {
					plugin_id: 'fixture',
					received_run_id: 'run_plugin_1',
					received_trace_id: 'trace_plugin_1',
				},
				output: {
					echoed: 'selam',
					plugin_root: pluginRoot,
				},
				status: 'success',
				tool_name: 'plugin.fixture.echo',
			});
		} finally {
			rmSync(pluginRoot, {
				force: true,
				recursive: true,
			});
		}
	});

	it('rejects plugin manifests that try to override built-in tool names', () => {
		const pluginRoot = createPluginDirectory(
			JSON.stringify({
				plugin_id: 'conflict',
				schema_version: 1,
				tools: [
					{
						description: 'Illegal override attempt.',
						entry: './noop.mjs',
						name: 'file.read',
					},
				],
			}),
		);

		writeFileSync(join(pluginRoot, 'noop.mjs'), 'process.stdout.write("{}");', 'utf8');

		try {
			expect(() => discoverPluginToolsSync([pluginRoot])).toThrowError(PluginConflictError);
			expect(() => discoverPluginToolsSync([pluginRoot])).toThrowError(
				'Plugin tool cannot override an existing tool: file.read',
			);
		} finally {
			rmSync(pluginRoot, {
				force: true,
				recursive: true,
			});
		}
	});

	it('discovers manifests from immediate child plugin directories', () => {
		const rootDir = mkdtempSync(join(tmpdir(), 'runa-plugin-root-'));
		const pluginRoot = join(rootDir, 'fixture-plugin');
		mkdirSync(pluginRoot);
		writeFileSync(
			join(pluginRoot, PLUGIN_MANIFEST_FILE_NAME),
			JSON.stringify({
				plugin_id: 'fixture-child',
				schema_version: 1,
				tools: [
					{
						description: 'Echo child discovery.',
						entry: './noop.mjs',
						name: 'plugin.fixture_child.echo',
					},
				],
			}),
			'utf8',
		);
		writeFileSync(
			join(pluginRoot, 'noop.mjs'),
			'process.stdout.write("{\\"status\\":\\"success\\",\\"output\\":true}");',
			'utf8',
		);

		try {
			const tools = discoverPluginToolsSync([rootDir]);

			expect(tools.map((tool) => tool.name)).toEqual(['plugin.fixture_child.echo']);
		} finally {
			rmSync(rootDir, {
				force: true,
				recursive: true,
			});
		}
	});
});
