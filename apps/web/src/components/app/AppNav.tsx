import { Clock3, type LucideIcon, MessageCircle, Monitor, UserRound } from 'lucide-react';
import type { CSSProperties, ReactElement } from 'react';
import { NavLink } from 'react-router-dom';

import { uiCopy } from '../../localization/copy.js';

export type AuthenticatedPageId = 'account' | 'chat' | 'developer' | 'devices' | 'history';

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

const navGridStyle: CSSProperties = {
	display: 'grid',
	gap: '4px',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(132px, 100%), 1fr))',
};

const navButtonStyle: CSSProperties = {
	display: 'flex',
	gap: '8px',
	alignItems: 'center',
	textAlign: 'left',
	padding: '6px 10px',
	borderRadius: '10px',
	border: '1px solid rgba(148, 163, 184, 0.12)',
	background: 'rgba(9, 14, 25, 0.4)',
	color: 'hsl(var(--color-text))',
	cursor: 'pointer',
	transition: 'border-color 140ms ease, background 140ms ease',
	minWidth: 0,
	minHeight: '40px',
};

const activeNavButtonStyle: CSSProperties = {
	border: '1px solid rgba(245, 158, 11, 0.28)',
	background: 'rgba(46, 29, 8, 0.5)',
};

const navLabelStyle: CSSProperties = {
	fontSize: '13px',
	fontWeight: 600,
};

const navDescriptionStyle: CSSProperties = {
	fontSize: '10px',
	lineHeight: 1.3,
	color: 'hsl(var(--color-text-dim))',
	overflowWrap: 'anywhere',
};

const navIconStyle: CSSProperties = {
	display: 'grid',
	placeItems: 'center',
	width: '24px',
	height: '24px',
	borderRadius: '8px',
	border: '1px solid rgba(148, 163, 184, 0.08)',
	background: 'rgba(15, 23, 42, 0.4)',
	flex: '0 0 auto',
};

type AppNavProps = Readonly<{
	activePage: AuthenticatedPageId;
}>;

export function AppNav({ activePage }: AppNavProps): ReactElement {
	return (
		<nav aria-label={uiCopy.appNav.navLabel} style={{ display: 'grid', gap: '12px' }}>
			<div style={navGridStyle}>
				{appNavItems.map((item) => {
					const isActive = item.id === activePage;
					const Icon = item.icon;

					return (
						<NavLink
							key={item.id}
							to={item.to}
							aria-controls="authenticated-app-content"
							aria-label={`${item.label}. ${item.description}`}
							style={{
								...navButtonStyle,
								...(isActive ? activeNavButtonStyle : {}),
								textDecoration: 'none',
							}}
						>
							<span style={navIconStyle} aria-hidden="true">
								<Icon size={14} />
							</span>
							<span style={{ display: 'grid', gap: '3px', minWidth: 0 }}>
								<span style={navLabelStyle}>{item.label}</span>
								<span style={navDescriptionStyle}>{item.description}</span>
							</span>
						</NavLink>
					);
				})}
			</div>
		</nav>
	);
}
