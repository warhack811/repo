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

const forbiddenTechnical = [
	'Web Speech API',
	'SpeechRecognition',
	'webkitSpeechRecognition',
	'runtime',
	'metadata',
	'protocol',
	'backend',
];

const mojibakePatterns = ['\u00C3', '\u00C4', '\u00C5', '\u00E2\u20AC\u00A2', '\uFFFD'];

for (const viewport of viewports) {
	test(`voice state smoke at ${viewport.label}`, async ({ page }) => {
		await page.setViewportSize({ height: viewport.height, width: viewport.width });
		await page.goto('/tests/visual/ui-overhaul-20-voice-state-smoke.html');

		// All state sections are visible
		await expect(page.getByTestId('voice-state-idle')).toBeVisible();
		await expect(page.getByTestId('voice-state-listening')).toBeVisible();
		await expect(page.getByTestId('voice-state-denied')).toBeVisible();
		await expect(page.getByTestId('voice-state-unsupported')).toBeVisible();
		await expect(page.getByTestId('voice-state-speaking')).toBeVisible();
		await expect(page.getByTestId('voice-state-no-response')).toBeVisible();

		// Key copy assertions
		await expect(page.getByText('Sesle yaz').first()).toBeVisible();
		await expect(page.getByText('Dinlemeyi durdur')).toBeVisible();
		await expect(page.getByText('Mikrofon izni kapalı')).toBeVisible();
		await expect(page.getByText('Bu tarayıcı sesle yazmayı desteklemiyor')).toBeVisible();
		await expect(page.getByText('Okumayı durdur')).toBeVisible();

		// Unsupported input button is disabled
		const unsupportedSection = page.getByTestId('voice-state-unsupported');
		const unsupportedButtons = unsupportedSection.locator('button');
		await expect(unsupportedButtons.first()).toBeDisabled();

		// Denied input button is disabled
		const deniedSection = page.getByTestId('voice-state-denied');
		const deniedButtons = deniedSection.locator('button');
		await expect(deniedButtons.first()).toBeDisabled();

		// No forbidden technical strings in body
		const bodyText = await page.locator('body').innerText();
		for (const term of forbiddenTechnical) {
			expect(bodyText, `forbidden technical string: "${term}"`).not.toContain(term);
		}

		// No mojibake
		for (const pattern of mojibakePatterns) {
			expect(bodyText, `mojibake pattern: "${pattern}"`).not.toContain(pattern);
		}

		// No horizontal overflow
		await assertNoHorizontalOverflow(page, viewport.width, viewport.label);
	});
}
