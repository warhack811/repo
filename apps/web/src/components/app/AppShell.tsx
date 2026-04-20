import type { CSSProperties, ReactElement, ReactNode } from 'react';

import {
	heroPanelStyle,
	pageStyle,
	pillStyle,
	secondaryButtonStyle,
} from '../../lib/chat-styles.js';
import { uiCopy } from '../../localization/copy.js';
import { AppNav, type AuthenticatedPageId } from './AppNav.js';

export const appShellPageStyle: CSSProperties = pageStyle;

const shellFrameStyle: CSSProperties = {
	margin: '0 auto',
	maxWidth: '1180px',
	width: 'min(100%, 1180px)',
	display: 'grid',
	gap: 'clamp(16px, 3vw, 20px)',
	minWidth: 0,
};

export const appShellPanelStyle: CSSProperties = {
	background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.82) 0%, rgba(10, 15, 27, 0.76) 100%)',
	border: '1px solid rgba(148, 163, 184, 0.2)',
	borderRadius: '24px',
	boxShadow: 'var(--shadow-panel)',
	padding: 'clamp(18px, 3vw, 24px)',
	backdropFilter: 'blur(12px)',
	position: 'relative',
	overflow: 'hidden',
};

export const appShellHeroPanelStyle: CSSProperties = {
	...appShellPanelStyle,
	...heroPanelStyle,
};

export const appShellSecondaryLabelStyle: CSSProperties = {
	fontSize: '11px',
	letterSpacing: '0.08em',
	textTransform: 'uppercase',
	color: '#94a3b8',
};

export const appShellMutedTextStyle: CSSProperties = {
	margin: 0,
	color: '#cbd5e1',
	lineHeight: 1.6,
};

export const appShellButtonRowStyle: CSSProperties = {
	display: 'grid',
	gap: '10px',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
	alignItems: 'stretch',
};

export const appShellPrimaryButtonStyle: CSSProperties = {
	padding: '12px 16px',
	borderRadius: '14px',
	border: 'none',
	background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
	color: 'var(--color-accent-foreground)',
	fontWeight: 700,
	cursor: 'pointer',
	boxShadow: '0 18px 32px rgba(234, 88, 12, 0.22)',
};

export const appShellSecondaryButtonStyle: CSSProperties = {
	...secondaryButtonStyle,
};

export const appShellMetricCardStyle: CSSProperties = {
	padding: '14px 16px',
	borderRadius: '18px',
	background: 'linear-gradient(180deg, rgba(6, 11, 21, 0.76) 0%, rgba(2, 6, 23, 0.64) 100%)',
	border: '1px solid rgba(148, 163, 184, 0.16)',
	display: 'grid',
	gap: '8px',
	minWidth: 0,
	overflowWrap: 'anywhere',
};

const shellHeaderStyle: CSSProperties = {
	display: 'grid',
	gap: '18px',
};

const shellMainStyle: CSSProperties = {
	display: 'grid',
	gap: '20px',
	minWidth: 0,
};

const pageCopyById: Record<
	AuthenticatedPageId,
	{
		readonly eyebrow: string;
		readonly subtitle: string;
		readonly title: string;
	}
> = {
	chat: {
		eyebrow: uiCopy.appShell.chatEyebrow,
		subtitle: uiCopy.appShell.chatSubtitle,
		title: uiCopy.appShell.chatTitle,
	},
	account: {
		eyebrow: uiCopy.appShell.accountEyebrow,
		subtitle: uiCopy.appShell.accountSubtitle,
		title: uiCopy.appShell.accountTitle,
	},
	developer: {
		eyebrow: uiCopy.appShell.developerEyebrow,
		subtitle: uiCopy.appShell.developerSubtitle,
		title: uiCopy.appShell.developerTitle,
	},
};

type AppShellProps = Readonly<{
	activePage: AuthenticatedPageId;
	authStatus: 'authenticated' | 'service';
	children: ReactNode;
}>;

export function AppShell({ activePage, authStatus, children }: AppShellProps): ReactElement {
	const pageCopy = pageCopyById[activePage];
	const statusLabel =
		authStatus === 'service'
			? uiCopy.appShell.serviceSession
			: uiCopy.appShell.authenticatedSession;

	return (
		<div style={appShellPageStyle}>
			<div style={shellFrameStyle}>
				<header
					style={{ ...appShellHeroPanelStyle, ...shellHeaderStyle }}
					className="runa-ambient-panel"
				>
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'flex-start',
							gap: '16px',
							flexWrap: 'wrap',
							marginBottom: '18px',
						}}
					>
						<div style={{ display: 'grid', gap: '10px', maxWidth: 'min(760px, 100%)' }}>
							<div className="runa-eyebrow">{pageCopy.eyebrow.toUpperCase()}</div>
							<h1 style={{ margin: 0, fontSize: 'clamp(28px, 5vw, 38px)' }}>{pageCopy.title}</h1>
							<p style={appShellMutedTextStyle}>{pageCopy.subtitle}</p>
						</div>
						<div
							style={{
								...pillStyle,
								alignSelf: 'start',
							}}
						>
							{statusLabel}
						</div>
					</div>

					<AppNav activePage={activePage} />
				</header>

				<main id="authenticated-app-content" style={shellMainStyle}>
					{children}
				</main>
			</div>
		</div>
	);
}
