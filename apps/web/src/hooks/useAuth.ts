import { useEffect, useEffectEvent, useRef, useState } from 'react';

import type {
	AuthContext,
	AuthEmailPasswordCredentials,
	AuthPasswordActionResponse,
	AuthPasswordSignupRequest,
	AuthSessionTokens,
	OAuthProvider,
} from '@runa/types';

import {
	buildLocalDevBootstrapPath,
	clearStoredBearerToken,
	consumeOAuthRedirectResult,
	fetchAuthContext,
	isLocalDevAuthUiEnabled,
	loginWithPassword,
	logout,
	readStoredBearerToken,
	signupWithPassword,
	writeStoredBearerToken,
} from '../lib/auth-client.js';
import { uiCopy } from '../localization/copy.js';

export type AuthStatus = 'authenticated' | 'anonymous' | 'bootstrapping' | 'service';
export type AuthorizationRole = 'admin' | 'anonymous' | 'editor' | 'owner' | 'viewer';
export type AuthSessionState = 'active' | 'expired' | 'expiring';

const AUTH_REFRESH_TOKEN_STORAGE_KEY = 'runa.auth.refresh_token';
const AUTH_SESSION_EXPIRES_AT_STORAGE_KEY = 'runa.auth.session_expires_at';
const AUTH_PKCE_CODE_VERIFIER_STORAGE_KEY = 'runa.auth.oauth.code_verifier';
const AUTH_PKCE_REDIRECT_TARGET_STORAGE_KEY = 'runa.auth.oauth.redirect_to';
const PKCE_CODE_VERIFIER_LENGTH = 96;
const SESSION_EXPIRING_WINDOW_SECONDS = 90;

interface AuthorizationMetadataCandidate extends Record<string, unknown> {
	readonly role?: unknown;
	readonly roles?: unknown;
	readonly runa_role?: unknown;
}

interface AuthenticatedActionResponseCandidate extends Record<string, unknown> {
	readonly outcome?: unknown;
	readonly session?: unknown;
}

interface SessionCandidate extends Record<string, unknown> {
	readonly access_token?: unknown;
}

export interface UseAuthResult {
	readonly authContext: AuthContext | null;
	readonly authError: string | null;
	readonly authNotice: string | null;
	readonly authStatus: AuthStatus;
	readonly authorizationRole: AuthorizationRole;
	readonly bearerToken: string | null;
	readonly hasStoredBearerToken: boolean;
	readonly isAuthActionPending: boolean;
	readonly isAuthBootstrapPending: boolean;
	readonly isAuthPending: boolean;
	readonly sessionState: AuthSessionState;
	authenticateWithToken: (token: string) => Promise<void>;
	clearAuthToken: () => Promise<void>;
	loginWithPassword: (input: AuthEmailPasswordCredentials) => Promise<void>;
	logout: () => Promise<void>;
	refreshAuthContext: () => Promise<void>;
	signupWithPassword: (input: AuthPasswordSignupRequest) => Promise<void>;
	startLocalDevSession: () => void;
	startOAuthSignIn: (provider: OAuthProvider) => void;
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Bilinmeyen auth istegi hatasi.';
}

function resolveSessionStorage(): Storage | null {
	if (typeof window === 'undefined') {
		return null;
	}

	return window.sessionStorage;
}

function readStoredRefreshToken(): string | null {
	const storage = resolveSessionStorage();
	const value = storage?.getItem(AUTH_REFRESH_TOKEN_STORAGE_KEY)?.trim();

	return value && value.length > 0 ? value : null;
}

function writeStoredRefreshToken(refreshToken: string | undefined): void {
	const storage = resolveSessionStorage();

	if (!storage) {
		return;
	}

	if (!refreshToken || refreshToken.trim().length === 0) {
		storage.removeItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
		return;
	}

	storage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, refreshToken.trim());
}

