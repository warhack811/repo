import { existsSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { type Page, expect, test } from '@playwright/test';

const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const activeConversationStorageKey = 'runa.chat.active_conversation_id';
const proofFilePath = join(os.tmpdir(), 'runa-e2e-proof', 'approval-proof.txt');

async function bootstrapLocalDevChat(page: Page): Promise<void> {
	const baseUrl = test.info().project.use.baseURL;

	if (!baseUrl) {
		throw new Error('Playwright baseURL is required for the E2E bootstrap.');
	}

	await page.addInitScript(
		([conversationStorageKey, storageKey]) => {
			window.localStorage.removeItem(conversationStorageKey);
			window.localStorage.setItem(
				storageKey,
				JSON.stringify({
					apiKey: 'e2e-openai-key',
					includePresentationBlocks: true,
					model: 'gpt-4o-mini',
					provider: 'openai',
				}),
			);
		},
		[activeConversationStorageKey, runtimeConfigStorageKey],
	);

	await page.goto(
		`/auth/dev/bootstrap?redirect_to=${encodeURIComponent(new URL('/chat', baseUrl).toString())}`,
	);
	await page.waitForURL('**/chat');
	await expect(page.getByRole('heading', { name: 'Sohbetten devam et' })).toBeVisible();
	await expect(page.locator('textarea')).toBeVisible();
	await expect(page.getByRole('button', { name: /send|gonder/i })).toBeEnabled({
		timeout: 20_000,
	});
}

test('auth bootstrap opens the chat shell', async ({ page }) => {
	await bootstrapLocalDevChat(page);

	await expect(page.getByRole('heading', { name: 'Aktif sohbet akışı' })).toBeVisible();
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
	await page.getByRole('button', { name: /send|gonder/i }).click();

	const approveButton = page.getByRole('button', { name: /approve|kabul et/i });
	await expect(approveButton).toBeVisible({ timeout: 20_000 });
	await approveButton.click();

	await expect(page.getByText(/Kabul edildi/i)).toBeVisible({ timeout: 20_000 });
	await expect(page.getByText('file.write completed successfully.')).toBeVisible({
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
