import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
	AuthClaims,
	AuthContext,
	AuthIdentityProvider,
	AuthMetadata,
	AuthProvider,
	AuthScope,
	AuthSession,
	AuthUser,
	AuthenticatedPrincipal,
	ServicePrincipal,
} from '@runa/types';
import type { FastifyReply, FastifyRequest } from 'fastify';

type SupportedAuthProvider = Extract<AuthProvider, 'external_jwt' | 'internal' | 'supabase'>;
const LOCAL_DEV_TOKEN_AUDIENCE = 'authenticated';
const LOCAL_DEV_TOKEN_ISSUER = 'runa-dev-local';
const LOCAL_DEV_TOKEN_LIFETIME_SECONDS = 60 * 60 * 8;

export interface VerifyAuthTokenInput {
	readonly request_id?: string;
	readonly token: string;
}

export interface AuthVerificationResult {
	readonly claims: AuthClaims;
	readonly provider?: SupportedAuthProvider;
	readonly session?: AuthSession;
	readonly user?: AuthUser;
}

export type AuthTokenVerifier = (input: VerifyAuthTokenInput) => Promise<AuthVerificationResult>;

export interface CreateSupabaseAuthMiddlewareInput {
	readonly verify_token: AuthTokenVerifier;
}

export interface SupabaseTokenVerifierEnvironment {
	readonly NODE_ENV?: string;
	readonly RUNA_DEV_AUTH_EMAIL?: string;
	readonly RUNA_DEV_AUTH_ENABLED?: string;
	readonly RUNA_DEV_AUTH_SECRET?: string;
	readonly SUPABASE_ANON_KEY?: string;
	readonly SUPABASE_SERVICE_ROLE_KEY?: string;
	readonly SUPABASE_URL?: string;
}

export interface CreateSupabaseTokenVerifierInput {
	readonly environment?: SupabaseTokenVerifierEnvironment;
	readonly fetch?: typeof fetch;
}

export interface ParsedBearerToken {
	readonly status: 'malformed' | 'missing' | 'present';
	readonly token?: string;
}

type SupabaseAuthErrorCode =
	| 'SUPABASE_AUTH_REQUIRED'
	| 'SUPABASE_AUTH_INVALID_AUTHORIZATION_HEADER'
	| 'SUPABASE_AUTH_INVALID_TOKEN';

interface SupabaseAuthErrorCandidate {
	readonly error?: unknown;
	readonly error_description?: unknown;
	readonly message?: unknown;
	readonly msg?: unknown;
}

interface JwtClaimsPayloadCandidate {
	readonly app_metadata?: unknown;
	readonly aud?: unknown;
	readonly email?: unknown;
	readonly email_verified?: unknown;
	readonly exp?: unknown;
	readonly iat?: unknown;
	readonly iss?: unknown;
	readonly role?: unknown;
	readonly scope?: unknown;
	readonly session_id?: unknown;
	readonly sub?: unknown;
	readonly user_metadata?: unknown;
}

interface AuthScopeCandidate {
	readonly tenant_id?: unknown;
	readonly workspace_id?: unknown;
	readonly workspace_ids?: unknown;
}

interface IdentityProviderMetadataCandidate {
	readonly provider?: unknown;
}

interface SupabaseUserPayloadCandidate {
	readonly app_metadata?: unknown;
	readonly created_at?: unknown;
	readonly email?: unknown;
	readonly email_confirmed_at?: unknown;
	readonly id?: unknown;
	readonly identities?: unknown;
	readonly updated_at?: unknown;
	readonly user_metadata?: unknown;
}

interface LocalDevJwtHeaderCandidate {
	readonly alg?: unknown;
	readonly typ?: unknown;
}

interface CreateLocalDevSessionTokenInput {
	readonly email?: string;
	readonly secret: string;
	readonly session_id?: string;
	readonly user_id?: string;
}

interface LocalDevTokenPayload {
	readonly access_token: string;
	readonly expires_at: number;
	readonly expires_in: number;
	readonly issued_at: number;
}

export class SupabaseAuthError extends Error {
	readonly code: SupabaseAuthErrorCode;
	readonly statusCode = 401;

	constructor(code: SupabaseAuthErrorCode, message: string) {
		super(message);
		this.code = code;
		this.name = 'SupabaseAuthError';
	}
}

declare module 'fastify' {
	interface FastifyRequest {
		auth: AuthContext;
	}
}

