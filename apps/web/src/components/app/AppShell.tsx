import type { CSSProperties, ReactElement, ReactNode } from 'react';

import {
	heroPanelStyle,
	pageStyle,
	pillStyle,
	secondaryButtonStyle,
} from '../../lib/chat-styles.js';
import { uiCopy } from '../../localization/copy.js';
import { AppNav, type AuthenticatedPageId } from './AppNav.js';

export const appShellPageStyle: CSSProperties = {
	...pageStyle,
	minHeight: '100dvh',
	padding: `calc(var(--space-page-y) + var(--safe-area-top))
		calc(var(--space-page-x) + var(--safe-area-right))
		calc(var(--space-page-y) + var(--safe-area-bottom))
		calc(var(--space-page-x) + var(--safe-area-left))`,
};

const shellFrameStyle: CSSProperties = {
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
		<div className="runa-page runa-page--app-shell" style={appShellPageStyle}>
			<div className="runa-shell-frame runa-shell-frame--app" style={shellFrameStyle}>
				<header
					style={{ ...appShellHeroPanelStyle, ...shellHeaderStyle }}
					className="runa-card runa-card--hero runa-ambient-panel runa-app-shell-header"
				>
					<div className="runa-app-shell-header__top">
						<div className="runa-app-shell-header__copy">
							<div className="runa-eyebrow">{pageCopy.eyebrow.toUpperCase()}</div>
							<h1 style={{ margin: 0, fontSize: 'clamp(28px, 5vw, 38px)' }}>{pageCopy.title}</h1>
							<p style={appShellMutedTextStyle}>{pageCopy.subtitle}</p>
						</div>
						<div
							style={{
								...pillStyle,
							}}
							className="runa-pill runa-app-shell-status-pill"
						>
							{statusLabel}
						</div>
					</div>

					<div className="runa-app-shell-nav">
						<AppNav activePage={activePage} />
					</div>
				</header>

				<main
					id="authenticated-app-content"
					style={shellMainStyle}
					className="runa-app-shell-main"
				>
					{children}
				</main>
			</div>
		</div>
	);
}
