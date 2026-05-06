import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthClaims, AuthContext, AuthSession, AuthUser } from '@runa/types';
import type { FastifyInstance } from 'fastify';

import { buildServer } from '../app.js';
import type { AuthTokenVerifier } from '../auth/supabase-auth.js';
import type { SupabaseAuthError } from '../auth/supabase-auth.js';
import type { SubscriptionContextResolver } from '../policy/subscription-context.js';
import type { WebSocketServerBridgeMessage } from './messages.js';

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

	it('supports access_token query fallback for browser-compatible handshakes', async () => {
		const verifyToken = vi
			.fn<AuthTokenVerifier>()
			.mockResolvedValue(createAuthVerificationResult());

		const result = await verifyWebSocketHandshake({
			request: {
				headers: {},
				id: 'req_ws_query_1',
				url: '/ws?access_token=query-token',
			},
			verify_token: verifyToken,
		});

		expect(verifyToken).toHaveBeenCalledWith({
			request_id: 'req_ws_query_1',
			token: 'query-token',
		});
		expect(result.transport).toBe('websocket');
	});

	it('verifies an explicit websocket query token instead of reusing a pre-authenticated request context', async () => {
		const verifyToken = vi.fn<AuthTokenVerifier>().mockResolvedValue({
			claims: createClaims({ sub: 'user_2' }),
			provider: 'supabase' as const,
			session: createSession({ session_id: 'session_2', user_id: 'user_2' }),
			user: createUser({ user_id: 'user_2' }),
		});

		const result = await verifyWebSocketHandshake({
			request: {
				auth: createAuthenticatedHttpAuthContext(),
				headers: {},
				id: 'req_ws_query_overrides_auth_1',
				url: '/ws?access_token=query-token-user-2',
			},
			verify_token: verifyToken,
		});

		expect(verifyToken).toHaveBeenCalledWith({
			request_id: 'req_ws_query_overrides_auth_1',
			token: 'query-token-user-2',
		});
		expect(result.transport).toBe('websocket');
		expect(result.principal.kind).toBe('authenticated');
		if (result.principal.kind === 'authenticated') {
			expect(result.principal.user_id).toBe('user_2');
		}
	});

	it('rejects missing websocket auth tokens with a required-auth error', async () => {
		await expect(
			verifyWebSocketHandshake({
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
				request: {
					headers: {},
					id: 'req_ws_invalid_1',
					url: '/ws?access_token=expired-token',
				},
				verify_token: async () => {
					throw new Error('jwt expired');
				},
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
		const { wsUrl } = await startWebSocketServer(async () => createAuthVerificationResult());
		const socket = await connectWebSocket(`${wsUrl}?access_token=valid-token`);

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
		const { wsUrl } = await startWebSocketServer(async ({ token }) => {
			if (token === 'invalid-token') {
				throw new Error('jwt expired');
			}

			return createAuthVerificationResult();
		});

		const missingTokenSocket = await connectWebSocket(wsUrl);
		const missingTokenClose = await waitForSocketClose(missingTokenSocket);

		expect(missingTokenClose.code).toBe(WEBSOCKET_AUTH_CLOSE_CODE);
		expect(missingTokenClose.reason).toBe('Authenticated WebSocket connection required.');

		const invalidTokenSocket = await connectWebSocket(`${wsUrl}?access_token=invalid-token`);
		const invalidTokenClose = await waitForSocketClose(invalidTokenSocket);

		expect(invalidTokenClose.code).toBe(WEBSOCKET_AUTH_CLOSE_CODE);
		expect(invalidTokenClose.reason).toBe('Invalid or expired bearer token.');
	});

	it('rejects missing desktop-agent websocket auth before the desktop bridge handshake starts', async () => {
		const { wsUrl } = await startWebSocketServer(async () => createAuthVerificationResult());
		const desktopAgentSocket = await connectWebSocket(`${wsUrl}/desktop-agent`);
		const closeResult = await waitForSocketClose(desktopAgentSocket);

		expect(closeResult.code).toBe(WEBSOCKET_AUTH_CLOSE_CODE);
		expect(closeResult.reason).toBe('Authenticated WebSocket connection required.');
	});
});
