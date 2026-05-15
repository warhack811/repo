import { describe, expect, it } from 'vitest';

import {
	resolveWebSocketSecurityConfig,
	validateWebSocketOrigin,
	validateWebSocketTransportSecurity,
} from './ws-security.js';

describe('ws security policy', () => {
	it('rejects unauthorized origins with exact allowlist matching', () => {
		expect(() =>
			validateWebSocketOrigin(
				{
					headers: {
						host: 'app.runa.test',
						origin: 'https://evil.runa.test',
					},
				},
				{
					allow_query_access_token: false,
					allowed_origins: ['https://app.runa.test'],
					enforce_secure_transport_in_production: true,
				},
			),
		).toThrow('WebSocket origin is not allowed.');
	});

	it('enforces secure transport in production except explicit localhost development paths', () => {
		expect(() =>
			validateWebSocketTransportSecurity(
				{
					headers: {
						host: 'app.runa.test',
					},
					protocol: 'http',
					raw: {
						socket: {
							encrypted: false,
						},
					},
				},
				{
					allow_query_access_token: false,
					allowed_origins: ['https://app.runa.test'],
					enforce_secure_transport_in_production: true,
				},
			),
		).toThrow('require secure transport');

		expect(() =>
			validateWebSocketTransportSecurity(
				{
					headers: {
						host: '127.0.0.1:3000',
					},
					protocol: 'http',
					raw: {
						socket: {
							encrypted: false,
						},
					},
				},
				{
					allow_query_access_token: false,
					allowed_origins: ['http://127.0.0.1'],
					enforce_secure_transport_in_production: true,
				},
			),
		).not.toThrow();
	});

	it('allows loopback frontend origins in local development even when the websocket host differs', () => {
		expect(() =>
			validateWebSocketOrigin(
				{
					headers: {
						host: '127.0.0.1:3000',
						origin: 'http://localhost:5173',
					},
				},
				{
					allow_query_access_token: false,
					enforce_secure_transport_in_production: false,
				},
			),
		).not.toThrow();
	});

	it('keeps query access token disabled by default', () => {
		expect(
			resolveWebSocketSecurityConfig({
				NODE_ENV: 'production',
			}),
		).toMatchObject({
			allow_query_access_token: false,
		});
	});
});
