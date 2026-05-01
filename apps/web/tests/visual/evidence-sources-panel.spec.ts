import { type Page, expect, test } from '@playwright/test';

const viewports = [
	{ height: 900, label: 'desktop', width: 1440 },
	{ height: 844, label: 'mobile', width: 390 },
] as const;

async function assertNoHorizontalOverflow(
	page: Page,
	viewportWidth: number,
	label: string,
): Promise<void> {
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth, `${label} horizontal overflow`).toBeLessThanOrEqual(viewportWidth + 2);
}

for (const viewport of viewports) {
	test(`EvidencePack sources panel renders canonical metadata on ${viewport.label}`, async ({
		page,
	}) => {
		await page.setViewportSize({ height: viewport.height, width: viewport.width });
		await page.goto('/tests/visual/evidence-sources-fixture.html');

		await expect(page.getByTestId('evidence-sources-fixture')).toBeVisible();
		await expect(page.getByRole('heading', { name: /web arama/i })).toBeVisible();
		await expect(page.getByText('2 arama')).toBeVisible();
		await expect(page.getByText('4 sonuç')).toBeVisible();
		await expect(page.getByText('Bazı sonuçlar kısaltıldı')).toBeVisible();
		await expect(page.getByText('Kaynak güveni sınırlı')).toBeVisible();

		await page.getByRole('button', { name: /2 kaynak/i }).click();

		await expect(page.getByRole('link', { name: /Runa launch readiness source/i })).toBeVisible();
		await expect(page.getByRole('link', { name: /Evidence pack source/i })).toBeVisible();
		await expect(page.locator('code').filter({ hasText: 'example.com' })).toBeVisible();
		await expect(page.locator('code').filter({ hasText: 'docs.example.org' })).toBeVisible();
		await expect(page.getByText('Güven 91')).toBeVisible();
		await expect(page.getByText('Güven 74')).toBeVisible();
		await expect(page.getByText('Yayın:')).toBeVisible();
		await expect(page.getByText('https://example.com/runa-launch')).toBeVisible();
		await expect(page.getByText('legacy.example')).toHaveCount(0);

		await assertNoHorizontalOverflow(page, viewport.width, viewport.label);
	});
}
