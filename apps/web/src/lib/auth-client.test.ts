import { describe, expect, it } from 'vitest';

import { formatAuthErrorMessage } from './auth-client.js';

describe('formatAuthErrorMessage', () => {
	it('maps Supabase invalid credential JSON to product copy', () => {
		const message = formatAuthErrorMessage(
			'{"statusCode":400,"error":"Bad Request","message":"Invalid login credentials"}',
			400,
		);

		expect(message).toContain('E-posta veya şifre hatalı');
		expect(message).not.toContain('statusCode');
		expect(message).not.toContain('Invalid login credentials');
	});

	it('maps unavailable auth service statuses to actionable product copy', () => {
		const message = formatAuthErrorMessage('', 502);

		expect(message).toContain('Kimlik doğrulama servisine');
		expect(message).toContain('deneme oturumunu');
		expect(message).not.toContain('Auth isteği');
	});
});
