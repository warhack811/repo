import { describe, expect, it } from 'vitest';

import {
	parseSettingsTab,
	settingsTabToSearchParams,
	shouldNormalizeSettingsTab,
} from './settingsTabs.js';

describe('settingsTabs helpers', () => {
	it('parses tab values with legacy fallback', () => {
		expect(parseSettingsTab(null)).toBe('appearance');
		expect(parseSettingsTab('appearance')).toBe('appearance');
		expect(parseSettingsTab('conversation')).toBe('conversation');
		expect(parseSettingsTab('notifications')).toBe('notifications');
		expect(parseSettingsTab('privacy')).toBe('privacy');
		expect(parseSettingsTab('advanced')).toBe('advanced');
		expect(parseSettingsTab('preferences')).toBe('appearance');
		expect(parseSettingsTab('unknown')).toBe('appearance');
	});

	it('maps tabs back to query params', () => {
		expect(settingsTabToSearchParams('appearance').toString()).toBe('');
		expect(settingsTabToSearchParams('conversation').toString()).toBe('tab=conversation');
	});

	it('marks only legacy or invalid values for normalization', () => {
		expect(shouldNormalizeSettingsTab(null)).toBe(false);
		expect(shouldNormalizeSettingsTab('appearance')).toBe(true);
		expect(shouldNormalizeSettingsTab('preferences')).toBe(true);
		expect(shouldNormalizeSettingsTab('unknown')).toBe(true);
		expect(shouldNormalizeSettingsTab('conversation')).toBe(false);
		expect(shouldNormalizeSettingsTab('notifications')).toBe(false);
		expect(shouldNormalizeSettingsTab('privacy')).toBe(false);
		expect(shouldNormalizeSettingsTab('advanced')).toBe(false);
	});
});
