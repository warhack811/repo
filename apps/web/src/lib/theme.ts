export type Theme = 'light' | 'dark' | 'system';

export const BRAND_THEMES = ['teal', 'indigo', 'graphite', 'plum', 'amber'] as const;
export type BrandTheme = (typeof BRAND_THEMES)[number];

export const DEFAULT_BRAND_THEME: BrandTheme = 'teal';

export const BRAND_THEME_OPTIONS: readonly {
	readonly label: string;
	readonly value: BrandTheme;
}[] = [
	{ value: 'teal', label: 'Teal' },
	{ value: 'indigo', label: 'Indigo' },
	{ value: 'graphite', label: 'Grafit' },
	{ value: 'plum', label: 'Plum' },
	{ value: 'amber', label: 'Amber' },
];

const THEME_STORAGE_KEY = 'runa-theme';
const BRAND_THEME_STORAGE_KEY = 'runa-brand-theme';

function isTheme(value: unknown): value is Theme {
	return value === 'dark' || value === 'light' || value === 'system';
}

export function isBrandTheme(value: unknown): value is BrandTheme {
	return typeof value === 'string' && BRAND_THEMES.includes(value as BrandTheme);
}

export function getStoredTheme(): Theme {
	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		if (isTheme(stored)) {
			return stored;
		}
	} catch {
		// localStorage unavailable
	}
	return 'system';
}

export function storeTheme(theme: Theme): void {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, theme);
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
		if (isBrandTheme(stored)) {
			return stored;
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

export function applyAppearance(theme: Theme, brandTheme: BrandTheme): void {
	applyTheme(theme);
	applyBrandTheme(brandTheme);
}
