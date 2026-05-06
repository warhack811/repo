import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { type Page, expect, test } from '@playwright/test';
import type { ApprovalMode } from '@runa/types';

const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const activeConversationStorageKey = 'runa.chat.active_conversation_id';
const onboardingCompletedStorageKey = 'runa.onboarding.completed';
const screenshotDir = resolve(
	'docs/design-audit/screenshots/2026-05-03-approval-modes-capability-live',
);
const scenarioWriteProofPath = join(os.tmpdir(), 'runa-e2e-proof', 'scenario-write-proof.txt');
const e2eProvider = 'deepseek';
const e2eModel = 'deepseek-v4-flash';

type ExpectedApproval = 'boundary' | 'none';

interface BrowserScenario {
	readonly approval_mode: ApprovalMode;
	readonly expected_approval: ExpectedApproval;
	readonly expected_approval_targets?: readonly string[];
	readonly id: string;
	readonly prompt: string;
	readonly screenshot: string;
	readonly title: string;
}

interface WebSocketLog {
	readonly received?: readonly unknown[];
	readonly sent?: readonly unknown[];
}

const scenarios: readonly BrowserScenario[] = [
	{
		approval_mode: 'standard',
		expected_approval: 'none',
		id: 'standard-chat',
		prompt: 'Plain chat smoke. Reply without a tool.',
		screenshot: '01-standard-chat.png',
		title: 'Standard mode plain chat',
	},
	{
		approval_mode: 'standard',
		expected_approval: 'none',
		id: 'standard-file-list',
		prompt: '[runa-e2e:cap-file-list] List the workspace root.',
		screenshot: '02-standard-file-list.png',
		title: 'Standard mode file.list',
	},
	{
		approval_mode: 'ask-every-time',
		expected_approval: 'boundary',
		expected_approval_targets: ['file.list'],
		id: 'ask-file-list',
		prompt: '[runa-e2e:cap-file-list] List the workspace root.',
		screenshot: '03-ask-file-list-approval.png',
		title: 'Ask every time safe read approval',
	},
	{
		approval_mode: 'trusted-session',
		expected_approval: 'boundary',
		expected_approval_targets: ['agent.auto_continue'],
		id: 'trusted-file-read',
		prompt: '[runa-e2e:cap-file-read] Read the README header.',
		screenshot: '04-trusted-file-read.png',
		title: 'Trusted-session file.read',
	},
	{
		approval_mode: 'trusted-session',
		expected_approval: 'boundary',
		expected_approval_targets: ['file.write'],
		id: 'trusted-file-write',
		prompt: '[runa-e2e:cap-file-write] Write the scenario proof file.',
		screenshot: '05-trusted-file-write-approval.png',
		title: 'Trusted-session write boundary',
	},
	{
		approval_mode: 'standard',
		expected_approval: 'none',
		id: 'search-grep',
		prompt: '[runa-e2e:cap-search-grep] Search docs for Runa.',
		screenshot: '06-search-grep.png',
		title: 'search.grep capability',
	},
	{
		approval_mode: 'standard',
		expected_approval: 'none',
		id: 'search-codebase',
		prompt: '[runa-e2e:cap-search-codebase] Search the WS code for policy wiring.',
		screenshot: '07-search-codebase.png',
		title: 'search.codebase capability',
	},
	{
		approval_mode: 'standard',
		expected_approval: 'none',
		id: 'git-status',
		prompt: '[runa-e2e:cap-git-status] Check git status.',
		screenshot: '08-git-status.png',
		title: 'git.status capability',
	},
	{
		approval_mode: 'standard',
		expected_approval: 'none',
		id: 'git-diff',
		prompt: '[runa-e2e:cap-git-diff] Inspect the current git diff.',
		screenshot: '09-git-diff.png',
		title: 'git.diff capability',
	},
	{
		approval_mode: 'standard',
		expected_approval: 'boundary',
		expected_approval_targets: ['shell.exec'],
		id: 'shell-exec',
		prompt: '[runa-e2e:cap-shell-exec] Run a safe node command.',
		screenshot: '10-shell-exec-approval.png',
		title: 'shell.exec approval boundary',
	},
	{
		approval_mode: 'standard',
		expected_approval: 'none',
		id: 'browser-navigate',
		prompt: '[runa-e2e:cap-browser-navigate] Open the evidence fixture in an isolated browser.',
		screenshot: '11-browser-navigate.png',
		title: 'browser.navigate capability',
	},
];

