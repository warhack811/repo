import {
	type AuthContext,
	type AuthEmailPasswordCredentials,
	type AuthLogoutResponse,
	type AuthPasswordActionResponse,
	type AuthPasswordSignupRequest,
	type AuthSessionTokens,
	type OAuthProvider,
	type SubscriptionContext,
	oauthProviders,
} from '@runa/types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
	type AuthorizationRole,
	requireAuthorizationRole,
	resolveAuthorizationRole,
} from '../auth/rbac.js';
import {
	type AuthTokenVerifier,
	createAuthContextFromVerification,
	createLocalDevSessionToken,
	createLocalDevTokenVerifierFromEnvironment,
	readBearerToken,
	requireAuthenticatedRequest,
} from '../auth/supabase-auth.js';
import { closeWebSocketSessionsForAuthContext } from '../ws/ws-session-registry.js';
import type { WebSocketTicketPath } from '../ws/ws-ticket.js';

interface AuthContextResponse {
	readonly auth: AuthContext;
	readonly authorization: {
		readonly role: AuthorizationRole;
	};
	readonly principal_kind: AuthContext['principal']['kind'];
	readonly subscription?: SubscriptionContext;
}

export interface SupabaseAuthActionEnvironment {
	readonly NODE_ENV?: string;
	readonly RUNA_DEV_AUTH_EMAIL?: string;
	readonly RUNA_DEV_AUTH_ENABLED?: string;
	readonly RUNA_DEV_AUTH_SECRET?: string;
	readonly SUPABASE_ANON_KEY?: string;
	readonly SUPABASE_URL?: string;
}

export type SupabaseAuthFetch = typeof fetch;

export interface RegisterAuthRoutesOptions {
	readonly issue_ws_ticket?: (input: {
		readonly auth: AuthContext;
		readonly path: WebSocketTicketPath;
		readonly request_id?: string;
	}) => {
		readonly expires_at: string;
		readonly expires_in_seconds: number;
		readonly path: WebSocketTicketPath;
		readonly ws_ticket: string;
	};
	readonly supabase?: {
		readonly environment?: SupabaseAuthActionEnvironment;
		readonly fetch?: SupabaseAuthFetch;
	};
	readonly verify_token: AuthTokenVerifier;
}

interface ProtectedAuthResponse {
	readonly principal_kind: 'authenticated' | 'service';
	readonly service_name?: string;
	readonly user_id?: string;
}

type LoginReply = AuthPasswordActionResponse;
type LogoutReply = AuthLogoutResponse;
type SignupReply = AuthPasswordActionResponse;

interface SupabaseAuthActionClient {
	readonly anon_key: string;
	readonly auth_fetch: SupabaseAuthFetch;
	readonly supabase_url: string;
}

interface SupabaseActionErrorCandidate {
	readonly error?: unknown;
	readonly error_description?: unknown;
	readonly msg?: unknown;
	readonly message?: unknown;
}

interface AuthRequestBodyCandidate {
	readonly email?: unknown;
	readonly password?: unknown;
}

interface OAuthStartQueryCandidate {
	readonly code_challenge?: unknown;
	readonly code_challenge_method?: unknown;
	readonly provider?: unknown;
	readonly redirect_to?: unknown;
}

interface LocalDevBootstrapQueryCandidate {
	readonly redirect_to?: unknown;
}

interface OAuthCallbackQueryCandidate {
	readonly code?: unknown;
	readonly error?: unknown;
	readonly error_description?: unknown;
	readonly redirect_to?: unknown;
}

interface RefreshSessionBodyCandidate {
	readonly refresh_token?: unknown;
}

interface OAuthCodeExchangeBodyCandidate {
	readonly auth_code?: unknown;
	readonly code_verifier?: unknown;
}

interface WebSocketTicketRequestBodyCandidate {
	readonly path?: unknown;
}

interface SupabaseSessionTokensCandidate {
	readonly access_token?: unknown;
	readonly expires_at?: unknown;
	readonly expires_in?: unknown;
	readonly refresh_token?: unknown;
	readonly token_type?: unknown;
}

class AuthRouteError extends Error {
	readonly statusCode: number;

