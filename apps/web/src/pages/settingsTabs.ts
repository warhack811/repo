export type SettingsTab = 'advanced' | 'appearance' | 'conversation' | 'notifications' | 'privacy';

const explicitTabs = new Set<SettingsTab>([
	'advanced',
	'appearance',
	'conversation',
	'notifications',
	'privacy',
]);

export function parseSettingsTab(value: string | null): SettingsTab {
	if (value === 'preferences') {
		return 'appearance';
	}

	if (value !== null && explicitTabs.has(value as SettingsTab)) {
		return value as SettingsTab;
	}

	return 'appearance';
}

export function settingsTabToSearchParams(tab: SettingsTab): URLSearchParams {
	const params = new URLSearchParams();

	if (tab !== 'appearance') {
		params.set('tab', tab);
	}

	return params;
}

export function shouldNormalizeSettingsTab(value: string | null): boolean {
	if (value === null) {
		return false;
	}

	if (value === 'appearance' || value === 'preferences') {
		return true;
	}

	return !explicitTabs.has(value as SettingsTab);
}
