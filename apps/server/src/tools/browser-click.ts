import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

import { sanitizePromptContent } from '../utils/sanitize-prompt-content.js';
import {
	BrowserManagerError,
	type ManagedBrowserPage,
	defaultBrowserManager,
} from './browser-manager.js';

const DEFAULT_ACTION_TIMEOUT_MS = 5_000;
const MAX_SELECTOR_LENGTH = 300;
const MAX_VISIBLE_ERROR_LENGTH = 240;
const POST_ACTION_WAIT_TIMEOUT_MS = 1_500;

type BrowserClickRiskClass = 'authentication' | 'destructive' | 'financial' | 'general';

export type BrowserClickArguments = ToolArguments & {
	readonly selector?: string;
	readonly timeout_ms?: number;
};

export interface BrowserActionPageObservation {
	readonly navigated: boolean;
	readonly title: string;
	readonly url: string;
	readonly visible_error?: string;
}

export interface BrowserClickSuccessData {
	readonly page: BrowserActionPageObservation;
	readonly selector: string;
}

export type BrowserClickInput = ToolCallInput<'browser.click', BrowserClickArguments>;

export type BrowserClickSuccessResult = ToolResultSuccess<'browser.click', BrowserClickSuccessData>;

export type BrowserClickErrorResult = ToolResultError<'browser.click'>;

export type BrowserClickResult = ToolResult<'browser.click', BrowserClickSuccessData>;

interface BrowserClickDependencies {
	readonly browser_manager?: Pick<typeof defaultBrowserManager, 'getSession'>;
}

function createErrorResult(
	input: BrowserClickInput,
	error_code: BrowserClickErrorResult['error_code'],
	error_message: string,
	details?: BrowserClickErrorResult['details'],
	retryable?: boolean,
): BrowserClickErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'browser.click',
	};
}

function normalizeTimeout(value: unknown): number | undefined {
	if (value === undefined) {
		return DEFAULT_ACTION_TIMEOUT_MS;
	}

	return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 15_000
		? value
		: undefined;
}

function normalizeSelector(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const normalizedSelector = value.trim();

	if (normalizedSelector.length === 0 || normalizedSelector.length > MAX_SELECTOR_LENGTH) {
		return undefined;
	}

	return normalizedSelector;
}

function classifyClickRisk(selector: string): Readonly<{
	readonly reasons: readonly string[];
	readonly risk_class: BrowserClickRiskClass;
}> {
	const normalizedSelector = selector.toLocaleLowerCase();
	const reasons: string[] = [];

	if (
		/password|passcode|token|otp|secret|login|sign-in|signin|authorize|auth/iu.test(
			normalizedSelector,
		)
	) {
		reasons.push('authentication-surface');
	}

	if (/delete|remove|destroy|trash|logout|sign-out|signout|confirm/iu.test(normalizedSelector)) {
		reasons.push('destructive-surface');
	}

	if (/buy|purchase|pay|checkout|order|billing|subscribe/iu.test(normalizedSelector)) {
		reasons.push('financial-surface');
	}

	if (reasons.includes('financial-surface')) {
		return {
			reasons,
			risk_class: 'financial',
		};
	}

	if (reasons.includes('destructive-surface')) {
		return {
			reasons,
			risk_class: 'destructive',
		};
	}

	if (reasons.includes('authentication-surface')) {
		return {
			reasons,
			risk_class: 'authentication',
		};
	}

	return {
		reasons: reasons.length > 0 ? reasons : ['general-action'],
		risk_class: 'general',
	};
}

function validateInput(input: BrowserClickInput):
	| {
			readonly selector: string;
			readonly timeout_ms: number;
	  }
	| BrowserClickErrorResult {
	const allowedKeys = new Set(['selector', 'timeout_ms']);

	for (const key of Object.keys(input.arguments)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				`browser.click does not accept the "${key}" argument.`,
				{
					argument: key,
					reason: 'unexpected_argument',
				},
				false,
			);
		}
	}

	const selector = normalizeSelector(input.arguments.selector);

	if (!selector) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'browser.click requires a non-empty selector string up to 300 characters.',
			{
				argument: 'selector',
				reason: 'invalid_selector',
			},
			false,
		);
	}

	const timeoutMs = normalizeTimeout(input.arguments.timeout_ms);

	if (!timeoutMs) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'browser.click timeout_ms must be an integer between 1 and 15000.',
			{
				argument: 'timeout_ms',
				reason: 'invalid_timeout_ms',
			},
			false,
		);
	}

	return {
		selector,
		timeout_ms: timeoutMs,
	};
}

function isBlankPage(url: string): boolean {
	return url === '' || url === 'about:blank';
}

