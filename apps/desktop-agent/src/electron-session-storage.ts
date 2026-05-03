import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
	type DesktopAgentPersistedSession,
	normalizeDesktopAgentPersistedSession,
} from './auth.js';
import type { DesktopAgentSessionStorage } from './session.js';

export interface DesktopAgentSafeStorage {
	decryptString(encryptedBuffer: Buffer): string;
	encryptString(plainText: string): Buffer;
}

export interface DesktopAgentSafeStorageAvailability extends DesktopAgentSafeStorage {
	isEncryptionAvailable(): boolean;
}

export interface DesktopAgentSessionStorageLogger {
	warn(message: string): void;
}

export interface DesktopAgentSessionStorageSelection {
	readonly insecure_storage: boolean;
	readonly storage: DesktopAgentSessionStorage;
}

const noopSessionStorageLogger: DesktopAgentSessionStorageLogger = {
	warn: () => {},
};

function isNodeErrorWithCode(error: unknown, code: string): boolean {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSessionFromUnknown(value: unknown): DesktopAgentPersistedSession {
	if (!isRecord(value) || typeof value['access_token'] !== 'string') {
		throw new Error('Desktop agent session storage contained an invalid payload.');
	}

	return normalizeDesktopAgentPersistedSession({
		access_token: value['access_token'],
		expires_at: typeof value['expires_at'] === 'number' ? value['expires_at'] : undefined,
		expires_in: typeof value['expires_in'] === 'number' ? value['expires_in'] : undefined,
		refresh_token: typeof value['refresh_token'] === 'string' ? value['refresh_token'] : undefined,
		token_type: typeof value['token_type'] === 'string' ? value['token_type'] : undefined,
	});
}

async function atomicWrite(filePath: string, body: string | Buffer): Promise<void> {
	const directory = dirname(filePath);
	const temporaryPath = `${filePath}.${process.pid}.tmp`;

	await mkdir(directory, { recursive: true });
	await writeFile(temporaryPath, body);
	await rename(temporaryPath, filePath);
}

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
			if (isNodeErrorWithCode(error, 'ENOENT')) {
				return null;
			}

			throw error;
		}

		return normalizeSessionFromUnknown(JSON.parse(rawValue));
	}

	async save(session: DesktopAgentPersistedSession): Promise<void> {
		const normalizedSession = normalizeDesktopAgentPersistedSession(session);
		await atomicWrite(this.#filePath, JSON.stringify(normalizedSession));
	}
}

export class EncryptedDesktopAgentSessionStorage implements DesktopAgentSessionStorage {
	readonly #encryptedFilePath: string;
	readonly #legacyStorage: FileDesktopAgentSessionStorage;
	readonly #legacyFilePath: string;
	readonly #logger: DesktopAgentSessionStorageLogger;
	readonly #safeStorage: DesktopAgentSafeStorage;

	constructor(
		userDataDirectory: string,
		safeStorage: DesktopAgentSafeStorage,
		logger: DesktopAgentSessionStorageLogger = noopSessionStorageLogger,
	) {
		this.#encryptedFilePath = join(userDataDirectory, 'desktop-session.bin');
		this.#legacyFilePath = join(userDataDirectory, 'desktop-session.json');
		this.#legacyStorage = new FileDesktopAgentSessionStorage(userDataDirectory);
		this.#logger = logger;
		this.#safeStorage = safeStorage;
	}

	async clear(): Promise<void> {
		await rm(this.#encryptedFilePath, { force: true });
		await rm(this.#legacyFilePath, { force: true });
	}

	async load(): Promise<DesktopAgentPersistedSession | null> {
		let encryptedValue: Buffer;

		try {
			encryptedValue = await readFile(this.#encryptedFilePath);
		} catch (error: unknown) {
			if (isNodeErrorWithCode(error, 'ENOENT')) {
				return await this.#migrateLegacySession();
			}

			throw error;
		}

		const decryptedValue = this.#safeStorage.decryptString(encryptedValue);
		return normalizeSessionFromUnknown(JSON.parse(decryptedValue));
	}

	async save(session: DesktopAgentPersistedSession): Promise<void> {
		const normalizedSession = normalizeDesktopAgentPersistedSession(session);
		const encryptedValue = this.#safeStorage.encryptString(JSON.stringify(normalizedSession));
		await atomicWrite(this.#encryptedFilePath, encryptedValue);
	}

	async #migrateLegacySession(): Promise<DesktopAgentPersistedSession | null> {
		const legacySession = await this.#legacyStorage.load();

		if (!legacySession) {
			return null;
		}

		await this.save(legacySession);
		await rm(this.#legacyFilePath, { force: true });
		this.#logger.warn('Migrated legacy plaintext desktop session storage.');
		return legacySession;
	}
}

export function createFileDesktopAgentSessionStorage(
	userDataDirectory: string,
): FileDesktopAgentSessionStorage {
	return new FileDesktopAgentSessionStorage(userDataDirectory);
}

export function createEncryptedDesktopAgentSessionStorage(
	userDataDirectory: string,
	safeStorage: DesktopAgentSafeStorage,
	logger?: DesktopAgentSessionStorageLogger,
): EncryptedDesktopAgentSessionStorage {
	return new EncryptedDesktopAgentSessionStorage(userDataDirectory, safeStorage, logger);
}

export function createDesktopAgentSessionStorageForSafeStorage(input: {
	readonly logger?: DesktopAgentSessionStorageLogger;
	readonly safeStorage: DesktopAgentSafeStorageAvailability;
	readonly userDataDirectory: string;
}): DesktopAgentSessionStorageSelection {
	if (!input.safeStorage.isEncryptionAvailable()) {
		input.logger?.warn('OS keychain unavailable; falling back to plaintext storage.');
		return {
			insecure_storage: true,
			storage: createFileDesktopAgentSessionStorage(input.userDataDirectory),
		};
	}

	return {
		insecure_storage: false,
		storage: createEncryptedDesktopAgentSessionStorage(
			input.userDataDirectory,
			input.safeStorage,
			input.logger,
		),
	};
}
