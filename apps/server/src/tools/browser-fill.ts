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
const MAX_VALUE_LENGTH = 4_000;
const MAX_VISIBLE_ERROR_LENGTH = 240;
const POST_ACTION_WAIT_TIMEOUT_MS = 1_500;

type BrowserFillRiskClass = 'authentication' | 'financial' | 'general';

export type BrowserFillArguments = ToolArguments & {
	readonly selector?: string;
	readonly timeout_ms?: number;
	readonly value?: string;
};

export interface BrowserActionPageObservation {
	readonly navigated: boolean;
	readonly title: string;
	readonly url: string;
	readonly visible_error?: string;
}

export interface BrowserFillSuccessData {
	readonly page: BrowserActionPageObservation;
	readonly selector: string;
	readonly value_length: number;
}

export type BrowserFillInput = ToolCallInput<'browser.fill', BrowserFillArguments>;

export type BrowserFillSuccessResult = ToolResultSuccess<'browser.fill', BrowserFillSuccessData>;

export type BrowserFillErrorResult = ToolResultError<'browser.fill'>;

export type BrowserFillResult = ToolResult<'browser.fill', BrowserFillSuccessData>;

interface BrowserFillDependencies {
	readonly browser_manager?: Pick<typeof defaultBrowserManager, 'getSession'>;
}

function createErrorResult(
	input: BrowserFillInput,
	error_code: BrowserFillErrorResult['error_code'],
	error_message: string,
	details?: BrowserFillErrorResult['details'],
	retryable?: boolean,
): BrowserFillErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'browser.fill',
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

function normalizeValue(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	return value.length <= MAX_VALUE_LENGTH ? value : undefined;
}

function classifyFillRisk(selector: string): Readonly<{
	readonly reasons: readonly string[];
	readonly risk_class: BrowserFillRiskClass;
}> {
	const normalizedSelector = selector.toLocaleLowerCase();
	const reasons: string[] = [];

	if (
		/password|passcode|token|otp|secret|login|sign-in|signin|authorize|auth|username|email/iu.test(
			normalizedSelector,
		)
	) {
		reasons.push('authentication-field');
	}

	if (/card|credit|cvv|iban|routing|billing|payment/iu.test(normalizedSelector)) {
		reasons.push('financial-field');
	}

	if (reasons.includes('financial-field')) {
		return {
			reasons,
			risk_class: 'financial',
		};
	}

	if (reasons.includes('authentication-field')) {
		return {
			reasons,
			risk_class: 'authentication',
		};
	}

	return {
		reasons: reasons.length > 0 ? reasons : ['general-field'],
		risk_class: 'general',
	};
}

function validateInput(input: BrowserFillInput):
	| {
			readonly selector: string;
			readonly timeout_ms: number;
			readonly value: string;
	  }
	| BrowserFillErrorResult {
	const allowedKeys = new Set(['selector', 'timeout_ms', 'value']);

	for (const key of Object.keys(input.arguments)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				`browser.fill does not accept the "${key}" argument.`,
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
			'browser.fill requires a non-empty selector string up to 300 characters.',
			{
				argument: 'selector',
				reason: 'invalid_selector',
			},
			false,
		);
	}

	const value = normalizeValue(input.arguments.value);

	if (value === undefined) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'browser.fill requires a string value up to 4000 characters.',
			{
				argument: 'value',
				reason: 'invalid_value',
			},
			false,
		);
	}

	const timeoutMs = normalizeTimeout(input.arguments.timeout_ms);

	if (!timeoutMs) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'browser.fill timeout_ms must be an integer between 1 and 15000.',
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
		value,
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
	input: BrowserFillInput,
	error: BrowserManagerError,
): BrowserFillErrorResult {
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
			'Browser fill was aborted before a page became available.',
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

export function createBrowserFillTool(
	dependencies: BrowserFillDependencies = {},
): ToolDefinition<BrowserFillInput, BrowserFillResult> {
	const browserManager = dependencies.browser_manager ?? defaultBrowserManager;

	return {
		callable_schema: {
			parameters: {
				selector: {
					description: 'CSS selector for the form control to fill on the current browser page.',
					required: true,
					type: 'string',
				},
				timeout_ms: {
					description: 'Optional fill timeout in milliseconds.',
					type: 'number',
				},
				value: {
					description:
						'String value to write into the field. Returned output never echoes it back.',
					required: true,
					type: 'string',
				},
			},
		},
		description:
			'Fills a form field in the isolated browser context and reports the observed post-fill page state.',
		async execute(input, context): Promise<BrowserFillResult> {
			const validated = validateInput(input);

			if ('status' in validated) {
				return validated;
			}

			const risk = classifyFillRisk(validated.selector);

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
				await locator.fill(validated.value, {
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
						value_length: validated.value.length,
					},
					status: 'success',
					tool_name: 'browser.fill',
				};
			} catch (error: unknown) {
				if (error instanceof BrowserManagerError) {
					return toManagerErrorResult(input, error);
				}

				if (error instanceof Error && error.name === 'TimeoutError') {
					return createErrorResult(
						input,
						'TIMEOUT',
						`Browser fill timed out: ${error.message}`,
						{
							selector: validated.selector,
						},
						true,
					);
				}

				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					error instanceof Error ? `Browser fill failed: ${error.message}` : 'Browser fill failed.',
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
			side_effect_level: 'write',
			tags: ['browser', 'fill', 'approval-required', 'isolated-context'],
		},
		name: 'browser.fill',
		user_label_tr: 'Form doldurma',
		user_summary_tr: 'Sayfa formuna metin doldurulur.',
	};
}

export const browserFillTool = createBrowserFillTool();
