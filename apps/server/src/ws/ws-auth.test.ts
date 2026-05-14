import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthClaims, AuthContext, AuthSession, AuthUser } from '@runa/types';
import type { FastifyInstance } from 'fastify';

import { buildServer } from '../app.js';
import type { AuthTokenVerifier } from '../auth/supabase-auth.js';
import type { SupabaseAuthError } from '../auth/supabase-auth.js';
import type { SubscriptionContextResolver } from '../policy/subscription-context.js';
import type { WebSocketServerBridgeMessage } from './messages.js';
import { createWebSocketTicketService } from './ws-ticket.js';

import {
	WEBSOCKET_AUTH_CLOSE_CODE,
	rejectWebSocketConnection,
	verifyWebSocketHandshake,
} from './ws-auth.js';

function createClaims(overrides: Partial<AuthClaims> = {}): AuthClaims {
	return {
		aud: 'authenticated',
		email: 'dev@runa.ai',
		email_verified: true,
		exp: 1_900_000_000,
		iat: 1_800_000_000,
		iss: 'https://project-ref.supabase.co/auth/v1',
		role: 'authenticated',
		scope: {
			tenant_id: 'tenant_1',
			workspace_id: 'workspace_1',
			workspace_ids: ['workspace_1'],
		},
		session_id: 'session_1',
		sub: 'user_1',
		...overrides,
	};
}

function createUser(overrides: Partial<AuthUser> = {}): AuthUser {
	return {
		email: 'dev@runa.ai',
		email_verified: true,
		identities: [],
		primary_provider: 'supabase',
		scope: {
			tenant_id: 'tenant_1',
			workspace_id: 'workspace_1',
			workspace_ids: ['workspace_1'],
		},
		status: 'active',
		user_id: 'user_1',
		...overrides,
	};
}

function createSession(overrides: Partial<AuthSession> = {}): AuthSession {
	return {
		identity_provider: 'magic_link',
		provider: 'supabase',
		scope: {
			tenant_id: 'tenant_1',
			workspace_id: 'workspace_1',
			workspace_ids: ['workspace_1'],
		},
		session_id: 'session_1',
		user_id: 'user_1',
		...overrides,
	};
}

function createAuthenticatedHttpAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
	return {
		bearer_token_present: true,
		claims: createClaims(),
		principal: {
			email: 'dev@runa.ai',
			kind: 'authenticated',
			provider: 'supabase',
			role: 'authenticated',
			scope: {
				tenant_id: 'tenant_1',
				workspace_id: 'workspace_1',
				workspace_ids: ['workspace_1'],
			},
			session_id: 'session_1',
			user_id: 'user_1',
		},
		request_id: 'req_http_1',
		session: createSession(),
		transport: 'http',
		user: createUser(),
		...overrides,
	};
}

function createAuthVerificationResult() {
	return {
		claims: createClaims(),
		provider: 'supabase' as const,
		session: createSession(),
		user: createUser(),
	};
}

function createSubscriptionContext() {
	return {
		entitlements: [],
		effective_tier: 'free' as const,
		evaluated_at: '2026-04-16T12:00:00.000Z',
		quotas: [],
		scope: {
			kind: 'workspace' as const,
			subject_id: 'workspace_1',
			tenant_id: 'tenant_1',
			user_id: 'user_1',
			workspace_id: 'workspace_1',
		},
		status: 'active' as const,
	};
}

class MockClosableSocket {
	closed = false;
	closeCode?: number;
	closeReason?: string;

	close(code?: number, reason?: string): void {
		this.closed = true;
		this.closeCode = code;
		this.closeReason = reason;
	}
}

const serversToClose: FastifyInstance[] = [];

