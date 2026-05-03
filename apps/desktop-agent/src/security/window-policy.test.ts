import { describe, expect, it } from 'vitest';

import { isAllowedExternalUrl, readAllowedExternalUrlPolicy } from './window-policy.js';

describe('window external URL policy', () => {
	it('allows only https URLs on the default runa domains', () => {
		expect(isAllowedExternalUrl('https://runa.app/account')).toBe(true);
		expect(isAllowedExternalUrl('https://app.runa.app/chat')).toBe(true);
		expect(isAllowedExternalUrl('https://deep.app.runa.app/chat')).toBe(true);
		expect(isAllowedExternalUrl('http://runa.app/account')).toBe(false);
		expect(isAllowedExternalUrl('https://example.com/account')).toBe(false);
		expect(isAllowedExternalUrl('runa://desktop-pair?code=ABCD1234')).toBe(false);
	});

	it('reads a comma-separated allowlist from env', () => {
		const policy = readAllowedExternalUrlPolicy({
			RUNA_ALLOWED_EXTERNAL_DOMAINS: 'example.com, *.example.org, https://bad.example',
		});

		expect(policy.allowed_domains).toEqual(['example.com', '*.example.org']);
		expect(isAllowedExternalUrl('https://example.com/path', policy)).toBe(true);
		expect(isAllowedExternalUrl('https://app.example.org/path', policy)).toBe(true);
		expect(isAllowedExternalUrl('https://example.org/path', policy)).toBe(false);
	});
});
