import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
	type DesktopAgentPersistedSession,
	normalizeDesktopAgentPersistedSession,
} from './auth.js';
import type { DesktopAgentSessionStorage } from './session.js';

export class FileDesktopAgentSessionStorage implements DesktopAgentSessionStorage {
	readonly #filePath: string;

	constructor(userDataDirectory: string) {
		this.#filePath = join(userDataDirectory, 'desktop-session.json');
	}

	async clear(): Promise<void> {
		await rm(this.#filePath, { force: true });
	}

	async load(): Promise<DesktopAgentPersistedSession | null> {
		let rawValue: string;

		try {
			rawValue = await readFile(this.#filePath, 'utf8');
		} catch (error: unknown) {
			if (
				typeof error === 'object' &&
				error !== null &&
				'code' in error &&
				error.code === 'ENOENT'
			) {
				return null;
			}

			throw error;
		}

		const parsedValue = JSON.parse(rawValue) as unknown;
		return normalizeDesktopAgentPersistedSession(parsedValue as DesktopAgentPersistedSession);
	}

	async save(session: DesktopAgentPersistedSession): Promise<void> {
		const normalizedSession = normalizeDesktopAgentPersistedSession(session);
		const directory = dirname(this.#filePath);
		const temporaryPath = `${this.#filePath}.${process.pid}.tmp`;

		await mkdir(directory, { recursive: true });
		await writeFile(temporaryPath, JSON.stringify(normalizedSession), 'utf8');
		await rename(temporaryPath, this.#filePath);
	}
}

export function createFileDesktopAgentSessionStorage(
	userDataDirectory: string,
): FileDesktopAgentSessionStorage {
	return new FileDesktopAgentSessionStorage(userDataDirectory);
}
