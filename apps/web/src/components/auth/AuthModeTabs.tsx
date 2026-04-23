import type { CSSProperties, ReactElement } from 'react';

import { pillStyle } from '../../lib/chat-styles.js';
import { uiCopy } from '../../localization/copy.js';

export type LoginPageMode = 'login' | 'signup' | 'token';

const tabListStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
	gap: '8px',
};

const tabButtonStyle: CSSProperties = {
	display: 'grid',
	gap: '2px',
	justifyItems: 'start',
	padding: '12px 14px',
	borderRadius: '14px',
	border: '1px solid rgba(148, 163, 184, 0.2)',
	background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.72) 0%, rgba(9, 14, 25, 0.7) 100%)',
	color: '#cbd5e1',
	fontWeight: 700,
	cursor: 'pointer',
	transition:
		'transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease',
};

const activeTabButtonStyle: CSSProperties = {
	border: '1px solid rgba(245, 158, 11, 0.34)',
	background:
		'radial-gradient(circle at top right, rgba(245, 158, 11, 0.12), transparent 42%), linear-gradient(180deg, rgba(46, 29, 8, 0.76) 0%, rgba(15, 23, 42, 0.82) 100%)',
	color: '#f8fafc',
	boxShadow: 'var(--shadow-glow)',
};

const tabs = [
	{
		id: 'login',
		label: uiCopy.auth.login,
	},
	{
		id: 'signup',
		label: uiCopy.auth.signup,
	},
	{
		id: 'token',
		label: uiCopy.auth.token,
	},
] as const satisfies readonly {
	readonly id: LoginPageMode;
	readonly label: string;
}[];

type AuthModeTabsProps = Readonly<{
	activeMode: LoginPageMode;
	onSelectMode: (mode: LoginPageMode) => void;
	panelIdBase?: string;
}>;

export function AuthModeTabs({
	activeMode,
	onSelectMode,
	panelIdBase = 'auth-mode-panel',
}: AuthModeTabsProps): ReactElement {
	return (
		<div role="tablist" aria-label={uiCopy.auth.modeLabel} style={tabListStyle}>
			{tabs.map((tab) => {
				const isActive = tab.id === activeMode;
				const panelId = `${panelIdBase}-${tab.id}`;
				const tabId = `${panelIdBase}-tab-${tab.id}`;

				return (
					<button
						key={tab.id}
						type="button"
						id={tabId}
						role="tab"
						aria-selected={isActive}
						aria-controls={panelId}
						onClick={() => onSelectMode(tab.id)}
						style={{
							...tabButtonStyle,
							...(isActive ? activeTabButtonStyle : null),
						}}
						className={`runa-button ${isActive ? 'runa-button--secondary-active' : 'runa-button--secondary'}`}
					>
						{isActive ? (
							<span
								style={{
									...pillStyle,
									padding: '4px 8px',
									marginBottom: '6px',
									width: 'fit-content',
								}}
							>
								active
							</span>
						) : null}
						{tab.label}
					</button>
				);
			})}
		</div>
	);
}
