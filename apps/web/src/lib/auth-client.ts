import type {
	AuthContext,
	AuthEmailPasswordCredentials,
	AuthLogoutResponse,
	AuthPasswordActionResponse,
	AuthPasswordSignupRequest,
	AuthSessionTokens,
	OAuthProvider,
} from '@runa/types';

const AUTH_BEARER_TOKEN_STORAGE_KEY = 'runa.auth.bearer_token';

export interface AuthContextResponse {
	readonly auth: AuthContext;
	readonly principal_kind: AuthContext['principal']['kind'];
}

export interface FetchAuthContextInput {
	readonly bearerToken?: string;
	readonly signal?: AbortSignal;
}

export interface OAuthRedirectErrorResult {
	readonly message: string;
	readonly status: 'error';
}

export interface OAuthRedirectSessionResult {
	readonly session: AuthSessionTokens;
	readonly status: 'session';
}

export interface OAuthRedirectEmptyResult {
	readonly status: 'empty';
}

export type OAuthRedirectResult =
	| OAuthRedirectEmptyResult
	| OAuthRedirectErrorResult
	| OAuthRedirectSessionResult;

interface AuthContextCandidate {
	readonly auth?: unknown;
	readonly principal_kind?: unknown;
}

interface AuthContextShapeCandidate {
	readonly principal?: unknown;
	readonly transport?: unknown;
}

interface AuthActionResponseCandidate {
	readonly auth?: unknown;
	readonly email?: unknown;
	readonly message?: unknown;
	readonly outcome?: unknown;
	readonly principal_kind?: unknown;
	readonly remote_sign_out?: unknown;
	readonly session?: unknown;
}

interface AuthPrincipalShapeCandidate {
	readonly email?: unknown;
	readonly kind?: unknown;
	readonly provider?: unknown;
	readonly role?: unknown;
	readonly scope?: unknown;
	readonly service_name?: unknown;
	readonly session_id?: unknown;
	readonly user_id?: unknown;
}

interface AuthScopeShapeCandidate {
	readonly tenant_id?: unknown;
	readonly workspace_id?: unknown;
	readonly workspace_ids?: unknown;
}

