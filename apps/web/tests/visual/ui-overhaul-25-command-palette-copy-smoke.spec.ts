import { type Page, expect, test } from '@playwright/test';

const viewports = [
	{ height: 844, label: 'mobile-390', width: 390 },
	{ height: 896, label: 'mobile-320', width: 320 },
] as const;

const expectedCommandLabels = [
	'Sohbete git',
	'Yeni sohbet başlat',
	'Geçmişi aç',
	'Bağlamı aç',
	'Gelişmiş görünümü aç',
	'Bildirimleri göster',
	'Geçmiş sayfasına git',
];

const forbiddenOldCopy = [
	'alanina',
	'calisma',
	'taslagi',
	'baslat',
	'gecmisi',
	'kaldigim',
	'arsiv',
	'Gecmisi',
	'Baglami',
	'Gelismis',
	'gorunum',
	'Bildirimleri goster',
	'Kayitli',
	'Komut paletini ac',
	'working files',
];

const mojibakePatterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];

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

async function assertNoForbiddenText(page: Page): Promise<void> {
	const bodyText = await page.locator('body').innerText();
	for (const token of forbiddenOldCopy) {
		expect(bodyText, `forbidden old copy: "${token}"`).not.toContain(token);
	}
	for (const pattern of mojibakePatterns) {
		expect(bodyText, `mojibake pattern: "${pattern}"`).not.toContain(pattern);
	}
}

for (const viewport of viewports) {
	test(`command palette copy smoke at ${viewport.label}`, async ({ page }) => {
		await page.setViewportSize({ height: viewport.height, width: viewport.width });
		await page.goto('/tests/visual/ui-overhaul-25-command-palette-copy-smoke.html');

		// Trigger should be visible with correct label
		const triggerButton = page.getByRole('button', { name: 'Komut paletini aç' });
		await expect(triggerButton).toBeVisible();
		await expect(triggerButton).toContainText('Komut ara');

		// Click trigger to open palette
		await triggerButton.click();

		// Palette should show expected command labels
		for (const label of expectedCommandLabels) {
			await expect(page.getByText(label).first()).toBeVisible();
		}

		// Forbidden old copy should not appear
		await assertNoForbiddenText(page);

		// No horizontal overflow
		await assertNoHorizontalOverflow(page, viewport.width, viewport.label);
	});
}
