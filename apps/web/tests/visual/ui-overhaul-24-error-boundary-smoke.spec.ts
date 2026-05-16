import { type Page, expect, test } from '@playwright/test';

const viewports = [
  { height: 844, label: 'mobile-390', width: 390 },
  { height: 896, label: 'mobile-320', width: 320 },
] as const;

const forbiddenPatterns = [
  'TypeError',
  'ReferenceError',
  'Cannot read properties',
  'Internal Server Error',
  'componentDidCatch',
  'getDerivedStateFromError',
  'stack',
  'trace',
  'backend',
  'protocol',
  'payload',
  'metadata',
  'undefined',
  'null',
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
  for (const term of forbiddenPatterns) {
    expect(bodyText, `forbidden raw string: "${term}"`).not.toContain(term);
  }
  for (const pattern of mojibakePatterns) {
    expect(bodyText, `mojibake pattern: "${pattern}"`).not.toContain(pattern);
  }
}

for (const viewport of viewports) {
  test(`route-level error boundary fallback at ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ height: viewport.height, width: viewport.width });
    await page.goto('/tests/visual/ui-overhaul-24-error-boundary-smoke.html?mode=route-error');

    await expect(page.getByTestId('error-boundary-fixture')).toBeVisible();
    await expect(page.getByText('Bir şey ters gitti.')).toBeVisible();
    await expect(
      page.getByText('Bu ekran şu anda açılmadı. Tekrar deneyebilir veya sohbete dönebilirsin.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tekrar dene' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sohbete dön' })).toBeVisible();
    await expect(page.getByText('Güvenli kurtarma')).toBeVisible();

    await assertNoForbiddenText(page);
    await assertNoHorizontalOverflow(page, viewport.width, viewport.label);
  });

  test(`root-level error boundary fallback at ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ height: viewport.height, width: viewport.width });
    await page.goto('/tests/visual/ui-overhaul-24-error-boundary-smoke.html?mode=root-error');

    await expect(page.getByTestId('error-boundary-fixture')).toBeVisible();
    await expect(page.getByText('Bir şey ters gitti.')).toBeVisible();
    await expect(
      page.getByText('Bu ekran şu anda açılmadı. Tekrar deneyebilir veya sohbete dönebilirsin.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tekrar dene' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sohbete dön' })).toBeVisible();
    await expect(page.getByText('Güvenli kurtarma')).toBeVisible();

    await assertNoForbiddenText(page);
    await assertNoHorizontalOverflow(page, viewport.width, viewport.label);
  });

	test(`retry success at ${viewport.label}`, async ({ page }) => {
		await page.setViewportSize({ height: viewport.height, width: viewport.width });
		await page.goto('/tests/visual/ui-overhaul-24-error-boundary-smoke.html?mode=route-error');

		// First render throws, boundary catches it, fallback is visible
		await expect(page.getByText('Bir şey ters gitti.')).toBeVisible();

		// Switch to safe mode via JS before retry so the re-mounted child doesn't throw
		await page.evaluate(() => {
			window.history.replaceState(null, '', '?mode=safe');
		});

		// Click Tekrar dene — boundary resets, child re-mounts with safe mode
		await page.getByRole('button', { name: 'Tekrar dene' }).click();

		// Now success content should be visible
		await expect(page.getByTestId('success-content')).toBeVisible({ timeout: 3000 });
		await expect(page.getByText('Ekran yeniden açıldı.')).toBeVisible();

		await assertNoForbiddenText(page);
		await assertNoHorizontalOverflow(page, viewport.width, viewport.label);
	});
}
