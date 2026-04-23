import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PLUGIN_MANIFEST_FILE_NAME, RUNA_PLUGIN_DIRS_ENV_KEY } from '../plugins/manifest.js';
import { createToolRegistryFromEnvironment } from './runtime-dependencies.js';

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
});
