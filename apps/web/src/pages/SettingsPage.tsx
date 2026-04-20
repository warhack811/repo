import type { CSSProperties, ReactElement } from 'react';

import type { AuthContext } from '@runa/types';

import {
	appShellButtonRowStyle,
	appShellMutedTextStyle,
	appShellPanelStyle,
	appShellSecondaryButtonStyle,
	appShellSecondaryLabelStyle,
} from '../components/app/AppShell.js';
import { ProfileCard } from '../components/auth/ProfileCard.js';
import { SessionCard } from '../components/auth/SessionCard.js';
import { pillStyle } from '../lib/chat-styles.js';
import { uiCopy } from '../localization/copy.js';

const sectionGridStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
	gap: '20px',
};

const heroMetricRowStyle: CSSProperties = {
	display: 'flex',
	flexWrap: 'wrap',
	gap: '10px',
	marginTop: '16px',
};

const destructiveButtonStyle: CSSProperties = {
	...appShellSecondaryButtonStyle,
	border: '1px solid rgba(248, 113, 113, 0.36)',
	color: '#fecaca',
};

type SettingsPageProps = Readonly<{
	authContext: AuthContext;
	authError: string | null;
	isAuthPending: boolean;
	onLogout: () => Promise<void>;
}>;

export function SettingsPage({
	authContext,
	authError,
	isAuthPending,
	onLogout,
}: SettingsPageProps): ReactElement {
	return (
		<>
			<section
				style={{
					...appShellPanelStyle,
					background:
						'radial-gradient(circle at top right, rgba(245, 158, 11, 0.14), transparent 30%), linear-gradient(180deg, rgba(20, 26, 40, 0.92) 0%, rgba(15, 23, 42, 0.8) 100%)',
				}}
				aria-labelledby="account-heading"
				className="runa-ambient-panel"
			>
				<div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
					<div style={appShellSecondaryLabelStyle}>{uiCopy.account.heading}</div>
					<h2 id="account-heading" style={{ margin: 0, fontSize: '24px' }}>
						{uiCopy.account.heading}
					</h2>
					<p style={appShellMutedTextStyle}>{uiCopy.account.description}</p>
				</div>

				<div style={heroMetricRowStyle}>
					<span style={pillStyle}>{authContext.principal.kind}</span>
					<span style={{ ...pillStyle, borderColor: 'rgba(96, 165, 250, 0.26)', color: '#bfdbfe' }}>
						{authContext.transport}
					</span>
				</div>

				<div style={appShellButtonRowStyle}>
					<button
						type="button"
						onClick={() => void onLogout()}
						disabled={isAuthPending}
						style={{
							...destructiveButtonStyle,
							opacity: isAuthPending ? 0.6 : 1,
							width: '100%',
						}}
					>
						{uiCopy.account.logout}
					</button>
				</div>

				{authError ? (
					<div
						role="alert"
						style={{
							marginTop: '16px',
							padding: '12px 14px',
							borderRadius: '14px',
							background: 'rgba(127, 29, 29, 0.28)',
							border: '1px solid rgba(248, 113, 113, 0.36)',
							color: '#fecaca',
							lineHeight: 1.5,
						}}
					>
						<strong>{uiCopy.account.authErrorTitle}: </strong>
						{authError}
					</div>
				) : null}
			</section>

			<section style={sectionGridStyle}>
				<ProfileCard authContext={authContext} />
				<SessionCard authContext={authContext} />
			</section>
		</>
	);
}
