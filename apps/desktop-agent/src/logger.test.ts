import { describe, expect, it } from 'vitest';

import { redactPii } from './logger.js';

describe('redactPii', () => {
	it('redacts nested sensitive keys', () => {
		expect(
			redactPii({
				access_token: 'access',
				nested: {
					refreshToken: 'refresh',
					safe: 'ok',
				},
				rows: [{ api_key: 'key' }],
			}),
		).toEqual({
			access_token: '[REDACTED]',
			nested: {
				refreshToken: '[REDACTED]',
				safe: 'ok',
			},
			rows: [{ api_key: '[REDACTED]' }],
		});
	});

	it('redacts bearer tokens and JWT-shaped strings', () => {
		expect(
			redactPii('Authorization: Bearer secret-token and eyJabc.def_123.ghi-456 are hidden'),
		).toBe('Authorization: Bearer [REDACTED] and [REDACTED_JWT] are hidden');
	});
});