function resolveAuthProvider(provider: SupportedAuthProvider | undefined): SupportedAuthProvider {
	return provider ?? 'supabase';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeScope(value: unknown): AuthScope {
	if (!isRecord(value)) {
		return {};
	}

	const candidate = value as AuthScopeCandidate;

	const tenantId = normalizeOptionalString(candidate.tenant_id);
	const workspaceId = normalizeOptionalString(candidate.workspace_id);
	const workspaceIds = Array.isArray(candidate.workspace_ids)
		? candidate.workspace_ids
				.map((workspaceValue) => normalizeOptionalString(workspaceValue))
				.filter((workspaceValue): workspaceValue is string => workspaceValue !== undefined)
		: undefined;

	return {
		tenant_id: tenantId,
		workspace_id: workspaceId,
		workspace_ids: workspaceIds,
	};
}

function normalizeMetadata(value: unknown): AuthMetadata | undefined {
	return isRecord(value) ? value : undefined;
}

function createBase64Url(input: string): string {
	return Buffer.from(input, 'utf8').toString('base64url');
}

function signTokenPayload(
	input: Readonly<{ header: string; payload: string; secret: string }>,
): string {
	return createHmac('sha256', input.secret)
		.update(`${input.header}.${input.payload}`)
		.digest('base64url');
}

function readNumericDate(value: number | undefined, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function toIsoDate(value: number | undefined): string | undefined {
	return typeof value === 'number' ? new Date(value * 1000).toISOString() : undefined;
}

function parseJwtPayload(token: string): AuthClaims {
	const [, payloadSegment] = token.split('.');

	if (!payloadSegment) {
		throw new SupabaseAuthError('SUPABASE_AUTH_INVALID_TOKEN', 'Invalid or expired bearer token.');
	}

	try {
		const jsonText = Buffer.from(payloadSegment, 'base64url').toString('utf8');
		const parsed = JSON.parse(jsonText) as unknown;

		if (!isRecord(parsed)) {
			throw new Error('JWT payload must be an object.');
		}

		const candidate = parsed as JwtClaimsPayloadCandidate;

		const subject = normalizeOptionalString(candidate.sub);

		if (!subject) {
			throw new Error('JWT payload must include a subject.');
		}

		const roleValue = normalizeOptionalString(candidate.role);
		const normalizedRole =
			roleValue === 'anon' || roleValue === 'authenticated' || roleValue === 'service_role'
				? roleValue
				: undefined;

		return {
			app_metadata: normalizeMetadata(candidate.app_metadata),
			aud:
				typeof candidate.aud === 'string'
					? candidate.aud
					: Array.isArray(candidate.aud)
						? candidate.aud.filter((audience): audience is string => typeof audience === 'string')
						: undefined,
			email: normalizeOptionalString(candidate.email),
			email_verified:
				typeof candidate.email_verified === 'boolean' ? candidate.email_verified : undefined,
			exp: typeof candidate.exp === 'number' ? candidate.exp : undefined,
			iat: typeof candidate.iat === 'number' ? candidate.iat : undefined,
			iss: normalizeOptionalString(candidate.iss),
			raw_claims: parsed,
			role: normalizedRole,
			scope: normalizeScope(candidate.scope),
			session_id: normalizeOptionalString(candidate.session_id),
			sub: subject,
			user_metadata: normalizeMetadata(candidate.user_metadata),
		};
	} catch {
		throw new SupabaseAuthError('SUPABASE_AUTH_INVALID_TOKEN', 'Invalid or expired bearer token.');
	}
}

async function readResponsePayload(response: Response): Promise<unknown> {
	const responseText = await response.text();
	const trimmedResponse = responseText.trim();

	if (trimmedResponse.length === 0) {
		return null;
	}

	try {
		return JSON.parse(trimmedResponse) as unknown;
	} catch {
		return trimmedResponse;
	}
}

function extractSupabaseAuthErrorMessage(value: unknown): string | null {
	if (typeof value === 'string' && value.trim().length > 0) {
		return value.trim();
	}

	if (!isRecord(value)) {
		return null;
	}

	const candidate = value as SupabaseAuthErrorCandidate;

	return (
		normalizeOptionalString(candidate.message) ??
		normalizeOptionalString(candidate.msg) ??
		normalizeOptionalString(candidate.error_description) ??
		normalizeOptionalString(candidate.error) ??
		null
	);
}

function resolveIdentityProviderFromMetadata(
	metadata: AuthMetadata | undefined,
): AuthIdentityProvider {
	const metadataCandidate = metadata as IdentityProviderMetadataCandidate | undefined;
	const provider = normalizeOptionalString(metadataCandidate?.provider);

	switch (provider) {
		case 'email':
		case 'email_password':
			return 'email_password';
		case 'magic_link':
		case 'magiclink':
		case 'phone':
		case 'sms':
			return 'magic_link';
		case 'service_role':
		case 'service_token':
			return 'service_token';
		default:
			return provider === undefined ? 'email_password' : 'oauth';
	}
}

function createSessionFromClaims(claims: AuthClaims): AuthSession | undefined {
	if (claims.role === 'service_role') {
		return undefined;
	}

	return {
		expires_at: toIsoDate(claims.exp),
		identity_provider: resolveIdentityProviderFromMetadata(claims.app_metadata),
		issued_at: toIsoDate(claims.iat),
		provider: 'supabase',
		scope: claims.scope,
		session_id: claims.session_id ?? claims.sub,
		user_id: claims.sub,
	};
}

function createLocalDevSessionFromClaims(claims: AuthClaims): AuthSession {
	return {
		expires_at: toIsoDate(claims.exp),
		identity_provider: 'service_token',
		issued_at: toIsoDate(claims.iat),
		provider: 'internal',
		scope: claims.scope,
		session_id: claims.session_id ?? claims.sub,
		user_id: claims.sub,
	};
}

function createLocalDevUserFromClaims(claims: AuthClaims): AuthUser {
	return {
		email: claims.email,
		email_verified: true,
		identities: [],
		primary_provider: 'internal',
		scope: claims.scope,
		status: 'active',
		user_id: claims.sub,
	};
}

function readMetadataString(metadata: AuthMetadata | undefined, key: string): string | undefined {
	if (!metadata) {
		return undefined;
	}

	return normalizeOptionalString(metadata[key]);
}

function createUserFromClaims(claims: AuthClaims, payload: unknown): AuthUser {
	const userPayload = isRecord(payload) ? (payload as SupabaseUserPayloadCandidate) : undefined;
	const userMetadata = normalizeMetadata(userPayload?.user_metadata);
	const scope = claims.scope;
	const emailFromPayload = normalizeOptionalString(userPayload?.email);
	const emailConfirmedAt = normalizeOptionalString(userPayload?.email_confirmed_at);
	const userIdFromPayload = normalizeOptionalString(userPayload?.id);

	return {
		avatar_url:
			readMetadataString(userMetadata, 'avatar_url') ?? readMetadataString(userMetadata, 'picture'),
		created_at: normalizeOptionalString(userPayload?.created_at),
		display_name:
			readMetadataString(userMetadata, 'display_name') ??
			readMetadataString(userMetadata, 'full_name') ??
			readMetadataString(userMetadata, 'name'),
		email: emailFromPayload ?? claims.email,
		email_verified: claims.email_verified ?? emailConfirmedAt !== undefined,
		identities: [],
		metadata: userMetadata,
		primary_provider: 'supabase',
		scope,
		status: 'active',
		updated_at: normalizeOptionalString(userPayload?.updated_at),
		user_id: userIdFromPayload ?? claims.sub,
	};
}

async function verifySupabaseAccessToken(
	input: Readonly<{
		anon_key: string;
		auth_fetch: typeof fetch;
		supabase_url: string;
		token: string;
	}>,
): Promise<unknown> {
	const response = await input.auth_fetch(`${input.supabase_url}/auth/v1/user`, {
		headers: {
			apikey: input.anon_key,
			authorization: `Bearer ${input.token}`,
		},
		method: 'GET',
	});
	const responsePayload = await readResponsePayload(response);

	if (!response.ok) {
		throw new SupabaseAuthError(
			'SUPABASE_AUTH_INVALID_TOKEN',
			extractSupabaseAuthErrorMessage(responsePayload) ?? 'Invalid or expired bearer token.',
		);
	}

	return responsePayload;
}

export function createSupabaseTokenVerifierFromEnvironment(
	input: CreateSupabaseTokenVerifierInput = {},
): AuthTokenVerifier | null {
	const authFetch = input.fetch ?? globalThis.fetch;
	const environment = input.environment;
	const anonKey = environment?.SUPABASE_ANON_KEY?.trim();
	const supabaseUrl = environment?.SUPABASE_URL?.trim().replace(/\/+$/g, '');
	const serviceRoleKey = environment?.SUPABASE_SERVICE_ROLE_KEY?.trim();

	if (!authFetch || !anonKey || !supabaseUrl) {
		return null;
	}

	return async ({ token }) => {
		const claims = parseJwtPayload(token);

		if (serviceRoleKey && token === serviceRoleKey && claims.role === 'service_role') {
			return {
				claims,
				provider: 'supabase',
			};
		}

		const verifiedUserPayload = await verifySupabaseAccessToken({
			anon_key: anonKey,
			auth_fetch: authFetch,
			supabase_url: supabaseUrl,
			token,
		});

		return {
			claims,
			provider: 'supabase',
			session: createSessionFromClaims(claims),
			user: createUserFromClaims(claims, verifiedUserPayload),
		};
	};
}

function decodeLocalDevTokenSegment(segment: string): unknown {
	const decodedSegment = Buffer.from(segment, 'base64url').toString('utf8');
	return JSON.parse(decodedSegment) as unknown;
}

function isLocalDevHeader(value: unknown): value is LocalDevJwtHeaderCandidate {
	if (!isRecord(value)) {
		return false;
	}

	const header = value as LocalDevJwtHeaderCandidate;

	return header.alg === 'HS256' && header.typ === 'JWT';
}

function shouldEnableLocalDevAuth(environment?: SupabaseTokenVerifierEnvironment): boolean {
	return (
		environment?.RUNA_DEV_AUTH_ENABLED?.trim() === '1' &&
		environment?.NODE_ENV?.trim() === 'development'
	);
}

function isLocalDevAudience(audience: AuthClaims['aud']): boolean {
	if (typeof audience === 'string') {
		return audience === LOCAL_DEV_TOKEN_AUDIENCE;
	}

	return Array.isArray(audience) && audience.includes(LOCAL_DEV_TOKEN_AUDIENCE);
}

export function createLocalDevSessionToken(
	input: CreateLocalDevSessionTokenInput,
): LocalDevTokenPayload {
	const issuedAt = Math.trunc(Date.now() / 1000);
	const expiresAt = issuedAt + LOCAL_DEV_TOKEN_LIFETIME_SECONDS;
	const userId = input.user_id?.trim() || 'local-dev-user';
	const email = input.email?.trim() || 'dev@runa.local';
	const sessionId = input.session_id?.trim() || `local-dev-session:${issuedAt}`;
	const header = createBase64Url(
		JSON.stringify({
			alg: 'HS256',
			typ: 'JWT',
		}),
	);
	const payload = createBase64Url(
		JSON.stringify({
			aud: LOCAL_DEV_TOKEN_AUDIENCE,
			email,
			email_verified: true,
			exp: expiresAt,
			iat: issuedAt,
			iss: LOCAL_DEV_TOKEN_ISSUER,
			role: 'authenticated',
			scope: {},
			session_id: sessionId,
			sub: userId,
		} satisfies AuthClaims),
	);
	const signature = signTokenPayload({
		header,
		payload,
		secret: input.secret,
	});

	return {
		access_token: `${header}.${payload}.${signature}`,
		expires_at: expiresAt,
		expires_in: expiresAt - issuedAt,
		issued_at: issuedAt,
	};
}

export function createLocalDevTokenVerifierFromEnvironment(
	input: CreateSupabaseTokenVerifierInput = {},
): ((input: VerifyAuthTokenInput) => Promise<AuthVerificationResult | null>) | null {
	const environment = input.environment;

	if (!shouldEnableLocalDevAuth(environment)) {
		return null;
	}

	const secret = environment?.RUNA_DEV_AUTH_SECRET?.trim();

	if (!secret) {
		return null;
	}

	return async ({ token }) => {
		const [headerSegment, payloadSegment, signatureSegment, ...rest] = token.split('.');

		if (
			headerSegment === undefined ||
			payloadSegment === undefined ||
			signatureSegment === undefined ||
			rest.length > 0
		) {
			return null;
		}

		let decodedHeader: unknown;
		let claims: AuthClaims;

		try {
			decodedHeader = decodeLocalDevTokenSegment(headerSegment);
			claims = parseJwtPayload(token);
		} catch {
			return null;
		}

		if (
			!isLocalDevHeader(decodedHeader) ||
			claims.iss !== LOCAL_DEV_TOKEN_ISSUER ||
			claims.role !== 'authenticated' ||
			!isLocalDevAudience(claims.aud)
		) {
			return null;
		}

		const expectedSignature = signTokenPayload({
			header: headerSegment,
			payload: payloadSegment,
			secret,
		});
		const signatureBuffer = Buffer.from(signatureSegment, 'base64url');
		const expectedSignatureBuffer = Buffer.from(expectedSignature, 'base64url');

		if (
			signatureBuffer.length !== expectedSignatureBuffer.length ||
			!timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
		) {
			throw new SupabaseAuthError(
				'SUPABASE_AUTH_INVALID_TOKEN',
				'Invalid or expired bearer token.',
			);
		}

		const nowSeconds = Math.trunc(Date.now() / 1000);
		const expiresAt = readNumericDate(claims.exp, 0);
		const issuedAt = readNumericDate(claims.iat, 0);

		if (expiresAt <= nowSeconds || issuedAt > nowSeconds + 60) {
			throw new SupabaseAuthError(
				'SUPABASE_AUTH_INVALID_TOKEN',
				'Invalid or expired bearer token.',
			);
		}

		return {
			claims,
			provider: 'internal',
			session: createLocalDevSessionFromClaims(claims),
			user: createLocalDevUserFromClaims(claims),
		};
	};
}

function createAnonymousPrincipal(): AuthContext['principal'] {
	return {
		kind: 'anonymous',
		provider: 'internal',
		role: 'anon',
		scope: {},
	};
}

function createServiceName(verification: AuthVerificationResult): string {
	return verification.user?.display_name ?? verification.claims.iss ?? 'supabase-service-role';
}

function createPrincipal(verification: AuthVerificationResult): AuthContext['principal'] {
	const provider = resolveAuthProvider(verification.provider);

	if (verification.claims.role === 'service_role') {
		return {
			kind: 'service',
			provider,
			role: 'service_role',
			scope: verification.claims.scope,
			service_name: createServiceName(verification),
			session_id: verification.claims.session_id,
		};
	}

	return {
		email: verification.claims.email ?? verification.user?.email,
		kind: 'authenticated',
		provider,
		role: 'authenticated',
		scope: verification.claims.scope,
		session_id: verification.claims.session_id,
		user_id: verification.claims.sub,
	};
}

export function createAnonymousAuthContext(
	requestId: string | undefined,
	bearerTokenPresent = false,
): AuthContext {
	return {
		bearer_token_present: bearerTokenPresent,
		principal: createAnonymousPrincipal(),
		request_id: requestId,
		transport: 'http',
	};
}

export function createAuthContextFromVerification(
	verification: AuthVerificationResult,
	requestId: string | undefined,
): AuthContext {
	return {
		bearer_token_present: true,
		claims: verification.claims,
		principal: createPrincipal(verification),
		request_id: requestId,
		session: verification.session,
		transport: 'http',
		user: verification.user,
	};
}

export function readBearerToken(authorizationHeader: string | undefined): ParsedBearerToken {
	if (authorizationHeader === undefined || authorizationHeader.trim() === '') {
		return {
			status: 'missing',
		};
	}

	const [scheme, token, ...rest] = authorizationHeader.trim().split(/\s+/);

	if (
		scheme?.toLowerCase() !== 'bearer' ||
		token === undefined ||
		token === '' ||
		rest.length > 0
	) {
		return {
			status: 'malformed',
		};
	}

	return {
		status: 'present',
		token,
	};
}

export function createSupabaseAuthMiddleware(input: CreateSupabaseAuthMiddlewareInput) {
	return async function supabaseAuthMiddleware(
		request: FastifyRequest,
		_reply: FastifyReply,
	): Promise<void> {
		const parsedToken = readBearerToken(request.headers.authorization);

		if (parsedToken.status === 'missing') {
			request.auth = createAnonymousAuthContext(request.id);
			return;
		}

		if (parsedToken.status === 'malformed' || parsedToken.token === undefined) {
			throw new SupabaseAuthError(
				'SUPABASE_AUTH_INVALID_AUTHORIZATION_HEADER',
				'Authorization header must use the Bearer token format.',
			);
		}

		try {
			const verification = await input.verify_token({
				request_id: request.id,
				token: parsedToken.token,
			});

			request.auth = createAuthContextFromVerification(verification, request.id);
		} catch (error: unknown) {
			if (error instanceof SupabaseAuthError) {
				throw error;
			}

			throw new SupabaseAuthError(
				'SUPABASE_AUTH_INVALID_TOKEN',
				'Invalid or expired bearer token.',
			);
		}
	};
}

export function requireAuthenticatedRequest(
	request: FastifyRequest,
): AuthenticatedPrincipal | ServicePrincipal {
	if (request.auth.principal.kind === 'anonymous') {
		throw new SupabaseAuthError('SUPABASE_AUTH_REQUIRED', 'Authenticated request required.');
	}

	return request.auth.principal;
}
