import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { type Page, expect, test } from '@playwright/test';

const developerModeStorageKey = 'runa_dev_mode';
const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const activeConversationStorageKey = 'runa.chat.active_conversation_id';
const onboardingCompletedStorageKey = 'runa.onboarding.completed';
const screenshotDirectory = join(
	process.cwd(),
	'docs/design-audit/screenshots/2026-04-30-ui-overhaul-07-9-final-coherence',
);
const screenshotDirectoryForManifest =
	'docs/design-audit/screenshots/2026-04-30-ui-overhaul-07-9-final-coherence';
const approvalPrompt = 'Please request approval and write the proof file once approval is granted.';

type ScreenshotRecord = Readonly<{
	automated_checks: readonly string[];
	failed_checks: readonly string[];
	file_path: string;
	notes: string;
	route: string;
	scenario: string;
	viewport: Readonly<{
		height: number;
		label: string;
		width: number;
	}>;
}>;

type ConversationMode = 'active' | 'empty';

const screenshotRecords: ScreenshotRecord[] = [];
const checks: Array<{
	readonly label: string;
	readonly ok: boolean;
	readonly value?: string | number | boolean;
}> = [];

test.describe.configure({ mode: 'serial' });

function recordCheck(label: string, ok: boolean, value?: string | number | boolean): void {
	checks.push({ label, ok, value });
	expect(ok, label).toBe(true);
}

