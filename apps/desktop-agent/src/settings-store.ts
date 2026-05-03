import type { DesktopAgentSettingsStoreState } from '@runa/types';

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const defaultDesktopAgentSettings: DesktopAgentSettingsStoreState = {
	autoStart: true,
	openWindowOnStart: false,
	telemetryOptIn: false,
};

export interface DesktopAgentSettingsStore {
	load(): Promise<DesktopAgentSettingsStoreState>;
	update(patch: Partial<DesktopAgentSettingsStoreState>): Promise<DesktopAgentSettingsStoreState>;
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSettings(value: unknown): DesktopAgentSettingsStoreState {
	if (!isRecord(value)) {
		return defaultDesktopAgentSettings;
	}

	return {
		autoStart:
			typeof value['autoStart'] === 'boolean'
				? value['autoStart']
				: defaultDesktopAgentSettings.autoStart,
		openWindowOnStart:
			typeof value['openWindowOnStart'] === 'boolean'
				? value['openWindowOnStart']
				: defaultDesktopAgentSettings.openWindowOnStart,
		telemetryOptIn:
			typeof value['telemetryOptIn'] === 'boolean'
				? value['telemetryOptIn']
				: defaultDesktopAgentSettings.telemetryOptIn,
	};
}

async function atomicWriteJson(
	filePath: string,
	settings: DesktopAgentSettingsStoreState,
): Promise<void> {
	const temporaryPath = `${filePath}.${process.pid}.tmp`;

	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(temporaryPath, JSON.stringify(settings, null, 2), 'utf8');
	await rename(temporaryPath, filePath);
}

export class FileDesktopAgentSettingsStore implements DesktopAgentSettingsStore {
	readonly #filePath: string;
	#settings: DesktopAgentSettingsStoreState | null = null;

	constructor(userDataDirectory: string) {
		this.#filePath = join(userDataDirectory, 'settings.json');
	}

	async load(): Promise<DesktopAgentSettingsStoreState> {
		if (this.#settings) {
			return { ...this.#settings };
		}

		let rawValue: string;

		try {
			rawValue = await readFile(this.#filePath, 'utf8');
		} catch (error: unknown) {
			if (isNodeErrorWithCode(error, 'ENOENT')) {
				this.#settings = defaultDesktopAgentSettings;
				return { ...this.#settings };
			}

			throw error;
		}

		try {
			this.#settings = normalizeSettings(JSON.parse(rawValue));
		} catch {
			this.#settings = defaultDesktopAgentSettings;
		}

		return { ...this.#settings };
	}

	async update(
		patch: Partial<DesktopAgentSettingsStoreState>,
	): Promise<DesktopAgentSettingsStoreState> {
		const currentSettings = await this.load();
		const nextSettings = normalizeSettings({
			...currentSettings,
			...patch,
		});

		await atomicWriteJson(this.#filePath, nextSettings);
		this.#settings = nextSettings;
		return { ...nextSettings };
	}

	async clear(): Promise<void> {
		this.#settings = null;
		await rm(this.#filePath, { force: true });
	}
}

export function createFileDesktopAgentSettingsStore(
	userDataDirectory: string,
): FileDesktopAgentSettingsStore {
	return new FileDesktopAgentSettingsStore(userDataDirectory);
}
