import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadShellOutputRedactionContext, redactShellOutput } from './shell-output-redaction.js';

async function createTempWorkspace(): Promise<string> {
	return mkdtemp(join(tmpdir(), 'runa-shell-redaction-'));
}

describe('shell output redaction', () => {
	it('redacts sensitive process env values without exposing the raw value', () => {
		const secretValue = 'runa_process_secret_value_123456789';
		const result = redactShellOutput(`token=${secretValue}`, {
			env: {
				RUNA_TEST_SECRET_KEY: secretValue,
			},
		});

		expect(result.text).toBe('token=[REDACTED_SECRET]');
		expect(result.text).not.toContain(secretValue);
		expect(result.metadata).toMatchObject({
			redaction_applied: true,
			redacted_occurrence_count: 1,
			redacted_source_kinds: ['process_env'],
			secret_values_exposed: false,
		});
	});

	it('redacts sensitive env-file values loaded from the workspace', async () => {
		const workspace = await createTempWorkspace();
		const secretValue = 'runa_file_secret_value_123456789';

		try {
			await writeFile(join(workspace, '.env.local'), `RUNA_FILE_SECRET_KEY=${secretValue}\n`);

			const context = await loadShellOutputRedactionContext(workspace, {});
			const result = redactShellOutput(`file=${secretValue}`, context);

			expect(result.text).toBe('file=[REDACTED_SECRET]');
			expect(result.text).not.toContain(secretValue);
			expect(result.metadata.redacted_source_kinds).toEqual(['.env.local']);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('does not redact short or low-signal env values', () => {
		const result = redactShellOutput('mode=local enabled=true code=abc123', {
			env: {
				RUNA_TEST_SECRET_KEY: 'abc123',
				RUNA_TOKEN_MODE: 'local',
			},
		});

		expect(result.text).toBe('mode=local enabled=true code=abc123');
		expect(result.metadata).toMatchObject({
			redaction_applied: false,
			redacted_occurrence_count: 0,
			secret_values_exposed: false,
		});
	});

	it('redacts database URL password segments', () => {
		const databaseUrl = 'postgres://user:database_password_12345@localhost:5432/runa';
		const result = redactShellOutput(databaseUrl, {});

		expect(result.text).toBe('postgres://user:[REDACTED_DATABASE_PASSWORD]@localhost:5432/runa');
		expect(result.text).not.toContain('database_password_12345');
		expect(result.metadata.redacted_source_kinds).toEqual(['database_url_password']);
	});

	it('redacts common token patterns without an env corpus', () => {
		const groqToken = 'gsk_1234567890abcdefghijklmnopqrstuvwxyz';
		const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJydW5hIn0.signature_segment_123456789';
		const result = redactShellOutput(`${groqToken}\n${jwt}`, {});

		expect(result.text).not.toContain(groqToken);
		expect(result.text).not.toContain(jwt);
		expect(result.metadata).toMatchObject({
			redaction_applied: true,
			redacted_occurrence_count: 2,
			redacted_source_kinds: ['token_pattern'],
			secret_values_exposed: false,
		});
	});
});
