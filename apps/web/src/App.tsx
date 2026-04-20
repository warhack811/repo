import type { AuthContext } from '@runa/types';
import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import type { AuthenticatedPageId } from './components/app/AppNav.js';
import { AppShell } from './components/app/AppShell.js';
import { useAuth } from './hooks/useAuth.js';
import { type UseChatRuntimeResult, useChatRuntime } from './hooks/useChatRuntime.js';
import { ChatPage } from './pages/ChatPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { SettingsPage } from './pages/SettingsPage.js';

type AuthenticatedLayoutProps = Readonly<{
	authStatus: 'authenticated' | 'service';
}>;

type AccountRouteProps = Readonly<{
	authContext: AuthContext;
	authError: string | null;
	isAuthPending: boolean;
	onLogout: () => Promise<void>;
}>;

type DeveloperRouteProps = Readonly<{
	authContext: AuthContext;
	authError: string | null;
	hasStoredBearerToken: boolean;
	isAuthPending: boolean;
	onClearAuthToken: () => Promise<void>;
	onRefreshAuthContext: () => Promise<void>;
	runtime: UseChatRuntimeResult;
}>;

function resolveActivePage(pathname: string): AuthenticatedPageId {
	if (pathname === '/developer') {
		return 'developer';
	}

	if (pathname === '/account') {
		return 'account';
	}

	return 'chat';
}

function AuthenticatedLayout({ authStatus }: AuthenticatedLayoutProps): ReactElement {
	const location = useLocation();
	const activePage = resolveActivePage(location.pathname);

	return (
		<AppShell activePage={activePage} authStatus={authStatus}>
			<Outlet />
		</AppShell>
	);
}

function AccountRoute({
	authContext,
	authError,
	isAuthPending,
	onLogout,
}: AccountRouteProps): ReactElement {
	return (
		<SettingsPage
			authContext={authContext}
			authError={authError}
			isAuthPending={isAuthPending}
			onLogout={onLogout}
		/>
	);
}

function DeveloperRoute({
	authContext,
	authError,
	hasStoredBearerToken,
	isAuthPending,
	onClearAuthToken,
	onRefreshAuthContext,
	runtime,
}: DeveloperRouteProps): ReactElement {
	return (
		<DashboardPage
			authContext={authContext}
			authError={authError}
			hasStoredBearerToken={hasStoredBearerToken}
			isAuthPending={isAuthPending}
			onClearAuthToken={onClearAuthToken}
			onRefreshAuthContext={onRefreshAuthContext}
			runtime={runtime}
		/>
	);
}

function AuthenticatedApp(
	props: Readonly<{
		authContext: AuthContext;
		authError: string | null;
		authStatus: 'authenticated' | 'service';
		bearerToken: string | null;
		hasStoredBearerToken: boolean;
		isAuthPending: boolean;
		onClearAuthToken: () => Promise<void>;
		onLogout: () => Promise<void>;
		onRefreshAuthContext: () => Promise<void>;
	}>,
): ReactElement {
	const runtime = useChatRuntime({
		accessToken: props.bearerToken,
	});

	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<AuthenticatedLayout authStatus={props.authStatus} />}>
					<Route index element={<Navigate replace to="chat" />} />
					<Route path="chat" element={<ChatPage embedded runtime={runtime} />} />
					<Route
						path="account"
						element={
							<AccountRoute
								authContext={props.authContext}
								authError={props.authError}
								isAuthPending={props.isAuthPending}
								onLogout={props.onLogout}
							/>
						}
					/>
					<Route
						path="developer"
						element={
							<DeveloperRoute
								authContext={props.authContext}
								authError={props.authError}
								hasStoredBearerToken={props.hasStoredBearerToken}
								isAuthPending={props.isAuthPending}
								onClearAuthToken={props.onClearAuthToken}
								onRefreshAuthContext={props.onRefreshAuthContext}
								runtime={runtime}
							/>
						}
					/>
					<Route path="dashboard" element={<Navigate replace to="/chat" />} />
					<Route path="settings" element={<Navigate replace to="/account" />} />
					<Route path="*" element={<Navigate replace to="/chat" />} />
				</Route>
			</Routes>
		</BrowserRouter>
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
