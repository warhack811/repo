import { beforeEach, describe, expect, it } from 'vitest';

import {
	BRAND_THEMES,
	DEFAULT_BRAND_THEME,
	applyBrandTheme,
	getStoredBrandTheme,
	storeBrandTheme,
} from './theme.js';

describe('brand theme preferences', () => {
	beforeEach(() => {
		window.localStorage.clear();
		document.documentElement.removeAttribute('data-brand-theme');
	});

	it('falls back to teal when the stored brand theme is invalid', () => {
		window.localStorage.setItem('runa-brand-theme', 'neon');

		expect(getStoredBrandTheme()).toBe(DEFAULT_BRAND_THEME);
	});

	it('stores and applies the supported brand themes on the root element', () => {
		for (const theme of BRAND_THEMES) {
			storeBrandTheme(theme);
			applyBrandTheme(getStoredBrandTheme());

			expect(document.documentElement.dataset['brandTheme']).toBe(theme);
		}
	});
});
