import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, expect, test } from '@playwright/test';

const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const activeConversationStorageKey = 'runa.chat.active_conversation_id';
const onboardingCompletedStorageKey = 'runa.onboarding.completed';
const smokeDirectory = join(
	'docs',
	'design-audit',
	'screenshots',
	'2026-04-29-ui-overhaul-07-2-smoke',
);
const shots: string[] = [];
const checks: Array<{
	readonly label: string;
	readonly ok: boolean;
	readonly value?: string | number | boolean;
}> = [];

test.describe.configure({ mode: 'serial' });

function recordCheck(label: string, ok: boolean, value?: string | number | boolean): void {
	checks.push({ label, ok, value });
	expect(ok, label).toBe(true);
}

async function bootstrapLocalDevChat(page: Page): Promise<void> {
	const baseUrl = test.info().project.use.baseURL;

	if (!baseUrl) {
		throw new Error('Playwright baseURL is required for the UI-OVERHAUL-07.2 smoke.');
	}

	await page.addInitScript(
		([conversationStorageKey, onboardingStorageKey, storageKey]) => {
			window.localStorage.removeItem(conversationStorageKey);
			window.localStorage.setItem(onboardingStorageKey, 'true');
			window.localStorage.setItem(
				storageKey,
				JSON.stringify({
					apiKey: '',
					includePresentationBlocks: true,
					model: 'deepseek-v4-flash',
					provider: 'deepseek',
				}),
			);
		},
		[activeConversationStorageKey, onboardingCompletedStorageKey, runtimeConfigStorageKey],
	);

	await page.goto(
		`/auth/dev/bootstrap?redirect_to=${encodeURIComponent(new URL('/chat', baseUrl).toString())}`,
	);
	await page.waitForURL('**/chat');
	await expect(page.getByRole('heading', { name: 'Neyi ilerletmek istiyorsun?' })).toBeVisible();
	await expect(page.locator('textarea')).toBeVisible();
}

async function capture(page: Page, filename: string): Promise<void> {
	shots.push(filename);
	await page.screenshot({
		fullPage: true,
		path: join(smokeDirectory, filename),
	});
}

async function assertNoHorizontalOverflow(
	page: Page,
	viewportWidth: number,
	label: string,
): Promise<void> {
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	recordCheck(`${label} horizontal overflow`, scrollWidth <= viewportWidth + 2, scrollWidth);
}

async function assertEmptyChatContract(
	page: Page,
	viewportWidth: number,
	label: string,
): Promise<void> {
	const bodyText = await page.locator('body').innerText();
	const forbiddenTerms = [
		'Masaustu hedefi',
		'Developer Mode',
		'Please request approval',
		'burada gorunur',
		'burada kalir',
		'Calisma akisi',
		'Mevcut calisma',
	];

	for (const term of forbiddenTerms) {
		recordCheck(`${label} hides "${term}"`, !bodyText.includes(term));
	}

	await expect(page.getByRole('heading', { name: 'Neyi ilerletmek istiyorsun?' })).toBeVisible();
	await expect(page.locator('.runa-chat-suggestion')).toHaveCount(4);
	await expect(page.locator('.runa-chat-layout__work > *')).toHaveCount(0);

	const composerActionCount = await page
		.locator(
			'.runa-chat-composer-actions__left > label, .runa-chat-composer-actions__right > .runa-chat-composer-more > summary, .runa-chat-composer-actions__right > button',
		)
		.count();
	recordCheck(`${label} composer action count`, composerActionCount <= 3, composerActionCount);

	if (viewportWidth < 720) {
		const composerBox = await page.locator('.runa-chat-layout__composer').boundingBox();
		const navBox = await page.locator('.runa-app-nav').boundingBox();
		recordCheck(
			`${label} mobile composer stays above nav`,
			Boolean(composerBox && navBox && composerBox.y + composerBox.height <= navBox.y - 2),
			composerBox && navBox ? Math.round(navBox.y - (composerBox.y + composerBox.height)) : false,
		);
	}

	await assertNoHorizontalOverflow(page, viewportWidth, label);
}

test.beforeAll(() => {
	mkdirSync(smokeDirectory, { recursive: true });
});

test.afterAll(() => {
	writeFileSync(
		join(smokeDirectory, 'manifest.json'),
		JSON.stringify(
			{
				checks,
				failed_checks: checks.filter((check) => !check.ok),
				generated_at: new Date().toISOString(),
				shots,
			},
			null,
			2,
		),
		'utf8',
	);
});

test('empty chat composer reset screenshots', async ({ page }) => {
	const viewports = [
		{ filename: 'desktop-1440-01-chat-empty.png', height: 900, width: 1440 },
		{ filename: 'desktop-1920-02-chat-empty.png', height: 1080, width: 1920 },
		{ filename: 'mobile-390-03-chat-empty.png', height: 844, width: 390 },
		{ filename: 'mobile-414-04-chat-empty.png', height: 896, width: 414 },
		{ filename: 'mobile-320-05-chat-empty.png', height: 568, width: 320 },
	] as const;

	for (const viewport of viewports) {
		await page.setViewportSize({ height: viewport.height, width: viewport.width });
		await bootstrapLocalDevChat(page);
		await assertEmptyChatContract(page, viewport.width, viewport.filename);
		await capture(page, viewport.filename);
	}
});

test('active run and mobile approval stay above the composer', async ({ page }) => {
	await page.setViewportSize({ height: 900, width: 1440 });
	await bootstrapLocalDevChat(page);
	await page
		.locator('textarea')
		.fill('Please request approval and write the proof file once approval is granted.');
	await page.getByRole('button', { name: /send|gonder|g.nder/i }).click();
	await expect(page.getByRole('button', { name: /approve|kabul et/i })).toBeVisible({
		timeout: 20_000,
	});
	await capture(page, 'desktop-1440-06-active-run-approval-pending.png');
	await assertNoHorizontalOverflow(page, 1440, 'desktop active approval');

	await page.setViewportSize({ height: 844, width: 390 });
	await bootstrapLocalDevChat(page);
	await page
		.locator('textarea')
		.fill('Please request approval and write the proof file once approval is granted.');
	await page.getByRole('button', { name: /send|gonder|g.nder/i }).click();

	const approveButton = page.getByRole('button', { name: /approve|kabul et/i });
	await expect(approveButton).toBeVisible({ timeout: 20_000 });
	await approveButton.scrollIntoViewIfNeeded();
	await capture(page, 'mobile-390-07-active-run-approval-pending.png');

	const composerBox = await page.locator('.runa-chat-layout__composer').boundingBox();
	const approveBox = await approveButton.boundingBox();
	recordCheck(
		'mobile approval button is not covered by composer',
		Boolean(composerBox && approveBox && approveBox.y + approveBox.height <= composerBox.y - 2),
		composerBox && approveBox
			? Math.round(composerBox.y - (approveBox.y + approveBox.height))
			: false,
	);

	await approveButton.click();
	await expect(page.getByText('Kabul edildi', { exact: true })).toBeVisible({ timeout: 20_000 });
	recordCheck('mobile approval real pointer click completed', true);
	await assertNoHorizontalOverflow(page, 390, 'mobile active approval');
});
