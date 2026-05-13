import { useDeveloperMode } from './useDeveloperMode.js';

export function useAdvancedViewMode(): Readonly<{
	isEnabled: boolean;
	setEnabled: (nextValue: boolean) => void;
}> {
	const { isDeveloperMode, setDeveloperMode } = useDeveloperMode();
	return {
		isEnabled: isDeveloperMode,
		setEnabled: setDeveloperMode,
	};
}
