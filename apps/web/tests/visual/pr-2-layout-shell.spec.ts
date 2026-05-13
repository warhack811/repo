import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { type Page, expect, test } from '@playwright/test';

const activeConversationStorageKey = 'runa.chat.active_conversation_id';
const developerModeStorageKey = 'runa_dev_mode';
const onboardingCompletedStorageKey = 'runa.onboarding.completed';
const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const screenshotDirectory = join(
	process.cwd(),
	'docs/design-audit/screenshots/2026-05-13-ui-restructure-pr-2-layout-shell',
);

type ConversationMode = 'active' | 'empty';

function createAuthRedirect(path: string): string {
	const baseUrl = test.info().project.use.baseURL;
	if (!baseUrl) {
		throw new Error('Playwright baseURL is required for PR-2 layout screenshots.');
	}

	return `/auth/dev/bootstrap?redirect_to=${encodeURIComponent(new URL(path, baseUrl).toString())}`;
}

async function installAuthenticatedState(page: Page): Promise<void> {
	await page.addInitScript(
		([activeKey, devModeKey, onboardingKey, runtimeKey]) => {
			window.localStorage.removeItem(activeKey);
			window.localStorage.setItem(devModeKey, 'false');
			window.localStorage.setItem(onboardingKey, 'true');
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
			activeConversationStorageKey,
			developerModeStorageKey,
			onboardingCompletedStorageKey,
			runtimeConfigStorageKey,
		],
	);
}

async function bootstrapAuthenticatedRoute(page: Page, path: string): Promise<void> {
	await installAuthenticatedState(page);
	await page.goto(createAuthRedirect(path));
	await page.waitForFunction(
		(expectedPath) => `${window.location.pathname}${window.location.search}` === expectedPath,
		path,
	);
}

async function mockChatData(page: Page): Promise<{
	setConversationMode: (mode: ConversationMode) => void;
}> {
	let conversationMode: ConversationMode = 'empty';
	const conversation = {
		access_role: 'owner',
		conversation_id: 'conversation_pr2',
		created_at: '2026-05-13T08:00:00.000Z',
		last_message_at: '2026-05-13T09:30:00.000Z',
		last_message_preview: 'Layout shell proof',
		title: 'Layout shell proof',
		updated_at: '2026-05-13T09:30:00.000Z',
	};

	await page.route('**/conversations**', async (route) => {
		const path = new URL(route.request().url()).pathname;

		if (path === '/conversations') {
			await route.fulfill({
				contentType: 'application/json',
				json: {
					conversations: conversationMode === 'empty' ? [] : [conversation],
				},
			});
			return;
		}

		if (path.endsWith('/messages')) {
			await route.fulfill({
				contentType: 'application/json',
				json: {
					conversation_id: conversation.conversation_id,
					messages:
						conversationMode === 'active'
							? [
									{
										content: 'PR-2 layout shell kanitini hazirla.',
										conversation_id: conversation.conversation_id,
										created_at: '2026-05-13T09:00:00.000Z',
										message_id: 'message_user_1',
										role: 'user',
										sequence_no: 1,
									},
									{
										content: 'Sag rail kalkti; sohbet sutunu iki kolon shell icinde kaldi.',
										conversation_id: conversation.conversation_id,
										created_at: '2026-05-13T09:02:00.000Z',
										message_id: 'message_assistant_1',
										role: 'assistant',
										sequence_no: 2,
									},
								]
							: [],
				},
			});
			return;
		}

		if (path.endsWith('/members')) {
			await route.fulfill({
				contentType: 'application/json',
				json: {
					conversation_id: conversation.conversation_id,
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
			json: { devices: [] },
		});
	});

	return {
		setConversationMode(mode: ConversationMode): void {
			conversationMode = mode;
		},
	};
}

async function capture(page: Page, filename: string): Promise<void> {
	await page.screenshot({ fullPage: true, path: join(screenshotDirectory, filename) });
}

async function assertLayoutShell(page: Page, viewport: 'desktop' | 'mobile'): Promise<void> {
	await expect(page.locator(`.runa-chat-layout__${'insights'}`)).toHaveCount(0);
	await expect(page.locator('.runa-command-palette-trigger')).toHaveCount(1);

	if (viewport === 'desktop') {
		await expect(page.locator('.runa-app-sidebar')).toBeVisible();
		await expect(page.locator('.runa-chat-header__title')).toBeVisible();
		return;
	}

	await expect(page.locator('.runa-app-nav')).toBeHidden();
	await expect(page.locator('.runa-chat-header__mobile-action')).toHaveCount(2);
}

async function revealStoredTranscript(page: Page): Promise<void> {
	const transcriptText = page.getByText(/sag rail kalkti/i).first();

	if (!(await transcriptText.isVisible())) {
		const conversationEntry = page.getByRole('button', { name: /layout shell proof/i }).first();
		if ((await conversationEntry.count()) > 0) {
			await conversationEntry.click();
		}
	}

	await expect(transcriptText).toBeVisible();
}

test.beforeAll(async () => {
	await mkdir(screenshotDirectory, { recursive: true });
});

test('generates PR-2 layout shell screenshots', async ({ page }) => {
	const data = await mockChatData(page);

	data.setConversationMode('empty');
	await page.setViewportSize({ width: 1440, height: 900 });
	await bootstrapAuthenticatedRoute(page, '/chat');
	await assertLayoutShell(page, 'desktop');
	await capture(page, 'desktop-1440-chat-empty.png');

	data.setConversationMode('active');
	await bootstrapAuthenticatedRoute(page, '/chat');
	await revealStoredTranscript(page);
	await assertLayoutShell(page, 'desktop');
	await capture(page, 'desktop-1440-chat-active.png');

	await page.setViewportSize({ width: 1920, height: 1080 });
	await bootstrapAuthenticatedRoute(page, '/chat');
	await revealStoredTranscript(page);
	await assertLayoutShell(page, 'desktop');
	await capture(page, 'desktop-1920-chat-active.png');

	data.setConversationMode('empty');
	await page.setViewportSize({ width: 390, height: 844 });
	await bootstrapAuthenticatedRoute(page, '/chat');
	await assertLayoutShell(page, 'mobile');
	await capture(page, 'mobile-390-chat-empty.png');

	await page.getByRole('textbox', { name: /mesaj/i }).focus();
	await capture(page, 'mobile-390-composer-focus.png');

	await page.setViewportSize({ width: 320, height: 568 });
	await bootstrapAuthenticatedRoute(page, '/chat');
	await assertLayoutShell(page, 'mobile');
	await capture(page, 'mobile-320-chat-empty.png');
});
