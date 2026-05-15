import { type Page, expect, test } from '@playwright/test';

const viewports = [
	{ height: 844, label: 'mobile-390', width: 390 },
	{ height: 896, label: 'mobile-320', width: 320 },
] as const;

async function assertNoHorizontalOverflow(
	page: Page,
	viewportWidth: number,
	label: string,
): Promise<void> {
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth, `${label}: page-level horizontal overflow`).toBeLessThanOrEqual(
		viewportWidth + 2,
	);
}

for (const viewport of viewports) {
	test(`empty state personalization smoke at ${viewport.label}`, async ({ page }) => {
		await page.setViewportSize({ height: viewport.height, width: viewport.width });
		await page.goto('/tests/visual/ui-overhaul-17-empty-state-smoke.html');

		// Hero section
		const heroTitle = page.locator('.runa-chat-empty-hero__title');
		await expect(heroTitle).toContainText('Günaydın');

		// Lead text
		await expect(page.locator('.runa-chat-empty-hero__lead')).toHaveText('Nereden başlayalım?');

		// Context chips
		const chips = page.locator('.runa-chat-empty-context__chip');
		const chipCount = await chips.count();
		expect(chipCount).toBe(3);
		await expect(chips.nth(0)).toContainText('Proje:');
		await expect(chips.nth(1)).toContainText('Cihaz');
		await expect(chips.nth(2)).toContainText('konuşma');

		// Suggestion grid — 4 buttons
		const suggestions = page.locator('.runa-chat-suggestion');
		await expect(suggestions).toHaveCount(4);

		// Each suggestion has a visible label and description
		for (let i = 0; i < 4; i++) {
			const suggestion = suggestions.nth(i);
			await expect(suggestion.locator('.runa-chat-suggestion__label')).toBeVisible();
			await expect(suggestion.locator('.runa-chat-suggestion__description')).toBeVisible();
		}

		// Tip
		await expect(page.locator('.runa-chat-empty-state__tip')).toContainText('Ctrl+K');

		// Page-level horizontal overflow check
		await assertNoHorizontalOverflow(page, viewport.width, viewport.label);

		// Mojibake absence
		const bodyText = await page.locator('body').innerText();
		const mojibakePatterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];
		for (const pattern of mojibakePatterns) {
			expect(bodyText, `no mojibake pattern "${pattern}"`).not.toContain(pattern);
		}
	});
}
