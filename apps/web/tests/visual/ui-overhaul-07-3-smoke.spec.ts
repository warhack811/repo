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
const approvalPrompt = '[runa-e2e:cap-file-write] Write the scenario proof file.';
const activityFeedLabel = 'Çalışma etkinlik akışı';
const pendingApprovalRowSelector = '[data-activity-kind="approval"][data-activity-status="pending"]';
const approvedApprovalRowSelector = '[data-activity-kind="approval"][data-activity-status="approved"]';
const rejectedApprovalRowSelector = '[data-activity-kind="approval"][data-activity-status="rejected"]';
const toolRowSelector = '[data-activity-kind="tool"]';

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
					approvalMode: 'ask-every-time',
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

async function assertRowFitsViewport(
	page: Page,
	selector: string,
	viewportWidth: number,
	label: string,
): Promise<void> {
	const row = page.locator(selector).last();
	const rowBox = await row.boundingBox();
	recordCheck(
		`${label} row fits viewport`,
		Boolean(rowBox && rowBox.x >= 0 && rowBox.x + rowBox.width <= viewportWidth + 2),
		rowBox ? `${rowBox.x}:${rowBox.width}` : 'no-box',
	);
}

async function submitApprovalRequest(page: Page): Promise<void> {
	await page.locator('textarea').fill(approvalPrompt);
	await page.getByRole('button', { name: /send|gonder|gönder/i }).click();
	await expect(page.locator(pendingApprovalRowSelector).last()).toBeVisible({ timeout: 20_000 });
}

function getPendingApprovalRow(page: Page) {
	return page.locator(pendingApprovalRowSelector).last();
}

async function assertPendingApprovalContract(page: Page, label: string): Promise<void> {
	const feed = page.getByRole('list', { name: activityFeedLabel }).last();
	const row = getPendingApprovalRow(page);
	await expect(feed).toBeVisible();
	await expect(row).toBeVisible();
	await expect(row).toHaveAttribute('data-activity-kind', 'approval');
	await expect(row.getByText('İzin gerekiyor', { exact: true })).toBeVisible();
	await expect(row.locator('p').first()).toBeVisible();
	await expect(row.locator('code')).toHaveCount(1);
	await expect(row.getByRole('button', { name: /reddet/i })).toBeVisible();
	await expect(row.getByRole('button', { name: /onayla|yine de devam et/i })).toBeVisible();

	const rowText = await row.innerText();
	recordCheck(
		`${label} hides non-dev raw approval fields`,
		!/file\.write|call_|approval required|approve file write/i.test(rowText),
	);
}

async function assertMobileApprovalButtonsClear(page: Page, label: string): Promise<void> {
	const row = getPendingApprovalRow(page);
	const approveButton = row.getByRole('button', { name: /onayla|yine de devam et/i });
	const rejectButton = row.getByRole('button', { name: /reddet/i });
	await approveButton.scrollIntoViewIfNeeded();

	const navBox = await page.locator('.runa-app-nav').last().boundingBox();
	const approveBox = await approveButton.boundingBox();
	const rejectBox = await rejectButton.boundingBox();
	const buttonsVisible = Boolean(
		approveBox && rejectBox && approveBox.height > 0 && rejectBox.height > 0,
	);
	const buttonsClearNav =
		!navBox ||
		Boolean(
			navBox &&
				approveBox &&
				rejectBox &&
				(approveBox.y + approveBox.height <= navBox.y - 2 ||
					approveBox.y >= navBox.y + navBox.height + 2) &&
				(rejectBox.y + rejectBox.height <= navBox.y - 2 ||
					rejectBox.y >= navBox.y + navBox.height + 2),
		);

	recordCheck(`${label} approval buttons visible`, buttonsVisible);
	recordCheck(`${label} approval buttons clear bottom nav`, buttonsClearNav);
}

