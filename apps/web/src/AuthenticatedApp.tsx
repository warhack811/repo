import type { AuthContext } from '@runa/types';
import { type ReactElement, Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import type { AuthenticatedAppProps } from './App.js';
import type { AuthenticatedPageId } from './components/app/AppNav.js';
import { AppShell } from './components/app/AppShell.js';
import { RunaSkeleton } from './components/ui/RunaSkeleton.js';
import { useDeveloperMode } from './hooks/useDeveloperMode.js';
import './styles/routes/app-shell-migration.css';

const ChatRuntimePage = lazy(() =>
	import('./pages/ChatRuntimePage.js').then((module) => ({ default: module.ChatRuntimePage })),
);
const CapabilityPreviewPage = lazy(() =>
	import('./pages/CapabilityPreviewPage.js').then((module) => ({
		default: module.CapabilityPreviewPage,
	})),
);
const DeveloperRuntimePage = lazy(() =>
	import('./pages/DeveloperRuntimePage.js').then((module) => ({
		default: module.DeveloperRuntimePage,
	})),
);
const DevicesPage = lazy(() =>
	import('./pages/DevicesPage.js').then((module) => ({ default: module.DevicesPage })),
);
const HistoryRoute = lazy(() =>
	import('./pages/HistoryRoute.js').then((module) => ({ default: module.HistoryRoute })),
);
const SettingsPage = lazy(() =>
	import('./pages/SettingsPage.js').then((module) => ({ default: module.SettingsPage })),
);

type AccountRouteProps = Readonly<{
	authContext: AuthContext;
	authError: string | null;
	isAuthPending: boolean;
	onLogout: () => Promise<void>;
}>;

function resolveActivePage(pathname: string): AuthenticatedPageId {
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

function AuthenticatedLayout(): ReactElement {
	const location = useLocation();
	const activePage = resolveActivePage(location.pathname);

	return (
		<AppShell activePage={activePage}>
			<Outlet />
		</AppShell>
	);
}

function RouteFallback(): ReactElement {
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

function DeveloperRouteGate(): ReactElement {
	const { isDeveloperMode } = useDeveloperMode();

	if (!isDeveloperMode) {
		return <Navigate replace to="/chat" />;
	}

	return <Outlet />;
}

export function AuthenticatedApp(props: AuthenticatedAppProps): ReactElement {
	return (
		<BrowserRouter>
			<Suspense fallback={<RouteFallback />}>
				<Routes>
					<Route path="/" element={<AuthenticatedLayout />}>
						<Route index element={<Navigate replace to="chat" />} />
						<Route path="chat" element={<ChatRuntimePage bearerToken={props.bearerToken} />} />
						<Route path="history" element={<HistoryRoute bearerToken={props.bearerToken} />} />
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
						<Route path="developer" element={<DeveloperRouteGate />}>
							<Route
								index
								element={
									<DeveloperRuntimePage
										authContext={props.authContext}
										authError={props.authError}
										bearerToken={props.bearerToken}
										hasStoredBearerToken={props.hasStoredBearerToken}
										isAuthPending={props.isAuthPending}
										onClearAuthToken={props.onClearAuthToken}
										onRefreshAuthContext={props.onRefreshAuthContext}
									/>
								}
							/>
							<Route path="capability-preview" element={<CapabilityPreviewPage />} />
						</Route>
						<Route path="dashboard" element={<Navigate replace to="/history" />} />
						<Route path="settings" element={<Navigate replace to="/account" />} />
						<Route path="*" element={<Navigate replace to="/chat" />} />
					</Route>
				</Routes>
			</Suspense>
		</BrowserRouter>
	);
}
