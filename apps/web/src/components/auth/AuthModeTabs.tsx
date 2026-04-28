import type { ReactElement } from 'react';
import { uiCopy } from '../../localization/copy.js';

export type LoginPageMode = 'login' | 'signup' | 'token';

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
	showTokenMode?: boolean;
}>;

export function AuthModeTabs({
	activeMode,
	onSelectMode,
	panelIdBase = 'auth-mode-panel',
	showTokenMode = true,
}: AuthModeTabsProps): ReactElement {
	const visibleTabs = showTokenMode ? tabs : tabs.filter((tab) => tab.id !== 'token');

	return (
		<div
			role="tablist"
			aria-label={uiCopy.auth.modeLabel}
			className="runa-migrated-components-auth-authmodetabs-1"
		>
			{visibleTabs.map((tab) => {
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
						className={[
							`runa-button ${isActive ? 'runa-button--secondary-active' : 'runa-button--secondary'}`,
							'runa-migrated-components-auth-authmodetabs-2',
						]
							.filter(Boolean)
							.join(' ')}
					>
						{isActive ? (
							<span className="runa-migrated-components-auth-authmodetabs-3">active</span>
						) : null}
						{tab.label}
					</button>
				);
			})}
		</div>
	);
}
