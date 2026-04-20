import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthClaims, AuthSession, AuthUser } from '@runa/types';

import {
	type AuthVerificationResult,
	type CreateSupabaseAuthMiddlewareInput,
	SupabaseAuthError,
	createSupabaseAuthMiddleware,
	createSupabaseTokenVerifierFromEnvironment,
	readBearerToken,
} from './supabase-auth.js';

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

function createVerificationResult(
	overrides: Partial<AuthVerificationResult> = {},
): AuthVerificationResult {
	return {
		claims: createClaims(),
		provider: 'supabase',
		session: createSession(),
		user: createUser(),
		...overrides,
	};
}

function createSupabaseJwt(overrides: Partial<AuthClaims> = {}): string {
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const payload = Buffer.from(JSON.stringify(createClaims(overrides))).toString('base64url');

	return `${header}.${payload}.signature`;
}

async function buildAuthTestServer(
	options: CreateSupabaseAuthMiddlewareInput,
): Promise<FastifyInstance> {
	const server = Fastify();

	server.addHook('onRequest', createSupabaseAuthMiddleware(options));

	server.get('/auth-probe', async (request) => ({
		auth: request.auth,
		principal_kind: request.auth.principal.kind,
		request_id: request.id,
	}));

	await server.ready();

	return server;
}

const serversToClose: FastifyInstance[] = [];

afterEach(async () => {
	while (serversToClose.length > 0) {
		const server = serversToClose.pop();

		if (server !== undefined) {
			await server.close();
		}
	}
});

describe('readBearerToken', () => {
	it('distinguishes missing, present, and malformed authorization headers', () => {
		expect(readBearerToken(undefined)).toEqual({
			status: 'missing',
		});
		expect(readBearerToken('Bearer token_123')).toEqual({
			status: 'present',
			token: 'token_123',
		});
		expect(readBearerToken('Basic token_123')).toEqual({
			status: 'malformed',
		});
	});
});

describe('createSupabaseAuthMiddleware', () => {
	it('attaches an anonymous auth context when the authorization header is missing', async () => {
		const verifyToken = vi.fn<CreateSupabaseAuthMiddlewareInput['verify_token']>();
		const server = await buildAuthTestServer({
			verify_token: verifyToken,
		});
		serversToClose.push(server);

		const response = await server.inject({
			method: 'GET',
			url: '/auth-probe',
		});

		expect(response.statusCode).toBe(200);
		expect(verifyToken).not.toHaveBeenCalled();
		expect(response.json()).toMatchObject({
			auth: {
				bearer_token_present: false,
				principal: {
					kind: 'anonymous',
					provider: 'internal',
					role: 'anon',
					scope: {},
				},
				transport: 'http',
			},
			principal_kind: 'anonymous',
		});
	});

	it('normalizes a verified bearer token into an authenticated auth context', async () => {
		const verifyToken = vi
			.fn<CreateSupabaseAuthMiddlewareInput['verify_token']>()
			.mockResolvedValue(createVerificationResult());
		const server = await buildAuthTestServer({
			verify_token: verifyToken,
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
			},
			method: 'GET',
			url: '/auth-probe',
		});

		expect(response.statusCode).toBe(200);
		expect(verifyToken).toHaveBeenCalledTimes(1);
		expect(verifyToken.mock.calls[0]?.[0]).toMatchObject({
			token: 'valid-token',
		});
		expect(response.json()).toMatchObject({
			auth: {
				bearer_token_present: true,
				claims: {
					email: 'dev@runa.ai',
					role: 'authenticated',
					scope: {
						tenant_id: 'tenant_1',
						workspace_id: 'workspace_1',
						workspace_ids: ['workspace_1'],
					},
					session_id: 'session_1',
					sub: 'user_1',
				},
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
				request_id: expect.any(String),
				session: {
					identity_provider: 'magic_link',
					provider: 'supabase',
					session_id: 'session_1',
					user_id: 'user_1',
				},
				transport: 'http',
				user: {
					email: 'dev@runa.ai',
					primary_provider: 'supabase',
					status: 'active',
					user_id: 'user_1',
				},
			},
			principal_kind: 'authenticated',
			request_id: expect.any(String),
		});
	});

	it('rejects malformed authorization headers without calling the verifier', async () => {
		const verifyToken = vi.fn<CreateSupabaseAuthMiddlewareInput['verify_token']>();
		const server = await buildAuthTestServer({
			verify_token: verifyToken,
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Token not-a-bearer',
			},
			method: 'GET',
			url: '/auth-probe',
		});

		expect(response.statusCode).toBe(401);
		expect(verifyToken).not.toHaveBeenCalled();
		expect(response.json()).toMatchObject({
			error: 'Unauthorized',
			message: 'Authorization header must use the Bearer token format.',
			statusCode: 401,
		});
	});

	it('rejects invalid bearer tokens through the injected verifier seam', async () => {
		const verifyToken = vi
			.fn<CreateSupabaseAuthMiddlewareInput['verify_token']>()
			.mockRejectedValue(new Error('jwt expired'));
		const server = await buildAuthTestServer({
			verify_token: verifyToken,
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer expired-token',
			},
			method: 'GET',
			url: '/auth-probe',
		});

		expect(response.statusCode).toBe(401);
		expect(verifyToken).toHaveBeenCalledWith(
			expect.objectContaining({
				token: 'expired-token',
			}),
		);
		expect(response.json()).toMatchObject({
			error: 'Unauthorized',
			message: 'Invalid or expired bearer token.',
			statusCode: 401,
		});
	});

	it('supports service role tokens with a typed service principal surface', async () => {
		const verifyToken = vi
			.fn<CreateSupabaseAuthMiddlewareInput['verify_token']>()
			.mockResolvedValue(
				createVerificationResult({
					claims: createClaims({
						email: undefined,
						role: 'service_role',
						sub: 'service_subject',
					}),
					session: undefined,
					user: createUser({
						display_name: 'supabase-admin',
					}),
				}),
			);
		const server = await buildAuthTestServer({
			verify_token: verifyToken,
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer service-token',
			},
			method: 'GET',
			url: '/auth-probe',
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			auth: {
				principal: {
					kind: 'service',
					provider: 'supabase',
					role: 'service_role',
					scope: {
						tenant_id: 'tenant_1',
						workspace_id: 'workspace_1',
						workspace_ids: ['workspace_1'],
					},
					service_name: 'supabase-admin',
				},
				transport: 'http',
			},
			principal_kind: 'service',
		});
	});

	it('surfaces its custom auth error type for direct hook consumers', async () => {
		const middleware = createSupabaseAuthMiddleware({
			verify_token: async () => {
				throw new Error('invalid token');
			},
		});

		await expect(
			middleware(
				{
					headers: {
						authorization: 'Bearer token',
					},
					id: 'req_1',
				} as FastifyRequest,
				{} as FastifyReply,
			),
		).rejects.toBeInstanceOf(SupabaseAuthError);
	});
});