	constructor(statusCode: number, message: string) {
		super(message);
		this.name = 'AuthRouteError';
		this.statusCode = statusCode;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRequiredString(value: unknown, fieldName: string): string {
	if (typeof value !== 'string') {
		throw new AuthRouteError(400, `${fieldName} is required.`);
	}

	const normalizedValue = value.trim();

	if (normalizedValue.length === 0) {
		throw new AuthRouteError(400, `${fieldName} is required.`);
	}

	return normalizedValue;
}

function normalizeOptionalString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function parseEmailPasswordCredentials(body: unknown): AuthEmailPasswordCredentials {
	if (!isRecord(body)) {
		throw new AuthRouteError(400, 'Request body must be a JSON object.');
	}

	const bodyCandidate = body as AuthRequestBodyCandidate;

	return {
		email: normalizeRequiredString(bodyCandidate.email, 'email'),
		password: normalizeRequiredString(bodyCandidate.password, 'password'),
	};
}

function parsePasswordSignupRequest(body: unknown): AuthPasswordSignupRequest {
	return parseEmailPasswordCredentials(body);
}

function createSupabaseAuthActionClient(
	options: RegisterAuthRoutesOptions['supabase'],
): SupabaseAuthActionClient | null {
	const environment = options?.environment;
	const authFetch = options?.fetch ?? globalThis.fetch;
	const anonKey = environment?.SUPABASE_ANON_KEY?.trim();
	const supabaseUrl = environment?.SUPABASE_URL?.trim().replace(/\/+$/g, '');

	if (!authFetch || !anonKey || !supabaseUrl) {
		return null;
	}

	return {
		anon_key: anonKey,
		auth_fetch: authFetch,
		supabase_url: supabaseUrl,
	};
}

function readMessageCandidate(value: unknown): string | null {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function extractSupabaseActionErrorMessage(value: unknown): string | null {
	if (!isRecord(value)) {
		return null;
	}

	const candidate = value as SupabaseActionErrorCandidate;

	return (
		readMessageCandidate(candidate.message) ??
		readMessageCandidate(candidate.msg) ??
		readMessageCandidate(candidate.error_description) ??
		readMessageCandidate(candidate.error)
	);
}

async function readSupabaseActionPayload(response: Response): Promise<unknown> {
	const responseText = await response.text();
	const trimmedText = responseText.trim();

	if (trimmedText.length === 0) {
		return null;
	}

	try {
		return JSON.parse(trimmedText) as unknown;
	} catch {
		return trimmedText;
	}
}

function readSupabaseSessionTokens(payload: unknown): AuthSessionTokens | null {
	if (!isRecord(payload)) {
		return null;
	}

	const candidate = payload as SupabaseSessionTokensCandidate;

	if (typeof candidate.access_token !== 'string' || candidate.access_token.trim().length === 0) {
		return null;
	}

	return {
		access_token: candidate.access_token,
		expires_at: typeof candidate.expires_at === 'number' ? candidate.expires_at : undefined,
		expires_in: typeof candidate.expires_in === 'number' ? candidate.expires_in : undefined,
		refresh_token:
			typeof candidate.refresh_token === 'string' ? candidate.refresh_token : undefined,
		token_type: typeof candidate.token_type === 'string' ? candidate.token_type : undefined,
	};
}

async function callSupabaseAuthEndpoint(
	client: SupabaseAuthActionClient,
	input: Readonly<{
		readonly authorizationToken?: string;
		readonly method?: 'GET' | 'POST';
		readonly pathname: string;
		readonly payload?: Record<string, unknown>;
	}>,
): Promise<unknown> {
	const headers = new Headers({
		apikey: client.anon_key,
	});

	if (input.authorizationToken) {
		headers.set('authorization', `Bearer ${input.authorizationToken}`);
	}

	if (input.payload) {
		headers.set('content-type', 'application/json');
	}

	const response = await client.auth_fetch(`${client.supabase_url}${input.pathname}`, {
		body: input.payload ? JSON.stringify(input.payload) : undefined,
		headers,
		method: input.method ?? 'POST',
	});
	const responsePayload = await readSupabaseActionPayload(response);

	if (!response.ok) {
		throw new AuthRouteError(
			response.status,
			extractSupabaseActionErrorMessage(responsePayload) ??
				`Supabase auth request failed with status ${response.status}.`,
		);
	}

	return responsePayload;
}

async function createAuthenticatedActionResponse(
	session: AuthSessionTokens,
	requestId: string | undefined,
	verifyToken: AuthTokenVerifier,
): Promise<AuthPasswordActionResponse> {
	const verification = await verifyToken({
		request_id: requestId,
		token: session.access_token,
	});
	const auth = createAuthContextFromVerification(verification, requestId);

	if (auth.principal.kind === 'anonymous') {
		throw new AuthRouteError(401, 'Authenticated action returned an anonymous auth context.');
	}

	return {
		auth,
		outcome: 'authenticated',
		principal_kind: auth.principal.kind,
		session,
	};
}

function resolveSupabaseActionClientOrThrow(
	options: RegisterAuthRoutesOptions['supabase'],
): SupabaseAuthActionClient {
	const client = createSupabaseAuthActionClient(options);

	if (!client) {
		throw new AuthRouteError(
			503,
			'Supabase auth action routes require SUPABASE_URL and SUPABASE_ANON_KEY.',
		);
	}

	return client;
}

function isOAuthProvider(value: string): value is OAuthProvider {
	return oauthProviders.includes(value as OAuthProvider);
}

function resolveRedirectTarget(target: string): Parameters<FastifyReply['redirect']>[0] {
	return target;
}

function resolveRequestOrigin(request: FastifyRequest): string {
	const host = normalizeRequiredString(request.headers.host, 'host');
	return `${request.protocol}://${host}`;
}

function resolveSameOriginRedirectTarget(
	request: FastifyRequest,
	value: string | undefined,
): string {
	const requestOrigin = resolveRequestOrigin(request);
	const target = value?.trim().length ? value.trim() : `${requestOrigin}/`;

	try {
		const resolvedUrl = new URL(target, requestOrigin);

		if (
			(resolvedUrl.protocol !== 'http:' && resolvedUrl.protocol !== 'https:') ||
			resolvedUrl.origin !== requestOrigin
		) {
			throw new AuthRouteError(
				400,
				'redirect_to must stay on the current app origin for OAuth flows.',
			);
		}

		return resolvedUrl.toString();
	} catch (error) {
		if (error instanceof AuthRouteError) {
			throw error;
		}

		throw new AuthRouteError(
			400,
			'redirect_to must stay on the current app origin for OAuth flows.',
		);
	}
}

function appendOAuthRelayParams(
	redirectTarget: string,
	query: OAuthCallbackQueryCandidate | undefined,
): string {
	const redirectUrl = new URL(redirectTarget);
	const authCode = normalizeOptionalString(query?.code);
	const authError = normalizeOptionalString(query?.error);
	const authErrorDescription = normalizeOptionalString(query?.error_description);

	if (authCode) {
		redirectUrl.searchParams.set('auth_code', authCode);
		redirectUrl.searchParams.delete('auth_error');
		redirectUrl.searchParams.delete('auth_error_description');
		return redirectUrl.toString();
	}

	redirectUrl.searchParams.set('auth_error', authError ?? 'missing_oauth_result');

	if (authErrorDescription) {
		redirectUrl.searchParams.set('auth_error_description', authErrorDescription);
	}

	return redirectUrl.toString();
}

function normalizePkceCodeChallenge(value: unknown): string | undefined {
	const normalized = normalizeOptionalString(value);

	if (!normalized) {
		return undefined;
	}

	if (!/^[A-Za-z0-9._~-]{43,128}$/u.test(normalized)) {
		throw new AuthRouteError(400, 'code_challenge must be a valid PKCE S256 code challenge.');
	}

	return normalized;
}

function normalizePkceCodeChallengeMethod(value: unknown): 'S256' | undefined {
	const normalized = normalizeOptionalString(value);

	if (!normalized) {
		return undefined;
	}

	if (normalized !== 'S256') {
		throw new AuthRouteError(400, 'code_challenge_method must be S256.');
	}

	return 'S256';
}

function parseRefreshToken(body: unknown): string {
	if (!isRecord(body)) {
		throw new AuthRouteError(400, 'Request body must be a JSON object.');
	}

	return normalizeRequiredString(
		(body as RefreshSessionBodyCandidate).refresh_token,
		'refresh_token',
	);
}

function parseOAuthCodeExchangeBody(body: unknown): {
	readonly auth_code: string;
	readonly code_verifier: string;
} {
	if (!isRecord(body)) {
		throw new AuthRouteError(400, 'Request body must be a JSON object.');
	}

	const bodyCandidate = body as OAuthCodeExchangeBodyCandidate;

	return {
		auth_code: normalizeRequiredString(bodyCandidate.auth_code, 'auth_code'),
		code_verifier: normalizeRequiredString(bodyCandidate.code_verifier, 'code_verifier'),
	};
}

function parseWebSocketTicketPath(body: unknown): WebSocketTicketPath {
	if (!isRecord(body)) {
		throw new AuthRouteError(400, 'Request body must be a JSON object.');
	}

	const candidate = body as WebSocketTicketRequestBodyCandidate;
	const path = normalizeRequiredString(candidate.path, 'path');

	if (path !== '/ws' && path !== '/ws/desktop-agent') {
		throw new AuthRouteError(400, 'path must be /ws or /ws/desktop-agent.');
	}

	return path;
}

function isLoopbackRedirectTarget(value: string): boolean {
	try {
		const candidateUrl = new URL(value);
		return (
			candidateUrl.protocol === 'http:' &&
			(candidateUrl.hostname === '127.0.0.1' || candidateUrl.hostname === 'localhost')
		);
	} catch {
		return false;
	}
}

function buildLocalDevBootstrapRedirectTarget(
	baseRedirectTarget: string,
	session: ReturnType<typeof createLocalDevSessionToken>,
): string {
	const redirectUrl = new URL(baseRedirectTarget);
	const fragment = new URLSearchParams({
		access_token: session.access_token,
		expires_at: String(session.expires_at),
		expires_in: String(session.expires_in),
		token_type: 'bearer',
	});
	redirectUrl.hash = fragment.toString();
	return redirectUrl.toString();
}

function isLoopbackHost(value: string | undefined): boolean {
	if (!value) {
		return false;
	}

	const normalizedHost = value
		.trim()
		.replace(/^\[|\]$/gu, '')
		.toLowerCase();

	return (
		normalizedHost === 'localhost' ||
		normalizedHost === '127.0.0.1' ||
		normalizedHost === '::1' ||
		normalizedHost === '::ffff:127.0.0.1'
	);
}

function isLoopbackRequest(request: FastifyRequest): boolean {
	return isLoopbackHost(request.hostname) && isLoopbackHost(request.ip);
}

export async function registerAuthRoutes(
	server: FastifyInstance,
	options: RegisterAuthRoutesOptions,
): Promise<void> {
	server.get<{ Reply: AuthContextResponse }>('/auth/context', async (request) => ({
		auth: request.auth,
		authorization: {
			role: resolveAuthorizationRole(request.auth),
		},
		principal_kind: request.auth.principal.kind,
		subscription: request.subscription,
	}));

	server.get<{ Reply: ProtectedAuthResponse }>('/auth/protected', async (request) => {
		const principal = requireAuthenticatedRequest(request);
		requireAuthorizationRole(request.auth, 'editor', 'Protected auth route');

		if (principal.kind === 'service') {
			return {
				principal_kind: 'service',
				service_name: principal.service_name,
			};
		}

		return {
			principal_kind: 'authenticated',
			user_id: principal.user_id,
		};
	});

	server.post<{ Reply: LoginReply }>('/auth/login', async (request) => {
		const credentials = parseEmailPasswordCredentials(request.body);
		const client = resolveSupabaseActionClientOrThrow(options.supabase);
		const payload = await callSupabaseAuthEndpoint(client, {
			pathname: '/auth/v1/token?grant_type=password',
			payload: {
				email: credentials.email,
				password: credentials.password,
			},
		});
		const session = readSupabaseSessionTokens(payload);

		if (!session) {
			throw new AuthRouteError(502, 'Login succeeded but no access token was returned.');
		}

		return createAuthenticatedActionResponse(session, request.id, options.verify_token);
	});

	server.post<{ Reply: SignupReply }>('/auth/signup', async (request) => {
		const signupRequest = parsePasswordSignupRequest(request.body);
		const client = resolveSupabaseActionClientOrThrow(options.supabase);
		const payload = await callSupabaseAuthEndpoint(client, {
			pathname: '/auth/v1/signup',
			payload: {
				email: signupRequest.email,
				password: signupRequest.password,
			},
		});
		const session = readSupabaseSessionTokens(payload);

		if (!session) {
			return {
				email: signupRequest.email,
				message:
					'Signup started. Check your email for the Supabase confirmation link before logging in.',
				outcome: 'verification_required',
			};
		}

		return createAuthenticatedActionResponse(session, request.id, options.verify_token);
	});

	server.post<{ Reply: LogoutReply }>('/auth/logout', async (request) => {
		const authorizationHeader = request.headers.authorization?.trim();

		if (!authorizationHeader) {
			return {
				message:
					'No bearer token was attached to the logout request. Local browser state can still be cleared, but there was no remote Supabase session to revoke.',
				outcome: 'logged_out',
				remote_sign_out: 'skipped',
			};
		}

		const parsedBearerToken = readBearerToken(authorizationHeader);

		if (parsedBearerToken.status !== 'present' || parsedBearerToken.token === undefined) {
			throw new AuthRouteError(401, 'Authorization header must use the Bearer token format.');
		}

		const client = resolveSupabaseActionClientOrThrow(options.supabase);
		await callSupabaseAuthEndpoint(client, {
			authorizationToken: parsedBearerToken.token,
			pathname: '/auth/v1/logout',
		});
		closeWebSocketSessionsForAuthContext(request.auth, {
			code: 1000,
			reason: 'WebSocket session closed after logout.',
		});

		return {
			message:
				'Supabase sign-out completed. Refresh tokens were revoked, but the current access token can remain valid until it expires.',
			outcome: 'logged_out',
			remote_sign_out: 'succeeded',
		};
	});

	server.post('/auth/ws-ticket', async (request) => {
		const principal = requireAuthenticatedRequest(request);
		const path = parseWebSocketTicketPath(request.body);

		if (path === '/ws/desktop-agent' && principal.kind !== 'authenticated') {
			throw new AuthRouteError(
				403,
				'Desktop agent websocket tickets require an authenticated user session.',
			);
		}

		if (!options.issue_ws_ticket) {
			throw new AuthRouteError(503, 'WebSocket ticket issuer is not configured.');
		}

		return options.issue_ws_ticket({
			auth: request.auth,
			path,
			request_id: request.id,
		});
	});

	server.get('/auth/oauth/start', async (request, reply) => {
		const queryCandidate = isRecord(request.query)
			? (request.query as OAuthStartQueryCandidate)
			: undefined;
		const providerValue = normalizeRequiredString(queryCandidate?.provider, 'provider');
		const client = resolveSupabaseActionClientOrThrow(options.supabase);

		if (!isOAuthProvider(providerValue)) {
			throw new AuthRouteError(400, 'Unsupported OAuth provider.');
		}

		const redirectToCandidate = resolveSameOriginRedirectTarget(
			request,
			normalizeOptionalString(queryCandidate?.redirect_to),
		);
		const codeChallenge = normalizePkceCodeChallenge(queryCandidate?.code_challenge);
		const codeChallengeMethod = normalizePkceCodeChallengeMethod(
			queryCandidate?.code_challenge_method,
		);

		if ((codeChallenge && !codeChallengeMethod) || (!codeChallenge && codeChallengeMethod)) {
			throw new AuthRouteError(
				400,
				'code_challenge and code_challenge_method must be provided together for PKCE.',
			);
		}

		const authorizeUrl = new URL('/auth/v1/authorize', client.supabase_url);
		authorizeUrl.searchParams.set('provider', providerValue);
		authorizeUrl.searchParams.set('redirect_to', redirectToCandidate);

		if (codeChallenge && codeChallengeMethod) {
			authorizeUrl.searchParams.set('code_challenge', codeChallenge);
			authorizeUrl.searchParams.set('code_challenge_method', codeChallengeMethod);
		}

		return reply.redirect(resolveRedirectTarget(authorizeUrl.toString()));
	});

	server.get('/auth/oauth/callback', async (request, reply) => {
		const queryCandidate = isRecord(request.query)
			? (request.query as OAuthCallbackQueryCandidate)
			: undefined;
		const redirectTarget = resolveSameOriginRedirectTarget(
			request,
			normalizeOptionalString(queryCandidate?.redirect_to),
		);

		return reply.redirect(
			resolveRedirectTarget(appendOAuthRelayParams(redirectTarget, queryCandidate)),
		);
	});

	server.post<{ Reply: AuthPasswordActionResponse }>(
		'/auth/oauth/callback/exchange',
		async (request) => {
			const client = resolveSupabaseActionClientOrThrow(options.supabase);
			const body = parseOAuthCodeExchangeBody(request.body);
			const payload = await callSupabaseAuthEndpoint(client, {
				pathname: '/auth/v1/token?grant_type=pkce',
				payload: {
					auth_code: body.auth_code,
					code_verifier: body.code_verifier,
				},
			});
			const session = readSupabaseSessionTokens(payload);

			if (!session) {
				throw new AuthRouteError(
					502,
					'OAuth callback code exchange succeeded but no access token was returned.',
				);
			}

			return createAuthenticatedActionResponse(session, request.id, options.verify_token);
		},
	);

	server.post<{ Reply: AuthPasswordActionResponse }>('/auth/session/refresh', async (request) => {
		const client = resolveSupabaseActionClientOrThrow(options.supabase);
		const refreshToken = parseRefreshToken(request.body);
		const payload = await callSupabaseAuthEndpoint(client, {
			pathname: '/auth/v1/token?grant_type=refresh_token',
			payload: {
				refresh_token: refreshToken,
			},
		});
		const session = readSupabaseSessionTokens(payload);

		if (!session) {
			throw new AuthRouteError(502, 'Session refresh succeeded but no access token was returned.');
		}

		return createAuthenticatedActionResponse(session, request.id, options.verify_token);
	});

	const environment = options.supabase?.environment;
	const localDevVerifier = createLocalDevTokenVerifierFromEnvironment({
		environment,
		fetch: options.supabase?.fetch,
	});

	if (localDevVerifier && environment?.RUNA_DEV_AUTH_ENABLED?.trim() === '1') {
		server.get('/auth/dev/bootstrap', async (request, reply) => {
			if (!isLoopbackRequest(request)) {
				throw new AuthRouteError(
					403,
					'Local dev auth bootstrap only accepts loopback-local requests.',
				);
			}

			const queryCandidate = isRecord(request.query)
				? (request.query as LocalDevBootstrapQueryCandidate)
				: undefined;
			const redirectTarget = normalizeRequiredString(queryCandidate?.redirect_to, 'redirect_to');

			if (!isLoopbackRedirectTarget(redirectTarget)) {
				throw new AuthRouteError(
					400,
					'redirect_to must stay on a localhost or 127.0.0.1 origin for local dev auth bootstrap.',
				);
			}

			const secret = environment?.RUNA_DEV_AUTH_SECRET?.trim();

			if (!secret) {
				throw new AuthRouteError(503, 'Local dev auth bootstrap secret is not configured.');
			}

			const session = createLocalDevSessionToken({
				email: environment?.RUNA_DEV_AUTH_EMAIL?.trim().length
					? environment.RUNA_DEV_AUTH_EMAIL?.trim()
					: 'dev@runa.local',
				secret,
			});
			const verification = await localDevVerifier({
				request_id: request.id,
				token: session.access_token,
			});

			if (!verification) {
				throw new AuthRouteError(503, 'Local dev auth bootstrap verifier is not available.');
			}

			const auth = createAuthContextFromVerification(verification, request.id);

			if (auth.principal.kind !== 'authenticated') {
				throw new AuthRouteError(
					503,
					'Local dev auth bootstrap must resolve to an authenticated session.',
				);
			}

			return reply.redirect(
				resolveRedirectTarget(buildLocalDevBootstrapRedirectTarget(redirectTarget, session)),
			);
		});
	}
}
