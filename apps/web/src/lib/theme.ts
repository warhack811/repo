export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'runa-theme';

export function getStoredTheme(): Theme {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === 'dark' || stored === 'light' || stored === 'system') {
			return stored;
		}
	} catch {
		// localStorage unavailable
	}
	return 'system';
}

export function storeTheme(theme: Theme): void {
	try {
		localStorage.setItem(STORAGE_KEY, theme);
	} catch {
		// localStorage unavailable
	}
}

export function applyTheme(theme: Theme): void {
	const root = document.documentElement;
	if (theme === 'system') {
		root.removeAttribute('data-theme');
	} else {
		root.setAttribute('data-theme', theme);
	}
}