async function readVisibleError(page: ManagedBrowserPage): Promise<string | undefined> {
	const candidates = [
		'[role="alert"]',
		'.error',
		'.alert-error',
		'.flash-error',
		'[data-error]',
	] as const;

	for (const selector of candidates) {
		const locator = page.locator(selector).first();
		const count = await locator.count();

		if (count < 1) {
			continue;
		}

		const isVisible = await locator.isVisible({ timeout: 200 });

		if (!isVisible) {
			continue;
		}

		const textContent = await locator.textContent({ timeout: 200 });

		if (!textContent) {
			continue;
		}

		const sanitized = sanitizePromptContent(textContent.trim());

		if (sanitized.length <= MAX_VISIBLE_ERROR_LENGTH) {
			return sanitized;
		}

		return `${sanitized.slice(0, MAX_VISIBLE_ERROR_LENGTH - 3)}...`;
	}

	return undefined;
}

async function observePageState(
	page: ManagedBrowserPage,
	beforeUrl: string,
	beforeTitle: string,
): Promise<BrowserActionPageObservation> {
	try {
		await page.waitForLoadState('domcontentloaded', {
			timeout: POST_ACTION_WAIT_TIMEOUT_MS,
		});
	} catch {
		// Best effort observation only.
	}

	const title = await page.title();
	const url = page.url();

	return {
		navigated: beforeUrl !== url || beforeTitle !== title,
		title,
		url,
		visible_error: await readVisibleError(page),
	};
}

function toManagerErrorResult(
	input: BrowserClickInput,
	error: BrowserManagerError,
): BrowserClickErrorResult {
	if (error.reason === 'browser_binary_unavailable') {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			'Browser automation is unavailable because no Chromium binary is installed.',
			{
				reason: 'browser_binary_unavailable',
			},
			true,
		);
	}

	if (error.reason === 'browser_session_aborted') {
		return createErrorResult(
			input,
			'TIMEOUT',
			'Browser click was aborted before a page became available.',
			{
				reason: 'browser_session_aborted',
			},
			true,
		);
	}

	return createErrorResult(
		input,
		'EXECUTION_FAILED',
		error.message,
		{
			reason: error.reason,
		},
		true,
	);
}

export function createBrowserClickTool(
	dependencies: BrowserClickDependencies = {},
): ToolDefinition<BrowserClickInput, BrowserClickResult> {
	const browserManager = dependencies.browser_manager ?? defaultBrowserManager;

	return {
		callable_schema: {
			parameters: {
				selector: {
					description: 'CSS selector for the element to click on the current browser page.',
					required: true,
					type: 'string',
				},
				timeout_ms: {
					description: 'Optional click timeout in milliseconds.',
					type: 'number',
				},
			},
		},
		description:
			'Clicks an element in the isolated browser context and reports the observed post-click page state.',
		async execute(input, context): Promise<BrowserClickResult> {
			const validated = validateInput(input);

			if ('status' in validated) {
				return validated;
			}

			const risk = classifyClickRisk(validated.selector);

			try {
				const session = await browserManager.getSession({
					run_id: context.run_id,
					signal: context.signal,
				});
				const pageUrl = session.page.url();

				if (isBlankPage(pageUrl)) {
					return createErrorResult(
						input,
						'EXECUTION_FAILED',
						'No navigated browser page is available for this run yet.',
						{
							reason: 'browser_page_not_initialized',
						},
						false,
					);
				}

				const locator = session.page.locator(validated.selector).first();

				if ((await locator.count()) < 1) {
					return createErrorResult(
						input,
						'NOT_FOUND',
						`No element matched selector: ${validated.selector}`,
						{
							reason: 'selector_not_found',
							selector: validated.selector,
						},
						false,
					);
				}

				const beforeTitle = await session.page.title();
				await locator.click({
					timeout: validated.timeout_ms,
				});
				const pageObservation = await observePageState(session.page, pageUrl, beforeTitle);

				return {
					call_id: input.call_id,
					metadata: {
						action_risk: {
							reasons: risk.reasons,
							requires_approval: true,
							risk_class: risk.risk_class,
						},
					},
					output: {
						page: pageObservation,
						selector: validated.selector,
					},
					status: 'success',
					tool_name: 'browser.click',
				};
			} catch (error: unknown) {
				if (error instanceof BrowserManagerError) {
					return toManagerErrorResult(input, error);
				}

				if (error instanceof Error && error.name === 'TimeoutError') {
					return createErrorResult(
						input,
						'TIMEOUT',
						`Browser click timed out: ${error.message}`,
						{
							selector: validated.selector,
						},
						true,
					);
				}

				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					error instanceof Error
						? `Browser click failed: ${error.message}`
						: 'Browser click failed.',
					{
						selector: validated.selector,
					},
					true,
				);
			}
		},
		metadata: {
			capability_class: 'browser',
			narration_policy: 'required',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'execute',
			tags: ['browser', 'click', 'approval-required', 'isolated-context'],
		},
		name: 'browser.click',
		user_label_tr: 'Tarayici tiklamasi',
		user_summary_tr: 'Sayfada bir ogeye tiklanir.',
	};
}

export const browserClickTool = createBrowserClickTool();
