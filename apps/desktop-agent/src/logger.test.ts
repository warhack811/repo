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

	it('redacts sensitive query string parameters without hiding safe URL context', () => {
		expect(
			redactPii(
				'https://app.runa.app/callback?access_token=secret-access&state=ok&refresh_token=secret-refresh#access_token=hash-secret',
			),
		).toBe(
			'https://app.runa.app/callback?access_token=[REDACTED]&state=ok&refresh_token=[REDACTED]#access_token=[REDACTED]',
		);
	});

	it('redacts ws_ticket and workspace_id query parameters', () => {
		expect(
			redactPii(
				'wss://app.runa.app/ws?ws_ticket=one-time-ticket&workspace_id=workspace_1&mode=desktop',
			),
		).toBe('wss://app.runa.app/ws?ws_ticket=[REDACTED]&workspace_id=[REDACTED]&mode=desktop');
	});
});
