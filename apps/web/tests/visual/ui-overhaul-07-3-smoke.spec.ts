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
	'2026-04-30-ui-overhaul-07-3-smoke',
);
const approvalPrompt = 'Please request approval and write the proof file once approval is granted.';
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
		throw new Error('Playwright baseURL is required for the UI-OVERHAUL-07.3 smoke.');
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

async function submitApprovalRequest(page: Page): Promise<void> {
	await page.locator('textarea').fill(approvalPrompt);
	await page.getByRole('button', { name: /send|gonder|g.nder/i }).click();
	await expect(page.getByText(/Güven kararı/i)).toBeVisible({ timeout: 20_000 });
}

async function getApprovalCard(page: Page) {
	return page
		.locator('article')
		.filter({ hasText: /Güven kararı/i })
		.last();
}

async function assertTrustFirstPending(page: Page, label: string): Promise<void> {
	const card = await getApprovalCard(page);
	await expect(card).toBeVisible();
	await expect(card.getByText(/Güven kararı/i)).toBeVisible();
	await expect(card.getByText(/Dosyaya yazma iste/i)).toBeVisible();
	await expect(card.getByText(/Bu onayda net hedef bilgisi|Hedef dosya|Hedef komut/i)).toBeVisible();
	await expect(card.getByText(/Bu i.lem bir dosyan.n i.eri.ini de.i.tirebilir/i)).toBeVisible();
	await expect(card.getByRole('button', { name: /approve|onayla|kabul et/i })).toBeVisible();
	await expect(card.getByRole('button', { name: /reject|reddet/i })).toBeVisible();

	const cardText = await card.innerText();
	recordCheck(`${label} carries trust-first heading`, /Güven kararı/i.test(cardText));
	recordCheck(`${label} shows target context`, /Hedef|hedef bilgisi/i.test(cardText));

	await expect(card.getByRole('button', { name: /ayr.nt.lar|teknik detaylar/i })).toHaveCount(0);
	await expect(card.locator('code').filter({ hasText: 'file.write' })).toHaveCount(0);
}

async function assertMobileApprovalButtonsClear(page: Page, label: string): Promise<void> {
	const approveButton = page.getByRole('button', { name: /approve|onayla|kabul et/i });
	const rejectButton = page.getByRole('button', { name: /reject|reddet/i });
	await approveButton.scrollIntoViewIfNeeded();

	const composerBox = await page.locator('.runa-chat-layout__composer').boundingBox();
	const navBox = await page.locator('.runa-app-nav').boundingBox();
	const approveBox = await approveButton.boundingBox();
	const rejectBox = await rejectButton.boundingBox();
	const buttonsClearComposer = Boolean(
		composerBox &&
			approveBox &&
			rejectBox &&
			Math.max(approveBox.y + approveBox.height, rejectBox.y + rejectBox.height) <=
				composerBox.y - 2,
	);
	const buttonsClearNav = Boolean(
		navBox &&
			approveBox &&
			rejectBox &&
			(approveBox.y + approveBox.height <= navBox.y - 2 ||
				approveBox.y >= navBox.y + navBox.height + 2) &&
			(rejectBox.y + rejectBox.height <= navBox.y - 2 ||
				rejectBox.y >= navBox.y + navBox.height + 2),
	);

	recordCheck(`${label} approval buttons clear composer`, buttonsClearComposer);
	recordCheck(`${label} approval buttons clear bottom nav`, buttonsClearNav);
}

async function assertEmptyChatContract(
	page: Page,
	viewportWidth: number,
	label: string,
): Promise<void> {
	await expect(page.getByRole('heading', { name: 'Neyi ilerletmek istiyorsun?' })).toBeVisible();
	await expect(page.locator('.runa-chat-suggestion')).toHaveCount(4);
	await expect(page.locator('.runa-chat-layout__work > *')).toHaveCount(0);
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

test('approval pending, approved, and continued screenshots', async ({ page }) => {
	const viewports = [
		{ filename: 'desktop-1440-01-approval-pending.png', height: 900, width: 1440 },
		{ filename: 'desktop-1920-02-approval-pending.png', height: 1080, width: 1920 },
		{ filename: 'mobile-390-03-approval-pending.png', height: 844, width: 390 },
		{ filename: 'mobile-320-04-approval-pending.png', height: 568, width: 320 },
	] as const;

	await page.setViewportSize({ height: viewports[0].height, width: viewports[0].width });
	await bootstrapLocalDevChat(page);
	await submitApprovalRequest(page);

	for (const viewport of viewports) {
		await page.setViewportSize({ height: viewport.height, width: viewport.width });
		await (await getApprovalCard(page)).scrollIntoViewIfNeeded();
		await assertTrustFirstPending(page, viewport.filename);

		if (viewport.width < 720) {
			await assertMobileApprovalButtonsClear(page, viewport.filename);
		}

		await capture(page, viewport.filename);
		await assertNoHorizontalOverflow(page, viewport.width, viewport.filename);
	}

	await page.setViewportSize({ height: 900, width: 1440 });
	await (await getApprovalCard(page)).scrollIntoViewIfNeeded();

	const pendingCard = await getApprovalCard(page);
	const approveButton = pendingCard.getByRole('button', { name: /approve|onayla|kabul et/i });
	await approveButton.click();
	await expect(page.getByText(/Onayland|Kabul edildi/i).last()).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.getByText(/.zin verildi/i)).toBeVisible();
	const approvedCard = page
		.locator('article')
		.filter({ hasText: /Onayland|Kabul edildi/i })
		.last();
	await expect(approvedCard.getByRole('button', { name: /approve|onayla|kabul et/i })).toHaveCount(
		0,
	);
	recordCheck('desktop approved state removes repeat approve action', true);
	await capture(page, 'desktop-1440-05-approval-approved.png');

	await expect(page.getByText(/.lem tamamland|Sonu. sohbet ak..ına eklendi/i).last()).toBeVisible({
		timeout: 20_000,
	});
	recordCheck('desktop completed flow shows approved tool result', true);
	await capture(page, 'desktop-1440-08-continued-completed.png');
	await assertNoHorizontalOverflow(page, 1440, 'desktop completed flow');

	await page.setViewportSize({ height: 844, width: 390 });
	await approvedCard.scrollIntoViewIfNeeded();
	await capture(page, 'mobile-390-06-approval-approved.png');
	await assertNoHorizontalOverflow(page, 390, 'mobile approved state');
});

test('rejected state and empty chat regression screenshots', async ({ page }) => {
	await page.setViewportSize({ height: 844, width: 390 });
	await bootstrapLocalDevChat(page);
	await submitApprovalRequest(page);
	await page.getByRole('button', { name: /reject|reddet/i }).click();
	await expect(page.getByText('Reddedildi', { exact: true })).toBeVisible({ timeout: 20_000 });
	await expect(page.getByText(/Bu ad.m reddedildi|.lem .al..t.r.lmad/i)).toBeVisible();
	await capture(page, 'mobile-390-07-approval-rejected.png');
	await assertNoHorizontalOverflow(page, 390, 'mobile rejected state');

	await page.setViewportSize({ height: 900, width: 1440 });
	await bootstrapLocalDevChat(page);
	await assertEmptyChatContract(page, 1440, 'desktop empty regression');
	await capture(page, 'desktop-1440-09-chat-empty.png');

	await page.setViewportSize({ height: 844, width: 390 });
	await bootstrapLocalDevChat(page);
	await assertEmptyChatContract(page, 390, 'mobile empty regression');
	await capture(page, 'mobile-390-10-chat-empty.png');
});
