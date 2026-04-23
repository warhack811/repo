import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthClaims, AuthSession, AuthUser } from '@runa/types';
import type { FastifyInstance } from 'fastify';

import { buildServer } from './app.js';
import { createLocalDevSessionToken } from './auth/supabase-auth.js';
import { ConversationStoreWriteError } from './persistence/conversation-store.js';
import type { StorageObject, StorageProviderAdapter } from './storage/storage-service.js';

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

function createSupabaseJwt(overrides: Partial<AuthClaims> = {}): string {
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const payload = Buffer.from(JSON.stringify(createClaims(overrides))).toString('base64url');

	return `${header}.${payload}.signature`;
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
});

async function startListeningServer(server: FastifyInstance): Promise<number> {
	await server.listen({
		host: '127.0.0.1',
		port: 0,
	});

	const address = server.server.address();

	if (address === null || typeof address === 'string') {
		throw new Error('Unable to resolve test server address.');
	}

	return address.port;
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

function createStorageAdapterResult(
	overrides: Partial<StorageObject> = {},
): StorageObject & { readonly content: Uint8Array } {
	return {
		blob_id: 'blob_storage_1',
		content: Buffer.from('fake-image'),
		content_type: 'image/png',
		created_at: '2026-04-16T12:00:00.000Z',
		filename: 'capture.png',
		kind: 'screenshot',
		owner_kind: 'authenticated',
		owner_subject: 'user_1',
		run_id: 'run_1',
		size_bytes: 10,
		tenant_id: 'tenant_1',
		trace_id: 'trace_1',
		user_id: 'user_1',
		workspace_id: 'workspace_1',
		...overrides,
	};
}

function createCustomStorageAdapter(): StorageProviderAdapter {
	return {
		async get_object() {
			return createStorageAdapterResult();
		},
		async upload_object(blob) {
			return {
				blob_id: `custom_${blob.blob_id}`,
				content_type: blob.content_type,
				created_at: blob.created_at,
				filename: blob.filename,
				kind: blob.kind,
				owner_kind: blob.owner_kind,
				owner_subject: blob.owner_subject,
				run_id: blob.run_id,
				size_bytes: blob.size_bytes,
				tenant_id: blob.tenant_id,
				trace_id: blob.trace_id,
				user_id: blob.user_id,
				workspace_id: blob.workspace_id,
			};
		},
	};
}

describe('buildServer auth wiring', () => {
	it('keeps request.auth available for anonymous requests', async () => {
		const server = await buildServer();
		serversToClose.push(server);

		const response = await server.inject({
			method: 'GET',
			url: '/auth/context',
		});

		expect(response.statusCode).toBe(200);
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

	it('forwards authenticated auth context into HTTP routes through the app-level hook', async () => {
		const verifyToken = vi.fn().mockResolvedValue({
			claims: createClaims(),
			provider: 'supabase' as const,
			session: createSession(),
			user: createUser(),
		});
		const server = await buildServer({
			auth: {
				verify_token: verifyToken,
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
			},
			method: 'GET',
			url: '/auth/context',
		});

		expect(response.statusCode).toBe(200);
		expect(verifyToken).toHaveBeenCalledWith(
			expect.objectContaining({
				token: 'valid-token',
			}),
		);
		expect(response.json()).toMatchObject({
			auth: {
				bearer_token_present: true,
				principal: {
					kind: 'authenticated',
					provider: 'supabase',
					role: 'authenticated',
					user_id: 'user_1',
				},
			},
			principal_kind: 'authenticated',
			subscription: {
				effective_tier: 'free',
				status: 'active',
			},
		});
	});

	it('uses the injected subscription resolver and exposes the resolved context on request surfaces', async () => {
		const resolveContext = vi.fn().mockResolvedValue({
			entitlements: [],
			effective_tier: 'pro',
			evaluated_at: '2026-04-16T13:30:00.000Z',
			quotas: [],
			scope: {
				kind: 'workspace',
				subject_id: 'workspace_1',
				tenant_id: 'tenant_1',
				user_id: 'user_1',
				workspace_id: 'workspace_1',
			},
			status: 'trialing',
		});
		const server = await buildServer({
			auth: {
				verify_token: async () => ({
					claims: createClaims(),
					provider: 'supabase',
					session: createSession(),
					user: createUser(),
				}),
			},
			subscription: {
				resolve_context: resolveContext,
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
			},
			method: 'GET',
			url: '/auth/context',
		});

		expect(response.statusCode).toBe(200);
		expect(resolveContext).toHaveBeenCalledWith(
			expect.objectContaining({
				auth: expect.objectContaining({
					principal: expect.objectContaining({
						kind: 'authenticated',
					}),
				}),
			}),
		);
		expect(response.json()).toMatchObject({
			subscription: {
				effective_tier: 'pro',
				status: 'trialing',
			},
		});
	});

	it('rejects anonymous requests on the protected route', async () => {
		const server = await buildServer();
		serversToClose.push(server);

		const response = await server.inject({
			method: 'GET',
			url: '/auth/protected',
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toMatchObject({
			error: 'Unauthorized',
			message: 'Authenticated request required.',
			statusCode: 401,
		});
	});

	it('rejects invalid tokens on the protected route through the injected verifier seam', async () => {
		const verifyToken = vi.fn().mockRejectedValue(new Error('jwt expired'));
		const server = await buildServer({
			auth: {
				verify_token: verifyToken,
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer expired-token',
			},
			method: 'GET',
			url: '/auth/protected',
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

	it('allows authenticated requests through the protected route', async () => {
		const server = await buildServer({
			auth: {
				verify_token: async () => ({
					claims: createClaims(),
					provider: 'supabase',
					session: createSession(),
					user: createUser(),
				}),
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
			},
			method: 'GET',
			url: '/auth/protected',
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			principal_kind: 'authenticated',
			user_id: 'user_1',
		});
	});

	it('rejects authenticated viewer-role users on the protected route with a clear authorization error', async () => {
		const server = await buildServer({
			auth: {
				verify_token: async () => ({
					claims: createClaims({
						app_metadata: {
							runa_role: 'viewer',
						},
					}),
					provider: 'supabase',
					session: createSession(),
					user: createUser(),
				}),
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer viewer-token',
			},
			method: 'GET',
			url: '/auth/protected',
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			message: 'Protected auth route requires editor authorization. Current role: viewer.',
			statusCode: 403,
		});
	});

	it('exposes a real login action seam backed by the configured Supabase auth surface', async () => {
		const authFetch = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					access_token: 'fresh-access-token',
					expires_in: 3600,
					refresh_token: 'refresh-token',
					token_type: 'bearer',
				}),
				{ status: 200 },
			),
		);
		const verifyToken = vi.fn().mockResolvedValue({
			claims: createClaims(),
			provider: 'supabase' as const,
			session: createSession(),
			user: createUser(),
		});
		const server = await buildServer({
			auth: {
				supabase: {
					environment: {
						SUPABASE_ANON_KEY: 'anon-key',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
					fetch: authFetch,
				},
				verify_token: verifyToken,
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				'content-type': 'application/json',
			},
			method: 'POST',
			payload: {
				email: 'dev@runa.ai',
				password: 'super-secret-password',
			},
			url: '/auth/login',
		});

		expect(response.statusCode).toBe(200);
		expect(authFetch).toHaveBeenCalledWith(
			'https://project-ref.supabase.co/auth/v1/token?grant_type=password',
			expect.objectContaining({
				method: 'POST',
			}),
		);
		expect(verifyToken).toHaveBeenCalledWith(
			expect.objectContaining({
				token: 'fresh-access-token',
			}),
		);
		expect(response.json()).toMatchObject({
			auth: {
				principal: {
					kind: 'authenticated',
				},
			},
			outcome: 'authenticated',
			principal_kind: 'authenticated',
			session: {
				access_token: 'fresh-access-token',
			},
		});
	});

	it('uses the env-backed default verifier for login actions when no custom verifier is injected', async () => {
		const accessToken = createSupabaseJwt();
		const authFetch = vi.fn<typeof fetch>().mockImplementation(async (input) => {
			const url = String(input);

			if (url.endsWith('/auth/v1/token?grant_type=password')) {
				return new Response(
					JSON.stringify({
						access_token: accessToken,
						expires_in: 3600,
						refresh_token: 'refresh-token',
						token_type: 'bearer',
					}),
					{ status: 200 },
				);
			}

			if (url.endsWith('/auth/v1/user')) {
				return new Response(
					JSON.stringify({
						email: 'dev@runa.ai',
						email_confirmed_at: '2026-04-18T10:00:00.000Z',
						id: 'user_1',
					}),
					{ status: 200 },
				);
			}

			throw new Error(`Unexpected auth fetch URL: ${url}`);
		});
		const server = await buildServer({
			auth: {
				supabase: {
					environment: {
						SUPABASE_ANON_KEY: 'anon-key',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
					fetch: authFetch,
				},
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				'content-type': 'application/json',
			},
			method: 'POST',
			payload: {
				email: 'dev@runa.ai',
				password: 'super-secret-password',
			},
			url: '/auth/login',
		});

		expect(response.statusCode).toBe(200);
		expect(authFetch).toHaveBeenCalledTimes(2);
		expect(authFetch).toHaveBeenNthCalledWith(
			1,
			'https://project-ref.supabase.co/auth/v1/token?grant_type=password',
			expect.objectContaining({
				method: 'POST',
			}),
		);
		expect(authFetch).toHaveBeenNthCalledWith(
			2,
			'https://project-ref.supabase.co/auth/v1/user',
			expect.objectContaining({
				method: 'GET',
			}),
		);
		expect(response.json()).toMatchObject({
			auth: {
				principal: {
					kind: 'authenticated',
					user_id: 'user_1',
				},
			},
			outcome: 'authenticated',
			principal_kind: 'authenticated',
			session: {
				access_token: accessToken,
			},
		});
	});

	it('relays PKCE parameters through the OAuth start route and rejects cross-origin callback targets', async () => {
		const server = await buildServer({
			auth: {
				supabase: {
					environment: {
						SUPABASE_ANON_KEY: 'anon-key',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
				},
			},
		});
		serversToClose.push(server);

		const okResponse = await server.inject({
			headers: {
				host: 'app.runa.test',
			},
			method: 'GET',
			url: '/auth/oauth/start?provider=github&redirect_to=http%3A%2F%2Fapp.runa.test%2Fauth%2Foauth%2Fcallback&code_challenge=abcdefghijklmnopqrstuvwxyzABCDEFG1234567890-_&code_challenge_method=S256',
		});

		expect(okResponse.statusCode).toBe(302);
		expect(okResponse.headers.location).toBe(
			'https://project-ref.supabase.co/auth/v1/authorize?provider=github&redirect_to=http%3A%2F%2Fapp.runa.test%2Fauth%2Foauth%2Fcallback&code_challenge=abcdefghijklmnopqrstuvwxyzABCDEFG1234567890-_&code_challenge_method=S256',
		);

		const rejectedResponse = await server.inject({
			headers: {
				host: 'app.runa.test',
			},
			method: 'GET',
			url: '/auth/oauth/start?provider=github&redirect_to=https%3A%2F%2Fevil.example%2Fcallback',
		});

		expect(rejectedResponse.statusCode).toBe(400);
		expect(rejectedResponse.json()).toMatchObject({
			message: 'redirect_to must stay on the current app origin for OAuth flows.',
			statusCode: 400,
		});
	});

	it('normalizes the OAuth callback back onto the current app origin before the SPA consumes it', async () => {
		const server = await buildServer();
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				host: 'app.runa.test',
			},
			method: 'GET',
			url: '/auth/oauth/callback?code=auth-code-1&redirect_to=http%3A%2F%2Fapp.runa.test%2Fchat',
		});

		expect(response.statusCode).toBe(302);
		expect(response.headers.location).toBe('http://app.runa.test/chat?auth_code=auth-code-1');
	});

	it('exchanges an OAuth PKCE callback code through the configured Supabase auth surface', async () => {
		const authFetch = vi.fn<typeof fetch>().mockImplementation(async (input) => {
			const url = String(input);

			if (url.endsWith('/auth/v1/token?grant_type=pkce')) {
				return new Response(
					JSON.stringify({
						access_token: 'oauth-access-token',
						expires_in: 3600,
						refresh_token: 'oauth-refresh-token',
						token_type: 'bearer',
					}),
					{ status: 200 },
				);
			}

			throw new Error(`Unexpected auth fetch URL: ${url}`);
		});
		const verifyToken = vi.fn().mockResolvedValue({
			claims: createClaims(),
			provider: 'supabase' as const,
			session: createSession(),
			user: createUser(),
		});
		const server = await buildServer({
			auth: {
				supabase: {
					environment: {
						SUPABASE_ANON_KEY: 'anon-key',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
					fetch: authFetch,
				},
				verify_token: verifyToken,
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				'content-type': 'application/json',
			},
			method: 'POST',
			payload: {
				auth_code: 'auth-code-1',
				code_verifier: 'code-verifier-1',
			},
			url: '/auth/oauth/callback/exchange',
		});

		expect(response.statusCode).toBe(200);
		expect(authFetch).toHaveBeenCalledWith(
			'https://project-ref.supabase.co/auth/v1/token?grant_type=pkce',
			expect.objectContaining({
				method: 'POST',
			}),
		);
		expect(verifyToken).toHaveBeenCalledWith(
			expect.objectContaining({
				token: 'oauth-access-token',
			}),
		);
		expect(response.json()).toMatchObject({
			outcome: 'authenticated',
			session: {
				access_token: 'oauth-access-token',
				refresh_token: 'oauth-refresh-token',
			},
		});
	});

	it('refreshes an expiring session through the Supabase refresh-token seam', async () => {
		const authFetch = vi.fn<typeof fetch>().mockImplementation(async (input) => {
			const url = String(input);

			if (url.endsWith('/auth/v1/token?grant_type=refresh_token')) {
				return new Response(
					JSON.stringify({
						access_token: 'refreshed-access-token',
						expires_in: 3600,
						refresh_token: 'refreshed-refresh-token',
						token_type: 'bearer',
					}),
					{ status: 200 },
				);
			}

			throw new Error(`Unexpected auth fetch URL: ${url}`);
		});
		const verifyToken = vi.fn().mockResolvedValue({
			claims: createClaims(),
			provider: 'supabase' as const,
			session: createSession(),
			user: createUser(),
		});
		const server = await buildServer({
			auth: {
				supabase: {
					environment: {
						SUPABASE_ANON_KEY: 'anon-key',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
					fetch: authFetch,
				},
				verify_token: verifyToken,
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				'content-type': 'application/json',
			},
			method: 'POST',
			payload: {
				refresh_token: 'refresh-token-1',
			},
			url: '/auth/session/refresh',
		});

		expect(response.statusCode).toBe(200);
		expect(authFetch).toHaveBeenCalledWith(
			'https://project-ref.supabase.co/auth/v1/token?grant_type=refresh_token',
			expect.objectContaining({
				method: 'POST',
			}),
		);
		expect(response.json()).toMatchObject({
			outcome: 'authenticated',
			session: {
				access_token: 'refreshed-access-token',
				refresh_token: 'refreshed-refresh-token',
			},
		});
	});

	it('returns a verification-required signup response when Supabase signup does not yield a session yet', async () => {
		const authFetch = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					user: {
						email: 'new@runa.ai',
						id: 'user_signup_1',
					},
				}),
				{ status: 200 },
			),
		);
		const server = await buildServer({
			auth: {
				supabase: {
					environment: {
						SUPABASE_ANON_KEY: 'anon-key',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
					fetch: authFetch,
				},
				verify_token: async () => ({
					claims: createClaims(),
					provider: 'supabase',
					session: createSession(),
					user: createUser(),
				}),
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				'content-type': 'application/json',
			},
			method: 'POST',
			payload: {
				email: 'new@runa.ai',
				password: 'new-password',
			},
			url: '/auth/signup',
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			email: 'new@runa.ai',
			message:
				'Signup started. Check your email for the Supabase confirmation link before logging in.',
			outcome: 'verification_required',
		});
	});

	it('exposes a loopback-only local dev bootstrap redirect when the dev auth seam is enabled', async () => {
		const server = await buildServer({
			auth: {
				supabase: {
					environment: {
						NODE_ENV: 'development',
						RUNA_DEV_AUTH_EMAIL: 'dev@runa.local',
						RUNA_DEV_AUTH_ENABLED: '1',
						RUNA_DEV_AUTH_SECRET: 'local-dev-secret',
						SUPABASE_ANON_KEY: 'anon-key',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
				},
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			method: 'GET',
			url: '/auth/dev/bootstrap?redirect_to=http%3A%2F%2F127.0.0.1%3A5173%2F',
		});

		expect(response.statusCode).toBe(302);
		expect(response.headers.location).toMatch(/^http:\/\/127\.0\.0\.1:5173\/#access_token=/u);
	});

	it('rejects non-loopback local dev bootstrap redirect targets', async () => {
		const server = await buildServer({
			auth: {
				supabase: {
					environment: {
						NODE_ENV: 'development',
						RUNA_DEV_AUTH_ENABLED: '1',
						RUNA_DEV_AUTH_SECRET: 'local-dev-secret',
						SUPABASE_ANON_KEY: 'anon-key',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
				},
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			method: 'GET',
			url: '/auth/dev/bootstrap?redirect_to=https%3A%2F%2Fexample.com%2F',
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toMatchObject({
			message:
				'redirect_to must stay on a localhost or 127.0.0.1 origin for local dev auth bootstrap.',
			statusCode: 400,
		});
	});

	it('does not register the local dev bootstrap route outside development mode', async () => {
		const server = await buildServer({
			auth: {
				supabase: {
					environment: {
						NODE_ENV: 'production',
						RUNA_DEV_AUTH_ENABLED: '1',
						RUNA_DEV_AUTH_SECRET: 'local-dev-secret',
						SUPABASE_ANON_KEY: 'anon-key',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
				},
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			method: 'GET',
			url: '/auth/dev/bootstrap?redirect_to=http%3A%2F%2F127.0.0.1%3A5173%2F',
		});

		expect(response.statusCode).toBe(404);
	});

	it('rejects malformed redirect targets for the local dev bootstrap route', async () => {
		const server = await buildServer({
			auth: {
				supabase: {
					environment: {
						NODE_ENV: 'development',
						RUNA_DEV_AUTH_ENABLED: '1',
						RUNA_DEV_AUTH_SECRET: 'local-dev-secret',
						SUPABASE_ANON_KEY: 'anon-key',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
				},
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			method: 'GET',
			url: '/auth/dev/bootstrap?redirect_to=not-a-valid-url',
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toMatchObject({
			message:
				'redirect_to must stay on a localhost or 127.0.0.1 origin for local dev auth bootstrap.',
			statusCode: 400,
		});
	});

	it('rejects non-loopback request hosts even when development bootstrap is enabled', async () => {
		const server = await buildServer({
			auth: {
				supabase: {
					environment: {
						NODE_ENV: 'development',
						RUNA_DEV_AUTH_ENABLED: '1',
						RUNA_DEV_AUTH_SECRET: 'local-dev-secret',
						SUPABASE_ANON_KEY: 'anon-key',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
				},
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				host: 'evil.test',
			},
			method: 'GET',
			remoteAddress: '10.0.0.5',
			url: '/auth/dev/bootstrap?redirect_to=http%3A%2F%2F127.0.0.1%3A5173%2F',
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			message: 'Local dev auth bootstrap only accepts loopback-local requests.',
			statusCode: 403,
		});
	});

	it('accepts local dev tokens on /auth/context through the normal auth middleware path', async () => {
		const secret = 'local-dev-secret';
		const token = createLocalDevSessionToken({
			email: 'dev@runa.local',
			secret,
		}).access_token;
		const server = await buildServer({
			auth: {
				supabase: {
					environment: {
						NODE_ENV: 'development',
						RUNA_DEV_AUTH_ENABLED: '1',
						RUNA_DEV_AUTH_SECRET: secret,
						SUPABASE_ANON_KEY: 'anon-key',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
				},
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: `Bearer ${token}`,
			},
			method: 'GET',
			url: '/auth/context',
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			auth: {
				principal: {
					kind: 'authenticated',
					provider: 'internal',
					role: 'authenticated',
				},
			},
			principal_kind: 'authenticated',
		});
	});

	it('accepts local dev tokens on /ws through the existing authenticated handshake path', async () => {
		const secret = 'local-dev-secret';
		const token = createLocalDevSessionToken({
			email: 'dev@runa.local',
			secret,
		}).access_token;
		const server = await buildServer({
			auth: {
				supabase: {
					environment: {
						NODE_ENV: 'development',
						RUNA_DEV_AUTH_ENABLED: '1',
						RUNA_DEV_AUTH_SECRET: secret,
						SUPABASE_ANON_KEY: 'anon-key',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
				},
			},
		});
		serversToClose.push(server);

		const port = await startListeningServer(server);
		const socket = await connectWebSocket(`ws://127.0.0.1:${port}/ws?access_token=${token}`);
		const closePromise = waitForSocketClose(socket);
		const readyMessage = await new Promise<string>((resolve, reject) => {
			socket.addEventListener('message', (event) => resolve(String(event.data)), { once: true });
			socket.addEventListener('error', () => reject(new Error('WebSocket message failed.')), {
				once: true,
			});
		});

		expect(readyMessage).toContain('"type":"connection.ready"');
		socket.close();
		await closePromise;
	});

	it('lists authenticated conversations through the injected conversation route seam', async () => {
		const listConversations = vi.fn().mockResolvedValue([
			{
				access_role: 'owner',
				conversation_id: 'conversation_1',
				created_at: '2026-04-22T10:00:00.000Z',
				last_message_at: '2026-04-22T10:05:00.000Z',
				last_message_preview: 'Follow-up question',
				owner_user_id: 'user_1',
				title: 'First conversation',
				updated_at: '2026-04-22T10:05:00.000Z',
			},
		]);
		const server = await buildServer({
			auth: {
				verify_token: async () => ({
					claims: createClaims(),
					provider: 'supabase',
					session: createSession(),
					user: createUser(),
				}),
			},
			conversations: {
				list_conversations: listConversations,
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
			},
			method: 'GET',
			url: '/conversations',
		});

		expect(response.statusCode).toBe(200);
		expect(listConversations).toHaveBeenCalledWith(
			expect.objectContaining({
				session_id: 'session_1',
				tenant_id: 'tenant_1',
				user_id: 'user_1',
				workspace_id: 'workspace_1',
			}),
		);
		expect(response.json()).toEqual({
			conversations: [
				{
					access_role: 'owner',
					conversation_id: 'conversation_1',
					created_at: '2026-04-22T10:00:00.000Z',
					last_message_at: '2026-04-22T10:05:00.000Z',
					last_message_preview: 'Follow-up question',
					owner_user_id: 'user_1',
					title: 'First conversation',
					updated_at: '2026-04-22T10:05:00.000Z',
				},
			],
		});
	});

	it('returns persisted messages for the selected authenticated conversation', async () => {
		const listConversationMessages = vi.fn().mockResolvedValue([
			{
				content: 'Hello again',
				conversation_id: 'conversation_1',
				created_at: '2026-04-22T10:05:00.000Z',
				message_id: 'message_1',
				role: 'user',
				run_id: 'run_1',
				sequence_no: 1,
				trace_id: 'trace_1',
			},
			{
				content: 'Merhaba, devam edelim.',
				conversation_id: 'conversation_1',
				created_at: '2026-04-22T10:05:10.000Z',
				message_id: 'message_2',
				role: 'assistant',
				run_id: 'run_1',
				sequence_no: 2,
				trace_id: 'trace_1',
			},
		]);
		const server = await buildServer({
			auth: {
				verify_token: async () => ({
					claims: createClaims(),
					provider: 'supabase',
					session: createSession(),
					user: createUser(),
				}),
			},
			conversations: {
				list_conversation_messages: listConversationMessages,
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
			},
			method: 'GET',
			url: '/conversations/conversation_1/messages',
		});

		expect(response.statusCode).toBe(200);
		expect(listConversationMessages).toHaveBeenCalledWith(
			'conversation_1',
			expect.objectContaining({
				session_id: 'session_1',
				tenant_id: 'tenant_1',
				user_id: 'user_1',
				workspace_id: 'workspace_1',
			}),
		);
		expect(response.json()).toEqual({
			conversation_id: 'conversation_1',
			messages: [
				{
					content: 'Hello again',
					conversation_id: 'conversation_1',
					created_at: '2026-04-22T10:05:00.000Z',
					message_id: 'message_1',
					role: 'user',
					run_id: 'run_1',
					sequence_no: 1,
					trace_id: 'trace_1',
				},
				{
					content: 'Merhaba, devam edelim.',
					conversation_id: 'conversation_1',
					created_at: '2026-04-22T10:05:10.000Z',
					message_id: 'message_2',
					role: 'assistant',
					run_id: 'run_1',
					sequence_no: 2,
					trace_id: 'trace_1',
				},
			],
		});
	});

	it('lists shared conversation members for authenticated viewers', async () => {
		const listConversationMembers = vi.fn().mockResolvedValue([
			{
				added_by_user_id: 'owner_user',
				conversation_id: 'conversation_1',
				created_at: '2026-04-22T10:01:00.000Z',
				member_role: 'viewer',
				member_user_id: 'viewer_user',
				updated_at: '2026-04-22T10:01:00.000Z',
			},
		]);
		const server = await buildServer({
			auth: {
				verify_token: async () => ({
					claims: createClaims(),
					provider: 'supabase',
					session: createSession(),
					user: createUser(),
				}),
			},
			conversations: {
				list_conversation_members: listConversationMembers,
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
			},
			method: 'GET',
			url: '/conversations/conversation_1/members',
		});

		expect(response.statusCode).toBe(200);
		expect(listConversationMembers).toHaveBeenCalledWith(
			'conversation_1',
			expect.objectContaining({
				session_id: 'session_1',
				tenant_id: 'tenant_1',
				user_id: 'user_1',
				workspace_id: 'workspace_1',
			}),
		);
		expect(response.json()).toEqual({
			conversation_id: 'conversation_1',
			members: [
				{
					added_by_user_id: 'owner_user',
					conversation_id: 'conversation_1',
					created_at: '2026-04-22T10:01:00.000Z',
					member_role: 'viewer',
					member_user_id: 'viewer_user',
					updated_at: '2026-04-22T10:01:00.000Z',
				},
			],
		});
	});

	it('allows owners to share a conversation member through the route seam', async () => {
		const shareConversationWithMember = vi.fn().mockResolvedValue({
			added_by_user_id: 'user_1',
			conversation_id: 'conversation_1',
			created_at: '2026-04-22T10:01:00.000Z',
			member_role: 'editor',
			member_user_id: 'user_2',
			updated_at: '2026-04-22T10:01:00.000Z',
		});
		const server = await buildServer({
			auth: {
				verify_token: async () => ({
					claims: createClaims(),
					provider: 'supabase',
					session: createSession(),
					user: createUser(),
				}),
			},
			conversations: {
				share_conversation_with_member: shareConversationWithMember,
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
			},
			method: 'POST',
			payload: {
				member_role: 'editor',
				member_user_id: 'user_2',
			},
			url: '/conversations/conversation_1/members',
		});

		expect(response.statusCode).toBe(200);
		expect(shareConversationWithMember).toHaveBeenCalledWith({
			conversation_id: 'conversation_1',
			member_role: 'editor',
			member_user_id: 'user_2',
			scope: expect.objectContaining({
				session_id: 'session_1',
				tenant_id: 'tenant_1',
				user_id: 'user_1',
				workspace_id: 'workspace_1',
			}),
		});
	});

	it('surfaces viewer/editor sharing validation as a bad request', async () => {
		const shareConversationWithMember = vi
			.fn()
			.mockRejectedValue(
				new ConversationStoreWriteError('Conversation member user id is invalid.'),
			);
		const server = await buildServer({
			auth: {
				verify_token: async () => ({
					claims: createClaims(),
					provider: 'supabase',
					session: createSession(),
					user: createUser(),
				}),
			},
			conversations: {
				share_conversation_with_member: shareConversationWithMember,
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
			},
			method: 'POST',
			payload: {
				member_role: 'viewer',
				member_user_id: '   ',
			},
			url: '/conversations/conversation_1/members',
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({
			error: 'Bad Request',
			message: 'Conversation member user id is invalid.',
			statusCode: 400,
		});
	});

	it('exposes a logout action seam that attempts remote Supabase sign-out before the client clears local state', async () => {
		const authFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
		const server = await buildServer({
			auth: {
				supabase: {
					environment: {
						SUPABASE_ANON_KEY: 'anon-key',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
					fetch: authFetch,
				},
				verify_token: async () => ({
					claims: createClaims(),
					provider: 'supabase',
					session: createSession(),
					user: createUser(),
				}),
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
			},
			method: 'POST',
			url: '/auth/logout',
		});

		expect(response.statusCode).toBe(200);
		expect(authFetch).toHaveBeenCalledWith(
			'https://project-ref.supabase.co/auth/v1/logout',
			expect.objectContaining({
				method: 'POST',
			}),
		);
		expect(response.json()).toEqual({
			message:
				'Supabase sign-out completed. Refresh tokens were revoked, but the current access token can remain valid until it expires.',
			outcome: 'logged_out',
			remote_sign_out: 'succeeded',
		});
	});

	it('keeps logout honest when no bearer token is attached to the request', async () => {
		const authFetch = vi.fn<typeof fetch>();
		const server = await buildServer({
			auth: {
				supabase: {
					environment: {
						SUPABASE_ANON_KEY: 'anon-key',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
					fetch: authFetch,
				},
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			method: 'POST',
			url: '/auth/logout',
		});

		expect(response.statusCode).toBe(200);
		expect(authFetch).not.toHaveBeenCalled();
		expect(response.json()).toEqual({
			message:
				'No bearer token was attached to the logout request. Local browser state can still be cleared, but there was no remote Supabase session to revoke.',
			outcome: 'logged_out',
			remote_sign_out: 'skipped',
		});
	});

	it('surfaces a remote sign-out failure instead of faking logout success on the server', async () => {
		const authFetch = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ message: 'Supabase logout failed upstream.' }), {
				status: 502,
			}),
		);
		const server = await buildServer({
			auth: {
				supabase: {
					environment: {
						SUPABASE_ANON_KEY: 'anon-key',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
					fetch: authFetch,
				},
				verify_token: async () => ({
					claims: createClaims(),
					provider: 'supabase',
					session: createSession(),
					user: createUser(),
				}),
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
			},
			method: 'POST',
			url: '/auth/logout',
		});

		expect(response.statusCode).toBe(502);
		expect(response.json()).toMatchObject({
			message: 'Supabase logout failed upstream.',
			statusCode: 502,
		});
	});
});

describe('buildServer storage wiring', () => {
	it('prefers a custom storage adapter over the Supabase env-backed adapter', async () => {
		const fetchImplementation = vi.fn<typeof fetch>();
		const server = await buildServer({
			auth: {
				verify_token: async () => ({
					claims: createClaims(),
					provider: 'supabase',
					session: createSession(),
					user: createUser(),
				}),
			},
			storage: {
				adapter: createCustomStorageAdapter(),
				supabase: {
					environment: {
						SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
						SUPABASE_STORAGE_BUCKET: 'runa-artifacts',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
					fetch: fetchImplementation,
				},
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
				'content-type': 'application/json',
			},
			method: 'POST',
			payload: {
				content_base64: Buffer.from('fake-image').toString('base64'),
				content_type: 'image/png',
				kind: 'screenshot',
			},
			url: '/storage/upload',
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			blob: {
				blob_id: expect.stringMatching(/^custom_/),
			},
		});
		expect(fetchImplementation).not.toHaveBeenCalled();
	});

	it('creates the Supabase storage adapter from environment when no custom adapter is provided', async () => {
		const fetchImplementation = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(JSON.stringify({ Key: 'ignored' }), { status: 200 }));
		const server = await buildServer({
			auth: {
				verify_token: async () => ({
					claims: createClaims(),
					provider: 'supabase',
					session: createSession(),
					user: createUser(),
				}),
			},
			storage: {
				supabase: {
					environment: {
						SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
						SUPABASE_STORAGE_BUCKET: 'runa-artifacts',
						SUPABASE_STORAGE_PREFIX: 'workspace-artifacts',
						SUPABASE_URL: 'https://project-ref.supabase.co',
					},
					fetch: fetchImplementation,
				},
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
				'content-type': 'application/json',
			},
			method: 'POST',
			payload: {
				content_base64: Buffer.from('fake-image').toString('base64'),
				content_type: 'image/png',
				kind: 'screenshot',
			},
			url: '/storage/upload',
		});

		expect(response.statusCode).toBe(200);
		expect(fetchImplementation).toHaveBeenCalledTimes(1);
		expect(String(fetchImplementation.mock.calls[0]?.[0])).toContain(
			'https://project-ref.supabase.co/storage/v1/object/runa-artifacts/workspace-artifacts/v1/blob/',
		);
		expect(String(fetchImplementation.mock.calls[0]?.[0])).toContain(
			'/kind/screenshot/owner-kind/authenticated/owner-subject/user_1/tenant/tenant_1/workspace/workspace_1/user/user_1/run/__none__/trace/__none__/',
		);
	});

	it('keeps the controlled not-configured fallback when no custom adapter or Supabase env is available', async () => {
		const server = await buildServer({
			auth: {
				verify_token: async () => ({
					claims: createClaims(),
					provider: 'supabase',
					session: createSession(),
					user: createUser(),
				}),
			},
			storage: {
				supabase: {
					environment: {},
				},
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
				'content-type': 'application/json',
			},
			method: 'POST',
			payload: {
				content_base64: Buffer.from('fake-image').toString('base64'),
				content_type: 'image/png',
				kind: 'screenshot',
			},
			url: '/storage/upload',
		});

		expect(response.statusCode).toBe(503);
		expect(response.json()).toMatchObject({
			message: 'Storage adapter is not configured.',
			statusCode: 503,
		});
	});
});
