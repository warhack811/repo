import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
	AuthClaims,
	AuthSession,
	AuthUser,
	FeatureGate,
	SubscriptionContext,
} from '@runa/types';
import type { FastifyInstance } from 'fastify';

import { buildServer } from '../app.js';
import type { AuthTokenVerifier } from '../auth/supabase-auth.js';
import type { SubscriptionContextResolver } from '../policy/subscription-context.js';
import { SubscriptionGateError } from '../policy/subscription-gating.js';
import type { WebSocketServerBridgeMessage } from './messages.js';
import { WEBSOCKET_AUTH_CLOSE_CODE } from './ws-auth.js';
import {
	defaultWebSocketConnectionGate,
	verifyWebSocketSubscriptionAccess,
} from './ws-subscription-gate.js';

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

function createAuthVerificationResult(): Awaited<ReturnType<AuthTokenVerifier>> {
	return {
		claims: createClaims(),
		provider: 'supabase',
		session: createSession(),
		user: createUser(),
	};
}

function createServiceVerificationResult(): Awaited<ReturnType<AuthTokenVerifier>> {
	return {
		claims: createClaims({
			email: undefined,
			role: 'service_role',
			sub: 'service_subject',
		}),
		provider: 'supabase',
		session: undefined,
		user: createUser({
			display_name: 'system-worker',
			user_id: 'service_subject',
		}),
	};
}

function createSubscriptionContext(
	overrides: Partial<SubscriptionContext> = {},
): SubscriptionContext {
	return {
		entitlements: [],
		effective_tier: 'free',
		evaluated_at: '2026-04-16T12:00:00.000Z',
		quotas: [],
		scope: {
			kind: 'workspace',
			subject_id: 'workspace_1',
			tenant_id: 'tenant_1',
			user_id: 'user_1',
			workspace_id: 'workspace_1',
		},
		status: 'active',
		...overrides,
	};
}

const proWebSocketGate: FeatureGate = {
	feature_key: 'checkpoint_resume',
	minimum_tier: 'pro',
	requires_active_subscription: true,
};

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

