import { describe, expect, it } from 'vitest';

import { BrowserManager, type BrowserManagerError } from './browser-manager.js';

class FakePage {
	constructor(readonly page_id: string) {}

	goto = async (): Promise<null> => null;
	locator = (): never => {
		throw new Error('not implemented');
	};
	title = async (): Promise<string> => this.page_id;
	url = (): string => 'about:blank';
	waitForLoadState = async (): Promise<void> => {};
}

class FakeBrowserContext {
	closed = false;
	readonly page;

	constructor(pageId: string) {
		this.page = new FakePage(pageId);
	}

	close = async (): Promise<void> => {
		this.closed = true;
	};

	newPage = async (): Promise<FakePage> => this.page;
}

class FakeBrowser {
	closed = false;
	context_counter = 0;
	readonly contexts: FakeBrowserContext[] = [];

	close = async (): Promise<void> => {
		this.closed = true;
	};

	newContext = async (): Promise<FakeBrowserContext> => {
		this.context_counter += 1;
		const context = new FakeBrowserContext(`page-${this.context_counter}`);
		this.contexts.push(context);
		return context;
	};
}

function createTimerHarness() {
	const handles: Array<{
		active: boolean;
		callback: () => void;
		unref: () => { active: boolean; callback: () => void; unref: () => unknown };
	}> = [];

	return {
		clearTimeout(handle: unknown) {
			if (typeof handle === 'object' && handle !== null && 'active' in handle) {
				(handle as { active?: boolean }).active = false;
			}
		},
		handles,
		setTimeout(callback: () => void) {
			const handle = {
				active: true,
				callback,
				unref() {
					return handle;
				},
			};
			handles.push(handle);
			return handle;
		},
	};
}

describe('BrowserManager', () => {
	it('lazy-inits the browser and reuses the same run-scoped context', async () => {
		const fakeBrowser = new FakeBrowser();
		let launchCount = 0;
		const timers = createTimerHarness();
		const manager = new BrowserManager(
			{
				inactivity_timeout_ms: 100,
			},
			{
				chromium: {
					launch: async () => {
						launchCount += 1;
						return fakeBrowser;
					},
				},
				clearTimeout: timers.clearTimeout,
				environment: {},
				setTimeout: timers.setTimeout,
			},
		);

		const first = await manager.getSession({
			run_id: 'run-1',
		});
		const second = await manager.getSession({
			run_id: 'run-1',
		});
		const third = await manager.getSession({
			run_id: 'run-2',
		});

		expect(launchCount).toBe(1);
		expect(fakeBrowser.context_counter).toBe(2);
		expect(first.page).toBe(second.page);
		expect(third.page).not.toBe(first.page);
	});

	it('cleans up inactive sessions and closes the browser when idle', async () => {
		const fakeBrowser = new FakeBrowser();
		const timers = createTimerHarness();
		const manager = new BrowserManager(
			{
				inactivity_timeout_ms: 100,
			},
			{
				chromium: {
					launch: async () => fakeBrowser,
				},
				clearTimeout: timers.clearTimeout,
				environment: {},
				setTimeout: timers.setTimeout,
			},
		);

		await manager.getSession({
			run_id: 'run-1',
		});
		expect(fakeBrowser.contexts[0]?.closed).toBe(false);

		timers.handles[0]?.callback();
		await Promise.resolve();
		await Promise.resolve();

		expect(fakeBrowser.contexts[0]?.closed).toBe(true);
		expect(fakeBrowser.closed).toBe(true);
	});

	it('supports explicit abort cleanup per run', async () => {
		const fakeBrowser = new FakeBrowser();
		const timers = createTimerHarness();
		const manager = new BrowserManager(
			{
				inactivity_timeout_ms: 100,
			},
			{
				chromium: {
					launch: async () => fakeBrowser,
				},
				clearTimeout: timers.clearTimeout,
				environment: {},
				setTimeout: timers.setTimeout,
			},
		);

		await manager.getSession({
			run_id: 'run-1',
		});

		await manager.abortRun('run-1');

		expect(fakeBrowser.contexts[0]?.closed).toBe(true);
		expect(fakeBrowser.closed).toBe(true);
	});

	it('throws a typed browser_binary_unavailable error when Chromium is missing', async () => {
		const timers = createTimerHarness();
		const manager = new BrowserManager(
			{
				inactivity_timeout_ms: 100,
			},
			{
				chromium: {
					launch: async () => {
						throw new Error("Executable doesn't exist at C:\\missing\\chromium.exe");
					},
				},
				clearTimeout: timers.clearTimeout,
				environment: {},
				setTimeout: timers.setTimeout,
			},
		);

		await expect(
			manager.getSession({
				run_id: 'run-1',
			}),
		).rejects.toMatchObject({
			name: 'BrowserManagerError',
			reason: 'browser_binary_unavailable',
		} satisfies Partial<BrowserManagerError>);
	});
});
