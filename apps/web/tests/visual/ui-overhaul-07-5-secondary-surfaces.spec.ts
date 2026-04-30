import { type Page, expect, test } from '@playwright/test';

const developerModeStorageKey = 'runa_dev_mode';
const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const onboardingCompletedStorageKey = 'runa.onboarding.completed';

async function bootstrapAuthenticatedRoute(page: Page, path: string): Promise<void> {
	const baseUrl = test.info().project.use.baseURL;

	if (!baseUrl) {
		throw new Error('Playwright baseURL is required for UI-OVERHAUL-07.5 secondary surfaces.');
	}

	await page.addInitScript(
		([devModeKey, onboardingKey, runtimeKey]) => {
			window.localStorage.setItem(onboardingKey, 'true');
			window.localStorage.setItem(devModeKey, 'false');
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
		[developerModeStorageKey, onboardingCompletedStorageKey, runtimeConfigStorageKey],
	);

	await page.goto(
		`/auth/dev/bootstrap?redirect_to=${encodeURIComponent(new URL(path, baseUrl).toString())}`,
	);
	await page.waitForURL(`**${path}`);
	await expect(page.getByRole('navigation', { name: /uygulama gezintisi/i })).toBeVisible();
}

async function mockSecondarySurfaceData(page: Page): Promise<void> {
	await page.route('**/conversations**', async (route) => {
		const path = new URL(route.request().url()).pathname;

		if (path === '/conversations') {
			await route.fulfill({
				contentType: 'application/json',
				json: {
					conversations: [
						{
							access_role: 'owner',
							conversation_id: 'conversation_1',
							created_at: '2026-04-30T08:00:00.000Z',
							last_message_at: '2026-04-30T09:30:00.000Z',
							last_message_preview: 'Proje notlarini toparladik.',
							title: 'Proje notlari',
							updated_at: '2026-04-30T09:30:00.000Z',
						},
					],
				},
			});
			return;
		}

		if (path.endsWith('/messages')) {
			await route.fulfill({
				contentType: 'application/json',
				json: {
					conversation_id: 'conversation_1',
					messages: [],
				},
			});
			return;
		}

		if (path.endsWith('/members')) {
			await route.fulfill({
				contentType: 'application/json',
				json: {
					conversation_id: 'conversation_1',
					members: [],
				},
			});
			return;
		}

		await route.fallback();
	});

	await page.route('**/desktop/devices', async (route) => {
		await route.fulfill({
			contentType: 'application/json',
			json: {
				devices: [
					{
						agent_id: 'agent_123456789',
						capabilities: [{ tool_name: 'desktop.screenshot' }],
						connected_at: '2026-04-30T09:00:00.000Z',
						connection_id: 'connection_123',
						machine_label: 'Workstation',
						status: 'online',
						transport: 'desktop_bridge',
						user_id: 'user_normal',
					},
				],
			},
		});
	});
}

async function assertNoForbiddenSurfaceCopy(page: Page, label: string): Promise<void> {
	const bodyText = await page.locator('body').innerText();
	const forbiddenTerms = [
		'Developer',
		'Project Memory',
		'debug',
		'operator',
		'Connection ',
		'desktop.screenshot',
		'Desteklenmeyen',
		'dev@runa.local',
	];

	for (const term of forbiddenTerms) {
		expect(bodyText, `${label} hides ${term}`).not.toContain(term);
	}
}

async function assertMobileNavIsOneRow(page: Page, label: string): Promise<void> {
	await expect(page.locator('.runa-app-nav__item')).toHaveCount(4);
	const boxes = await page.locator('.runa-app-nav__item').evaluateAll((items) =>
		items.map((item) => {
			const box = item.getBoundingClientRect();
			return {
				height: box.height,
				width: box.width,
				x: box.x,
				y: box.y,
			};
		}),
	);

	expect(boxes, `${label} nav item count`).toHaveLength(4);

	const navYValues = boxes.map((box) => Math.round(box.y));
	expect(new Set(navYValues).size, `${label} nav uses one row`).toBe(1);

	const minWidth = Math.min(...boxes.map((box) => box.width));
	expect(minWidth, `${label} nav items keep usable width`).toBeGreaterThan(64);
}

async function assertMainContentStartsInViewport(page: Page, label: string): Promise<void> {
	const firstContentBox = await page
		.locator('#authenticated-app-content > *')
		.first()
		.boundingBox();

	expect(firstContentBox, `${label} has primary content`).not.toBeNull();
	expect(
		firstContentBox?.y ?? Number.POSITIVE_INFINITY,
		`${label} primary content visible`,
	).toBeLessThan(844);
}

test.beforeEach(async ({ page }) => {
	await mockSecondarySurfaceData(page);
});

test('secondary surfaces stay product-facing on desktop', async ({ page }) => {
	await page.setViewportSize({ height: 900, width: 1440 });

	for (const path of ['/history', '/devices', '/account'] as const) {
		await bootstrapAuthenticatedRoute(page, path);
		await assertNoForbiddenSurfaceCopy(page, path);
		await expect(page.locator('a[href="/developer"]')).toHaveCount(0);
	}

	await bootstrapAuthenticatedRoute(page, '/history');
	await expect(page.getByRole('button', { name: /Proje notlari/ })).toBeVisible();
	await expect(page.getByText('owner')).toHaveCount(0);

	await bootstrapAuthenticatedRoute(page, '/devices');
	await expect(page.getByText('Workstation')).toBeVisible();
	await expect(page.getByText('Ekranı görme')).toBeVisible();
	await expect(page.getByText('connection_123')).toHaveCount(0);

	await bootstrapAuthenticatedRoute(page, '/account');
	await expect(page.getByRole('tab')).toHaveCount(2);
	await expect(page.getByRole('tab', { name: 'Hesap' })).toBeVisible();
	await expect(page.getByRole('tab', { name: 'Tercihler' })).toBeVisible();
});

test('secondary surfaces keep a single-row mobile nav and visible content', async ({ page }) => {
	await page.setViewportSize({ height: 844, width: 390 });

	for (const path of ['/history', '/devices', '/account'] as const) {
		await bootstrapAuthenticatedRoute(page, path);
		await assertMobileNavIsOneRow(page, path);
		await assertMainContentStartsInViewport(page, path);
		await assertNoForbiddenSurfaceCopy(page, `${path} mobile`);

		const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(scrollWidth, `${path} has no horizontal overflow`).toBeLessThanOrEqual(392);
	}
});
