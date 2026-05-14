import { afterEach, describe, expect, it, vi } from 'vitest';

import { createWebSocketUrl } from './ws-client.js';

describe('createWebSocketUrl', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('never includes access_token in websocket URLs', () => {
		const websocketUrl = createWebSocketUrl('ticket_abc123');

		expect(websocketUrl).toContain('ws_ticket=ticket_abc123');
		expect(websocketUrl).not.toContain('access_token=');
	});

	it('keeps optional workspace attestation without leaking bearer tokens', () => {
		vi.stubEnv('VITE_RUNA_WORKSPACE_ID', 'workspace_attestation_1');

		const websocketUrl = createWebSocketUrl('ticket_attestation_1');

		expect(websocketUrl).toContain('ws_ticket=ticket_attestation_1');
		expect(websocketUrl).toContain('workspace_id=workspace_attestation_1');
		expect(websocketUrl).not.toContain('access_token=');
	});
});
