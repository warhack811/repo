import type { CSSProperties, ReactElement } from 'react';
import { NavLink } from 'react-router-dom';

import { useDeveloperMode } from '../../hooks/useDeveloperMode.js';
import { pillStyle } from '../../lib/chat-styles.js';
import { uiCopy } from '../../localization/copy.js';

export type AuthenticatedPageId = 'account' | 'chat' | 'developer';

interface AppNavItem {
	readonly description: string;
	readonly id: AuthenticatedPageId;
	readonly label: string;
	readonly to: string;
}

const appNavItems: readonly AppNavItem[] = [
	{
		description: uiCopy.appNav.chatDescription,
		id: 'chat',
		label: uiCopy.appNav.chatLabel,
		to: '/chat',
	},
	{
		description: uiCopy.appNav.accountDescription,
		id: 'account',
		label: uiCopy.appNav.accountLabel,
		to: '/account',
	},
	{
		description: uiCopy.appNav.developerDescription,
		id: 'developer',
		label: uiCopy.appNav.developerLabel,
		to: '/developer',
	},
] as const;

const navGridStyle: CSSProperties = {
	display: 'grid',
	gap: '10px',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
};

const navButtonStyle: CSSProperties = {
	display: 'grid',
	gap: '6px',
	alignContent: 'start',
	textAlign: 'left',
	padding: '16px 18px',
	borderRadius: '18px',
	border: '1px solid rgba(148, 163, 184, 0.22)',
	background: 'linear-gradient(180deg, rgba(9, 14, 25, 0.78) 0%, rgba(6, 11, 21, 0.72) 100%)',
	color: 'hsl(var(--color-text))',
	cursor: 'pointer',
	transition:
		'transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease',
	minWidth: 0,
	minHeight: '96px',
	boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
};

const activeNavButtonStyle: CSSProperties = {
	border: '1px solid rgba(245, 158, 11, 0.42)',
	background:
		'radial-gradient(circle at top right, rgba(245, 158, 11, 0.14), transparent 40%), linear-gradient(180deg, rgba(46, 29, 8, 0.88) 0%, rgba(15, 23, 42, 0.82) 100%)',
	boxShadow: 'var(--shadow-glow)',
};

const navLabelStyle: CSSProperties = {
	fontSize: '15px',
	fontWeight: 700,
};

const navDescriptionStyle: CSSProperties = {
	fontSize: '12px',
	lineHeight: 1.5,
	color: 'hsl(var(--color-text-soft))',
	overflowWrap: 'anywhere',
};

type AppNavProps = Readonly<{
	activePage: AuthenticatedPageId;
}>;

export function AppNav({ activePage }: AppNavProps): ReactElement {
	const { isDeveloperMode, toggleDeveloperMode } = useDeveloperMode();
	const visibleNavItems = appNavItems.filter(
		(item) => item.id !== 'developer' || isDeveloperMode || activePage === 'developer',
	);

	return (
		<nav aria-label={uiCopy.appNav.navLabel} style={{ display: 'grid', gap: '12px' }}>
			<div className="runa-nav-meta">
				<div className="runa-subtle-copy" style={{ fontSize: '13px' }}>
					{isDeveloperMode
						? 'Developer surfaces are visible for this browser.'
						: 'Main navigation stays focused on conversation by default.'}
				</div>
				<button
					type="button"
					aria-pressed={isDeveloperMode}
					onClick={toggleDeveloperMode}
					className={`runa-developer-toggle${isDeveloperMode ? ' runa-developer-toggle--active' : ''}`}
				>
					<span>{uiCopy.appNav.developerLabel}</span>
					<span className="runa-developer-toggle__switch" aria-hidden="true" />
				</button>
			</div>
			<div style={navGridStyle}>
				{visibleNavItems.map((item) => {
					const isActive = item.id === activePage;

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
							<span style={{ ...pillStyle, width: 'fit-content', padding: '6px 10px' }}>
								{isActive ? 'Primary' : 'Secondary'}
							</span>
							<span style={navLabelStyle}>{item.label}</span>
							<span style={navDescriptionStyle}>{item.description}</span>
						</NavLink>
					);
				})}
			</div>
		</nav>
	);
}
