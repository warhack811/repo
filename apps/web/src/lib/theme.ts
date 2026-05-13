export type Theme = 'ember-dark' | 'ember-light' | 'rose-dark' | 'system';

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

const THEME_STORAGE_KEY = 'runa.settings.theme';
const LEGACY_THEME_STORAGE_KEY = 'runa-theme';
const BRAND_THEME_STORAGE_KEY = 'runa-brand-theme';
const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';

function isTheme(value: unknown): value is Theme {
	return (
		value === 'ember-dark' || value === 'ember-light' || value === 'rose-dark' || value === 'system'
	);
}

function normalizeTheme(value: string): Theme | null {
	if (isTheme(value)) {
		return value;
	}

	if (value === 'dark') {
		return 'ember-dark';
	}

	if (value === 'light') {
		return 'ember-light';
	}

	if (value === 'rose') {
		return 'rose-dark';
	}

	return null;
}

function resolveSystemTheme(): Extract<Theme, 'ember-dark' | 'ember-light'> {
	if (typeof window === 'undefined') {
		return 'ember-dark';
	}

	return window.matchMedia(SYSTEM_THEME_QUERY).matches ? 'ember-dark' : 'ember-light';
}

let detachSystemThemeListener: (() => void) | null = null;

function clearSystemThemeListener(): void {
	detachSystemThemeListener?.();
	detachSystemThemeListener = null;
}

function ensureSystemThemeListener(root: HTMLElement): void {
	clearSystemThemeListener();

	if (typeof window === 'undefined') {
		return;
	}

	const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY);
	const handleChange = (): void => {
		root.setAttribute('data-theme', resolveSystemTheme());
	};

	root.setAttribute('data-theme', resolveSystemTheme());
	mediaQuery.addEventListener('change', handleChange);
	detachSystemThemeListener = () => {
		mediaQuery.removeEventListener('change', handleChange);
	};
}

export function isBrandTheme(value: unknown): value is BrandTheme {
	return typeof value === 'string' && BRAND_THEMES.includes(value as BrandTheme);
}

export function getStoredTheme(): Theme {
	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		if (typeof stored === 'string') {
			const normalizedStoredTheme = normalizeTheme(stored);

			if (normalizedStoredTheme) {
				return normalizedStoredTheme;
			}
		}

		const legacyStored = localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
		if (typeof legacyStored === 'string') {
			const normalizedLegacyTheme = normalizeTheme(legacyStored);

			if (normalizedLegacyTheme) {
				return normalizedLegacyTheme;
			}
		}
	} catch {
		// localStorage unavailable
	}
	return 'system';
}

export function storeTheme(theme: Theme): void {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, theme);
		localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
	} catch {
		// localStorage unavailable
	}
}

export function applyTheme(theme: Theme): void {
	const root = document.documentElement;
	if (theme === 'system') {
		ensureSystemThemeListener(root);
	} else {
		clearSystemThemeListener();
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