interface SessionTokensCandidate {
	readonly access_token?: unknown;
	readonly expires_at?: unknown;
	readonly expires_in?: unknown;
	readonly refresh_token?: unknown;
	readonly token_type?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAuthScope(value: unknown): boolean {
	if (!isRecord(value)) {
		return false;
	}

	const scope = value as AuthScopeShapeCandidate;

	return (
		(scope.tenant_id === undefined || typeof scope.tenant_id === 'string') &&
		(scope.workspace_id === undefined || typeof scope.workspace_id === 'string') &&
		(scope.workspace_ids === undefined ||
			(Array.isArray(scope.workspace_ids) &&
				scope.workspace_ids.every((workspaceId) => typeof workspaceId === 'string')))
	);
}

function isAuthPrincipal(value: unknown): value is AuthContext['principal'] {
	if (!isRecord(value)) {
		return false;
	}

	const principal = value as AuthPrincipalShapeCandidate;

	if (
		(principal.session_id !== undefined && typeof principal.session_id !== 'string') ||
		!isAuthScope(principal.scope)
	) {
		return false;
	}

	switch (principal.kind) {
		case 'anonymous':
			return principal.provider === 'internal' && principal.role === 'anon';
		case 'authenticated':
			return (
				typeof principal.provider === 'string' &&
				principal.role === 'authenticated' &&
				typeof principal.user_id === 'string' &&
				(principal.email === undefined || typeof principal.email === 'string')
			);
		case 'service':
			return (
				typeof principal.provider === 'string' &&
				principal.role === 'service_role' &&
				typeof principal.service_name === 'string'
			);
		default:
			return false;
	}
}

function isAuthContext(value: unknown): value is AuthContext {
	if (!isRecord(value)) {
		return false;
	}

	const authContext = value as AuthContextShapeCandidate;

	return (
		isAuthPrincipal(authContext.principal) &&
		(authContext.transport === 'http' ||
			authContext.transport === 'websocket' ||
			authContext.transport === 'desktop_bridge' ||
			authContext.transport === 'internal')
	);
}

function isAuthContextResponse(value: unknown): value is AuthContextResponse {
	if (!isRecord(value)) {
		return false;
	}

	const response = value as AuthContextCandidate;

	return (
		(response.principal_kind === 'anonymous' ||
			response.principal_kind === 'authenticated' ||
			response.principal_kind === 'service') &&
		isAuthContext(response.auth) &&
		response.auth.principal.kind === response.principal_kind
	);
}

function isAuthSessionTokens(value: unknown): value is AuthSessionTokens {
	if (!isRecord(value)) {
		return false;
	}

	const session = value as SessionTokensCandidate;

	return (
		typeof session.access_token === 'string' &&
		(session.expires_at === undefined || typeof session.expires_at === 'number') &&
		(session.expires_in === undefined || typeof session.expires_in === 'number') &&
		(session.refresh_token === undefined || typeof session.refresh_token === 'string') &&
		(session.token_type === undefined || typeof session.token_type === 'string')
	);
}

function isAuthPasswordActionResponse(value: unknown): value is AuthPasswordActionResponse {
	if (!isRecord(value)) {
		return false;
	}

	const response = value as AuthActionResponseCandidate;

	if (response.outcome === 'verification_required') {
		return typeof response.email === 'string' && typeof response.message === 'string';
	}

	if (response.outcome === 'authenticated') {
		return (
			(response.principal_kind === 'authenticated' || response.principal_kind === 'service') &&
			isAuthContext(response.auth) &&
			isAuthSessionTokens(response.session)
		);
	}

	return false;
}

function isAuthLogoutResponse(value: unknown): value is AuthLogoutResponse {
	if (!isRecord(value)) {
		return false;
	}

	const response = value as AuthActionResponseCandidate;

	return (
		response.outcome === 'logged_out' &&
		typeof response.message === 'string' &&
		(response.remote_sign_out === 'skipped' || response.remote_sign_out === 'succeeded')
	);
}

function resolveSessionStorage(): Storage | null {
	if (typeof window === 'undefined') {
		return null;
	}

	return window.sessionStorage;
}

function readJsonErrorMessage(value: string): string | null {
	try {
		const parsed = JSON.parse(value) as unknown;

		if (!isRecord(parsed)) {
			return null;
		}

		const message = parsed['message'];
		return typeof message === 'string' && message.trim().length > 0 ? message.trim() : null;
	} catch {
		return null;
	}
}

export function formatAuthErrorMessage(message: string, status?: number): string {
	const normalizedMessage = readJsonErrorMessage(message) ?? message.trim();
	const lowerMessage = normalizedMessage.toLowerCase();

	if (
		lowerMessage.includes('invalid login credentials') ||
		lowerMessage.includes('invalid credentials')
	) {
		return 'E-posta veya ÅŸifre hatalÄ±. Bilgileri kontrol et; yerel geliÅŸtirme yapÄ±yorsan deneme oturumunu da baÅŸlatabilirsin.';
	}

	if (
		status === 502 ||
		status === 503 ||
		status === 504 ||
		lowerMessage.includes('502') ||
		lowerMessage.includes('503') ||
		lowerMessage.includes('504') ||
		lowerMessage.includes('bad gateway') ||
		lowerMessage.includes('failed to fetch') ||
		lowerMessage.includes('networkerror')
	) {
		return 'Kimlik doÄŸrulama servisine ÅŸu an ulaÅŸÄ±lamÄ±yor. Biraz sonra tekrar dene; yerel geliÅŸtirme yapÄ±yorsan deneme oturumunu baÅŸlatabilirsin.';
	}

	if (normalizedMessage.length === 0) {
		return status
			? `Kimlik doÄŸrulama isteÄŸi ${status} durumuyla baÅŸarÄ±sÄ±z oldu.`
			: 'Kimlik doÄŸrulama isteÄŸi baÅŸarÄ±sÄ±z oldu.';
	}

	return normalizedMessage;
}

async function readErrorMessage(response: Response): Promise<string> {
	const responseText = await response.text();
	const trimmedText = responseText.trim();

	if (trimmedText.length === 0) {
		return formatAuthErrorMessage('', response.status);
	}

	return formatAuthErrorMessage(trimmedText, response.status);
}

async function requestAuthJson(
	input: Readonly<{
		bearerToken?: string;
		body?: Record<string, unknown>;
		method: 'GET' | 'POST';
		pathname: string;
		signal?: AbortSignal;
		validate: (value: unknown) => boolean;
		validationErrorMessage: string;
	}>,
): Promise<unknown> {
	const headers = new Headers({
		accept: 'application/json',
	});

	if (input.body) {
		headers.set('content-type', 'application/json');
	}

	if (input.bearerToken && input.bearerToken.trim().length > 0) {
		headers.set('authorization', `Bearer ${input.bearerToken.trim()}`);
	}

	const response = await fetch(input.pathname, {
		body: input.body ? JSON.stringify(input.body) : undefined,
		cache: 'no-store',
		credentials: 'same-origin',
		headers,
		method: input.method,
		signal: input.signal,
	});

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	const parsed = (await response.json()) as unknown;

	if (!input.validate(parsed)) {
		throw new Error(input.validationErrorMessage);
	}

	return parsed;
}

function clearWindowHash(): void {
	if (typeof window === 'undefined') {
		return;
	}

	const nextUrl = `${window.location.pathname}${window.location.search}`;
	window.history.replaceState(null, document.title, nextUrl);
}

function parseNumberParam(value: string | null): number | undefined {
	if (!value) {
		return undefined;
	}

	const parsed = Number(value);

	return Number.isFinite(parsed) ? parsed : undefined;
}

export function readStoredBearerToken(): string | null {
	const storage = resolveSessionStorage();

	if (!storage) {
		return null;
	}

	const storedToken = storage.getItem(AUTH_BEARER_TOKEN_STORAGE_KEY)?.trim();

	return storedToken && storedToken.length > 0 ? storedToken : null;
}

export function writeStoredBearerToken(token: string): void {
	const storage = resolveSessionStorage();

	if (!storage) {
		return;
	}

	const normalizedToken = token.trim();

	if (normalizedToken.length === 0) {
		throw new Error('Bearer token is required.');
	}

	storage.setItem(AUTH_BEARER_TOKEN_STORAGE_KEY, normalizedToken);
}

export function clearStoredBearerToken(): void {
	const storage = resolveSessionStorage();

	if (!storage) {
		return;
	}

	storage.removeItem(AUTH_BEARER_TOKEN_STORAGE_KEY);
}

export async function loginWithPassword(
	input: AuthEmailPasswordCredentials,
): Promise<AuthPasswordActionResponse> {
	const parsed = await requestAuthJson({
		body: {
			email: input.email.trim(),
			password: input.password,
		},
		method: 'POST',
		pathname: '/auth/login',
		validate: isAuthPasswordActionResponse,
		validationErrorMessage: 'Desteklenmeyen login yanÄ±tÄ±.',
	});

	return parsed as AuthPasswordActionResponse;
}

export async function signupWithPassword(
	input: AuthPasswordSignupRequest,
): Promise<AuthPasswordActionResponse> {
	const parsed = await requestAuthJson({
		body: {
			email: input.email.trim(),
			password: input.password,
		},
		method: 'POST',
		pathname: '/auth/signup',
		validate: isAuthPasswordActionResponse,
		validationErrorMessage: 'Desteklenmeyen signup yanÄ±tÄ±.',
	});

	return parsed as AuthPasswordActionResponse;
}

export async function logout(bearerToken?: string): Promise<AuthLogoutResponse> {
	const parsed = await requestAuthJson({
		bearerToken,
		method: 'POST',
		pathname: '/auth/logout',
		validate: isAuthLogoutResponse,
		validationErrorMessage: 'Desteklenmeyen logout yanÄ±tÄ±.',
	});

	return parsed as AuthLogoutResponse;
}

export function buildOAuthStartPath(provider: OAuthProvider, redirectTo?: string): string {
	const searchParams = new URLSearchParams({
		provider,
	});

	if (redirectTo && redirectTo.trim().length > 0) {
		searchParams.set('redirect_to', redirectTo.trim());
	}

	return `/auth/oauth/start?${searchParams.toString()}`;
}

export function buildLocalDevBootstrapPath(redirectTo?: string): string {
	const searchParams = new URLSearchParams();

	if (redirectTo && redirectTo.trim().length > 0) {
		searchParams.set('redirect_to', redirectTo.trim());
	}

	return `/auth/dev/bootstrap?${searchParams.toString()}`;
}

export function isLocalDevAuthUiEnabled(): boolean {
	return import.meta.env.DEV;
}

export function consumeOAuthRedirectResult(): OAuthRedirectResult {
	if (typeof window === 'undefined') {
		return {
			status: 'empty',
		};
	}

	const hash = window.location.hash.trim();

	if (!hash.startsWith('#') || hash.length <= 1) {
		return {
			status: 'empty',
		};
	}

	const hashParams = new URLSearchParams(hash.slice(1));
	const accessToken = hashParams.get('access_token')?.trim();
	const authErrorDescription = hashParams.get('error_description')?.trim();
	const authError = hashParams.get('error')?.trim();

	if (accessToken && accessToken.length > 0) {
		const session: AuthSessionTokens = {
			access_token: accessToken,
			expires_at: parseNumberParam(hashParams.get('expires_at')),
			expires_in: parseNumberParam(hashParams.get('expires_in')),
			refresh_token: hashParams.get('refresh_token')?.trim() || undefined,
			token_type: hashParams.get('token_type')?.trim() || undefined,
		};

		clearWindowHash();
		return {
			session,
			status: 'session',
		};
	}

	if (authErrorDescription || authError) {
		clearWindowHash();
		return {
			message: authErrorDescription ?? authError ?? 'OAuth ile giriÅŸ baÅŸarÄ±sÄ±z oldu.',
			status: 'error',
		};
	}

	return {
		status: 'empty',
	};
}

export async function fetchAuthContext(
	input: FetchAuthContextInput = {},
): Promise<AuthContextResponse> {
	const headers = new Headers({
		accept: 'application/json',
	});
	const bearerToken = input.bearerToken?.trim();

	if (bearerToken) {
		headers.set('authorization', `Bearer ${bearerToken}`);
	}

	const response = await fetch('/auth/context', {
		cache: 'no-store',
		credentials: 'same-origin',
		headers,
		method: 'GET',
		signal: input.signal,
	});

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	const parsed = (await response.json()) as unknown;

	if (!isAuthContextResponse(parsed)) {
		throw new Error('Desteklenmeyen auth context yanÄ±tÄ±.');
	}

	return parsed;
}
