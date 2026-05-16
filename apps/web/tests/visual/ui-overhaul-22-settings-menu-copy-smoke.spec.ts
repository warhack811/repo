import { type Page, expect, test } from '@playwright/test';

const viewports = [
	{ height: 844, label: 'mobile-390', width: 390 },
	{ height: 896, label: 'mobile-320', width: 320 },
] as const;

const forbiddenOldCopy = [
	'Gecmis',
	'Gelismis',
	'Acik',
	'Kapali',
	'Yardim',
	'Yakinda',
	'Hizli menu',
	'Menuyu kapat',
	'Turkce',
	'Siki',
	'Suresiz',
	'30 gun',
];
const forbiddenMojibake = ['Ã', 'Ä', 'Å', 'â€¢', '�', 'Sayfa y?kleniyor'];

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
	test(`settings/menu copy smoke at ${viewport.label}`, async ({ page }) => {
		await page.setViewportSize({ height: viewport.height, width: viewport.width });
		await page.goto('/tests/visual/ui-overhaul-22-settings-menu-copy-smoke.html');

		await expect(page.getByRole('region', { name: 'Hızlı menü' })).toBeVisible();
		await expect(page.getByText('Geçmiş')).toBeVisible();
		await expect(page.getByText('Gelişmiş görünüm')).toBeVisible();
		await expect(page.getByText('Yardım ve geri bildirim')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Menüyü kapat' })).toBeVisible();

		const openSuffixCount = await page.getByText('Açık').count();
		const closedSuffixCount = await page.getByText('Kapalı').count();
		expect(openSuffixCount + closedSuffixCount).toBeGreaterThan(0);

		await expect(page.getByRole('tab', { name: 'Görünüm' }).first()).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Sohbet' }).first()).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Bildirimler' }).first()).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Gizlilik' }).first()).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Gelişmiş' }).first()).toBeVisible();

		await expect(page.getByText('Her işlemde sor')).toBeVisible();
		await expect(page.getByText('Güvenilir oturum')).toBeVisible();
		await expect(page.getByText('Metin yoğunluğu')).toBeVisible();

		const bodyText = await page.locator('body').innerText();
		for (const token of ['Sıkı', 'Türkçe', '30 gün', 'Süresiz']) {
			expect(bodyText, `required settings token: "${token}"`).toContain(token);
		}
		for (const token of forbiddenOldCopy) {
			expect(bodyText, `forbidden old copy token: "${token}"`).not.toContain(token);
		}
		for (const token of forbiddenMojibake) {
			expect(bodyText, `forbidden mojibake token: "${token}"`).not.toContain(token);
		}

		await assertNoHorizontalOverflow(page, viewport.width, viewport.label);
	});
}
