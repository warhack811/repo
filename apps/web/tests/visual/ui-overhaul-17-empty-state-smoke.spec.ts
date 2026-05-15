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
		// Freeze time to morning (09:00) so greeting is deterministic
		await page.clock.setFixedTime(new Date('2026-05-15T09:00:00'));
		await page.goto('/tests/visual/ui-overhaul-17-empty-state-smoke.html');

		// Fixture is visible
		await expect(page.getByTestId('empty-state-fixture')).toBeVisible();

		// Greeting and lead
		await expect(page.locator('.runa-chat-empty-hero__title')).toHaveText('Günaydın');
		await expect(page.locator('.runa-chat-empty-hero__lead')).toHaveText('Nereden başlayalım?');

		// Personalization: project name (not full path)
		await expect(page.locator('.runa-chat-empty-context__chip').first()).toHaveText('Proje: Runa');
		await expect(page.getByText('D:\\ai\\Runa')).toHaveCount(0);
		await expect(page.getByText('D:\\ai\\Runa')).toHaveCount(0);

		// Device chip
		await expect(page.locator('.runa-chat-empty-context__chip').nth(1)).toHaveText('Cihaz hazır');

		// Conversation count chip
		await expect(page.locator('.runa-chat-empty-context__chip').nth(2)).toHaveText('3 konuşma');

		// 4 suggestion buttons
		const suggestions = page.locator('.runa-chat-suggestion');
		await expect(suggestions).toHaveCount(4);

		// Suggestion labels visible
		await expect(suggestions.nth(0)).toContainText('Kod işini güvenle ilerlet');
		await expect(suggestions.nth(1)).toContainText('Bir hatayı araştır');
		await expect(suggestions.nth(2)).toContainText('Araştırma notu çıkar');
		await expect(suggestions.nth(3)).toContainText('Dokümanı netleştir');

		// Click suggestion → selected-prompt is populated
		await suggestions.nth(0).click();
		const selectedPrompt = page.getByTestId('selected-prompt');
		await expect(selectedPrompt).toContainText('Bu kod işini güvenli şekilde ilerlet');

		// Forbidden technical strings
		const bodyText = await page.locator('body').innerText();
		const forbidden = ['Developer Mode', 'runtime', 'metadata', 'transport', 'schema', 'protocol', 'API key'];
		for (const term of forbidden) {
			expect(bodyText, `forbidden technical string: "${term}"`).not.toContain(term);
		}

		// Mojibake absence
		const mojibakePatterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];
		for (const pattern of mojibakePatterns) {
			expect(bodyText, `mojibake pattern: "${pattern}"`).not.toContain(pattern);
		}

		// Horizontal overflow
		await assertNoHorizontalOverflow(page, viewport.width, viewport.label);
	});
}
