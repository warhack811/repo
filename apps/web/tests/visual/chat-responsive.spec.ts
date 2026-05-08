import { expect, test } from '@playwright/test';

const viewports = [
	{ height: 568, name: 'mobile-320', width: 320 },
	{ height: 896, name: 'mobile-414', width: 414 },
	{ height: 1024, name: 'tablet-768', width: 768 },
	{ height: 800, name: 'desktop-1280', width: 1280 },
] as const;

for (const viewport of viewports) {
	test(`responsive fixture passes at ${viewport.name}`, async ({ page }) => {
		await page.setViewportSize({ height: viewport.height, width: viewport.width });
		await page.goto('/tests/visual/ui-overhaul-05-fixture.html');

		await expect(page.getByTestId('composer')).toBeVisible();
		await expect(page.getByTestId('work-surface')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Sohbetler' })).toBeVisible();

		const composerPosition = await page.getByTestId('composer').evaluate((element) => {
			const styles = window.getComputedStyle(element.parentElement ?? element);
			return {
				bottom: styles.bottom,
				position: styles.position,
			};
		});
		const textareaFontSize = await page
			.locator('textarea')
			.evaluate((element) => Number.parseFloat(window.getComputedStyle(element).fontSize));
		const minButtonHeight = await page
			.locator('button')
			.evaluateAll((buttons) =>
				Math.min(...buttons.map((button) => button.getBoundingClientRect().height)),
			);
		const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);

		expect(textareaFontSize).toBeGreaterThanOrEqual(viewport.width < 768 ? 16 : 14);
		expect(minButtonHeight).toBeGreaterThanOrEqual(viewport.width < 768 ? 44 : 36);
		expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 2);

		if (viewport.width < 768) {
			expect(composerPosition.position).toBe('relative');
			expect(['auto', '0px']).toContain(composerPosition.bottom);
		}

		await page.keyboard.press('Escape');
		await expect(page.locator('.runa-conversation-sidebar--open')).toHaveCount(0);

		await page.screenshot({
			fullPage: true,
			path: `apps/web/tests/visual/__screenshots__/ui-overhaul-05-${viewport.name}.png`,
		});
	});
}
