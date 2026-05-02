import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Page, expect, test } from '@playwright/test';

const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const activeConversationStorageKey = 'runa.chat.active_conversation_id';
const onboardingCompletedStorageKey = 'runa.onboarding.completed';
const screenshotDir = resolve('docs/design-audit/screenshots/2026-04-30-competitive-chat-ux-e2e');

async function prepareRuntime(page: Page): Promise<void> {
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
}

async function bootstrapLocalDevChat(page: Page): Promise<void> {
	const baseUrl = test.info().project.use.baseURL;

	if (!baseUrl) {
		throw new Error('Playwright baseURL is required for visual chat UX screenshots.');
	}

	await prepareRuntime(page);
	await page.goto(
		`/auth/dev/bootstrap?redirect_to=${encodeURIComponent(new URL('/chat', baseUrl).toString())}`,
	);
	await page.waitForURL('**/chat');
	await expect(page.locator('textarea')).toBeVisible();
	await expect(page.getByRole('button', { name: /send|gonder|g.nder/i })).toBeEnabled({
		timeout: 20_000,
	});
}

test.describe('competitive chat UX screenshots', () => {
	test.beforeAll(() => {
		mkdirSync(screenshotDir, { recursive: true });
	});

	test('captures friendly login error copy', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 980 });
		await page.goto('/');
		await page.locator('input[type="email"]').fill('wrong@example.com');
		await page.locator('input[type="password"]').first().fill('wrong-password');
		await page.getByRole('button', { name: /giri/i }).click();
		await expect(page.getByRole('alert')).toContainText(/E-posta veya .*ifre hatal/i);
		await page.screenshot({
			fullPage: true,
			path: resolve(screenshotDir, 'desktop-login-error.png'),
		});
	});

	test('captures desktop chat and pending approval', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 1100 });
		await bootstrapLocalDevChat(page);
		await page.screenshot({
			fullPage: true,
			path: resolve(screenshotDir, 'desktop-empty-chat.png'),
		});

		await page
			.locator('textarea')
			.fill('Please request approval and write the proof file once approval is granted.');
		await page.locator('textarea').press('Enter');
		await expect(page.getByRole('button', { name: /approve|onayla|kabul et/i })).toBeVisible({
			timeout: 20_000,
		});
		await page.screenshot({
			fullPage: true,
			path: resolve(screenshotDir, 'desktop-pending-approval.png'),
		});
	});

	test('captures mobile chat and pending approval', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await bootstrapLocalDevChat(page);
		await page
			.locator('textarea')
			.fill('Please request approval and write the proof file once approval is granted.');
		await page.locator('textarea').press('Enter');
		await expect(page.getByRole('button', { name: /approve|onayla|kabul et/i })).toBeVisible({
			timeout: 20_000,
		});
		await page.screenshot({
			fullPage: true,
			path: resolve(screenshotDir, 'mobile-pending-approval.png'),
		});
	});
});
