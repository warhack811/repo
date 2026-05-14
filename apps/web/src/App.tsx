import type { AuthContext } from '@runa/types';
import { type ReactElement, Suspense, lazy, useCallback, useEffect, useState } from 'react';

import { RunaSkeleton } from './components/ui/RunaSkeleton.js';
import { useAuth } from './hooks/useAuth.js';
import { useVisualViewport } from './hooks/useVisualViewport.js';
import {
	type BrandTheme,
	type Theme,
	applyAppearance,
	getStoredBrandTheme,
	getStoredTheme,
	storeBrandTheme,
	storeTheme,
} from './lib/theme.js';
import { LoginPage } from './pages/LoginPage.js';

const AuthenticatedApp = lazy(() =>
	import('./AuthenticatedApp.js').then((module) => ({ default: module.AuthenticatedApp })),
);

export type AuthenticatedAppProps = Readonly<{
	authContext: AuthContext;
	authError: string | null;
	authStatus: 'authenticated' | 'service';
	bearerToken: string | null;
	brandTheme: BrandTheme;
	hasStoredBearerToken: boolean;
	isAuthPending: boolean;
	onBrandThemeChange: (theme: BrandTheme) => void;
	onClearAuthToken: () => Promise<void>;
	onLogout: () => Promise<void>;
	onRefreshAuthContext: () => Promise<void>;
	onThemeChange: (theme: Theme) => void;
	theme: Theme;
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
	const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
	const [brandTheme, setBrandTheme] = useState<BrandTheme>(() => getStoredBrandTheme());
	useVisualViewport();
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

	useEffect(() => {
		applyAppearance(theme, brandTheme);
	}, [brandTheme, theme]);

	const selectTheme = useCallback(
		(nextTheme: Theme): void => {
			setTheme(nextTheme);
			storeTheme(nextTheme);
			applyAppearance(nextTheme, brandTheme);
		},
		[brandTheme],
	);

	const selectBrandTheme = useCallback(
		(nextTheme: BrandTheme): void => {
			setBrandTheme(nextTheme);
			storeBrandTheme(nextTheme);
			applyAppearance(theme, nextTheme);
		},
		[theme],
	);

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
					brandTheme={brandTheme}
					hasStoredBearerToken={hasStoredBearerToken}
					isAuthPending={isAuthPending}
					onBrandThemeChange={selectBrandTheme}
					onClearAuthToken={clearAuthToken}
					onLogout={logout}
					onRefreshAuthContext={refreshAuthContext}
					onThemeChange={selectTheme}
					theme={theme}
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
