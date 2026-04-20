import { useEffect, useEffectEvent, useRef, useState } from 'react';

import type {
	AuthContext,
	AuthEmailPasswordCredentials,
	AuthPasswordSignupRequest,
	OAuthProvider,
} from '@runa/types';

import {
	buildLocalDevBootstrapPath,
	buildOAuthStartPath,
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

export interface UseAuthResult {
	readonly authContext: AuthContext | null;
	readonly authError: string | null;
	readonly authNotice: string | null;
	readonly authStatus: AuthStatus;
	readonly bearerToken: string | null;
	readonly hasStoredBearerToken: boolean;
	readonly isAuthActionPending: boolean;
	readonly isAuthBootstrapPending: boolean;
	readonly isAuthPending: boolean;
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

export function useAuth(): UseAuthResult {
	const [authContext, setAuthContext] = useState<AuthContext | null>(null);
	const [authError, setAuthError] = useState<string | null>(null);
	const [authNotice, setAuthNotice] = useState<string | null>(null);
	const [authStatus, setAuthStatus] = useState<AuthStatus>('bootstrapping');
	const [bearerToken, setBearerToken] = useState<string | null>(null);
	const [hasStoredBearerToken, setHasStoredBearerToken] = useState(false);
	const [isAuthActionPending, setIsAuthActionPending] = useState(false);
	const [isAuthBootstrapPending, setIsAuthBootstrapPending] = useState(true);
	const hasBootstrappedAuthContextRef = useRef(false);

	function applyAuthenticatedState(input: {
		readonly authContext: AuthContext;
		readonly bearerToken: string;
		readonly status: Extract<AuthStatus, 'authenticated' | 'service'>;
	}): void {
		writeStoredBearerToken(input.bearerToken);
		setAuthContext(input.authContext);
		setAuthError(null);
		setAuthStatus(input.status);
		setBearerToken(input.bearerToken);
		setHasStoredBearerToken(true);
	}

	function clearLocalStoredAuthState(): void {
		clearStoredBearerToken();
		setBearerToken(null);
		setHasStoredBearerToken(false);
	}

	async function applyAnonymousFallback(): Promise<void> {
		const anonymousResponse = await fetchAuthContext();
		setAuthContext(anonymousResponse.auth);
		setAuthStatus(anonymousResponse.principal_kind);
		setBearerToken(null);
		setHasStoredBearerToken(false);
	}

	async function refreshAuthContext(): Promise<void> {
		const redirectResult = consumeOAuthRedirectResult();
		const redirectToken =
			redirectResult.status === 'session' ? redirectResult.session.access_token : null;
		const storedBearerToken = redirectToken ?? readStoredBearerToken();

		if (redirectResult.status === 'session' && redirectToken) {
			writeStoredBearerToken(redirectToken);
			setAuthNotice(uiCopy.auth.oauthValidating);
			setAuthError(null);
		}

		if (redirectResult.status === 'error') {
			setAuthError(redirectResult.message);
			setAuthNotice(null);
		}

		setBearerToken(storedBearerToken);
		setHasStoredBearerToken(storedBearerToken !== null);
		setIsAuthBootstrapPending(true);

		try {
			const authResponse = await fetchAuthContext({
				bearerToken: storedBearerToken ?? undefined,
			});

			setAuthContext(authResponse.auth);
			setAuthStatus(authResponse.principal_kind);
			setAuthError(null);

			if (authResponse.principal_kind !== 'anonymous') {
				setAuthNotice(null);
			}
		} catch (error: unknown) {
			const errorMessage = getErrorMessage(error);

			if (storedBearerToken !== null) {
				clearStoredBearerToken();

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
		window.location.assign(
			buildOAuthStartPath(
				provider,
				`${window.location.origin}${window.location.pathname}${window.location.search}`,
			),
		);
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

	useEffect(() => {
		if (hasBootstrappedAuthContextRef.current) {
			return;
		}

		hasBootstrappedAuthContextRef.current = true;
		bootstrapAuthContext();
	}, [bootstrapAuthContext]);

	return {
		authContext,
		authError,
		authNotice,
		authStatus,
		bearerToken,
		hasStoredBearerToken,
		isAuthActionPending,
		isAuthBootstrapPending,
		isAuthPending: isAuthActionPending || isAuthBootstrapPending,
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
