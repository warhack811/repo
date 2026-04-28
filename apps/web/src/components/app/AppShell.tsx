import type { ReactElement, ReactNode } from 'react';
import { uiCopy } from '../../localization/copy.js';
import { RunaBadge, RunaSurface } from '../ui/index.js';
import { AppNav, type AuthenticatedPageId } from './AppNav.js';

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
	devices: {
		eyebrow: uiCopy.appShell.devicesEyebrow,
		subtitle: uiCopy.appShell.devicesSubtitle,
		title: uiCopy.appShell.devicesTitle,
	},
	developer: {
		eyebrow: uiCopy.appShell.developerEyebrow,
		subtitle: uiCopy.appShell.developerSubtitle,
		title: uiCopy.appShell.developerTitle,
	},
	history: {
		eyebrow: uiCopy.appShell.historyEyebrow,
		subtitle: uiCopy.appShell.historySubtitle,
		title: uiCopy.appShell.historyTitle,
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

	if (activePage === 'chat') {
		return (
			<div className="runa-page runa-page--chat-product runa-migrated-components-app-appshell-1">
				<RunaSurface
					as="main"
					id="authenticated-app-content"
					className="runa-app-shell-main runa-app-shell-main--chat runa-route-transition runa-migrated-components-app-appshell-2"
					tone="plain"
				>
					<AppNav activePage={activePage} />
					{children}
				</RunaSurface>
			</div>
		);
	}

	return (
		<div className="runa-page runa-page--app-shell runa-migrated-components-app-appshell-3">
			<div className="runa-shell-frame runa-shell-frame--app runa-migrated-components-app-appshell-4">
				<header className="runa-card runa-card--hero runa-ambient-panel runa-app-shell-header runa-migrated-components-app-appshell-5">
					<div className="runa-app-shell-header__top">
						<div className="runa-app-shell-header__copy">
							<div className="runa-eyebrow">{pageCopy.eyebrow.toUpperCase()}</div>
							<h1 className="runa-migrated-components-app-appshell-6">{pageCopy.title}</h1>
							<p className="runa-migrated-components-app-appshell-7">{pageCopy.subtitle}</p>
						</div>
						<RunaBadge
							className="runa-pill runa-app-shell-status-pill"
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
					className="runa-app-shell-main runa-route-transition runa-migrated-components-app-appshell-8"
					tone="plain"
				>
					{children}
				</RunaSurface>
			</div>
		</div>
	);
}