async function startWebSocketServer(input: {
	readonly resolve_context?: SubscriptionContextResolver;
	readonly verify_token: AuthTokenVerifier;
	readonly websocket_feature_gate?: FeatureGate;
	readonly websocket_allow_service_principal?: boolean;
}): Promise<{
	readonly wsUrl: string;
}> {
	const server = await buildServer({
		auth: {
			verify_token: input.verify_token,
		},
		subscription: {
			resolve_context: input.resolve_context,
			websocket: {
				allow_service_principal: input.websocket_allow_service_principal,
				feature_gate: input.websocket_feature_gate,
			},
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

describe('verifyWebSocketSubscriptionAccess', () => {
	it('accepts active authenticated users with sufficient tier', async () => {
		await expect(
			verifyWebSocketSubscriptionAccess({
				auth: {
					bearer_token_present: true,
					principal: {
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
					request_id: 'req_ws_sub_1',
					transport: 'websocket',
				},
				resolve_context: async () =>
					createSubscriptionContext({
						effective_tier: 'pro',
					}),
			}),
		).resolves.toMatchObject({
			subscription: {
				effective_tier: 'pro',
				status: 'active',
			},
		});
	});

	it('falls back to the default free baseline when subscription context is missing and still rejects inactive or restricted access', async () => {
		const auth = {
			bearer_token_present: true,
			principal: {
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
			request_id: 'req_ws_sub_2',
			transport: 'websocket',
		} as const;

		await expect(
			verifyWebSocketSubscriptionAccess({
				auth,
				resolve_context: async () => null,
			}),
		).resolves.toMatchObject({
			subscription: {
				effective_tier: 'free',
				status: 'active',
			},
		});

		await expect(
			verifyWebSocketSubscriptionAccess({
				auth,
				resolve_context: async () =>
					createSubscriptionContext({
						effective_tier: 'pro',
						status: 'paused',
					}),
			}),
		).rejects.toThrowError('Feature requires an active subscription.');

		await expect(
			verifyWebSocketSubscriptionAccess({
				auth,
				feature_gate: proWebSocketGate,
				resolve_context: async () =>
					createSubscriptionContext({
						effective_tier: 'free',
					}),
			}),
		).rejects.toThrowError('Feature requires pro tier access.');
	});

	it('allows service principals by default and can explicitly disable them', async () => {
		const auth = {
			bearer_token_present: true,
			principal: {
				kind: 'service',
				provider: 'supabase',
				role: 'service_role',
				scope: {
					tenant_id: 'tenant_1',
					workspace_id: 'workspace_1',
				},
				service_name: 'system-worker',
				session_id: 'service_session_1',
			},
			request_id: 'req_ws_sub_service_1',
			transport: 'websocket',
		} as const;

		await expect(
			verifyWebSocketSubscriptionAccess({
				auth,
				resolve_context: async () => null,
			}),
		).resolves.toMatchObject({
			auth: {
				principal: {
					kind: 'service',
				},
			},
		});

		await expect(
			verifyWebSocketSubscriptionAccess({
				allow_service_principal: false,
				auth,
				resolve_context: async () => null,
			}),
		).rejects.toThrowError('Service principal access is not allowed for this feature.');
	});
});

describe('websocket subscription integration', () => {
	it('keeps connection.ready for active free-tier websocket access', async () => {
		const { wsUrl } = await startWebSocketServer({
			resolve_context: async () => createSubscriptionContext(),
			verify_token: async () => createAuthVerificationResult(),
		});
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

	it('keeps websocket access on the default free baseline when subscription context is missing and still closes inactive or restricted connections', async () => {
		const missingContextServer = await startWebSocketServer({
			resolve_context: async () => null,
			verify_token: async () => createAuthVerificationResult(),
		});
		const missingContextSocket = await connectWebSocket(
			`${missingContextServer.wsUrl}?access_token=valid-token`,
		);
		const missingContextReadyMessage = await waitForServerMessage(missingContextSocket);

		expect(missingContextReadyMessage).toEqual({
			message: 'ready',
			transport: 'websocket',
			type: 'connection.ready',
		});

		missingContextSocket.close();
		await waitForSocketClose(missingContextSocket);

		const inactiveServer = await startWebSocketServer({
			resolve_context: async () =>
				createSubscriptionContext({
					effective_tier: 'pro',
					status: 'expired',
				}),
			verify_token: async () => createAuthVerificationResult(),
		});
		const inactiveSocket = await connectWebSocket(
			`${inactiveServer.wsUrl}?access_token=valid-token`,
		);
		const inactiveClose = await waitForSocketClose(inactiveSocket);

		expect(inactiveClose.code).toBe(WEBSOCKET_AUTH_CLOSE_CODE);
		expect(inactiveClose.reason).toBe('Feature requires an active subscription.');

		const restrictedServer = await startWebSocketServer({
			resolve_context: async () =>
				createSubscriptionContext({
					effective_tier: 'free',
				}),
			verify_token: async () => createAuthVerificationResult(),
			websocket_feature_gate: proWebSocketGate,
		});
		const restrictedSocket = await connectWebSocket(
			`${restrictedServer.wsUrl}?access_token=valid-token`,
		);
		const restrictedClose = await waitForSocketClose(restrictedSocket);

		expect(restrictedClose.code).toBe(WEBSOCKET_AUTH_CLOSE_CODE);
		expect(restrictedClose.reason).toBe('Feature requires pro tier access.');
	});

	it('supports explicit service principal control for websocket access', async () => {
		const allowedServer = await startWebSocketServer({
			resolve_context: async () => null,
			verify_token: async () => createServiceVerificationResult(),
		});
		const allowedSocket = await connectWebSocket(
			`${allowedServer.wsUrl}?access_token=service-token`,
		);
		const readyMessage = await waitForServerMessage(allowedSocket);

		expect(readyMessage).toEqual({
			message: 'ready',
			transport: 'websocket',
			type: 'connection.ready',
		});

		allowedSocket.close();
		await waitForSocketClose(allowedSocket);

		const deniedServer = await startWebSocketServer({
			resolve_context: async () => null,
			verify_token: async () => createServiceVerificationResult(),
			websocket_allow_service_principal: false,
		});
		const deniedSocket = await connectWebSocket(`${deniedServer.wsUrl}?access_token=service-token`);
		const deniedClose = await waitForSocketClose(deniedSocket);

		expect(deniedClose.code).toBe(WEBSOCKET_AUTH_CLOSE_CODE);
		expect(deniedClose.reason).toBe('Service principal access is not allowed for this feature.');
	});
});

describe('defaultWebSocketConnectionGate', () => {
	it('uses an active free-tier baseline for websocket access', () => {
		expect(defaultWebSocketConnectionGate).toEqual({
			feature_key: 'cloud_history',
			minimum_tier: 'free',
			requires_active_subscription: true,
		});
	});
});