function readStoredSessionExpiresAt(): number | null {
	const storage = resolveSessionStorage();
	const value = storage?.getItem(AUTH_SESSION_EXPIRES_AT_STORAGE_KEY)?.trim();

	if (!value) {
		return null;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function writeStoredSessionExpiresAt(expiresAt: number | undefined): void {
	const storage = resolveSessionStorage();

	if (!storage) {
		return;
	}

	if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
		storage.removeItem(AUTH_SESSION_EXPIRES_AT_STORAGE_KEY);
		return;
	}

	storage.setItem(AUTH_SESSION_EXPIRES_AT_STORAGE_KEY, String(expiresAt));
}

function clearStoredSessionSecrets(): void {
	writeStoredRefreshToken(undefined);
	writeStoredSessionExpiresAt(undefined);
}

function storeSessionTokens(session: AuthSessionTokens): void {
	writeStoredRefreshToken(session.refresh_token);
	writeStoredSessionExpiresAt(
		typeof session.expires_at === 'number'
			? session.expires_at
			: typeof session.expires_in === 'number'
				? Math.trunc(Date.now() / 1000) + session.expires_in
				: undefined,
	);
}

function resolveAuthorizationRole(authContext: AuthContext | null): AuthorizationRole {
	if (!authContext || authContext.principal.kind === 'anonymous') {
		return 'anonymous';
	}

	if (authContext.principal.kind === 'service') {
		return 'admin';
	}

	const metadataCandidates = [authContext.claims?.app_metadata, authContext.user?.metadata];

	for (const metadata of metadataCandidates) {
		if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
			continue;
		}

		const metadataCandidate = metadata as AuthorizationMetadataCandidate;
		const runaRole = metadataCandidate.runa_role;
		const role = metadataCandidate.role;
		const roles = metadataCandidate.roles;
		const candidates = [
			typeof runaRole === 'string' ? runaRole : null,
			typeof role === 'string' ? role : null,
			...(Array.isArray(roles)
				? roles.filter((value): value is string => typeof value === 'string')
				: []),
		];

		for (const candidate of candidates) {
			if (
				candidate === 'viewer' ||
				candidate === 'editor' ||
				candidate === 'owner' ||
				candidate === 'admin'
			) {
				return candidate;
			}
		}
	}

	return 'editor';
}

function resolveSessionState(expiresAt: number | null): AuthSessionState {
	if (expiresAt === null) {
		return 'active';
	}

	const nowSeconds = Math.trunc(Date.now() / 1000);

	if (expiresAt <= nowSeconds) {
		return 'expired';
	}

	if (expiresAt <= nowSeconds + SESSION_EXPIRING_WINDOW_SECONDS) {
		return 'expiring';
	}

	return 'active';
}

function clearOAuthQueryParams(): void {
	if (typeof window === 'undefined') {
		return;
	}

	const url = new URL(window.location.href);
	url.searchParams.delete('auth_code');
	url.searchParams.delete('auth_error');
	url.searchParams.delete('auth_error_description');
	window.history.replaceState(null, document.title, `${url.pathname}${url.search}${url.hash}`);
}

