import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { heroPanelStyle, pageStyle, secondaryButtonStyle } from '../../lib/chat-styles.js';
import { designTokens } from '../../lib/design-tokens.js';
import { uiCopy } from '../../localization/copy.js';
import { RunaBadge, RunaSurface } from '../ui/index.js';
import { AppNav, type AuthenticatedPageId } from './AppNav.js';

const TURKISH_LOCALE = 'tr-TR';

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
	gap: designTokens.spacing.shellGap,
	minWidth: 0,
};

export const appShellPanelStyle: CSSProperties = {
	background: designTokens.color.background.panel,
	border: `1px solid ${designTokens.color.border.subtle}`,
	borderRadius: designTokens.radius.card,
	boxShadow: designTokens.shadow.panel,
	padding: designTokens.spacing.panel,
	backdropFilter: 'blur(12px)',
	position: 'relative',
	overflow: 'hidden',
};

export const appShellHeroPanelStyle: CSSProperties = {
	...appShellPanelStyle,
	...heroPanelStyle,
};

export const appShellSecondaryLabelStyle: CSSProperties = {
	...designTokens.typography.label,
	color: designTokens.color.foreground.soft,
};

export const appShellMutedTextStyle: CSSProperties = {
	margin: 0,
	color: designTokens.color.foreground.muted,
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
	borderRadius: designTokens.radius.button,
	border: 'none',
	background: designTokens.color.interactive.primary,
	color: designTokens.color.foreground.inverse,
	fontWeight: 700,
	cursor: 'pointer',
	boxShadow: designTokens.shadow.primaryButton,
};

export const appShellSecondaryButtonStyle: CSSProperties = {
	...secondaryButtonStyle,
};

export const appShellMetricCardStyle: CSSProperties = {
	padding: '14px 16px',
	borderRadius: designTokens.radius.soft,
	background: 'linear-gradient(180deg, rgba(6, 11, 21, 0.76) 0%, rgba(2, 6, 23, 0.64) 100%)',
	border: `1px solid ${designTokens.color.border.soft}`,
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
							<div className="runa-eyebrow">
								{pageCopy.eyebrow.toLocaleUpperCase(TURKISH_LOCALE)}
							</div>
							<h1 style={{ margin: 0, fontSize: 'clamp(28px, 5vw, 38px)' }}>{pageCopy.title}</h1>
							<p style={appShellMutedTextStyle}>{pageCopy.subtitle}</p>
						</div>
						<RunaBadge
							className="runa-pill runa-app-shell-status-pill"
							lang="tr"
							tone={authStatus === 'service' ? 'warning' : 'neutral'}
						>
							{statusLabel}
						</RunaBadge>
					</div>

					<div className="runa-app-shell-nav">
						<AppNav activePage={activePage} />
					</div>
				</header>

				<RunaSurface
					as="main"
					id="authenticated-app-content"
					style={shellMainStyle}
					className="runa-app-shell-main"
					tone="plain"
				>
					{children}
				</RunaSurface>
			</div>
		</div>
	);
}
