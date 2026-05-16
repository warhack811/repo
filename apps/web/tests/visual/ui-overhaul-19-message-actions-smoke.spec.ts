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

const forbiddenTechnical = ['message_id', 'run_id', 'trace_id', 'metadata', 'protocol', 'backend'];
const mojibakePatterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];

for (const viewport of viewports) {
	test(`message actions smoke at ${viewport.label}`, async ({ page }) => {
		await page.setViewportSize({ height: viewport.height, width: viewport.width });
		await page.goto('/tests/visual/ui-overhaul-19-message-actions-smoke.html');

		// Fixture is visible
		await expect(page.getByTestId('message-actions-fixture')).toBeVisible();

		// Both user and assistant messages are visible
		await expect(page.locator('.runa-transcript-message--user')).toHaveCount(2);
		await expect(page.locator('.runa-transcript-message--assistant')).toHaveCount(2);

		// Action buttons visible
		const copyButtons = page.getByText('Kopyala');
		await expect(copyButtons.first()).toBeVisible();

		const editButtons = page.getByText('Düzenle');
		await expect(editButtons.first()).toBeVisible();

		const retryButtons = page.getByText('Tekrar dene');
		await expect(retryButtons.first()).toBeVisible();

		// Click retry on latest assistant → prepared-prompt has previous user prompt
		await retryButtons.last().click();
		const preparedPrompt = page.getByTestId('prepared-prompt');
		await expect(preparedPrompt).toContainText('Bir hata bulduğun dosyayı düzelt ve tekrar çalıştır.');

		// Click edit on user message → prepared-prompt has user prompt
		// First click retry on first user's edit
		await editButtons.first().click();
		await expect(preparedPrompt).toContainText('Projedeki tüm testleri çalıştır ve sonuçları raporla.');

		// Forbidden technical strings in body
		const bodyText = await page.locator('body').innerText();
		for (const term of forbiddenTechnical) {
			expect(bodyText, `forbidden technical string: "${term}"`).not.toContain(term);
		}

		// Mojibake absence
		for (const pattern of mojibakePatterns) {
			expect(bodyText, `mojibake pattern: "${pattern}"`).not.toContain(pattern);
		}

		// Horizontal overflow
		await assertNoHorizontalOverflow(page, viewport.width, viewport.label);
	});
}

test('message actions smoke at desktop with isRunning=true', async ({ page }) => {
	await page.setViewportSize({ height: 900, width: 1440 });
	await page.goto('/tests/visual/ui-overhaul-19-message-actions-smoke.html?running=1');

	// Running state: retry hidden, copy and edit visible
	await expect(page.getByText('Tekrar dene')).toHaveCount(0);
	await expect(page.getByText('Kopyala').first()).toBeVisible();
	await expect(page.getByText('Düzenle').first()).toBeVisible();

	const bodyText = await page.locator('body').innerText();
	for (const term of forbiddenTechnical) {
		expect(bodyText, `desktop forbidden technical string: "${term}"`).not.toContain(term);
	}

	for (const pattern of mojibakePatterns) {
		expect(bodyText, `desktop mojibake pattern: "${pattern}"`).not.toContain(pattern);
	}

	// Horizontal overflow
	await assertNoHorizontalOverflow(page, 1440, 'desktop');
});
