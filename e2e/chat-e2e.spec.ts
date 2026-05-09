import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Page, expect, test } from '@playwright/test';

const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const activeConversationStorageKey = 'runa.chat.active_conversation_id';
const onboardingCompletedStorageKey = 'runa.onboarding.completed';
const proofFilePath = resolve('.codex-temp', 'runa-e2e-proof', 'approval-proof.txt');
const e2eProvider = 'deepseek';
const e2eModel = 'deepseek-v4-flash';

async function bootstrapLocalDevChat(page: Page): Promise<void> {
	const baseUrl = test.info().project.use.baseURL;

	if (!baseUrl) {
		throw new Error('Playwright baseURL is required for the E2E bootstrap.');
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
	await expect(page.getByText(/Bug.n ne yapmak istersin/i)).toBeVisible();
	await expect(page.locator('textarea')).toBeVisible();
	await expect
		.poll(async () =>
			page.evaluate((storageKey) => {
				const rawValue = window.localStorage.getItem(storageKey);
				return rawValue ? JSON.parse(rawValue) : null;
			}, runtimeConfigStorageKey),
		)
		.toMatchObject({
			model: e2eModel,
			provider: e2eProvider,
		});
	await expect(page.getByRole('button', { name: /send|gonder|g.nder/i })).toBeEnabled({
		timeout: 20_000,
	});
}

test('auth bootstrap opens the chat shell', async ({ page }) => {
	await bootstrapLocalDevChat(page);

	await expect(page.getByRole('heading', { name: 'Neyi ilerletmek istiyorsun?' })).toBeVisible();
	await expect(page.getByText(/stored token seam/i)).toHaveCount(0);
	const sessionToken = await page.evaluate(() =>
		window.sessionStorage.getItem('runa.auth.bearer_token'),
	);
	expect(sessionToken).toBeTruthy();
});

test('chat submit reaches approval and completes after approve', async ({ page }) => {
	rmSync(proofFilePath, { force: true });
	await bootstrapLocalDevChat(page);

	await page
		.locator('textarea')
		.fill('Please request approval and write the proof file once approval is granted.');
	await page.getByRole('button', { name: /send|gonder|g.nder/i }).click();

	const approveButton = page.getByRole('button', { name: /approve|onayla|kabul et/i });
	await expect(approveButton).toBeVisible({ timeout: 20_000 });
	await approveButton.click();

	await expect(page.getByText(/Onayland|Kabul edildi/i).last()).toBeVisible({ timeout: 20_000 });
	await expect(page.getByText(/Dosya yazma tamamland|Dosya g.ncellendi/i).last()).toBeVisible({
		timeout: 20_000,
	});
	await expect
		.poll(() => existsSync(proofFilePath), {
			timeout: 20_000,
		})
		.toBe(true);

	expect(existsSync(proofFilePath)).toBe(true);
	expect(readFileSync(proofFilePath, 'utf8')).toBe('approval e2e proof\n');
});
