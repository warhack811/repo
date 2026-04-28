import type { AuthContext } from '@runa/types';
import { type ReactElement, Suspense, lazy, useCallback } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import type { AuthenticatedPageId } from './components/app/AppNav.js';
import { AppShell } from './components/app/AppShell.js';
import { RunaSpinner } from './components/ui/RunaSpinner.js';
import { useAuth } from './hooks/useAuth.js';
import { type UseChatRuntimeResult, useChatRuntime } from './hooks/useChatRuntime.js';
import { useConversations } from './hooks/useConversations.js';
import { LoginPage } from './pages/LoginPage.js';

const ChatPage = lazy(() =>
	import('./pages/ChatPage.js').then((module) => ({ default: module.ChatPage })),
);
const CapabilityPreviewPage = lazy(() =>
	import('./pages/CapabilityPreviewPage.js').then((module) => ({
		default: module.CapabilityPreviewPage,
	})),
);
const DeveloperPage = lazy(() =>
	import('./pages/DeveloperPage.js').then((module) => ({ default: module.DeveloperPage })),
);
const DevicesPage = lazy(() =>
	import('./pages/DevicesPage.js').then((module) => ({ default: module.DevicesPage })),
);
const HistoryPage = lazy(() =>
	import('./pages/HistoryPage.js').then((module) => ({ default: module.HistoryPage })),
);
const OnboardingWizard = lazy(() =>
	import('./components/onboarding/OnboardingWizard.js').then((module) => ({
		default: module.OnboardingWizard,
	})),
);
const SettingsPage = lazy(() =>
	import('./pages/SettingsPage.js').then((module) => ({ default: module.SettingsPage })),
);

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
	if (pathname === '/developer' || pathname.startsWith('/developer/')) {
		return 'developer';
	}

	if (pathname === '/account') {
		return 'account';
	}

	if (pathname === '/devices') {
		return 'devices';
	}

	if (pathname === '/history') {
		return 'history';
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

function RouteFallback(): ReactElement {
	return (
		<div className="runa-route-fallback" aria-busy="true">
			<RunaSpinner label="Sayfa yukleniyor" />
		</div>
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
		<DeveloperPage
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
	const conversations = useConversations({
		accessToken: props.bearerToken,
	});
	const onRunAccepted = useCallback(
		({ conversationId, prompt }: { conversationId?: string; prompt: string }) => {
			conversations.handleRunAccepted({ conversationId, prompt });
		},
		[conversations.handleRunAccepted],
	);

	const onRunFinished = useCallback(
		({ conversationId }: { conversationId?: string }) => {
			conversations.handleRunFinished({ conversationId });
		},
		[conversations.handleRunFinished],
	);

	const runtime = useChatRuntime({
		activeConversationId: conversations.activeConversationId,
		accessToken: props.bearerToken,
		buildRequestMessages: conversations.buildRequestMessages,
		onRunAccepted,
		onRunFinished,
	});

	return (
		<BrowserRouter>
			<Suspense fallback={<RouteFallback />}>
				<Routes>
					<Route path="/" element={<AuthenticatedLayout authStatus={props.authStatus} />}>
						<Route index element={<Navigate replace to="chat" />} />
						<Route
							path="chat"
							element={<ChatPage conversations={conversations} embedded runtime={runtime} />}
						/>
						<Route path="history" element={<HistoryPage conversations={conversations} />} />
						<Route path="devices" element={<DevicesPage accessToken={props.bearerToken} />} />
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
						<Route path="developer/capability-preview" element={<CapabilityPreviewPage />} />
						<Route path="dashboard" element={<Navigate replace to="/history" />} />
						<Route path="settings" element={<Navigate replace to="/account" />} />
						<Route path="*" element={<Navigate replace to="/chat" />} />
					</Route>
				</Routes>
				<OnboardingWizard onSubmitPrompt={runtime.setPrompt} />
			</Suspense>
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
