import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FileDesktopAgentSettingsStore, defaultDesktopAgentSettings } from './settings-store.js';

describe('FileDesktopAgentSettingsStore', () => {
	it('loads defaults when settings do not exist', async () => {
		const userDataDirectory = await mkdtemp(join(tmpdir(), 'runa-settings-default-'));

		try {
			const store = new FileDesktopAgentSettingsStore(userDataDirectory);
			expect(await store.load()).toEqual(defaultDesktopAgentSettings);
		} finally {
			await rm(userDataDirectory, { force: true, recursive: true });
		}
	});

	it('updates settings with atomic JSON writes', async () => {
		const userDataDirectory = await mkdtemp(join(tmpdir(), 'runa-settings-update-'));

		try {
			const store = new FileDesktopAgentSettingsStore(userDataDirectory);
			const nextSettings = await store.update({
				autoStart: false,
				openWindowOnStart: true,
			});

			expect(nextSettings).toEqual({
				autoStart: false,
				openWindowOnStart: true,
				telemetryOptIn: false,
			});
			expect(JSON.parse(await readFile(join(userDataDirectory, 'settings.json'), 'utf8'))).toEqual(
				nextSettings,
			);
		} finally {
			await rm(userDataDirectory, { force: true, recursive: true });
		}
	});

	it('normalizes malformed persisted settings', async () => {
		const userDataDirectory = await mkdtemp(join(tmpdir(), 'runa-settings-invalid-'));

		try {
			await writeFile(
				join(userDataDirectory, 'settings.json'),
				JSON.stringify({
					autoStart: 'yes',
					openWindowOnStart: true,
					telemetryOptIn: 'no',
				}),
				'utf8',
			);

			const store = new FileDesktopAgentSettingsStore(userDataDirectory);
			expect(await store.load()).toEqual({
				autoStart: true,
				openWindowOnStart: true,
				telemetryOptIn: false,
			});
		} finally {
			await rm(userDataDirectory, { force: true, recursive: true });
		}
	});
});
