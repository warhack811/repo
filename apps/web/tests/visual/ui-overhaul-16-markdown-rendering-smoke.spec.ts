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
	test(`markdown rendering smoke at ${viewport.label}`, async ({ page }) => {
		await page.setViewportSize({ height: viewport.height, width: viewport.width });
		await page.goto('/tests/visual/ui-overhaul-16-markdown-rendering-smoke.html');

		await expect(page.getByTestId('markdown-fixture')).toBeVisible();

		// Heading visibility
		await expect(page.getByRole('heading', { name: 'Başlık' })).toBeVisible();

		// List items
		await expect(page.getByText('Birinci madde')).toBeVisible();
		await expect(page.getByText('İkinci madde')).toBeVisible();

		// Blockquote
		await expect(page.getByText('Alıntı metni')).toBeVisible();

		// Inline code surface
		await expect(page.getByText('inline code')).toBeVisible();

		// Table
		await expect(page.getByRole('table')).toBeVisible();

		// Code block
		const codeValue = page.locator('code').filter({ hasText: 'const value' });
		await expect(codeValue).toBeVisible();

		// External link
		const externalLink = page.getByRole('link', { name: 'Harici link' });
		await expect(externalLink).toBeVisible();
		await expect(externalLink).toHaveAttribute('target', '_blank');
		await expect(externalLink).toHaveAttribute('rel', /noreferrer noopener/);

		// Page-level horizontal overflow check
		await assertNoHorizontalOverflow(page, viewport.width, viewport.label);

		// Check mojibake absence
		const bodyText = await page.locator('body').innerText();
		const mojibakePatterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];
		for (const pattern of mojibakePatterns) {
			expect(bodyText, `no mojibake pattern "${pattern}"`).not.toContain(pattern);
		}
	});
}
