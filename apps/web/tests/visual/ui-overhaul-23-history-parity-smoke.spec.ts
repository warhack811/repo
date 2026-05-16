import { type Page, expect, test } from '@playwright/test';

const viewports = [
	{ height: 844, label: 'mobile-390', width: 390 },
	{ height: 896, label: 'mobile-320', width: 320 },
] as const;

const forbiddenTechnical = [
	'conversation_id',
	'Internal Server Error',
	'{"error"',
	'trace',
	'stack',
	'backend',
	'protocol',
	'metadata',
];
const forbiddenMojibake = ['Ã', 'Ä', 'Å', 'â€¢', '�'];

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
	test(`history parity smoke at ${viewport.label}`, async ({ page }) => {
		await page.setViewportSize({ height: viewport.height, width: viewport.width });
		await page.goto('/tests/visual/ui-overhaul-23-history-parity-smoke.html');

		await expect(page.getByText('Sohbetler').first()).toBeVisible();
		await expect(page.getByText('Sohbet geçmişi').first()).toBeVisible();

		for (const label of ['Bugün', 'Dün', 'Son 7 gün', 'Daha eski']) {
			await expect(page.getByText(label).first()).toBeVisible();
		}

		const sidebarSection = page.getByTestId('sidebar-parity-state');
		const sidebarSearch = sidebarSection.getByPlaceholder('Başlık veya önizleme ara');
		await sidebarSearch.fill('eslesme-yok');
		await expect(sidebarSection.getByText('Bu aramayla eşleşen sohbet yok.')).toBeVisible();

		await expect(
			page.getByText(
				'Sohbet geçmişi şu anda yüklenemedi. Biraz sonra yeniden deneyebilirsin.',
			),
		).toBeVisible();
		await expect(page.getByText('Internal Server Error')).toHaveCount(0);
		await expect(page.getByText('{"error"')).toHaveCount(0);

		const bodyText = await page.locator('body').innerText();
		for (const token of forbiddenTechnical) {
			expect(bodyText, `forbidden technical string: "${token}"`).not.toContain(token);
		}
		for (const token of forbiddenMojibake) {
			expect(bodyText, `forbidden mojibake token: "${token}"`).not.toContain(token);
		}

		await assertNoHorizontalOverflow(page, viewport.width, viewport.label);
	});
}
