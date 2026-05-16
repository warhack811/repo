import { type Page, expect, test } from '@playwright/test';

const viewports = [
	{ height: 844, label: 'mobile-390', width: 390 },
	{ height: 896, label: 'mobile-320', width: 320 },
] as const;

const forbiddenTechnical = [
	'blob_id',
	'media_type',
	'size_bytes',
	'payload',
	'backend',
	'protocol',
	'metadata',
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

for (const viewport of viewports) {
	test(`upload attachment smoke at ${viewport.label}`, async ({ page }) => {
		await page.setViewportSize({ height: viewport.height, width: viewport.width });
		await page.goto('/tests/visual/ui-overhaul-21-upload-attachment-smoke.html');

		await expect(page.getByRole('button', { name: 'Dosya ekle' }).first()).toBeVisible();
		await expect(page.getByRole('button', { name: 'Tekrar seç' })).toBeVisible();
		await expect(page.getByText('Dosya yükleniyor...')).toBeVisible();

		await expect(page.getByText('Görsel').first()).toBeVisible();
		await expect(page.getByText('Metin').first()).toBeVisible();
		await expect(page.getByText('Doküman').first()).toBeVisible();
		await expect(page.getByText('1 ek').first()).toBeVisible();
		await expect(page.getByText('2 ek').first()).toBeVisible();

		await expect(page.getByText('working files')).toHaveCount(0);
		await expect(page.getByText(/\bbytes\b/)).toHaveCount(0);
		await expect(page.getByRole('button', { name: /Eki kaldır:/ }).first()).toBeVisible();

		const bodyText = await page.locator('body').innerText();
		for (const term of forbiddenTechnical) {
			expect(bodyText, `forbidden technical string: "${term}"`).not.toContain(term);
		}
		for (const pattern of mojibakePatterns) {
			expect(bodyText, `mojibake pattern: "${pattern}"`).not.toContain(pattern);
		}

		await assertNoHorizontalOverflow(page, viewport.width, viewport.label);
	});
}
