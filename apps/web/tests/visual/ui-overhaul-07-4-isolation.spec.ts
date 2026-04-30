import { type Page, expect, test } from '@playwright/test';

const developerModeStorageKey = 'runa_dev_mode';
const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const onboardingCompletedStorageKey = 'runa.onboarding.completed';

async function bootstrapAuthenticatedRoute(
	page: Page,
	path: string,
	developerMode: boolean,
): Promise<void> {
	const baseUrl = test.info().project.use.baseURL;

	if (!baseUrl) {
		throw new Error('Playwright baseURL is required for UI-OVERHAUL-07.4 isolation.');
	}

	await page.addInitScript(
		([devModeKey, onboardingKey, runtimeKey, isDeveloperMode]) => {
			window.localStorage.setItem(onboardingKey, 'true');
			window.localStorage.setItem(devModeKey, isDeveloperMode ? 'true' : 'false');
			window.localStorage.setItem(
				runtimeKey,
				JSON.stringify({
					apiKey: '',
					includePresentationBlocks: true,
					model: 'deepseek-v4-flash',
					provider: 'deepseek',
				}),
			);
		},
		[
			developerModeStorageKey,
			onboardingCompletedStorageKey,
			runtimeConfigStorageKey,
			developerMode,
		],
	);

	await page.goto(
		`/auth/dev/bootstrap?redirect_to=${encodeURIComponent(new URL(path, baseUrl).toString())}`,
	);
}

test('clean sessions cannot enter developer routes or self-enable QA preview', async ({ page }) => {
	await bootstrapAuthenticatedRoute(page, '/developer', false);
	await page.waitForURL('**/chat');
	await expect(page.getByRole('heading', { name: 'Neyi ilerletmek istiyorsun?' })).toBeVisible();
	await expect(page.getByText('Developer Mode')).toHaveCount(0);
	await expect(page.locator('a[href="/developer"]')).toHaveCount(0);

	await bootstrapAuthenticatedRoute(page, '/developer/capability-preview', false);
	await page.waitForURL('**/chat');
	await expect(page.getByRole('heading', { name: 'Neyi ilerletmek istiyorsun?' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Enable Developer Mode' })).toHaveCount(0);
});

test('explicit developer mode keeps internal tooling reachable', async ({ page }) => {
	await bootstrapAuthenticatedRoute(page, '/developer', true);
	await page.waitForURL('**/developer');
	await expect(page.getByRole('heading', { name: 'Developer Mode' })).toBeVisible();
	await expect(page.getByRole('heading', { name: /Runtime ayarlar/i })).toBeVisible();

	await bootstrapAuthenticatedRoute(page, '/developer/capability-preview', true);
	await page.waitForURL('**/developer/capability-preview');
	await expect(page.getByRole('heading', { name: 'Capability component harness' })).toBeVisible();
	await expect(page.getByText('Developer route')).toBeVisible();
});