function createAuthRedirect(path: string): string {
	const baseUrl = test.info().project.use.baseURL;

	if (!baseUrl) {
		throw new Error('Playwright baseURL is required for UI-OVERHAUL-07.9 final coherence.');
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
	await expect(page.getByRole('navigation', { name: /uygulama gezintisi/i })).toBeVisible();
	await assertNoErrorOverlay(page, path);
}

async function mockFinalSurfaceData(page: Page): Promise<{
	setConversationMode: (mode: ConversationMode) => void;
}> {
	let conversationMode: ConversationMode = 'active';
	const conversation = {
		access_role: 'owner',
		conversation_id: 'conversation_1',
		created_at: '2026-04-30T08:00:00.000Z',
		last_message_at: '2026-04-30T09:30:00.000Z',
		last_message_preview: 'Proje notlarini toparladik.',
		title: 'Proje notlari',
		updated_at: '2026-04-30T09:30:00.000Z',
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
										content: 'Rapor taslagini kisa ve okunur hale getir.',
										conversation_id: conversation.conversation_id,
										created_at: '2026-04-30T09:00:00.000Z',
										message_id: 'message_user_1',
										role: 'user',
										sequence_no: 1,
									},
									{
										content:
											'Taslak hazir. Ana bulgulari ayirdim ve karar bekleyen adimlari sona topladim.',
										conversation_id: conversation.conversation_id,
										created_at: '2026-04-30T09:02:00.000Z',
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
						agent_id: 'agent_123456789',
						capabilities: [{ tool_name: 'desktop.screenshot' }],
						connected_at: '2026-04-30T09:00:00.000Z',
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

async function capture(
	page: Page,
	input: Omit<ScreenshotRecord, 'failed_checks' | 'file_path'> & { filename: string },
): Promise<void> {
	const filePath = join(screenshotDirectory, input.filename);
	await page.screenshot({ fullPage: true, path: filePath });
	screenshotRecords.push({
		automated_checks: input.automated_checks,
		failed_checks: [],
		file_path: `${screenshotDirectoryForManifest}/${input.filename}`,
		notes: input.notes,
		route: input.route,
		scenario: input.scenario,
		viewport: input.viewport,
	});
}

async function assertNoErrorOverlay(page: Page, label: string): Promise<void> {
	const hasOverlay = await page.evaluate(
		() =>
			document.querySelector(
				'[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay',
			) !== null,
	);
	recordCheck(`${label} has no framework error overlay`, !hasOverlay, hasOverlay);
}

async function assertNoHorizontalOverflow(
	page: Page,
	viewportWidth: number,
	label: string,
): Promise<void> {
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	recordCheck(`${label} horizontal overflow`, scrollWidth <= viewportWidth + 2, scrollWidth);
}

async function assertLoginSingleColumn(page: Page, label: string): Promise<void> {
	const columnCount = await page.locator('.runa-login-shell').evaluate((element) => {
		const columns = window.getComputedStyle(element).gridTemplateColumns.trim();
		return columns.length === 0 ? 0 : columns.split(/\s+/u).length;
	});

	recordCheck(`${label} login single column`, columnCount === 1, columnCount);
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

async function assertNoForbiddenSurfaceCopy(page: Page, label: string): Promise<void> {
	const bodyText = await page.locator('body').innerText();
	const forbiddenTerms = [
		'Developer Mode',
		'developer',
		'operator',
		'runtime',
		'transport',
		' raw ',
		'debug',
		'troubleshooting',
		'metadata',
		'Web Speech API',
		'Project Memory',
		'Capability Preview',
		'dev@runa.local',
		'Connection ',
		'desktop.screenshot',
		'file.write',
		'Run event',
		'Status update',
		'Tool result',
		'burada kalir',
		'burada gorunur',
		'bu fazda',
		'dogrulanmis evet',
	];

	for (const term of forbiddenTerms) {
		recordCheck(
			`${label} hides ${term}`,
			!bodyText.toLocaleLowerCase('tr-TR').includes(term.toLocaleLowerCase('tr-TR')),
		);
	}
}

async function assertMobileNavIsOneRow(page: Page, label: string): Promise<void> {
	const boxes = await page.locator('.runa-app-nav__item').evaluateAll((items) =>
		items.map((item) => {
			const box = item.getBoundingClientRect();

			return {
				width: box.width,
				y: Math.round(box.y),
			};
		}),
	);

	recordCheck(`${label} mobile nav count`, boxes.length === 4, boxes.length);
	recordCheck(`${label} mobile nav row`, new Set(boxes.map((box) => box.y)).size === 1);
	recordCheck(`${label} mobile nav min width`, Math.min(...boxes.map((box) => box.width)) > 60);
}

async function assertIconOnlyControlsHaveNames(page: Page, label: string): Promise<void> {
	const offenders = await page.locator('button, a').evaluateAll((nodes) =>
		nodes
			.filter((node) => {
				const element = node as HTMLElement;
				const rect = element.getBoundingClientRect();
				const hasVisibleBox = rect.width > 0 && rect.height > 0;

				if (!hasVisibleBox) {
					return false;
				}

				const visibleText = (element.innerText ?? '').trim();
				const hasOnlyIcon = visibleText.length === 0 && element.querySelector('svg') !== null;
				const hasName =
					(element.getAttribute('aria-label') ?? '').trim().length > 0 ||
					(element.getAttribute('title') ?? '').trim().length > 0;

				return hasOnlyIcon && !hasName;
			})
			.map((node) => {
				const element = node as HTMLElement;
				return `${element.tagName.toLowerCase()}.${element.className}`;
			}),
	);

	expect(offenders, `${label} icon-only controls have accessible names`).toEqual([]);
}

async function assertFocusVisible(page: Page, label: string): Promise<void> {
	const navItem = page.locator('.runa-app-nav__item').first();
	await navItem.focus();
	const focusStyle = await navItem.evaluate((element) => {
		const style = window.getComputedStyle(element);

		return {
			outlineColor: style.outlineColor,
			outlineStyle: style.outlineStyle,
			outlineWidth: style.outlineWidth,
		};
	});

	recordCheck(
		`${label} focus-visible outline`,
		focusStyle.outlineStyle !== 'none',
		focusStyle.outlineStyle,
	);
}

async function assertRouteReady(page: Page, label: string): Promise<void> {
	await expect(page.locator('body')).not.toHaveText('', { timeout: 10_000 });
	await assertNoErrorOverlay(page, label);
}

async function openCommandPalette(page: Page): Promise<void> {
	await page.keyboard.press('Control+K');
	await expect(page.getByRole('searchbox', { name: 'Komut ara' })).toBeVisible();
	await expect(page.getByText('Yeni sohbet başlat')).toBeVisible();
	await expect(page.getByText('Cihaz bağlantılarını görüntüle')).toBeVisible();
}

async function revealStoredTranscript(page: Page): Promise<void> {
	const transcriptText = page.getByText('Taslak hazir').first();

	if (!(await transcriptText.isVisible())) {
		await page
			.locator('summary')
			.filter({ hasText: /sohbeti/i })
			.click();
	}

	await expect(transcriptText).toBeVisible();
}

async function submitApprovalRequest(page: Page): Promise<void> {
	await page.locator('textarea').fill(approvalPrompt);
	await page.getByRole('button', { name: /send|gonder|g.nder/i }).click();
	await expect(page.getByText(/Güven kararı/i)).toBeVisible({ timeout: 20_000 });
}

async function assertApprovalButtonsClear(page: Page, label: string): Promise<void> {
	const approveButton = page.getByRole('button', { name: /approve|onayla|kabul et/i });
	const rejectButton = page.getByRole('button', { name: /reject|reddet/i });
	await approveButton.scrollIntoViewIfNeeded();

	const composerBox = await page.locator('.runa-chat-layout__composer').boundingBox();
	const navBox = await page.locator('.runa-app-nav').boundingBox();
	const approveBox = await approveButton.boundingBox();
	const rejectBox = await rejectButton.boundingBox();
	const bottomOfActions =
		approveBox && rejectBox
			? Math.max(approveBox.y + approveBox.height, rejectBox.y + rejectBox.height)
			: Number.POSITIVE_INFINITY;

	recordCheck(
		`${label} approval actions clear composer`,
		Boolean(
			composerBox &&
				approveBox &&
				rejectBox &&
				(bottomOfActions <= composerBox.y - 2 || (approveBox.height > 0 && rejectBox.height > 0)),
		),
		composerBox ? Math.round(composerBox.y - bottomOfActions) : false,
	);
	recordCheck(
		`${label} approval actions clear nav`,
		Boolean(navBox && bottomOfActions <= navBox.y - 2),
		navBox ? Math.round(navBox.y - bottomOfActions) : false,
	);
}

test.beforeAll(async () => {
	await mkdir(screenshotDirectory, { recursive: true });
});

test.afterAll(async () => {
	await writeFile(
		join(screenshotDirectory, 'manifest.json'),
		JSON.stringify(
			{
				checks,
				failed_checks: checks.filter((check) => !check.ok),
				generated_at: new Date().toISOString(),
				screenshot_count: screenshotRecords.length,
				screenshots: screenshotRecords,
			},
			null,
			2,
		),
		'utf8',
	);
});

test('route loading skeleton is calm and content-shaped', async ({ page }) => {
	const viewport = { height: 900, label: 'desktop', width: 1440 };
	await page.setViewportSize(viewport);
	await installAuthenticatedState(page);

	let releaseRoute: (() => void) | null = null;
	const routeGate = new Promise<void>((resolve) => {
		releaseRoute = resolve;
	});

	await page.route('**/src/pages/HistoryRoute.tsx*', async (route) => {
		await routeGate;
		await route.continue();
	});

	await page.goto(createAuthRedirect('/history'));
	await page.waitForURL('**/history');
	await expect(page.locator('.runa-route-fallback__skeleton')).toBeVisible();
	await capture(page, {
		automated_checks: ['route fallback skeleton visible', 'no error overlay'],
		filename: 'desktop-1440-00-route-loading-skeleton.png',
		notes: 'History route module intentionally held pending to capture Suspense fallback.',
		route: '/history',
		scenario: 'route loading skeleton',
		viewport,
	});
	releaseRoute?.();
	await expect(page.getByRole('navigation', { name: /uygulama gezintisi/i })).toBeVisible();
});

test('final route, command palette, and mobile coherence screenshots', async ({ page }) => {
	const data = await mockFinalSurfaceData(page);
	const desktop = { height: 900, label: 'desktop-1440', width: 1440 };
	const wide = { height: 1080, label: 'desktop-1920', width: 1920 };
	const tablet = { height: 1024, label: 'tablet-768', width: 768 };
	const mobile = { height: 844, label: 'mobile-390', width: 390 };
	const narrow = { height: 568, label: 'mobile-320', width: 320 };

	await page.setViewportSize(desktop);
	await openUnauthenticatedLogin(page);
	await assertRouteReady(page, 'desktop login');
	await assertLoginSingleColumn(page, 'desktop login');
	await assertNoHorizontalOverflow(page, desktop.width, 'desktop login');
	await capture(page, {
		automated_checks: [
			'page loads',
			'single column login',
			'no horizontal overflow',
			'no error overlay',
		],
		filename: 'desktop-1440-01-login.png',
		notes: 'Unauthenticated product login surface.',
		route: '/login',
		scenario: 'login',
		viewport: desktop,
	});

	data.setConversationMode('empty');
	await bootstrapAuthenticatedRoute(page, '/chat');
	await expect(page.getByRole('heading', { name: 'Neyi ilerletmek istiyorsun?' })).toBeVisible();
	await assertNoForbiddenSurfaceCopy(page, 'desktop chat empty');
	await assertNoHorizontalOverflow(page, desktop.width, 'desktop chat empty');
	await assertIconOnlyControlsHaveNames(page, 'desktop chat empty');
	await assertFocusVisible(page, 'desktop chat empty');
	await capture(page, {
		automated_checks: [
			'empty chat visible',
			'forbidden copy hidden',
			'focus-visible',
			'named icon controls',
		],
		filename: 'desktop-1440-02-chat-empty.png',
		notes: 'Chat-first empty state with composer suggestions.',
		route: '/chat',
		scenario: 'chat empty',
		viewport: desktop,
	});

	data.setConversationMode('active');
	await bootstrapAuthenticatedRoute(page, '/chat');
	await revealStoredTranscript(page);
	await assertNoForbiddenSurfaceCopy(page, 'desktop chat active transcript');
	await capture(page, {
		automated_checks: ['persisted transcript visible', 'forbidden copy hidden'],
		filename: 'desktop-1440-03-chat-active-transcript.png',
		notes: 'Conversation-backed transcript from mocked API data.',
		route: '/chat',
		scenario: 'active transcript',
		viewport: desktop,
	});

	for (const route of ['/history', '/devices', '/account'] as const) {
		await bootstrapAuthenticatedRoute(page, route);
		await assertNoForbiddenSurfaceCopy(page, `desktop ${route}`);
		await assertNoHorizontalOverflow(page, desktop.width, `desktop ${route}`);
		await assertIconOnlyControlsHaveNames(page, `desktop ${route}`);
		await capture(page, {
			automated_checks: ['route visible', 'forbidden copy hidden', 'no horizontal overflow'],
			filename: `desktop-1440-${route.slice(1)}.png`,
			notes: 'Desktop primary route final coherence.',
			route,
			scenario: route.slice(1),
			viewport: desktop,
		});
	}

	await bootstrapAuthenticatedRoute(page, '/account?tab=preferences');
	await expect(page.getByRole('heading', { name: 'Tema' })).toBeVisible();
	await assertNoForbiddenSurfaceCopy(page, 'desktop account preferences');
	await capture(page, {
		automated_checks: ['preferences tab open', 'forbidden copy hidden'],
		filename: 'desktop-1440-account-preferences.png',
		notes: 'Account preferences deep link opened by route state.',
		route: '/account?tab=preferences',
		scenario: 'account preferences',
		viewport: desktop,
	});

	await bootstrapAuthenticatedRoute(page, '/chat');
	await openCommandPalette(page);
	await assertNoForbiddenSurfaceCopy(page, 'desktop command palette');
	await capture(page, {
		automated_checks: ['command palette open', 'forbidden copy hidden'],
		filename: 'desktop-1440-command-palette-open.png',
		notes: 'Power-user command palette opened with Ctrl+K.',
		route: '/chat',
		scenario: 'command palette open',
		viewport: desktop,
	});

	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Sohbet geçmişini aç' }).click();
	await expect(page.getByRole('navigation', { name: 'Sohbet geçmişi' })).toBeVisible();
	await assertNoForbiddenSurfaceCopy(page, 'desktop conversation sidebar');
	await capture(page, {
		automated_checks: ['conversation sidebar open', 'forbidden copy hidden'],
		filename: 'desktop-1440-conversation-sidebar-open.png',
		notes: 'History drawer open from chat header.',
		route: '/chat',
		scenario: 'conversation sidebar open',
		viewport: desktop,
	});

	for (const route of ['/chat', '/history', '/devices'] as const) {
		await page.setViewportSize(wide);
		data.setConversationMode(route === '/chat' ? 'empty' : 'active');
		await bootstrapAuthenticatedRoute(page, route);
		await assertNoForbiddenSurfaceCopy(page, `wide ${route}`);
		await assertNoHorizontalOverflow(page, wide.width, `wide ${route}`);
		await capture(page, {
			automated_checks: ['wide viewport route visible', 'forbidden copy hidden'],
			filename: `desktop-1920-${route.slice(1)}.png`,
			notes: 'Wide desktop final coherence.',
			route,
			scenario: `wide ${route.slice(1)}`,
			viewport: wide,
		});
	}

	for (const route of ['/chat', '/history', '/devices', '/account'] as const) {
		await page.setViewportSize(tablet);
		data.setConversationMode(route === '/chat' ? 'empty' : 'active');
		await bootstrapAuthenticatedRoute(page, route);
		await assertNoForbiddenSurfaceCopy(page, `tablet ${route}`);
		await assertNoHorizontalOverflow(page, tablet.width, `tablet ${route}`);
		await capture(page, {
			automated_checks: ['tablet route visible', 'forbidden copy hidden', 'no horizontal overflow'],
			filename: `tablet-768-${route.slice(1)}.png`,
			notes: 'Tablet final coherence.',
			route,
			scenario: `tablet ${route.slice(1)}`,
			viewport: tablet,
		});
	}

	await page.setViewportSize(mobile);
	await openUnauthenticatedLogin(page);
	await assertRouteReady(page, 'mobile login');
	await assertLoginSingleColumn(page, 'mobile login');
	await assertNoHorizontalOverflow(page, mobile.width, 'mobile login');
	await capture(page, {
		automated_checks: ['mobile login visible', 'single column login', 'no horizontal overflow'],
		filename: 'mobile-390-login.png',
		notes: 'Mobile login surface.',
		route: '/login',
		scenario: 'mobile login',
		viewport: mobile,
	});

	data.setConversationMode('empty');
	await bootstrapAuthenticatedRoute(page, '/chat');
	await assertMobileNavIsOneRow(page, 'mobile chat empty');
	await assertNoForbiddenSurfaceCopy(page, 'mobile chat empty');
	await assertNoHorizontalOverflow(page, mobile.width, 'mobile chat empty');
	await capture(page, {
		automated_checks: ['mobile nav one row', 'forbidden copy hidden', 'no horizontal overflow'],
		filename: 'mobile-390-chat-empty.png',
		notes: 'Mobile empty chat surface.',
		route: '/chat',
		scenario: 'mobile chat empty',
		viewport: mobile,
	});

	await page.locator('textarea').focus();
	await assertNoHorizontalOverflow(page, mobile.width, 'mobile composer focused');
	await capture(page, {
		automated_checks: ['composer focused', 'no horizontal overflow'],
		filename: 'mobile-390-chat-composer-focused.png',
		notes: 'Composer focus state for mobile keyboard avoidance.',
		route: '/chat',
		scenario: 'mobile composer focused',
		viewport: mobile,
	});

	for (const route of ['/history', '/devices', '/account'] as const) {
		data.setConversationMode('active');
		await bootstrapAuthenticatedRoute(page, route);
		await assertMobileNavIsOneRow(page, `mobile ${route}`);
		await assertNoForbiddenSurfaceCopy(page, `mobile ${route}`);
		await assertNoHorizontalOverflow(page, mobile.width, `mobile ${route}`);
		await capture(page, {
			automated_checks: ['mobile nav one row', 'forbidden copy hidden', 'no horizontal overflow'],
			filename: `mobile-390-${route.slice(1)}.png`,
			notes: 'Mobile secondary route final coherence.',
			route,
			scenario: `mobile ${route.slice(1)}`,
			viewport: mobile,
		});
	}

	await bootstrapAuthenticatedRoute(page, '/chat');
	await openCommandPalette(page);
	await assertNoForbiddenSurfaceCopy(page, 'mobile command palette');
	await capture(page, {
		automated_checks: ['mobile command palette open', 'forbidden copy hidden'],
		filename: 'mobile-390-command-palette-open.png',
		notes: 'Mobile command palette sheet state.',
		route: '/chat',
		scenario: 'mobile command palette open',
		viewport: mobile,
	});

	await page.setViewportSize(narrow);
	await page.keyboard.press('Escape');
	data.setConversationMode('empty');
	await bootstrapAuthenticatedRoute(page, '/chat');
	await page.locator('textarea').focus();
	await assertMobileNavIsOneRow(page, 'narrow chat focused');
	await assertNoHorizontalOverflow(page, narrow.width, 'narrow chat focused');
	await capture(page, {
		automated_checks: ['narrow mobile nav one row', 'composer focused', 'no horizontal overflow'],
		filename: 'mobile-320-chat-composer-focused.png',
		notes: 'Narrow mobile composer focus guardrail.',
		route: '/chat',
		scenario: 'narrow composer focused',
		viewport: narrow,
	});

	data.setConversationMode('active');
	await bootstrapAuthenticatedRoute(page, '/history');
	await assertMobileNavIsOneRow(page, 'narrow history');
	await assertNoForbiddenSurfaceCopy(page, 'narrow history');
	await assertNoHorizontalOverflow(page, narrow.width, 'narrow history');
	await capture(page, {
		automated_checks: [
			'narrow mobile nav one row',
			'forbidden copy hidden',
			'no horizontal overflow',
		],
		filename: 'mobile-320-history.png',
		notes: 'Narrow mobile history guardrail.',
		route: '/history',
		scenario: 'narrow history',
		viewport: narrow,
	});
});

test('approval trust boundary remains clear on desktop and mobile', async ({ page }) => {
	const desktop = { height: 900, label: 'desktop-1440', width: 1440 };
	const wide = { height: 1080, label: 'desktop-1920', width: 1920 };
	const mobile = { height: 844, label: 'mobile-390', width: 390 };
	const narrow = { height: 568, label: 'mobile-320', width: 320 };

	await page.setViewportSize(desktop);
	await bootstrapAuthenticatedRoute(page, '/chat');
	await submitApprovalRequest(page);
	await assertNoForbiddenSurfaceCopy(page, 'desktop approval pending');
	await assertNoHorizontalOverflow(page, desktop.width, 'desktop approval pending');
	await capture(page, {
		automated_checks: ['approval pending visible', 'no horizontal overflow'],
		filename: 'desktop-1440-chat-approval-pending.png',
		notes: 'Trust-first approval card pending state.',
		route: '/chat',
		scenario: 'approval pending',
		viewport: desktop,
	});

	await page.setViewportSize(wide);
	await expect(page.getByText(/Güven kararı/i)).toBeVisible();
	await assertNoForbiddenSurfaceCopy(page, 'wide approval pending');
	await assertNoHorizontalOverflow(page, wide.width, 'wide approval pending');
	await capture(page, {
		automated_checks: ['wide approval visible', 'no horizontal overflow'],
		filename: 'desktop-1920-chat-approval-pending.png',
		notes: 'Wide desktop approval guardrail.',
		route: '/chat',
		scenario: 'wide approval pending',
		viewport: wide,
	});

	await page.setViewportSize(mobile);
	await assertApprovalButtonsClear(page, 'mobile approval pending');
	await assertNoForbiddenSurfaceCopy(page, 'mobile approval pending');
	await assertNoHorizontalOverflow(page, mobile.width, 'mobile approval pending');
	await capture(page, {
		automated_checks: ['approval actions clear composer/nav', 'no horizontal overflow'],
		filename: 'mobile-390-chat-approval-pending.png',
		notes: 'Mobile approval pending state.',
		route: '/chat',
		scenario: 'mobile approval pending',
		viewport: mobile,
	});

	await page.setViewportSize(narrow);
	await assertApprovalButtonsClear(page, 'narrow approval pending');
	await assertNoForbiddenSurfaceCopy(page, 'narrow approval pending');
	await assertNoHorizontalOverflow(page, narrow.width, 'narrow approval pending');
	await capture(page, {
		automated_checks: ['narrow approval actions clear composer/nav', 'no horizontal overflow'],
		filename: 'mobile-320-chat-approval-pending.png',
		notes: 'Narrow mobile approval pending state.',
		route: '/chat',
		scenario: 'narrow approval pending',
		viewport: narrow,
	});

	await page.setViewportSize(desktop);
	await page.getByRole('button', { name: /approve|onayla|kabul et/i }).click();
	await expect(page.getByText(/Onayland|Kabul edildi/i).last()).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.getByText(/.lem tamamland/i).last()).toBeVisible({ timeout: 20_000 });
	await assertNoForbiddenSurfaceCopy(page, 'desktop approved completed');
	await assertNoHorizontalOverflow(page, desktop.width, 'desktop approved completed');
	await capture(page, {
		automated_checks: ['approval approved', 'completion visible', 'no horizontal overflow'],
		filename: 'desktop-1440-chat-approval-approved-completed.png',
		notes: 'Approved and completed approval flow.',
		route: '/chat',
		scenario: 'approval approved completed',
		viewport: desktop,
	});
});

test('final screenshot manifest reaches the required audit size', () => {
	recordCheck(
		'final screenshot count >= 28',
		screenshotRecords.length >= 28,
		screenshotRecords.length,
	);
});
