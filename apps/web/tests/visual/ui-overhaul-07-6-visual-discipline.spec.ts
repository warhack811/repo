import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { type Page, expect, test } from '@playwright/test';

const developerModeStorageKey = 'runa_dev_mode';
const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const onboardingCompletedStorageKey = 'runa.onboarding.completed';
const screenshotRoot = join(
	process.cwd(),
	'docs/design-audit/screenshots/2026-04-30-ui-overhaul-07-6-visual-discipline',
);

async function bootstrapAuthenticatedRoute(page: Page, path: string): Promise<void> {
	const baseUrl = test.info().project.use.baseURL;

	if (!baseUrl) {
		throw new Error('Playwright baseURL is required for UI-OVERHAUL-07.6 visual discipline.');
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

async function mockSurfaceData(page: Page): Promise<void> {
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

async function assertFlatButtonBackgrounds(page: Page, label: string): Promise<void> {
	const offenders = await page
		.locator('button, a.runa-button, .runa-ui-button')
		.evaluateAll((nodes) =>
			nodes
				.filter((node) => {
					const element = node as HTMLElement;
					const style = window.getComputedStyle(element);

					return (
						element.offsetParent !== null &&
						style.backgroundImage !== 'none' &&
						style.backgroundImage.trim() !== ''
					);
				})
				.map((node) => {
					const element = node as HTMLElement;
					const style = window.getComputedStyle(element);

					return `${element.tagName.toLowerCase()}.${element.className}: ${style.backgroundImage}`;
				}),
		);

	expect(offenders, `${label} uses flat button backgrounds`).toEqual([]);
}

async function assertTypographyScale(page: Page, label: string): Promise<void> {
	const allowedSizes = new Set(['12', '14', '16', '20', '28']);
	const allowedWeights = new Set(['400', '500', '600']);
	const offenders = await page.locator('body').evaluate((body) => {
		const nodes = Array.from(body.querySelectorAll('*')).filter((node) => {
			const element = node as HTMLElement;
			const rect = element.getBoundingClientRect();

			return rect.width > 0 && rect.height > 0 && (element.textContent ?? '').trim().length > 0;
		});

		return nodes.flatMap((node) => {
			const element = node as HTMLElement;
			const style = window.getComputedStyle(element);
			const size = String(Math.round(Number.parseFloat(style.fontSize)));
			const weight = String(Math.round(Number.parseFloat(style.fontWeight)));
			const issues: string[] = [];

			if (!['12', '14', '16', '20', '28'].includes(size)) {
				issues.push(`${element.tagName.toLowerCase()}.${element.className}: ${style.fontSize}`);
			}

			if (!['400', '500', '600'].includes(weight)) {
				issues.push(`${element.tagName.toLowerCase()}.${element.className}: ${style.fontWeight}`);
			}

			return issues;
		});
	});

	for (const offender of offenders) {
		const value = offender.split(': ').at(-1)?.replace('px', '') ?? '';

		if (offender.includes('px')) {
			expect(allowedSizes.has(value), `${label} type size ${offender}`).toBe(true);
		} else {
			expect(allowedWeights.has(value), `${label} type weight ${offender}`).toBe(true);
		}
	}
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
		'raw transport',
		'raw connection',
	];

	for (const term of forbiddenTerms) {
		expect(bodyText, `${label} hides ${term}`).not.toContain(term);
	}
}

async function assertMobileNavIsOneRow(page: Page, label: string): Promise<void> {
	const boxes = await page.locator('.runa-app-nav__item').evaluateAll((items) =>
		items.map((item) => {
			const box = item.getBoundingClientRect();

			return {
				width: box.width,
				y: Math.round(box.y),
			};
		}),
	);

	expect(boxes, `${label} nav item count`).toHaveLength(4);
	expect(new Set(boxes.map((box) => box.y)).size, `${label} nav uses one row`).toBe(1);
	expect(Math.min(...boxes.map((box) => box.width)), `${label} nav width`).toBeGreaterThan(64);
}

test.beforeEach(async ({ page }) => {
	await mockSurfaceData(page);
});

test('visual discipline holds across primary routes on desktop and mobile', async ({ page }) => {
	await mkdir(screenshotRoot, { recursive: true });

	const routes = [
		{ authenticated: false, label: 'login', path: '/login' },
		{ authenticated: true, label: 'chat', path: '/chat' },
		{ authenticated: true, label: 'history', path: '/history' },
		{ authenticated: true, label: 'devices', path: '/devices' },
		{ authenticated: true, label: 'account', path: '/account' },
	] as const;
	const viewports = [
		{ height: 900, label: 'desktop', width: 1440 },
		{ height: 844, label: 'mobile', width: 390 },
	] as const;

	for (const viewport of viewports) {
		await page.setViewportSize({ height: viewport.height, width: viewport.width });

		for (const route of routes) {
			if (route.authenticated) {
				await bootstrapAuthenticatedRoute(page, route.path);
				await assertNoForbiddenSurfaceCopy(page, `${viewport.label} ${route.label}`);
			} else {
				await page.goto(route.path);
				await expect(page.locator('body')).toContainText('Runa');
			}

			await assertFlatButtonBackgrounds(page, `${viewport.label} ${route.label}`);
			await assertTypographyScale(page, `${viewport.label} ${route.label}`);

			if (viewport.label === 'mobile' && route.authenticated) {
				await assertMobileNavIsOneRow(page, route.label);
			}

			await page.screenshot({
				fullPage: true,
				path: join(screenshotRoot, `${viewport.label}-${route.label}.png`),
			});
		}
	}
});
