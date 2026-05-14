import { type Page, expect, test } from '@playwright/test';

const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const activeConversationStorageKey = 'runa.chat.active_conversation_id';
const onboardingCompletedStorageKey = 'runa.onboarding.completed';

interface WebSocketProbeLog {
	readonly socket_urls?: readonly string[];
}

async function installWebSocketProbe(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const globalWindow = window as unknown as {
			__RUNA_WS_PROBE__?: { socket_urls: string[] };
			WebSocket: typeof WebSocket;
		};

		if (globalWindow.__RUNA_WS_PROBE__) {
			return;
		}

		const log = {
			socket_urls: [] as string[],
		};
		const NativeWebSocket = globalWindow.WebSocket;

		function WrappedWebSocket(...args: ConstructorParameters<typeof WebSocket>): WebSocket {
			log.socket_urls.push(String(args[0]));
			return new NativeWebSocket(...args);
		}

		Object.setPrototypeOf(WrappedWebSocket, NativeWebSocket);
		WrappedWebSocket.prototype = NativeWebSocket.prototype;
		globalWindow.WebSocket = WrappedWebSocket as typeof WebSocket;
		globalWindow.__RUNA_WS_PROBE__ = log;
	});
}

async function readProbeLog(page: Page): Promise<WebSocketProbeLog> {
	return await page.evaluate(() => {
		const globalWindow = window as unknown as {
			__RUNA_WS_PROBE__?: WebSocketProbeLog;
		};
		return globalWindow.__RUNA_WS_PROBE__ ?? {};
	});
}

async function bootstrapLocalDevChat(page: Page): Promise<void> {
	const baseUrl = test.info().project.use.baseURL;

	if (!baseUrl) {
		throw new Error('Playwright baseURL is required for the hardening E2E bootstrap.');
	}

	await installWebSocketProbe(page);
	await page.addInitScript(
		([conversationStorageKey, onboardingStorageKey, storageKey]) => {
			window.localStorage.removeItem(conversationStorageKey);
			window.localStorage.setItem(onboardingStorageKey, 'true');
			window.localStorage.setItem(
				storageKey,
				JSON.stringify({
					apiKey: '',
					approvalMode: 'standard',
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
	await expect(page.locator('textarea')).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test('ws auth transport hardening + rapid navigation lifecycle smoke', async ({ page }) => {
	const pageErrors: string[] = [];
	const badResponses: string[] = [];
	const warningSignals: string[] = [];

	page.on('pageerror', (error) => {
		pageErrors.push(error.message);
	});
	page.on('response', (response) => {
		if (response.status() >= 400) {
			badResponses.push(`${response.status()} ${response.url()}`);
		}
	});
	page.on('console', (message) => {
		const text = message.text();
		if (
			text.includes('WebSocket is closed before the connection is established') ||
			text.toLowerCase().includes('persistence failure')
		) {
			warningSignals.push(text);
		}
	});

	await bootstrapLocalDevChat(page);

	await expect
		.poll(async () => !String(await page.evaluate(() => window.location.hash)).toLowerCase().includes('access_token'))
		.toBe(true);
	await expect
		.poll(async () => !String(await page.evaluate(() => window.location.href)).toLowerCase().includes('access_token'))
		.toBe(true);
	await expect
		.poll(async () =>
			Boolean(await page.evaluate(() => window.sessionStorage.getItem('runa.auth.bearer_token'))),
		)
		.toBe(true);

	for (const route of ['/history', '/settings', '/devices', '/chat', '/history', '/chat']) {
		await page.goto(route);
		await page.waitForLoadState('domcontentloaded');
	}

	await page.goto('/chat');
	const hasChatComposer = await page
		.locator('textarea')
		.isVisible()
		.catch(() => false);
	if (!hasChatComposer) {
		await bootstrapLocalDevChat(page);
	}
	await expect(page.locator('textarea')).toBeVisible({ timeout: 20_000 });
	await page.locator('textarea').fill('WS transport hardening smoke: plain chat response only.');
	await page.getByRole('button', { name: /send|gonder|g.nder/i }).click();
	await expect(page.getByText(/calisma tamamlandi|tamamland|completed/i).last()).toBeVisible({
		timeout: 20_000,
	});

	const log = await readProbeLog(page);
	const urls = (log.socket_urls ?? []).map((value) => String(value));
	const runtimeWsUrls = urls.filter((socketUrl) => {
		try {
			const parsed = new URL(socketUrl);
			return parsed.pathname === '/ws';
		} catch {
			return false;
		}
	});

	expect(runtimeWsUrls.length).toBeGreaterThan(0);
	for (const socketUrl of runtimeWsUrls) {
		const normalized = socketUrl.toLowerCase();
		expect(normalized).not.toContain('access_token=');
		expect(normalized).not.toContain('refresh_token=');
		expect(normalized).toContain('ws_ticket=');
	}

	expect(pageErrors).toEqual([]);
	expect(badResponses).toEqual([]);
	expect(warningSignals).toEqual([]);
});
