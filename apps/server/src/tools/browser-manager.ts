import { chromium } from 'playwright-core';

import type { ToolExecutionSignal } from '@runa/types';

/*
Mini-RFC: why playwright-core here?

- We need a real browser automation engine with isolated BrowserContext support,
  but we do not want `@runa/server` to auto-download browser binaries during
  install. `playwright-core` gives us the protocol/runtime without bundling the
  Chromium payload into the dependency graph.
- Browser binaries are expected to come from one of two operator-controlled
  paths:
  1. an explicit executable path via `RUNA_BROWSER_EXECUTABLE_PATH` or
     `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`
  2. an existing Playwright browser installation reachable through the normal
     Playwright cache resolution flow, optionally with `PLAYWRIGHT_BROWSERS_PATH`
     pointing at that cache
- In local/dev environments the expected setup is `npx playwright install chromium`
  (or an equivalent preinstalled Chromium/Chrome path exposed through env).
- In server deployments where no browser binary is available, the manager must
  fail with a typed `browser_binary_unavailable` path instead of crashing the
  process or hanging startup. That keeps browser tools opt-in and graceful.
*/

export type BrowserWaitUntil = 'domcontentloaded' | 'load' | 'networkidle';

export interface ManagedBrowserLocator {
	click(options?: Readonly<{ timeout?: number }>): Promise<void>;
	count(): Promise<number>;
	fill(value: string, options?: Readonly<{ timeout?: number }>): Promise<void>;
	first(): ManagedBrowserLocator;
	getAttribute(name: string, options?: Readonly<{ timeout?: number }>): Promise<string | null>;
	innerText(options?: Readonly<{ timeout?: number }>): Promise<string>;
	isVisible(options?: Readonly<{ timeout?: number }>): Promise<boolean>;
	locator(selector: string): ManagedBrowserLocator;
	nth(index: number): ManagedBrowserLocator;
	textContent(options?: Readonly<{ timeout?: number }>): Promise<string | null>;
}

export interface ManagedBrowserPage {
	goto(
		url: string,
		options?: Readonly<{ timeout?: number; waitUntil?: BrowserWaitUntil }>,
	): Promise<unknown>;
	locator(selector: string): ManagedBrowserLocator;
	title(): Promise<string>;
	url(): string;
	waitForLoadState(
		state?: BrowserWaitUntil,
		options?: Readonly<{ timeout?: number }>,
	): Promise<void>;
}

interface ManagedBrowserContext {
	close(): Promise<void>;
	newPage(): Promise<ManagedBrowserPage>;
}

interface ManagedBrowser {
	close(): Promise<void>;
	newContext(
		options?: Readonly<{
			acceptDownloads?: boolean;
			ignoreHTTPSErrors?: boolean;
			serviceWorkers?: 'allow' | 'block';
		}>,
	): Promise<ManagedBrowserContext>;
}

interface ChromiumLauncher {
	launch(
		options?: Readonly<{
			executablePath?: string;
			headless?: boolean;
		}>,
	): Promise<ManagedBrowser>;
}

interface TimerHandleLike {
	readonly unref?: () => TimerHandleLike;
}

export type BrowserManagerErrorReason =
	| 'browser_binary_unavailable'
	| 'browser_launch_failed'
	| 'browser_session_aborted';

export class BrowserManagerError extends Error {
	readonly reason: BrowserManagerErrorReason;

	constructor(reason: BrowserManagerErrorReason, message: string, cause?: unknown) {
		super(message);
		this.name = 'BrowserManagerError';
		this.reason = reason;
		this.cause = cause;
	}
}

export interface BrowserSessionHandle {
	readonly page: ManagedBrowserPage;
	readonly run_id: string;
}

interface BrowserSessionRecord extends BrowserSessionHandle {
	readonly browser_context: ManagedBrowserContext;
	timer: TimerHandleLike | undefined;
}

interface BrowserManagerDependencies {
	readonly chromium: ChromiumLauncher;
	readonly clearTimeout: (handle: TimerHandleLike) => void;
	readonly environment: NodeJS.ProcessEnv;
	readonly setTimeout: (callback: () => void, delay_ms: number) => TimerHandleLike;
}

export interface BrowserManagerOptions {
	readonly inactivity_timeout_ms?: number;
}

const DEFAULT_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1_000;
const EXECUTABLE_PATH_ENV_KEYS = [
	'RUNA_BROWSER_EXECUTABLE_PATH',
	'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH',
] as const;

function isBrowserBinaryUnavailableError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const message = error.message.toLocaleLowerCase();

	return (
		message.includes("executable doesn't exist") ||
		message.includes('browser executable') ||
		message.includes('failed to launch browser process') ||
		message.includes('playwright install')
	);
}

function getConfiguredExecutablePath(environment: NodeJS.ProcessEnv): string | undefined {
	for (const key of EXECUTABLE_PATH_ENV_KEYS) {
		const candidate = environment[key]?.trim();

		if (candidate) {
			return candidate;
		}
	}

	return undefined;
}

function assertSignalNotAborted(signal: ToolExecutionSignal | undefined): void {
	if (signal?.aborted === true) {
		throw new BrowserManagerError(
			'browser_session_aborted',
			'Browser automation aborted before a session became available.',
		);
	}
}

