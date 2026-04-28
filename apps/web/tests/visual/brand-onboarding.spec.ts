import { expect, test } from '@playwright/test';

const viewports = [
	{ height: 568, name: 'mobile-320', width: 320 },
	{ height: 1024, name: 'tablet-768', width: 768 },
	{ height: 900, name: 'desktop-1440', width: 1440 },
] as const;

for (const viewport of viewports) {
	test(`brand onboarding fixture passes at ${viewport.name}`, async ({ page }) => {
		const consoleErrors: string[] = [];
		const pageErrors: string[] = [];
		page.on('console', (message) => {
			if (message.type() === 'error') {
				consoleErrors.push(message.text());
			}
		});
		page.on('pageerror', (error) => pageErrors.push(error.message));

		await page.setViewportSize({ height: viewport.height, width: viewport.width });
		await page.goto('/tests/visual/ui-overhaul-06-fixture.html');

		await expect(page.getByRole('heading', { name: 'Runa ile devam et' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Çalışma ortağın hazır.' })).toBeVisible();
		await page.getByRole('button', { name: 'Atla' }).click();
		await expect(page.getByTestId('chat-polish')).toBeVisible();
		await expect(page.getByTestId('settings-polish')).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Preferences' })).toBeVisible();

		await page.getByRole('tab', { name: 'Preferences' }).click();
		await expect(page.getByRole('heading', { name: 'Tema' })).toBeVisible();
		await page.getByRole('tab', { name: 'Devices' }).click();
		await expect(page.getByRole('heading', { name: 'Cihaz durumu' })).toBeVisible();
		await page.getByRole('tab', { name: 'Project Memory' }).click();
		await expect(page.getByRole('heading', { name: 'Proje hafizasi' })).toBeVisible();

		const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 2);
		expect(consoleErrors).toEqual([]);
		expect(pageErrors).toEqual([]);

		await page.screenshot({
			fullPage: true,
			path: `apps/web/tests/visual/__screenshots__/ui-overhaul-06-${viewport.name}.png`,
		});
	});
}