async function assertDetailsToggleContract(page: Page): Promise<void> {
	const toolRow = page.locator(toolRowSelector).last();
	await expect(toolRow).toBeVisible({ timeout: 20_000 });
	const detailsButton = toolRow
		.getByRole('button', {
			name: /Ayrıntıları göster|Ayrıntıları gizle/i,
		})
		.first();
	await detailsButton.click();
	await expect(detailsButton).toHaveAttribute('aria-expanded', 'true');
	await expect(toolRow.getByRole('button', { name: 'Komutu kopyala' })).toBeVisible();

	const toolRowText = await toolRow.innerText();
	recordCheck(
		'details toggle keeps raw technical ids hidden in non-dev mode',
		!/call_[a-z0-9_-]+|file\.write|shell\.exec|approval required/i.test(toolRowText),
	);
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
		await getPendingApprovalRow(page).scrollIntoViewIfNeeded();
		await assertPendingApprovalContract(page, viewport.filename);
		await assertRowFitsViewport(page, pendingApprovalRowSelector, viewport.width, viewport.filename);

		if (viewport.width < 720) {
			await assertMobileApprovalButtonsClear(page, viewport.filename);
		}

		await capture(page, viewport.filename);
		await assertNoHorizontalOverflow(page, viewport.width, viewport.filename);
	}

	await page.setViewportSize({ height: 900, width: 1440 });
	const pendingRow = getPendingApprovalRow(page);
	await pendingRow.getByRole('button', { name: /onayla|yine de devam et/i }).click();

	const approvedRow = page.locator(approvedApprovalRowSelector).last();
	await expect(approvedRow).toBeVisible({ timeout: 20_000 });
	await expect(approvedRow.getByText('İzin verildi', { exact: true })).toBeVisible();
	await expect(approvedRow.getByRole('button', { name: /onayla|yine de devam et/i })).toHaveCount(0);
	await expect(approvedRow.getByRole('button', { name: /reddet/i })).toHaveCount(0);
	await expect(page.locator(pendingApprovalRowSelector)).toHaveCount(0);
	recordCheck('desktop approved state removes pending CTAs', true);

	const successToolRow = page.locator(`${toolRowSelector}[data-activity-status="success"]`).last();
	await expect(successToolRow).toBeVisible({ timeout: 20_000 });
	recordCheck('desktop continued flow shows tool/result activity', true);
	await assertDetailsToggleContract(page);
	await capture(page, 'desktop-1440-05-approval-approved.png');
	await capture(page, 'desktop-1440-08-continued-completed.png');
	await assertNoHorizontalOverflow(page, 1440, 'desktop completed flow');

	await page.setViewportSize({ height: 844, width: 390 });
	await approvedRow.scrollIntoViewIfNeeded();
	await capture(page, 'mobile-390-06-approval-approved.png');
	await assertNoHorizontalOverflow(page, 390, 'mobile approved state');
});

test('rejected state and empty chat regression screenshots', async ({ page }) => {
	await page.setViewportSize({ height: 844, width: 390 });
	await bootstrapLocalDevChat(page);
	await submitApprovalRequest(page);
	const pendingRow = getPendingApprovalRow(page);
	await pendingRow.getByRole('button', { name: /reddet/i }).click();

	const rejectedRow = page.locator(rejectedApprovalRowSelector).last();
	await expect(rejectedRow).toBeVisible({ timeout: 20_000 });
	await expect(rejectedRow.getByText('Reddedildi', { exact: true })).toBeVisible();
	await expect(rejectedRow.getByRole('button', { name: /onayla|yine de devam et/i })).toHaveCount(0);
	await expect(rejectedRow.getByRole('button', { name: /reddet/i })).toHaveCount(0);
	await capture(page, 'mobile-390-07-approval-rejected.png');
	await assertNoHorizontalOverflow(page, 390, 'mobile rejected state');

	await page.setViewportSize({ height: 900, width: 1440 });
	await bootstrapLocalDevChat(page);
	await expect(page.getByRole('heading', { name: 'Neyi ilerletmek istiyorsun?' })).toBeVisible();
	await expect(page.locator('textarea')).toBeVisible();
	await capture(page, 'desktop-1440-09-chat-empty.png');

	await page.setViewportSize({ height: 844, width: 390 });
	await bootstrapLocalDevChat(page);
	await expect(page.getByRole('heading', { name: 'Neyi ilerletmek istiyorsun?' })).toBeVisible();
	await expect(page.locator('textarea')).toBeVisible();
	await capture(page, 'mobile-390-10-chat-empty.png');
});