function consumeOAuthSearchResult():
	| {
			readonly authCode: string;
			readonly status: 'code';
	  }
	| {
			readonly message: string;
			readonly status: 'error';
	  }
	| {
			readonly status: 'empty';
	  } {
	if (typeof window === 'undefined') {
		return {
			status: 'empty',
		};
	}

	const url = new URL(window.location.href);
	const authCode = url.searchParams.get('auth_code')?.trim();
	const authError =
		url.searchParams.get('auth_error_description')?.trim() ??
		url.searchParams.get('auth_error')?.trim();

	if (authCode) {
		clearOAuthQueryParams();
		return {
			authCode,
			status: 'code',
		};
	}

	if (authError) {
		clearOAuthQueryParams();
		return {
			message: authError,
			status: 'error',
		};
	}

	return {
		status: 'empty',
	};
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
	let binary = '';

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

function generatePkceCodeVerifier(): string {
	const randomBytes = new Uint8Array(PKCE_CODE_VERIFIER_LENGTH);
	window.crypto.getRandomValues(randomBytes);
	return base64UrlEncodeBytes(randomBytes);
}

async function buildPkceCodeChallenge(codeVerifier: string): Promise<string> {
	const verifierBytes = new TextEncoder().encode(codeVerifier);
	const digest = await window.crypto.subtle.digest('SHA-256', verifierBytes);
	return base64UrlEncodeBytes(new Uint8Array(digest));
}

function writeStoredPkceCodeVerifier(codeVerifier: string): void {
	const storage = resolveSessionStorage();

	if (!storage) {
		return;
	}

	storage.setItem(AUTH_PKCE_CODE_VERIFIER_STORAGE_KEY, codeVerifier);
}

function readStoredPkceCodeVerifier(): string | null {
	const storage = resolveSessionStorage();
	const value = storage?.getItem(AUTH_PKCE_CODE_VERIFIER_STORAGE_KEY)?.trim();

	return value && value.length > 0 ? value : null;
}

function clearStoredPkceCodeVerifier(): void {
	const storage = resolveSessionStorage();
	storage?.removeItem(AUTH_PKCE_CODE_VERIFIER_STORAGE_KEY);
}

function writeStoredPkceRedirectTarget(redirectTarget: string): void {
	const storage = resolveSessionStorage();

	if (!storage) {
		return;
	}

	storage.setItem(AUTH_PKCE_REDIRECT_TARGET_STORAGE_KEY, redirectTarget);
}

function clearStoredPkceRedirectTarget(): void {
	const storage = resolveSessionStorage();
	storage?.removeItem(AUTH_PKCE_REDIRECT_TARGET_STORAGE_KEY);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAuthenticatedActionResponse(
	value: unknown,
): value is Extract<AuthPasswordActionResponse, { readonly outcome: 'authenticated' }> {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as AuthenticatedActionResponseCandidate;
	const sessionCandidate = isRecord(candidate.session)
		? (candidate.session as SessionCandidate)
		: undefined;

	return (
		candidate.outcome === 'authenticated' &&
		sessionCandidate !== undefined &&
		typeof sessionCandidate.access_token === 'string'
	);
}

async function readResponseErrorMessage(response: Response): Promise<string> {
	const responseText = await response.text();
	return responseText.trim().length > 0
		? responseText
		: `Auth istegi ${response.status} durumu ile basarisiz oldu.`;
}

async function postAuthenticatedAction(
	pathname: string,
	body: Record<string, unknown>,
): Promise<Extract<AuthPasswordActionResponse, { readonly outcome: 'authenticated' }>> {
	const response = await fetch(pathname, {
		body: JSON.stringify(body),
		cache: 'no-store',
		credentials: 'same-origin',
		headers: {
			accept: 'application/json',
			'content-type': 'application/json',
		},
		method: 'POST',
	});

	if (!response.ok) {
		throw new Error(await readResponseErrorMessage(response));
	}

	const parsed = (await response.json()) as unknown;

	if (!isAuthenticatedActionResponse(parsed)) {
		throw new Error('Desteklenmeyen auth action yaniti.');
	}

	return parsed;
}

export function useAuth(): UseAuthResult {
	const [authContext, setAuthContext] = useState<AuthContext | null>(null);
	const [authError, setAuthError] = useState<string | null>(null);
	const [authNotice, setAuthNotice] = useState<string | null>(null);
	const [authStatus, setAuthStatus] = useState<AuthStatus>('bootstrapping');
	const [bearerToken, setBearerToken] = useState<string | null>(null);
	const [hasStoredBearerToken, setHasStoredBearerToken] = useState(false);
	const [isAuthActionPending, setIsAuthActionPending] = useState(false);
	const [isAuthBootstrapPending, setIsAuthBootstrapPending] = useState(true);
	const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(
		readStoredSessionExpiresAt(),
	);
	const hasBootstrappedAuthContextRef = useRef(false);

	function applyAuthenticatedState(input: {
		readonly authContext: AuthContext;
		readonly bearerToken: string;
		readonly status: Extract<AuthStatus, 'authenticated' | 'service'>;
		readonly session?: AuthSessionTokens;
	}): void {
		writeStoredBearerToken(input.bearerToken);
		storeSessionTokens(input.session ?? { access_token: input.bearerToken });
		setAuthContext(input.authContext);
		setAuthError(null);
		setAuthStatus(input.status);
		setBearerToken(input.bearerToken);
		setHasStoredBearerToken(true);
		setSessionExpiresAt(readStoredSessionExpiresAt());
	}

	function clearLocalStoredAuthState(): void {
		clearStoredBearerToken();
		clearStoredSessionSecrets();
		clearStoredPkceCodeVerifier();
		clearStoredPkceRedirectTarget();
		setBearerToken(null);
		setHasStoredBearerToken(false);
		setSessionExpiresAt(null);
	}

	async function applyAnonymousFallback(): Promise<void> {
		const anonymousResponse = await fetchAuthContext();
		setAuthContext(anonymousResponse.auth);
		setAuthStatus(anonymousResponse.principal_kind);
		setBearerToken(null);
		setHasStoredBearerToken(false);
		setSessionExpiresAt(readStoredSessionExpiresAt());
	}

	async function refreshAuthContext(): Promise<void> {
		setIsAuthBootstrapPending(true);
		let storedBearerToken: string | null = null;
		let authenticatedActionResponse:
			| Extract<AuthPasswordActionResponse, { readonly outcome: 'authenticated' }>
			| undefined;

		try {
			const searchRedirectResult = consumeOAuthSearchResult();
			const redirectResult = consumeOAuthRedirectResult();
			let redirectToken =
				redirectResult.status === 'session' ? redirectResult.session.access_token : null;
			storedBearerToken = redirectToken ?? readStoredBearerToken();

			if (redirectResult.status === 'session' && redirectToken) {
				writeStoredBearerToken(redirectToken);
				storeSessionTokens(redirectResult.session);
				setAuthNotice(uiCopy.auth.oauthValidating);
				setAuthError(null);
			}

			if (redirectResult.status === 'error') {
				setAuthError(redirectResult.message);
				setAuthNotice(null);
			}

			if (searchRedirectResult.status === 'error') {
				setAuthError(searchRedirectResult.message);
				setAuthNotice(null);
			}

			if (searchRedirectResult.status === 'code') {
				const codeVerifier = readStoredPkceCodeVerifier();

				if (!codeVerifier) {
					setAuthError('OAuth PKCE callback code_verifier bulunamadi. Girisi yeniden baslatin.');
					setAuthNotice(null);
				} else {
					setAuthNotice(uiCopy.auth.oauthValidating);
					setAuthError(null);
					authenticatedActionResponse = await postAuthenticatedAction(
						'/auth/oauth/callback/exchange',
						{
							auth_code: searchRedirectResult.authCode,
							code_verifier: codeVerifier,
						},
					);
					clearStoredPkceCodeVerifier();
					clearStoredPkceRedirectTarget();
					redirectToken = authenticatedActionResponse.session.access_token;
					storedBearerToken = redirectToken;
					writeStoredBearerToken(redirectToken);
					storeSessionTokens(authenticatedActionResponse.session);
				}
			}

			const storedRefreshToken = readStoredRefreshToken();
			const storedExpiresAt = readStoredSessionExpiresAt();
			const sessionState = resolveSessionState(storedExpiresAt);

			if (
				storedBearerToken &&
				storedRefreshToken &&
				(sessionState === 'expired' || sessionState === 'expiring') &&
				authenticatedActionResponse === undefined
			) {
				setAuthNotice('Oturum yenileniyor...');
				authenticatedActionResponse = await postAuthenticatedAction('/auth/session/refresh', {
					refresh_token: storedRefreshToken,
				});
				storedBearerToken = authenticatedActionResponse.session.access_token;
				writeStoredBearerToken(storedBearerToken);
				storeSessionTokens(authenticatedActionResponse.session);
			}

			setBearerToken(storedBearerToken);
			setHasStoredBearerToken(storedBearerToken !== null);
			setSessionExpiresAt(readStoredSessionExpiresAt());

			if (authenticatedActionResponse) {
				applyAuthenticatedState({
					authContext: authenticatedActionResponse.auth,
					bearerToken: authenticatedActionResponse.session.access_token,
					session: authenticatedActionResponse.session,
					status: authenticatedActionResponse.principal_kind,
				});
				setAuthNotice(null);
				return;
			}

			const authResponse = await fetchAuthContext({
				bearerToken: storedBearerToken ?? undefined,
			});

			setAuthContext(authResponse.auth);
			setAuthStatus(authResponse.principal_kind);
			setAuthError(null);
			setSessionExpiresAt(readStoredSessionExpiresAt());

			if (authResponse.principal_kind !== 'anonymous') {
				setAuthNotice(null);
			}
		} catch (error: unknown) {
			const errorMessage = getErrorMessage(error);

			if (storedBearerToken !== null) {
				clearStoredBearerToken();
				clearStoredSessionSecrets();

				try {
					await applyAnonymousFallback();
					setAuthError(`${errorMessage} ${uiCopy.auth.clearStoredTokenNotice}`);
					setAuthNotice(null);
				} catch (fallbackError: unknown) {
					setAuthContext(null);
					setAuthError(getErrorMessage(fallbackError));
					setAuthStatus('anonymous');
				}
			} else {
				setAuthContext(null);
				setAuthError(errorMessage);
				setAuthNotice(null);
				setAuthStatus('anonymous');
			}
		} finally {
			setIsAuthBootstrapPending(false);
		}
	}

	async function authenticateWithToken(token: string): Promise<void> {
		const normalizedToken = token.trim();

		if (normalizedToken.length === 0) {
			setAuthError(uiCopy.auth.bearerTokenRequired);
			setAuthNotice(null);
			setAuthStatus('anonymous');
			return;
		}

		setIsAuthActionPending(true);

		try {
			const authResponse = await fetchAuthContext({
				bearerToken: normalizedToken,
			});

			if (authResponse.principal_kind === 'anonymous') {
				throw new Error(uiCopy.auth.invalidSession);
			}

			applyAuthenticatedState({
				authContext: authResponse.auth,
				bearerToken: normalizedToken,
				status: authResponse.principal_kind,
			});
			clearStoredSessionSecrets();
			setAuthNotice(null);
		} catch (error: unknown) {
			clearLocalStoredAuthState();

			try {
				await applyAnonymousFallback();
			} catch (fallbackError: unknown) {
				setAuthContext(null);
				setAuthStatus('anonymous');
				setAuthError(getErrorMessage(fallbackError));
				setAuthNotice(null);
				setIsAuthActionPending(false);
				return;
			}

			setAuthError(getErrorMessage(error));
			setAuthNotice(null);
		} finally {
			setIsAuthActionPending(false);
		}
	}

	async function clearAuthToken(): Promise<void> {
		setIsAuthActionPending(true);
		clearLocalStoredAuthState();

		try {
			await applyAnonymousFallback();
			setAuthError(null);
			setAuthNotice(uiCopy.auth.clearStoredTokenNotice);
		} catch (error: unknown) {
			setAuthContext(null);
			setAuthError(getErrorMessage(error));
			setAuthNotice(null);
			setAuthStatus('anonymous');
		} finally {
			setIsAuthActionPending(false);
		}
	}

	async function logoutAction(): Promise<void> {
		setAuthError(null);
		setAuthNotice(null);
		setIsAuthActionPending(true);

		try {
			const logoutResponse = await logout(readStoredBearerToken() ?? undefined);
			clearLocalStoredAuthState();
			await applyAnonymousFallback();
			setAuthError(null);
			setAuthNotice(logoutResponse.message);
		} catch (error: unknown) {
			clearLocalStoredAuthState();

			try {
				await applyAnonymousFallback();
			} catch (fallbackError: unknown) {
				setAuthContext(null);
				setAuthStatus('anonymous');
				setAuthError(getErrorMessage(fallbackError));
				setAuthNotice(null);
				setIsAuthActionPending(false);
				return;
			}

			setAuthError(`${getErrorMessage(error)} ${uiCopy.auth.logoutRemoteWarning}`);
			setAuthNotice(null);
		} finally {
			setIsAuthActionPending(false);
		}
	}

	async function loginWithPasswordAction(input: AuthEmailPasswordCredentials): Promise<void> {
		setAuthError(null);
		setAuthNotice(null);
		setIsAuthActionPending(true);

		try {
			const actionResponse = await loginWithPassword(input);

			if (actionResponse.outcome !== 'authenticated') {
				throw new Error('Giris sonrasi kimligi dogrulanmis bir oturum olusmadi.');
			}

			applyAuthenticatedState({
				authContext: actionResponse.auth,
				bearerToken: actionResponse.session.access_token,
				session: actionResponse.session,
				status: actionResponse.principal_kind,
			});
		} catch (error: unknown) {
			try {
				await applyAnonymousFallback();
			} catch (fallbackError: unknown) {
				setAuthContext(null);
				setAuthStatus('anonymous');
				setAuthError(getErrorMessage(fallbackError));
				setAuthNotice(null);
				setIsAuthActionPending(false);
				return;
			}

			setAuthError(getErrorMessage(error));
			setAuthNotice(null);
		} finally {
			setIsAuthActionPending(false);
		}
	}

	async function signupWithPasswordAction(input: AuthPasswordSignupRequest): Promise<void> {
		setAuthError(null);
		setAuthNotice(null);
		setIsAuthActionPending(true);

		try {
			const actionResponse = await signupWithPassword(input);

			if (actionResponse.outcome === 'authenticated') {
				applyAuthenticatedState({
					authContext: actionResponse.auth,
					bearerToken: actionResponse.session.access_token,
					session: actionResponse.session,
					status: actionResponse.principal_kind,
				});
				return;
			}

			await applyAnonymousFallback();
			setAuthNotice(actionResponse.message);
		} catch (error: unknown) {
			try {
				await applyAnonymousFallback();
			} catch (fallbackError: unknown) {
				setAuthContext(null);
				setAuthStatus('anonymous');
				setAuthError(getErrorMessage(fallbackError));
				setAuthNotice(null);
				setIsAuthActionPending(false);
				return;
			}

			setAuthError(getErrorMessage(error));
			setAuthNotice(null);
		} finally {
			setIsAuthActionPending(false);
		}
	}

	function startOAuthSignIn(provider: OAuthProvider): void {
		if (typeof window === 'undefined') {
			throw new Error('OAuth girisi sadece tarayicida baslayabilir.');
		}

		setAuthError(null);
		setAuthNotice(uiCopy.auth.oauthRedirecting);

		void (async () => {
			if (!window.crypto?.subtle) {
				setAuthError('Tarayici PKCE icin gerekli Web Crypto destegini sunmuyor.');
				setAuthNotice(null);
				return;
			}

			try {
				const codeVerifier = generatePkceCodeVerifier();
				const codeChallenge = await buildPkceCodeChallenge(codeVerifier);
				const redirectTarget = `${window.location.origin}${window.location.pathname}${window.location.search}`;
				const callbackUrl = new URL('/auth/oauth/callback', window.location.origin);
				callbackUrl.searchParams.set('redirect_to', redirectTarget);
				writeStoredPkceCodeVerifier(codeVerifier);
				writeStoredPkceRedirectTarget(redirectTarget);
				window.location.assign(
					`/auth/oauth/start?${new URLSearchParams({
						code_challenge: codeChallenge,
						code_challenge_method: 'S256',
						provider,
						redirect_to: callbackUrl.toString(),
					}).toString()}`,
				);
			} catch (error: unknown) {
				clearStoredPkceCodeVerifier();
				clearStoredPkceRedirectTarget();
				setAuthError(getErrorMessage(error));
				setAuthNotice(null);
			}
		})();
	}

	function startLocalDevSession(): void {
		if (typeof window === 'undefined' || !isLocalDevAuthUiEnabled()) {
			throw new Error(uiCopy.auth.localDevOnly);
		}

		setAuthError(null);
		setAuthNotice(uiCopy.auth.startingDevSession);
		window.location.assign(
			buildLocalDevBootstrapPath(
				`${window.location.origin}${window.location.pathname}${window.location.search}`,
			),
		);
	}

	const bootstrapAuthContext = useEffectEvent(() => {
		void refreshAuthContext();
	});
	const scheduleAuthRefresh = useEffectEvent(() => {
		void refreshAuthContext();
	});

	useEffect(() => {
		if (hasBootstrappedAuthContextRef.current) {
			return;
		}

		hasBootstrappedAuthContextRef.current = true;
		bootstrapAuthContext();
	}, [bootstrapAuthContext]);

	useEffect(() => {
		if (typeof window === 'undefined' || bearerToken === null) {
			return;
		}

		const expiresAt = readStoredSessionExpiresAt();
		const refreshToken = readStoredRefreshToken();

		setSessionExpiresAt(expiresAt);

		if (expiresAt === null || refreshToken === null) {
			return;
		}

		const delayMs = Math.max(
			(expiresAt - Math.trunc(Date.now() / 1000) - SESSION_EXPIRING_WINDOW_SECONDS) * 1000,
			0,
		);
		const timeoutId = window.setTimeout(() => {
			scheduleAuthRefresh();
		}, delayMs);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [bearerToken, scheduleAuthRefresh]);

	return {
		authContext,
		authError,
		authNotice,
		authStatus,
		authorizationRole: resolveAuthorizationRole(authContext),
		bearerToken,
		hasStoredBearerToken,
		isAuthActionPending,
		isAuthBootstrapPending,
		isAuthPending: isAuthActionPending || isAuthBootstrapPending,
		sessionState: resolveSessionState(sessionExpiresAt),
		authenticateWithToken,
		clearAuthToken,
		loginWithPassword: loginWithPasswordAction,
		logout: logoutAction,
		refreshAuthContext,
		signupWithPassword: signupWithPasswordAction,
		startLocalDevSession,
		startOAuthSignIn,
	};
}
