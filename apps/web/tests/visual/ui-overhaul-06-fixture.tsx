import type { AuthContext } from '@runa/types';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import '../../src/styles/index.css';
import { CurrentRunSurface } from '../../src/components/chat/CurrentRunSurface.js';
import { EmptyState } from '../../src/components/chat/EmptyState.js';
import { OnboardingWizard } from '../../src/components/onboarding/OnboardingWizard.js';
import { LoginPage } from '../../src/pages/LoginPage.js';
import { SettingsPage } from '../../src/pages/SettingsPage.js';

window.localStorage.removeItem('runa.onboarding.completed');

const authContext: AuthContext = {
	principal: {
		email: 'qa@runa.dev',
		kind: 'authenticated',
		provider: 'supabase',
		role: 'authenticated',
		scope: {},
		user_id: 'user_fixture',
	},
	session: {
		identity_provider: 'email_password',
		provider: 'supabase',
		scope: {},
		session_id: 'session_fixture',
		user_id: 'user_fixture',
	},
	transport: 'http',
	user: {
		email: 'qa@runa.dev',
		email_verified: true,
		identities: [],
		primary_provider: 'supabase',
		scope: {},
		status: 'active',
		user_id: 'user_fixture',
	},
};

function Fixture(): JSX.Element {
	return (
		<MemoryRouter>
			<div>
				<LoginPage
					authContext={null}
					authError={null}
					authNotice={null}
					authStatus="anonymous"
					hasStoredBearerToken={false}
					isAuthPending={false}
					onAuthenticateWithToken={async () => undefined}
					onClearAuthToken={async () => undefined}
					onLoginWithPassword={async () => undefined}
					onRefreshAuthContext={async () => undefined}
					onSignupWithPassword={async () => undefined}
					onStartLocalDevSession={() => undefined}
					onStartOAuth={() => undefined}
				/>
				<section className="runa-page" data-testid="chat-polish">
					<div className="runa-shell-frame runa-shell-frame--chat">
						<CurrentRunSurface
							activeConversationId={null}
							activeConversationMessages={[]}
							currentPresentationContent={null}
							currentRunId={undefined}
							currentRunProgressPanel={null}
							currentStreamingRunId={null}
							currentStreamingText=""
							emptyStateContent={<EmptyState onSubmitSuggestion={() => undefined} />}
							isHistoryLoading
						/>
					</div>
				</section>
				<section className="runa-page" data-testid="settings-polish">
					<div className="runa-shell-frame runa-shell-frame--app">
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
					</div>
				</section>
				<OnboardingWizard onSubmitPrompt={() => undefined} />
			</div>
		</MemoryRouter>
	);
}

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('Fixture root element is missing.');
}

createRoot(rootElement).render(<Fixture />);
