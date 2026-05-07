import { describe, expect, it } from 'vitest';

import { maskSecret, parseEnvFileText, resolveEnvAuthority } from './env-authority.js';

describe('env authority resolver', () => {
	it('lets process env win over file-backed values', () => {
		const result = resolveEnvAuthority({
			env: { DEEPSEEK_API_KEY: 'process-secret' },
			files: [{ label: '.env', values: { DEEPSEEK_API_KEY: 'file-secret' } }],
			name: 'DEEPSEEK_API_KEY',
			required: true,
		});

		expect(result.value).toBe('process-secret');
		expect(result.report.source).toBe('process_env');
		expect(result.report.resolved_from).toBe('DEEPSEEK_API_KEY');
		expect(result.report.missing_required_names).toEqual([]);
	});

	it('lets .env.local win over .env', () => {
		const result = resolveEnvAuthority({
			env: {},
			files: [
				{ label: '.env', values: { GROQ_API_KEY: 'env-secret' } },
				{ label: '.env.local', values: { GROQ_API_KEY: 'local-secret' } },
			],
			name: 'GROQ_API_KEY',
		});

		expect(result.value).toBe('local-secret');
		expect(result.report.source).toBe('.env.local');
	});

	it('falls back to .env', () => {
		const result = resolveEnvAuthority({
			env: {},
			files: [{ label: '.env', values: { GROQ_API_KEY: 'env-secret' } }],
			name: 'GROQ_API_KEY',
		});

		expect(result.value).toBe('env-secret');
		expect(result.report.source).toBe('.env');
	});

	it('falls back to .env.compose', () => {
		const result = resolveEnvAuthority({
			env: {},
			files: [{ label: '.env.compose', values: { DATABASE_URL: 'postgres://secret' } }],
			name: 'DATABASE_URL',
		});

		expect(result.value).toBe('postgres://secret');
		expect(result.report.source).toBe('.env.compose');
	});

	it('reports missing required variables without a value', () => {
		const result = resolveEnvAuthority({
			env: {},
			files: [],
			name: 'DEEPSEEK_API_KEY',
			required: true,
		});

		expect(result.value).toBeUndefined();
		expect(result.report.source).toBe('missing');
		expect(result.report.missing_required_names).toEqual(['DEEPSEEK_API_KEY']);
	});

	it('reports default value authority separately from real credentials', () => {
		const result = resolveEnvAuthority({
			defaultValue: 'deepseek-v4-flash',
			env: {},
			name: 'DEEPSEEK_FAST_MODEL',
		});

		expect(result.value).toBe('deepseek-v4-flash');
		expect(result.report.source).toBe('default');
		expect(result.report.authoritative).toBe(false);
	});

	it('prefers client config before server env for gateway requests', () => {
		const result = resolveEnvAuthority({
			clientValue: 'client-secret',
			env: { GROQ_API_KEY: 'server-secret' },
			name: 'GROQ_API_KEY',
		});

		expect(result.value).toBe('client-secret');
		expect(result.report.source).toBe('client_config');
	});

	it('masks secrets without exposing the raw value', () => {
		const secret = 'sk-test-1234567890';
		const masked = maskSecret(secret);

		expect(masked).toBe('sk-t...7890');
		expect(masked).not.toContain(secret);
	});

	it('parses quoted env file values and skips comments', () => {
		expect(
			parseEnvFileText(`
				# comment
				EMPTY=
				GROQ_API_KEY="quoted-secret"
				// ignored
			`),
		).toEqual({ GROQ_API_KEY: 'quoted-secret' });
	});
});