function installWebSocketLog(page: Page): Promise<void> {
	return page.addInitScript(() => {
		const globalWindow = window as unknown as {
			__RUNA_E2E_WS_LOG__?: {
				received: unknown[];
				sent: unknown[];
				socket_urls: string[];
			};
			WebSocket: typeof WebSocket;
		};

		if (globalWindow.__RUNA_E2E_WS_LOG__) {
			return;
		}

		const log = {
			received: [] as unknown[],
			sent: [] as unknown[],
			socket_urls: [] as string[],
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
			log.socket_urls.push(String(args[0]));
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
		globalWindow.__RUNA_E2E_WS_LOG__ = log;
	});
}

async function bootstrapLocalDevChat(page: Page, approvalMode: ApprovalMode): Promise<void> {
	const baseUrl = test.info().project.use.baseURL;

	if (!baseUrl) {
		throw new Error('Playwright baseURL is required for approval mode E2E bootstrap.');
	}

	await installWebSocketLog(page);
	await page.addInitScript(
		([conversationStorageKey, onboardingStorageKey, storageKey, mode, model, provider]) => {
			window.localStorage.removeItem(conversationStorageKey);
			window.localStorage.setItem(onboardingStorageKey, 'true');
			window.localStorage.setItem(
				storageKey,
				JSON.stringify({
					apiKey: '',
					approvalMode: mode,
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
			approvalMode,
			e2eModel,
			e2eProvider,
		],
	);

	await page.goto(
		`/auth/dev/bootstrap?redirect_to=${encodeURIComponent(new URL('/chat', baseUrl).toString())}`,
	);
	await page.waitForURL('**/chat');
	await expect(page.locator('textarea')).toBeVisible();
	await expect(page.getByRole('button', { name: /send|gonder|g.nder/i })).toBeEnabled({
		timeout: 20_000,
	});
}

async function readWsLog(page: Page): Promise<WebSocketLog> {
	return await page.evaluate(() => {
		const globalWindow = window as unknown as {
			__RUNA_E2E_WS_LOG__?: WebSocketLog;
		};

		return globalWindow.__RUNA_E2E_WS_LOG__ ?? {};
	});
}

function getMessageType(value: unknown): string | undefined {
	if (!value || typeof value !== 'object' || !('type' in value)) {
		return undefined;
	}

	const candidate = (value as { readonly type?: unknown }).type;
	return typeof candidate === 'string' ? candidate : undefined;
}

function getRunRequestApprovalMode(log: WebSocketLog): unknown {
	const runRequest = [...(log.sent ?? [])]
		.reverse()
		.find((message) => getMessageType(message) === 'run.request');

	if (!runRequest || typeof runRequest !== 'object') {
		return undefined;
	}

	return (
		runRequest as { readonly payload?: { readonly approval_policy?: { readonly mode?: unknown } } }
	).payload?.approval_policy?.mode;
}

function hasPendingApproval(log: WebSocketLog): boolean {
	return (log.received ?? []).some((message) => {
		if (!message || typeof message !== 'object') {
			return false;
		}

		const payload = (message as { readonly payload?: { readonly blocks?: readonly unknown[] } })
			.payload;
		return (payload?.blocks ?? []).some((block) => {
			if (!block || typeof block !== 'object') {
				return false;
			}

			const candidate = block as {
				readonly payload?: { readonly status?: unknown };
				readonly type?: unknown;
			};

			return candidate.type === 'approval_block' && candidate.payload?.status === 'pending';
		});
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
				readonly payload?: {
					readonly target_label?: unknown;
					readonly tool_name?: unknown;
				};
				readonly type?: unknown;
			};

			if (candidate.type !== 'approval_block') {
				continue;
			}

			const target =
				typeof candidate.payload?.target_label === 'string'
					? candidate.payload.target_label
					: typeof candidate.payload?.tool_name === 'string'
						? candidate.payload.tool_name
						: undefined;

			if (target) {
				targets.push(target);
			}
		}
	}

	return targets;
}

function hasToolError(log: WebSocketLog): boolean {
	return (log.received ?? []).some((message) => {
		if (!message || typeof message !== 'object') {
			return false;
		}

		const payload = (message as { readonly payload?: { readonly blocks?: readonly unknown[] } })
			.payload;
		return (payload?.blocks ?? []).some((block) => {
			if (!block || typeof block !== 'object') {
				return false;
			}

			const candidate = block as {
				readonly payload?: { readonly status?: unknown };
				readonly type?: unknown;
			};

			return candidate.type === 'tool_result_block' && candidate.payload?.status === 'error';
		});
	});
}

async function isRunFinished(page: Page): Promise<boolean> {
	const log = await readWsLog(page);

	return (log.received ?? []).some(
		(message) =>
			getMessageType(message) === 'run.finished' &&
			(message as { readonly payload?: { readonly final_state?: unknown } }).payload
				?.final_state === 'COMPLETED',
	);
}

async function waitForRunFinished(page: Page): Promise<void> {
	await expect.poll(async () => await isRunFinished(page), { timeout: 30_000 }).toBe(true);
}

async function approveBoundariesUntilFinished(
	page: Page,
	scenario: BrowserScenario,
): Promise<void> {
	let capturedBoundary = false;

	for (let index = 0; index < 6; index += 1) {
		if (await isRunFinished(page)) {
			return;
		}

		const visible = await page
			.waitForFunction(
				() => {
					return Array.from(document.querySelectorAll('button')).some((button) => {
						const label = button.textContent ?? '';

						return (
							!button.disabled &&
							(button.offsetParent !== null || button.getClientRects().length > 0) &&
							(label.includes('Onayla') || label.includes('Approve') || label.includes('Kabul Et'))
						);
					});
				},
				undefined,
				{
					timeout: scenario.expected_approval === 'none' ? 1_000 : 20_000,
				},
			)
			.then(() => true)
			.catch(() => false);

		if (!visible) {
			break;
		}

		if (!capturedBoundary) {
			await assertNoHorizontalOverflow(page);
			await page.screenshot({
				fullPage: true,
				path: resolve(screenshotDir, scenario.screenshot),
			});
			capturedBoundary = true;
		}

		await page.evaluate(() => {
			const approveButton = Array.from(document.querySelectorAll('button')).find((button) => {
				const label = button.textContent ?? '';

				return (
					!button.disabled &&
					(button.offsetParent !== null || button.getClientRects().length > 0) &&
					(label.includes('Onayla') || label.includes('Approve') || label.includes('Kabul Et'))
				);
			});

			if (approveButton instanceof HTMLButtonElement) {
				approveButton.click();
			}
		});
	}

	await waitForRunFinished(page);
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
	await expect
		.poll(async () => {
			return await page.evaluate(() => ({
				innerWidth: window.innerWidth,
				scrollWidth: document.documentElement.scrollWidth,
			}));
		})
		.toMatchObject({
			scrollWidth: expect.any(Number),
		});
	const viewport = page.viewportSize();
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);

	if (viewport) {
		expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 2);
	}
}

test.describe.configure({ mode: 'serial' });

test.describe('approval modes and capability browser live matrix', () => {
	test.beforeAll(() => {
		mkdirSync(screenshotDir, { recursive: true });
	});

	for (const scenario of scenarios) {
		test(scenario.title, async ({ page }) => {
			const consoleErrors: string[] = [];
			const pageErrors: string[] = [];
			const responseErrors: string[] = [];
			page.on('console', (message) => {
				if (message.type() === 'error') {
					const location = message.location();
					consoleErrors.push(`${message.text()} @ ${location.url}:${location.lineNumber}`);
				}
			});
			page.on('pageerror', (error) => {
				pageErrors.push(error.message);
			});
			page.on('response', (response) => {
				if (response.status() >= 400) {
					responseErrors.push(`${response.status()} ${response.url()}`);
				}
			});

			await bootstrapLocalDevChat(page, scenario.approval_mode);
			await page.locator('textarea').fill(scenario.prompt);
			await page.getByRole('button', { name: /send|gonder|g.nder/i }).click();

			await approveBoundariesUntilFinished(page, scenario);
			await expect(page.getByText(/calisma tamamlandi|çalışma tamamlandı/i).last()).toBeVisible({
				timeout: 20_000,
			});
			await assertNoHorizontalOverflow(page);

			if (scenario.expected_approval === 'none') {
				await page.screenshot({
					fullPage: true,
					path: resolve(screenshotDir, scenario.screenshot),
				});
			}

			const log = await readWsLog(page);
			expect(getRunRequestApprovalMode(log)).toBe(scenario.approval_mode);
			expect(hasPendingApproval(log)).toBe(scenario.expected_approval === 'boundary');
			for (const target of scenario.expected_approval_targets ?? []) {
				expect(getApprovalTargets(log)).toContain(target);
			}
			expect(hasToolError(log)).toBe(false);
			expect(consoleErrors).toEqual([]);
			expect(responseErrors).toEqual([]);
			expect(pageErrors).toEqual([]);
		});
	}

	test('approved file write scenario produced the expected proof file', () => {
		expect(existsSync(scenarioWriteProofPath)).toBe(true);
		expect(readFileSync(scenarioWriteProofPath, 'utf8')).toBe('scenario write proof\n');
	});
});
