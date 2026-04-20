import { useEffect, useState } from 'react';

const DEVELOPER_MODE_STORAGE_KEY = 'runa_dev_mode';

function readStoredDeveloperMode(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}

	return window.localStorage.getItem(DEVELOPER_MODE_STORAGE_KEY) === 'true';
}

export function useDeveloperMode(): Readonly<{
	isDeveloperMode: boolean;
	setDeveloperMode: (nextValue: boolean) => void;
	toggleDeveloperMode: () => void;
}> {
	const [isDeveloperMode, setIsDeveloperMode] = useState<boolean>(() => readStoredDeveloperMode());

	useEffect(() => {
		function handleStorage(event: StorageEvent): void {
			if (event.key === DEVELOPER_MODE_STORAGE_KEY) {
				setIsDeveloperMode(event.newValue === 'true');
			}
		}

		window.addEventListener('storage', handleStorage);
		return () => window.removeEventListener('storage', handleStorage);
	}, []);

	const setDeveloperMode = (nextValue: boolean): void => {
		setIsDeveloperMode(nextValue);
		window.localStorage.setItem(DEVELOPER_MODE_STORAGE_KEY, nextValue ? 'true' : 'false');
	};

	const toggleDeveloperMode = (): void => {
		setDeveloperMode(!isDeveloperMode);
	};

	return {
		isDeveloperMode,
		setDeveloperMode,
		toggleDeveloperMode,
	};
}
