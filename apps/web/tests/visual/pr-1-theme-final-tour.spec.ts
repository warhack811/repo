import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { type Page, expect, test } from '@playwright/test';

const developerModeStorageKey = 'runa_dev_mode';
const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const activeConversationStorageKey = 'runa.chat.active_conversation_id';
const onboardingCompletedStorageKey = 'runa.onboarding.completed';
const screenshotDirectory = join(
	process.cwd(),
	'docs/design-audit/screenshots/2026-05-13-ui-restructure-pr-1-theme',
);

type ConversationMode = 'active' | 'empty';
type VisualTheme = 'ember-dark' | 'ember-light' | 'rose-dark';

function createAuthRedirect(path: string): string {
	const baseUrl = test.info().project.use.baseURL;
	if (!baseUrl) {
		throw new Error('Playwright baseURL is required for PR-1 final tour screenshots.');
	}

	return `/auth/dev/bootstrap?redirect_to=${encodeURIComponent(new URL(path, baseUrl).toString())}`;
}

async function installAuthenticatedState(
	page: Page,
	input: Readonly<{ onboardingCompleted: boolean }>,
): Promise<void> {
	await page.addInitScript(
		([activeKey, devModeKey, onboardingKey, runtimeKey, onboardingCompleted]) => {
			window.localStorage.removeItem(activeKey);
			window.localStorage.setItem(devModeKey, 'false');
			window.localStorage.setItem(onboardingKey, onboardingCompleted ? 'true' : 'false');
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
			input.onboardingCompleted,
		],
	);
}

async function bootstrapAuthenticatedRoute(
	page: Page,
	path: string,
	input: Readonly<{ onboardingCompleted: boolean }>,
): Promise<void> {
	await installAuthenticatedState(page, input);
	await page.goto(createAuthRedirect(path));
	await page.waitForFunction(
		(expectedPath) => `${window.location.pathname}${window.location.search}` === expectedPath,
		path,
	);
	await expect(page.getByRole('navigation', { name: /uygulama gezintisi/i })).toBeVisible();
}

async function openUnauthenticatedLogin(page: Page): Promise<void> {
	await page
		.evaluate(() => {
			window.sessionStorage.clear();
			for (const key of Object.keys(window.localStorage)) {
				if (key.startsWith('runa.auth.') || key.startsWith('sb-')) {
					window.localStorage.removeItem(key);
				}
			}
		})
		.catch(() => undefined);
	await page.context().clearCookies();
	await page.goto('/login');
	await page.waitForFunction(() => window.location.pathname === '/login');
	await expect(page.locator('.runa-login-shell')).toBeVisible();
}

async function applyTheme(page: Page, theme: VisualTheme): Promise<void> {
	await page.evaluate((nextTheme) => {
		document.documentElement.setAttribute('data-theme', nextTheme);
	}, theme);
	await page.waitForTimeout(80);
}

async function capture(page: Page, filename: string): Promise<void> {
	await page.screenshot({ fullPage: true, path: join(screenshotDirectory, filename) });
}

async function mockChatData(page: Page): Promise<{
	setConversationMode: (mode: ConversationMode) => void;
}> {
	let conversationMode: ConversationMode = 'empty';
	const conversation = {
		access_role: 'owner',
		conversation_id: 'conversation_1',
		created_at: '2026-05-13T08:00:00.000Z',
		last_message_at: '2026-05-13T09:30:00.000Z',
		last_message_preview: 'Tema ve tipografi son kontrolu',
		title: 'Tema son kontrol',
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
										content: 'Bugun merge oncesi son kontrolleri tamamla.',
										conversation_id: conversation.conversation_id,
										created_at: '2026-05-13T09:00:00.000Z',
										message_id: 'message_user_1',
										role: 'user',
										sequence_no: 1,
									},
									{
										content: 'Kontroller tamamlandi. Screenshot ve lighthouse kanitlari hazir.',
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
			json: {
				devices: [
					{
						agent_id: 'agent_123',
						capabilities: [{ tool_name: 'desktop.screenshot' }],
						connected_at: '2026-05-13T09:00:00.000Z',
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

	return {
		setConversationMode(mode: ConversationMode): void {
			conversationMode = mode;
		},
	};
}

async function revealStoredTranscript(page: Page): Promise<void> {
	const transcriptText = page
		.getByText(/kontroller tamamlandi|screenshot ve lighthouse kanitlari hazir/i)
		.first();
	const userPromptText = page.getByText(/merge oncesi son kontrolleri/i).first();

	if (!(await transcriptText.isVisible()) && !(await userPromptText.isVisible())) {
		const conversationEntry = page.getByRole('button', { name: /tema son kontrol/i }).first();
		if ((await conversationEntry.count()) > 0) {
			await conversationEntry.click();
		}
	}

	await expect
		.poll(async () => (await transcriptText.isVisible()) || (await userPromptText.isVisible()), {
			timeout: 15_000,
		})
		.toBe(true);
}

test.beforeAll(async () => {
	await mkdir(screenshotDirectory, { recursive: true });
});

test('generates PR-1 final tour screenshots', async ({ page }) => {
	const data = await mockChatData(page);

	await page.setViewportSize({ width: 1440, height: 900 });
	await openUnauthenticatedLogin(page);
	await applyTheme(page, 'ember-dark');
	await capture(page, 'desktop-1440-login-ember-dark.png');

	data.setConversationMode('empty');
	await bootstrapAuthenticatedRoute(page, '/chat', { onboardingCompleted: true });
	await applyTheme(page, 'ember-dark');
	await expect(page.getByRole('heading', { name: /Neyi ilerletmek istiyorsun\?/i })).toBeVisible();
	await capture(page, 'desktop-1440-chat-empty-ember-dark.png');

	await applyTheme(page, 'ember-light');
	await capture(page, 'desktop-1440-chat-empty-ember-light.png');

	await applyTheme(page, 'rose-dark');
	await capture(page, 'desktop-1440-chat-empty-rose-dark.png');

	data.setConversationMode('active');
	await bootstrapAuthenticatedRoute(page, '/chat', { onboardingCompleted: true });
	await applyTheme(page, 'ember-dark');
	await revealStoredTranscript(page);
	await capture(page, 'desktop-1440-chat-active-transcript-ember-dark.png');

	data.setConversationMode('empty');
	await bootstrapAuthenticatedRoute(page, '/chat', { onboardingCompleted: false });
	await applyTheme(page, 'ember-dark');
	await expect(page.locator('.runa-onboarding-shell')).toBeVisible();
	await capture(page, 'desktop-1440-onboarding-ember-dark.png');

	await page.setViewportSize({ width: 390, height: 844 });
	await bootstrapAuthenticatedRoute(page, '/chat', { onboardingCompleted: true });
	await applyTheme(page, 'ember-dark');
	await expect(page.getByRole('heading', { name: /Neyi ilerletmek istiyorsun\?/i })).toBeVisible();
	await capture(page, 'mobile-390-chat-empty-ember-dark.png');

	await applyTheme(page, 'rose-dark');
	await capture(page, 'mobile-390-chat-empty-rose-dark.png');
});
