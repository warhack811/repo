import type { AuthContext } from '@runa/types';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import '../../src/styles/index.css';
import { MenuSheet } from '../../src/components/app/MenuSheet.js';
import { RunaToastProvider } from '../../src/components/ui/RunaToast.js';
import { SettingsPage } from '../../src/pages/SettingsPage.js';

const authContext: AuthContext = {
	principal: {
		email: 'person@example.com',
		kind: 'authenticated',
		provider: 'supabase',
		role: 'authenticated',
		scope: {},
		session_id: 'session_fixture',
		user_id: 'user_fixture',
	},
	session: {
		identity_provider: 'email_password',
		provider: 'supabase',
		scope: {},
		session_id: 'session_fixture',
		user_id: 'user_fixture',
	},
	transport: 'websocket',
};

function Section(props: { children: ReactNode; label: string; testId: string }): ReactNode {
	return (
		<section
			aria-label={props.label}
			data-testid={props.testId}
			style={{
				border: '1px solid color-mix(in srgb, var(--ink-1) 14%, transparent)',
				borderRadius: 12,
				display: 'grid',
				gap: 10,
				marginBottom: 14,
				padding: 12,
			}}
		>
			<h2
				style={{
					fontSize: 14,
					fontWeight: 600,
					margin: 0,
				}}
			>
				{props.label}
			</h2>
			{props.children}
		</section>
	);
}

function SettingsPreview(props: { initialEntry: string; label: string; testId: string }): ReactNode {
	return (
		<Section label={props.label} testId={props.testId}>
			<MemoryRouter initialEntries={[props.initialEntry]}>
				<Routes>
					<Route
						path="/account"
						element={
							<SettingsPage
								accessToken={null}
								authContext={authContext}
								authError={null}
								brandTheme="teal"
								isAuthPending={false}
								onBrandThemeChange={() => undefined}
								onLogout={async () => undefined}
								onThemeChange={() => undefined}
								theme="system"
							/>
						}
					/>
				</Routes>
			</MemoryRouter>
		</Section>
	);
}

function Fixture(): ReactNode {
	return (
		<main className="runa-page runa-page--chat-product">
			<div style={{ margin: '0 auto', maxWidth: 920, padding: 12 }}>
				<Section label="Menu sheet open" testId="menu-sheet-open">
					<MemoryRouter>
						<RunaToastProvider>
							<MenuSheet
								isDeveloperMode={true}
								open={true}
								onOpenChange={() => undefined}
								onOpenHistorySheet={() => undefined}
								onToggleDeveloperMode={() => undefined}
							/>
						</RunaToastProvider>
					</MemoryRouter>
				</Section>

				<SettingsPreview
					initialEntry="/account"
					label="Settings appearance tab"
					testId="settings-appearance"
				/>
				<SettingsPreview
					initialEntry="/account?tab=conversation"
					label="Settings conversation tab"
					testId="settings-conversation"
				/>
				<SettingsPreview
					initialEntry="/account?tab=notifications"
					label="Settings notifications tab"
					testId="settings-notifications"
				/>
			</div>
		</main>
	);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
	throw new Error('Fixture root element is missing.');
}

createRoot(rootElement).render(
	<StrictMode>
		<Fixture />
	</StrictMode>,
);
