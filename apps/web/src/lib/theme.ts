export type Theme = 'light' | 'dark' | 'system';
export const BRAND_THEMES = ['teal', 'indigo', 'graphite', 'plum', 'amber'] as const;
export type BrandTheme = (typeof BRAND_THEMES)[number];
export const DEFAULT_BRAND_THEME: BrandTheme = 'teal';

const STORAGE_KEY = 'runa-theme';
const BRAND_THEME_STORAGE_KEY = 'runa-brand-theme';

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

export function getStoredBrandTheme(): BrandTheme {
	try {
		const stored = localStorage.getItem(BRAND_THEME_STORAGE_KEY);
		if (stored && BRAND_THEMES.includes(stored as BrandTheme)) {
			return stored as BrandTheme;
		}
	} catch {
		// localStorage unavailable
	}
	return DEFAULT_BRAND_THEME;
}

export function storeBrandTheme(theme: BrandTheme): void {
	try {
		localStorage.setItem(BRAND_THEME_STORAGE_KEY, theme);
	} catch {
		// localStorage unavailable
	}
}

export function applyBrandTheme(theme: BrandTheme): void {
	document.documentElement.setAttribute('data-brand-theme', theme);
}

// Compatibility bridge for retained bootstrap/test files expecting legacy API.
export function applyAppearance(theme: Theme, brandTheme: BrandTheme): void {
	applyTheme(theme);
	applyBrandTheme(brandTheme);
}