export class BrowserManager {
	readonly #dependencies: BrowserManagerDependencies;
	readonly #inactivityTimeoutMs: number;
	#browser: ManagedBrowser | undefined;
	#browserPromise: Promise<ManagedBrowser> | undefined;
	readonly #sessionPromises = new Map<string, Promise<BrowserSessionRecord>>();
	readonly #sessions = new Map<string, BrowserSessionRecord>();

	constructor(
		options: BrowserManagerOptions = {},
		dependencies: BrowserManagerDependencies = {
			chromium: chromium as ChromiumLauncher,
			clearTimeout: (handle) => clearTimeout(handle as unknown as NodeJS.Timeout),
			environment: process.env,
			setTimeout: (callback, delayMs) =>
				setTimeout(callback, delayMs) as unknown as TimerHandleLike,
		},
	) {
		this.#dependencies = dependencies;
		this.#inactivityTimeoutMs = options.inactivity_timeout_ms ?? DEFAULT_INACTIVITY_TIMEOUT_MS;
	}

	async getSession(input: {
		readonly run_id: string;
		readonly signal?: ToolExecutionSignal;
	}): Promise<BrowserSessionHandle> {
		assertSignalNotAborted(input.signal);

		const existingSession = this.#sessions.get(input.run_id);

		if (existingSession) {
			this.#touchSession(existingSession);
			assertSignalNotAborted(input.signal);
			return {
				page: existingSession.page,
				run_id: existingSession.run_id,
			};
		}

		const existingPromise = this.#sessionPromises.get(input.run_id);

		if (existingPromise) {
			const session = await existingPromise;
			this.#touchSession(session);
			assertSignalNotAborted(input.signal);
			return {
				page: session.page,
				run_id: session.run_id,
			};
		}

		const sessionPromise = this.#createSession(input.run_id, input.signal);
		this.#sessionPromises.set(input.run_id, sessionPromise);

		try {
			const session = await sessionPromise;
			this.#sessions.set(input.run_id, session);
			this.#touchSession(session);
			assertSignalNotAborted(input.signal);

			return {
				page: session.page,
				run_id: session.run_id,
			};
		} catch (error: unknown) {
			await this.abortRun(input.run_id);
			throw error;
		} finally {
			this.#sessionPromises.delete(input.run_id);
		}
	}

	async abortRun(runId: string): Promise<void> {
		const session = this.#sessions.get(runId);

		if (!session) {
			return;
		}

		this.#sessions.delete(runId);
		this.#clearSessionTimer(session);
		await session.browser_context.close();
		await this.#closeBrowserIfIdle();
	}

	async close(): Promise<void> {
		const sessionClosures = Array.from(this.#sessions.keys(), (runId) => this.abortRun(runId));
		await Promise.allSettled(sessionClosures);

		const browser = this.#browser;
		this.#browser = undefined;
		this.#browserPromise = undefined;

		if (browser) {
			await browser.close();
		}
	}

	async #createSession(
		runId: string,
		signal: ToolExecutionSignal | undefined,
	): Promise<BrowserSessionRecord> {
		assertSignalNotAborted(signal);
		const browser = await this.#ensureBrowser();
		const browserContext = await browser.newContext({
			acceptDownloads: false,
			ignoreHTTPSErrors: false,
			serviceWorkers: 'block',
		});
		const page = await browserContext.newPage();
		assertSignalNotAborted(signal);

		return {
			browser_context: browserContext,
			page,
			run_id: runId,
			timer: undefined,
		};
	}

	async #ensureBrowser(): Promise<ManagedBrowser> {
		if (this.#browser) {
			return this.#browser;
		}

		if (this.#browserPromise) {
			return this.#browserPromise;
		}

		const browserPromise = (async () => {
			try {
				const executablePath = getConfiguredExecutablePath(this.#dependencies.environment);
				const browser = await this.#dependencies.chromium.launch({
					executablePath,
					headless: true,
				});
				this.#browser = browser;
				return browser;
			} catch (error: unknown) {
				if (isBrowserBinaryUnavailableError(error)) {
					throw new BrowserManagerError(
						'browser_binary_unavailable',
						'No Chromium browser binary is available for browser automation.',
						error,
					);
				}

				throw new BrowserManagerError(
					'browser_launch_failed',
					error instanceof Error
						? `Browser launch failed: ${error.message}`
						: 'Browser launch failed.',
					error,
				);
			} finally {
				this.#browserPromise = undefined;
			}
		})();

		this.#browserPromise = browserPromise;

		return browserPromise;
	}

	async #closeBrowserIfIdle(): Promise<void> {
		if (this.#sessions.size > 0) {
			return;
		}

		const browser = this.#browser;
		this.#browser = undefined;
		this.#browserPromise = undefined;

		if (browser) {
			await browser.close();
		}
	}

	#clearSessionTimer(session: BrowserSessionRecord): void {
		if (!session.timer) {
			return;
		}

		this.#dependencies.clearTimeout(session.timer);
		session.timer = undefined;
	}

	#touchSession(session: BrowserSessionRecord): void {
		this.#clearSessionTimer(session);

		const timer = this.#dependencies.setTimeout(() => {
			void this.abortRun(session.run_id);
		}, this.#inactivityTimeoutMs);

		timer.unref?.();
		session.timer = timer;
	}
}

export const defaultBrowserManager = new BrowserManager();