afterEach(async () => {
	while (serversToClose.length > 0) {
		const server = serversToClose.pop();

		if (server !== undefined) {
			await server.close();
		}
	}

	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

async function startWebSocketServer(
	verifyToken: AuthTokenVerifier,
	resolveContext: SubscriptionContextResolver = async () => createSubscriptionContext(),
): Promise<{
	readonly server: FastifyInstance;
	readonly wsUrl: string;
}> {
	const server = await buildServer({
		auth: {
			verify_token: verifyToken,
		},
		subscription: {
			resolve_context: resolveContext,
		},
	});
	serversToClose.push(server);

	await server.listen({
		host: '127.0.0.1',
		port: 0,
	});

	const address = server.server.address();

	if (address === null || typeof address === 'string') {
		throw new Error('Unable to resolve test WebSocket server address.');
	}

	return {
		server,
		wsUrl: `ws://127.0.0.1:${address.port}/ws`,
	};
}

async function issueWebSocketTicket(input: {
	readonly bearerToken: string;
	readonly path: '/ws' | '/ws/desktop-agent';
	readonly server: FastifyInstance;
}): Promise<string> {
	const response = await input.server.inject({
		headers: {
			authorization: `Bearer ${input.bearerToken}`,
			'content-type': 'application/json',
		},
		method: 'POST',
		payload: {
			path: input.path,
		},
		url: '/auth/ws-ticket',
	});

	expect(response.statusCode).toBe(200);
	return response.json().ws_ticket as string;
}

async function connectWebSocket(url: string): Promise<WebSocket> {
	return await new Promise((resolve, reject) => {
		const socket = new WebSocket(url);

		socket.addEventListener('open', () => resolve(socket), { once: true });
		socket.addEventListener('error', () => reject(new Error('WebSocket connection failed.')), {
			once: true,
		});
	});
}

async function waitForServerMessage(socket: WebSocket): Promise<WebSocketServerBridgeMessage> {
	return await new Promise((resolve, reject) => {
		socket.addEventListener(
			'message',
			(event) => {
				try {
					resolve(JSON.parse(String(event.data)) as WebSocketServerBridgeMessage);
				} catch (error: unknown) {
					reject(error);
				}
			},
			{ once: true },
		);
		socket.addEventListener('error', () => reject(new Error('WebSocket message failed.')), {
			once: true,
		});
	});
}

async function waitForSocketClose(socket: WebSocket): Promise<{
	readonly code: number;
	readonly reason: string;
}> {
	return await new Promise((resolve) => {
		socket.addEventListener(
			'close',
			(event) => {
				resolve({
					code: event.code,
					reason: event.reason,
				});
			},
			{ once: true },
		);
	});
}

describe('verifyWebSocketHandshake', () => {
	it('reuses an existing authenticated request auth context and retags transport', async () => {
		const verifyToken = vi.fn<AuthTokenVerifier>();

		const result = await verifyWebSocketHandshake({
			path: '/ws',
			request: {
				auth: createAuthenticatedHttpAuthContext(),
				headers: {},
				id: 'req_ws_1',
			},
			verify_token: verifyToken,
		});

		expect(verifyToken).not.toHaveBeenCalled();
		expect(result.transport).toBe('websocket');
		expect(result.principal.kind).toBe('authenticated');
	});

	it('verifies Authorization header bearer tokens when request.auth is not already authenticated', async () => {
		const verifyToken = vi
			.fn<AuthTokenVerifier>()
			.mockResolvedValue(createAuthVerificationResult());

		const result = await verifyWebSocketHandshake({
			path: '/ws',
			request: {
				auth: {
					bearer_token_present: false,
					principal: {
						kind: 'anonymous',
						provider: 'internal',
						role: 'anon',
						scope: {},
					},
					request_id: 'req_ws_2',
					transport: 'http',
				},
				headers: {
					authorization: 'Bearer valid-token',
				},
				id: 'req_ws_2',
			},
			verify_token: verifyToken,
		});

		expect(verifyToken).toHaveBeenCalledWith({
			request_id: 'req_ws_2',
			token: 'valid-token',
		});
		expect(result.transport).toBe('websocket');
		expect(result.principal.kind).toBe('authenticated');
	});

	it('accepts one-time ws_ticket query authentication', async () => {
		const verifyToken = vi.fn<AuthTokenVerifier>();
		const wsTicketService = createWebSocketTicketService({
			now: () => 1_700_000_000_000,
			ttl_seconds: 45,
		});
		const issuedTicket = wsTicketService.issue({
			auth: createAuthenticatedHttpAuthContext(),
			path: '/ws',
			request_id: 'req_ws_ticket_issue_1',
		});

		const result = await verifyWebSocketHandshake({
			path: '/ws',
			request: {
				headers: {},
				id: 'req_ws_ticket_1',
				url: `/ws?ws_ticket=${issuedTicket.ws_ticket}`,
			},
			resolve_ws_ticket_auth_context: wsTicketService.consume,
			verify_token: verifyToken,
		});

		expect(verifyToken).not.toHaveBeenCalled();
		expect(result.transport).toBe('websocket');
		expect(result.principal.kind).toBe('authenticated');
	});

	it('rejects deprecated query access_token on default secure path', async () => {
		await expect(
			verifyWebSocketHandshake({
				path: '/ws',
				request: {
					headers: {},
					id: 'req_ws_query_access_token_reject_1',
					url: '/ws?access_token=query-token',
				},
				verify_token: async () => createAuthVerificationResult(),
			}),
		).rejects.toMatchObject({
			code: 'SUPABASE_AUTH_INVALID_TOKEN',
			statusCode: 401,
		} satisfies Partial<SupabaseAuthError>);
	});

	it('keeps deprecated query access_token behind explicit compatibility flag', async () => {
		const verifyToken = vi
			.fn<AuthTokenVerifier>()
			.mockResolvedValue(createAuthVerificationResult());

		const result = await verifyWebSocketHandshake({
			allow_query_access_token: true,
			path: '/ws',
			request: {
				headers: {},
				id: 'req_ws_query_compat_1',
				url: '/ws?access_token=query-token-compat',
			},
			verify_token: verifyToken,
		});

		expect(result.transport).toBe('websocket');
		expect(verifyToken).toHaveBeenCalledWith({
			request_id: 'req_ws_query_compat_1',
			token: 'query-token-compat',
		});
	});

	it('rejects missing websocket auth tokens with a required-auth error', async () => {
		await expect(
			verifyWebSocketHandshake({
				path: '/ws',
				request: {
					headers: {},
					id: 'req_ws_missing_1',
					url: '/ws',
				},
				verify_token: async () => createAuthVerificationResult(),
			}),
		).rejects.toMatchObject({
			code: 'SUPABASE_AUTH_REQUIRED',
			statusCode: 401,
		} satisfies Partial<SupabaseAuthError>);
	});

	it('rejects malformed authorization headers and invalid verified tokens', async () => {
		await expect(
			verifyWebSocketHandshake({
				path: '/ws',
				request: {
					headers: {
						authorization: 'Token malformed',
					},
					id: 'req_ws_bad_header_1',
				},
				verify_token: async () => createAuthVerificationResult(),
			}),
		).rejects.toMatchObject({
			code: 'SUPABASE_AUTH_INVALID_AUTHORIZATION_HEADER',
		} satisfies Partial<SupabaseAuthError>);

		await expect(
			verifyWebSocketHandshake({
				path: '/ws',
				request: {
					headers: {},
					id: 'req_ws_invalid_1',
					url: '/ws?ws_ticket=invalid-ticket',
				},
				resolve_ws_ticket_auth_context: () => {
					throw new Error('ticket invalid');
				},
				verify_token: async () => createAuthVerificationResult(),
			}),
		).rejects.toMatchObject({
			code: 'SUPABASE_AUTH_INVALID_TOKEN',
		} satisfies Partial<SupabaseAuthError>);
	});
});

describe('rejectWebSocketConnection', () => {
	it('closes websocket connections with the secure policy violation code', () => {
		const socket = new MockClosableSocket();

		rejectWebSocketConnection(socket, new Error('Authenticated WebSocket connection required.'));

		expect(socket.closed).toBe(true);
		expect(socket.closeCode).toBe(WEBSOCKET_AUTH_CLOSE_CODE);
		expect(socket.closeReason).toBe('Authenticated WebSocket connection required.');
	});
});

describe('websocket auth integration', () => {
	it('accepts valid JWT handshakes and emits connection.ready', async () => {
		const { server, wsUrl } = await startWebSocketServer(async () => createAuthVerificationResult());
		const wsTicket = await issueWebSocketTicket({
			bearerToken: 'valid-token',
			path: '/ws',
			server,
		});
		const socket = await connectWebSocket(`${wsUrl}?ws_ticket=${wsTicket}`);

		const readyMessage = await waitForServerMessage(socket);

		expect(readyMessage).toEqual({
			message: 'ready',
			transport: 'websocket',
			type: 'connection.ready',
		});

		socket.close();
		await waitForSocketClose(socket);
	});

	it('rejects missing and invalid JWT handshakes before connection.ready', async () => {
		const { wsUrl } = await startWebSocketServer(async () => createAuthVerificationResult());

		const missingTokenSocket = await connectWebSocket(wsUrl);
		const missingTokenClose = await waitForSocketClose(missingTokenSocket);

		expect(missingTokenClose.code).toBe(WEBSOCKET_AUTH_CLOSE_CODE);
		expect(missingTokenClose.reason).toContain('Authenticated WebSocket connection required.');

		const invalidTokenSocket = await connectWebSocket(`${wsUrl}?ws_ticket=invalid-ticket`);
		const invalidTokenClose = await waitForSocketClose(invalidTokenSocket);

		expect(invalidTokenClose.code).toBe(WEBSOCKET_AUTH_CLOSE_CODE);
		expect(invalidTokenClose.reason).toBe('WebSocket ticket is invalid.');
	});

	it('rejects missing desktop-agent websocket auth before the desktop bridge handshake starts', async () => {
		const { wsUrl } = await startWebSocketServer(async () => createAuthVerificationResult());
		const desktopAgentSocket = await connectWebSocket(`${wsUrl}/desktop-agent`);
		const closeResult = await waitForSocketClose(desktopAgentSocket);

		expect(closeResult.code).toBe(WEBSOCKET_AUTH_CLOSE_CODE);
		expect(closeResult.reason).toContain('Authenticated WebSocket connection required.');
	});
});
