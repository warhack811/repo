import { Clock3, type LucideIcon, MessageCircle, Monitor, UserRound } from 'lucide-react';
import type { ReactElement } from 'react';
import { NavLink } from 'react-router-dom';

import { uiCopy } from '../../localization/copy.js';

export type AuthenticatedPageId = 'account' | 'chat' | 'devices' | 'history';

interface AppNavItem {
	readonly description: string;
	readonly id: AuthenticatedPageId;
	readonly icon: LucideIcon;
	readonly label: string;
	readonly to: string;
}

const appNavItems: readonly AppNavItem[] = [
	{
		description: uiCopy.appNav.chatDescription,
		id: 'chat',
		icon: MessageCircle,
		label: uiCopy.appNav.chatLabel,
		to: '/chat',
	},
	{
		description: uiCopy.appNav.historyDescription,
		id: 'history',
		icon: Clock3,
		label: uiCopy.appNav.historyLabel,
		to: '/history',
	},
	{
		description: uiCopy.appNav.devicesDescription,
		id: 'devices',
		icon: Monitor,
		label: uiCopy.appNav.devicesLabel,
		to: '/devices',
	},
	{
		description: uiCopy.appNav.accountDescription,
		id: 'account',
		icon: UserRound,
		label: uiCopy.appNav.accountLabel,
		to: '/account',
	},
] as const;

type AppNavProps = Readonly<{
	activePage: AuthenticatedPageId;
}>;

export function AppNav({ activePage }: AppNavProps): ReactElement {
	return (
		<nav
			aria-label={uiCopy.appNav.navLabel}
			className="runa-app-nav runa-migrated-components-app-appnav-1"
		>
			<div className="runa-app-nav__items runa-migrated-components-app-appnav-2">
				{appNavItems.map((item) => {
					const isActive = item.id === activePage;
					const Icon = item.icon;

					return (
						<NavLink
							key={item.id}
							to={item.to}
							aria-controls="authenticated-app-content"
							aria-label={`${item.label}. ${item.description}`}
							className={`runa-app-nav__item${
								isActive ? ' runa-app-nav__item--active' : ''
							} runa-migrated-components-app-appnav-3`}
						>
							<span
								className="runa-app-nav__icon runa-migrated-components-app-appnav-4"
								aria-hidden="true"
							>
								<Icon size={14} />
							</span>
							<span className="runa-app-nav__copy runa-migrated-components-app-appnav-5">
								<span className="runa-app-nav__label runa-migrated-components-app-appnav-6">
									{item.label}
								</span>
								<span className="runa-app-nav__description runa-migrated-components-app-appnav-7">
									{item.description}
								</span>
							</span>
						</NavLink>
					);
				})}
			</div>
		</nav>
	);
}