describe('createSupabaseTokenVerifierFromEnvironment', () => {
	it('verifies a Supabase user token through the configured auth endpoint', async () => {
		const authFetch = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					email: 'dev@runa.ai',
					email_confirmed_at: '2026-04-18T10:00:00.000Z',
					id: 'user_1',
					user_metadata: {
						full_name: 'Runa Dev',
					},
				}),
				{ status: 200 },
			),
		);
		const verifyToken = createSupabaseTokenVerifierFromEnvironment({
			environment: {
				SUPABASE_ANON_KEY: 'anon-key',
				SUPABASE_URL: 'https://project-ref.supabase.co',
			},
			fetch: authFetch,
		});

		expect(verifyToken).not.toBeNull();

		const verification = await verifyToken?.({
			request_id: 'req_1',
			token: createSupabaseJwt(),
		});

		expect(authFetch).toHaveBeenCalledWith(
			'https://project-ref.supabase.co/auth/v1/user',
			expect.objectContaining({
				method: 'GET',
			}),
		);
		expect(verification).toMatchObject({
			claims: {
				email: 'dev@runa.ai',
				role: 'authenticated',
				sub: 'user_1',
			},
			provider: 'supabase',
			session: {
				identity_provider: 'email_password',
				provider: 'supabase',
				session_id: 'session_1',
				user_id: 'user_1',
			},
			user: {
				display_name: 'Runa Dev',
				email: 'dev@runa.ai',
				email_verified: true,
				primary_provider: 'supabase',
				user_id: 'user_1',
			},
		});
	});

	it('accepts the configured service role token without calling the user endpoint', async () => {
		const serviceRoleToken = createSupabaseJwt({
			email: undefined,
			role: 'service_role',
			sub: 'service_subject',
		});
		const authFetch = vi.fn<typeof fetch>();
		const verifyToken = createSupabaseTokenVerifierFromEnvironment({
			environment: {
				SUPABASE_ANON_KEY: 'anon-key',
				SUPABASE_SERVICE_ROLE_KEY: serviceRoleToken,
				SUPABASE_URL: 'https://project-ref.supabase.co',
			},
			fetch: authFetch,
		});

		expect(verifyToken).not.toBeNull();

		const verification = await verifyToken?.({
			request_id: 'req_service',
			token: serviceRoleToken,
		});

		expect(authFetch).not.toHaveBeenCalled();
		expect(verification).toMatchObject({
			claims: {
				role: 'service_role',
				sub: 'service_subject',
			},
			provider: 'supabase',
		});
	});
});
