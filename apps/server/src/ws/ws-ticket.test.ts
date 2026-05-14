import { describe, expect, it } from 'vitest';

import type { AuthContext } from '@runa/types';

import { createWebSocketTicketService } from './ws-ticket.js';

function createAuthenticatedContext(): AuthContext {
	return {
		bearer_token_present: true,
		principal: {
			kind: 'authenticated',
			provider: 'supabase',
			role: 'authenticated',
			scope: {
				tenant_id: 'tenant_1',
				workspace_id: 'workspace_1',
			},
			session_id: 'session_1',
			user_id: 'user_1',
		},
		request_id: 'req_ws_ticket_1',
		transport: 'http',
	};
}

describe('websocket ticket service', () => {
	it('accepts a valid ticket once and rejects reuse', () => {
		const service = createWebSocketTicketService({
			now: () => 1_700_000_000_000,
			ttl_seconds: 45,
		});
		const issued = service.issue({
			auth: createAuthenticatedContext(),
			path: '/ws',
		});

		expect(
			service.consume({
				path: '/ws',
				ticket: issued.ws_ticket,
			}),
		).toMatchObject({
			principal: {
				kind: 'authenticated',
			},
		});

		expect(() =>
			service.consume({
				path: '/ws',
				ticket: issued.ws_ticket,
			}),
		).toThrow('already consumed');
	});

	it('rejects expired tickets', () => {
		let nowMs = 1_700_000_000_000;
		const service = createWebSocketTicketService({
			now: () => nowMs,
			ttl_seconds: 30,
		});
		const issued = service.issue({
			auth: createAuthenticatedContext(),
			path: '/ws',
		});
		nowMs += 31_000;

		expect(() =>
			service.consume({
				path: '/ws',
				ticket: issued.ws_ticket,
			}),
		).toThrow('expired');
	});

	it('rejects path/audience mismatch between /ws and /ws/desktop-agent', () => {
		const service = createWebSocketTicketService({
			now: () => 1_700_000_000_000,
			ttl_seconds: 45,
		});
		const issued = service.issue({
			auth: createAuthenticatedContext(),
			path: '/ws',
		});

		expect(() =>
			service.consume({
				path: '/ws/desktop-agent',
				ticket: issued.ws_ticket,
			}),
		).toThrow('audience');
	});
});
