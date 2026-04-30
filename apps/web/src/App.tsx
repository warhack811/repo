import type { AuthContext } from '@runa/types';
import { type ReactElement, Suspense, lazy } from 'react';

import { RunaSkeleton } from './components/ui/RunaSkeleton.js';
import { useAuth } from './hooks/useAuth.js';
import { LoginPage } from './pages/LoginPage.js';

const AuthenticatedApp = lazy(() =>
	import('./AuthenticatedApp.js').then((module) => ({ default: module.AuthenticatedApp })),
);

export type AuthenticatedAppProps = Readonly<{
	authContext: AuthContext;
	authError: string | null;
	authStatus: 'authenticated' | 'service';
	bearerToken: string | null;
	hasStoredBearerToken: boolean;
	isAuthPending: boolean;
	onClearAuthToken: () => Promise<void>;
	onLogout: () => Promise<void>;
	onRefreshAuthContext: () => Promise<void>;
}>;

function AuthenticatedFallback(): ReactElement {
	return (
		<div className="runa-route-fallback" aria-busy="true">
			<span className="runa-sr-only">Sayfa yükleniyor</span>
			<div className="runa-route-fallback__skeleton">
				<RunaSkeleton variant="text" />
				<RunaSkeleton variant="rect" />
				<RunaSkeleton variant="text" />
			</div>
		</div>
	);
}

export function App(): ReactElement {
	const {
		authContext,
		authError,
		authNotice,
		authStatus,
		bearerToken,
		hasStoredBearerToken,
		isAuthPending,
		authenticateWithToken,
		clearAuthToken,
		loginWithPassword,
		logout,
		refreshAuthContext,
		signupWithPassword,
		startLocalDevSession,
		startOAuthSignIn,
	} = useAuth();

	const isAuthenticatedSurface =
		(authStatus === 'authenticated' || authStatus === 'service') && authContext !== null;

	if (isAuthenticatedSurface) {
		return (
			<Suspense fallback={<AuthenticatedFallback />}>
				<AuthenticatedApp
					authContext={authContext}
					authError={authError}
					authStatus={authStatus === 'service' ? 'service' : 'authenticated'}
					bearerToken={bearerToken}
					hasStoredBearerToken={hasStoredBearerToken}
					isAuthPending={isAuthPending}
					onClearAuthToken={clearAuthToken}
					onLogout={logout}
					onRefreshAuthContext={refreshAuthContext}
				/>
			</Suspense>
		);
	}

	return (
		<LoginPage
			authContext={authContext}
			authError={authError}
			authNotice={authNotice}
			authStatus={authStatus === 'bootstrapping' ? 'bootstrapping' : 'anonymous'}
			hasStoredBearerToken={hasStoredBearerToken}
			isAuthPending={isAuthPending}
			onAuthenticateWithToken={authenticateWithToken}
			onClearAuthToken={clearAuthToken}
			onLoginWithPassword={loginWithPassword}
			onStartLocalDevSession={startLocalDevSession}
			onRefreshAuthContext={refreshAuthContext}
			onSignupWithPassword={signupWithPassword}
			onStartOAuth={startOAuthSignIn}
		/>
	);
}
