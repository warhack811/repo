import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const activeConversationStorageKey = 'runa.chat.active_conversation_id';
const onboardingCompletedStorageKey = 'runa.onboarding.completed';
const scenarioWriteProofPath = resolve('.codex-temp', 'runa-e2e-proof', 'scenario-write-proof.txt');
const e2eProvider = 'deepseek';
const e2eModel = 'deepseek-v4-flash';

interface WebSocketLog {
	readonly received?: readonly unknown[];
	readonly sent?: readonly unknown[];
}

function normalizePathForMatch(pathValue: string): string {
	return pathValue.replaceAll('\\', '/').toLowerCase();
}

function getMessageType(value: unknown): string | undefined {
	if (!value || typeof value !== 'object' || !('type' in value)) {
		return undefined;
	}

	const candidate = (value as { readonly type?: unknown }).type;
	return typeof candidate === 'string' ? candidate : undefined;
}

async function installWebSocketLog(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const globalWindow = window as unknown as {
			__RUNA_HARDENING_WS_LOG__?: {
				received: unknown[];
				sent: unknown[];
			};
			WebSocket: typeof WebSocket;
		};

		if (globalWindow.__RUNA_HARDENING_WS_LOG__) {
			return;
		}

		const log = {
			received: [] as unknown[],
			sent: [] as unknown[],
		};
		const NativeWebSocket = globalWindow.WebSocket;

		function parsePayload(rawValue: unknown): unknown {
			if (typeof rawValue !== 'string') {
				return rawValue;
			}

			try {
				return JSON.parse(rawValue) as unknown;
			} catch {
				return rawValue;
			}
		}

		function WrappedWebSocket(...args: ConstructorParameters<typeof WebSocket>): WebSocket {
			const socket = new NativeWebSocket(...args);
			const nativeSend = socket.send.bind(socket);

			socket.send = (data: string | ArrayBufferLike | Blob | ArrayBufferView): void => {
				log.sent.push(parsePayload(data));
				nativeSend(data);
			};

			socket.addEventListener('message', (event) => {
				log.received.push(parsePayload(event.data));
			});

			return socket;
		}

		Object.setPrototypeOf(WrappedWebSocket, NativeWebSocket);
		WrappedWebSocket.prototype = NativeWebSocket.prototype;
		globalWindow.WebSocket = WrappedWebSocket as typeof WebSocket;
		globalWindow.__RUNA_HARDENING_WS_LOG__ = log;
	});
}

async function readWsLog(page: Page): Promise<WebSocketLog> {
	return await page.evaluate(() => {
		const globalWindow = window as unknown as {
			__RUNA_HARDENING_WS_LOG__?: WebSocketLog;
		};
		return globalWindow.__RUNA_HARDENING_WS_LOG__ ?? {};
	});
}

function getApprovalTargets(log: WebSocketLog): readonly string[] {
	const targets: string[] = [];
	for (const message of log.received ?? []) {
		if (!message || typeof message !== 'object') {
			continue;
		}

		const payload = (message as { readonly payload?: { readonly blocks?: readonly unknown[] } })
			.payload;
		for (const block of payload?.blocks ?? []) {
			if (!block || typeof block !== 'object') {
				continue;
			}
			const candidate = block as {
				readonly payload?: { readonly target_label?: unknown; readonly tool_name?: unknown };
				readonly type?: unknown;
			};
			if (candidate.type !== 'approval_block') {
				continue;
			}

			const label =
				typeof candidate.payload?.target_label === 'string'
					? candidate.payload.target_label
					: typeof candidate.payload?.tool_name === 'string'
						? candidate.payload.tool_name
						: undefined;

			if (label) {
				targets.push(label);
			}
		}
	}
	return targets;
}

async function waitForRunFinished(page: Page): Promise<void> {
	await expect
		.poll(async () => {
			const log = await readWsLog(page);
			return (log.received ?? []).some((message) => {
				if (getMessageType(message) !== 'run.finished') {
					return false;
				}
				const payload = (message as { readonly payload?: { readonly final_state?: unknown } })
					.payload;
				return payload?.final_state === 'COMPLETED' || payload?.final_state === 'FAILED';
			});
		})
		.toBe(true);
}

async function bootstrapTrustedSession(page: Page): Promise<void> {
	const baseUrl = test.info().project.use.baseURL;
	if (!baseUrl) {
		throw new Error('Playwright baseURL is required.');
	}

	await installWebSocketLog(page);
	await page.addInitScript(
		([conversationStorageKey, onboardingStorageKey, storageKey, model, provider]) => {
			window.localStorage.removeItem(conversationStorageKey);
			window.localStorage.setItem(onboardingStorageKey, 'true');
			window.localStorage.setItem(
				storageKey,
				JSON.stringify({
					apiKey: '',
					approvalMode: 'trusted-session',
					includePresentationBlocks: true,
					model,
					provider,
				}),
			);
		},
		[
			activeConversationStorageKey,
			onboardingCompletedStorageKey,
			runtimeConfigStorageKey,
			e2eModel,
			e2eProvider,
		],
	);

	await page.goto(
		`/auth/dev/bootstrap?redirect_to=${encodeURIComponent(new URL('/chat', baseUrl).toString())}`,
	);
	await page.waitForURL('**/chat');
	await expect(page.locator('textarea')).toBeVisible();
}

async function submitFileWritePrompt(page: Page): Promise<void> {
	await page.locator('textarea').fill('[runa-e2e:cap-file-write] Write the scenario proof file.');
	await page.getByRole('button', { name: /send|gonder|g.nder/i }).click();
	await expect(page.getByRole('button', { name: /approve|onayla|kabul et/i })).toBeVisible({
		timeout: 20_000,
	});
}

test.describe.configure({ mode: 'serial' });

test.describe('hardening live approve/reject checks', () => {
	test('reject prevents file creation', async ({ page }) => {
		rmSync(scenarioWriteProofPath, { force: true });

		await bootstrapTrustedSession(page);
		await submitFileWritePrompt(page);

		const targetsBeforeDecision = getApprovalTargets(await readWsLog(page));
		const normalizedTargets = targetsBeforeDecision.map(normalizePathForMatch);
		const normalizedExpectedPath = normalizePathForMatch(scenarioWriteProofPath);
		console.log(
			`[hardening-live] approval targets before reject: ${JSON.stringify(targetsBeforeDecision)}`,
		);
		expect(
			normalizedTargets.some(
				(item) => item.includes(normalizedExpectedPath) || item.includes('file.write'),
			),
		).toBe(true);

		await page.getByRole('button', { name: /reject|reddet/i }).click();
		await waitForRunFinished(page);
		expect(existsSync(scenarioWriteProofPath)).toBe(false);
	});

	test('approve creates the file with expected content', async ({ page }) => {
		rmSync(scenarioWriteProofPath, { force: true });

		await bootstrapTrustedSession(page);
		await submitFileWritePrompt(page);

		await page.getByRole('button', { name: /approve|onayla|kabul et/i }).click();
		await waitForRunFinished(page);

		expect(existsSync(scenarioWriteProofPath)).toBe(true);
		expect(readFileSync(scenarioWriteProofPath, 'utf8')).toBe('scenario write proof\n');
	});
});
