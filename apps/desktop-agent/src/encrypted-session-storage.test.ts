import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { DesktopAgentSafeStorageAvailability } from './electron-session-storage.js';

import {
	EncryptedDesktopAgentSessionStorage,
	createDesktopAgentSessionStorageForSafeStorage,
} from './electron-session-storage.js';

class XorSafeStorage implements DesktopAgentSafeStorageAvailability {
	readonly #available: boolean;

	constructor(available = true) {
		this.#available = available;
	}

	decryptString(encryptedBuffer: Buffer): string {
		return this.#xor(encryptedBuffer).toString('utf8');
	}

	encryptString(plainText: string): Buffer {
		return this.#xor(Buffer.from(plainText, 'utf8'));
	}

	isEncryptionAvailable(): boolean {
		return this.#available;
	}

	#xor(input: Buffer): Buffer {
		return Buffer.from(input.map((byte) => byte ^ 0xff));
	}
}

async function pathExists(filePath: string): Promise<boolean> {
	try {
		await stat(filePath);
		return true;
	} catch (error: unknown) {
		if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
			return false;
		}

		throw error;
	}
}

describe('EncryptedDesktopAgentSessionStorage', () => {
	it('saves, loads, clears, and keeps refresh tokens out of plaintext files', async () => {
		const userDataDirectory = await mkdtemp(join(tmpdir(), 'runa-session-encrypted-'));
		const safeStorage = new XorSafeStorage();
		const storage = new EncryptedDesktopAgentSessionStorage(userDataDirectory, safeStorage);

		try {
			await storage.save({
				access_token: 'access-token',
				expires_at: 1_770_000_000,
				refresh_token: 'refresh-token',
				token_type: 'bearer',
			});

			const encryptedPath = join(userDataDirectory, 'desktop-session.bin');
			const plaintextPath = join(userDataDirectory, 'desktop-session.json');
			const encryptedBody = await readFile(encryptedPath);

			expect(encryptedBody.toString('utf8')).not.toContain('refresh-token');
			expect(await pathExists(plaintextPath)).toBe(false);
			expect(await storage.load()).toEqual({
				access_token: 'access-token',
				expires_at: 1_770_000_000,
				refresh_token: 'refresh-token',
				token_type: 'bearer',
			});

			await storage.clear();
			expect(await pathExists(encryptedPath)).toBe(false);
		} finally {
			await rm(userDataDirectory, { force: true, recursive: true });
		}
	});

	it('migrates legacy plaintext JSON only after encrypted write succeeds', async () => {
		const userDataDirectory = await mkdtemp(join(tmpdir(), 'runa-session-migrate-'));
		const safeStorage = new XorSafeStorage();
		const storage = new EncryptedDesktopAgentSessionStorage(userDataDirectory, safeStorage);

		try {
			const plaintextPath = join(userDataDirectory, 'desktop-session.json');
			const encryptedPath = join(userDataDirectory, 'desktop-session.bin');
			await writeFile(
				plaintextPath,
				JSON.stringify({
					access_token: 'legacy-access',
					refresh_token: 'legacy-refresh',
				}),
				'utf8',
			);

			expect(await storage.load()).toEqual({
				access_token: 'legacy-access',
				refresh_token: 'legacy-refresh',
			});
			expect(await pathExists(plaintextPath)).toBe(false);
			expect(await pathExists(encryptedPath)).toBe(true);
		} finally {
			await rm(userDataDirectory, { force: true, recursive: true });
		}
	});

	it('selects plaintext fallback when OS encryption is unavailable', async () => {
		const userDataDirectory = await mkdtemp(join(tmpdir(), 'runa-session-fallback-'));
		const warnings: string[] = [];

		try {
			const selection = createDesktopAgentSessionStorageForSafeStorage({
				logger: {
					warn: (message) => {
						warnings.push(message);
					},
				},
				safeStorage: new XorSafeStorage(false),
				userDataDirectory,
			});

			expect(selection.insecure_storage).toBe(true);
			expect(warnings).toEqual(['OS keychain unavailable; falling back to plaintext storage.']);

			await selection.storage.save({
				access_token: 'plain-access',
				refresh_token: 'plain-refresh',
			});

			expect(await pathExists(join(userDataDirectory, 'desktop-session.json'))).toBe(true);
			expect(await pathExists(join(userDataDirectory, 'desktop-session.bin'))).toBe(false);
		} finally {
			await rm(userDataDirectory, { force: true, recursive: true });
		}
	});
});
