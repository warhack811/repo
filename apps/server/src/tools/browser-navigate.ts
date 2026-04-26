import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

import {
	BrowserManagerError,
	type BrowserSessionHandle,
	type BrowserWaitUntil,
	defaultBrowserManager,
} from './browser-manager.js';
import { evaluateBrowserUrlPolicy } from './browser-url-policy.js';

const DEFAULT_NAVIGATION_TIMEOUT_MS = 15_000;

export type BrowserNavigateArguments = ToolArguments & {
	readonly url?: string;
	readonly wait_until?: BrowserWaitUntil;
};

export interface BrowserNavigateSuccessData {
	readonly title: string;
	readonly url: string;
	readonly wait_until: BrowserWaitUntil;
}

export type BrowserNavigateInput = ToolCallInput<'browser.navigate', BrowserNavigateArguments>;

export type BrowserNavigateSuccessResult = ToolResultSuccess<
	'browser.navigate',
	BrowserNavigateSuccessData
>;

export type BrowserNavigateErrorResult = ToolResultError<'browser.navigate'>;

export type BrowserNavigateResult = ToolResult<'browser.navigate', BrowserNavigateSuccessData>;

interface BrowserNavigateDependencies {
	readonly browser_manager?: Pick<typeof defaultBrowserManager, 'getSession'>;
	readonly evaluate_url_policy?: typeof evaluateBrowserUrlPolicy;
}

function createErrorResult(
	input: BrowserNavigateInput,
	error_code: BrowserNavigateErrorResult['error_code'],
	error_message: string,
	details?: BrowserNavigateErrorResult['details'],
	retryable?: boolean,
): BrowserNavigateErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'browser.navigate',
	};
}

function normalizeWaitUntil(value: unknown): BrowserWaitUntil | undefined {
	if (value === undefined) {
		return 'load';
	}

	if (value === 'domcontentloaded' || value === 'load' || value === 'networkidle') {
		return value;
	}

	return undefined;
}

function validateInput(input: BrowserNavigateInput):
	| {
			readonly url: string;
			readonly wait_until: BrowserWaitUntil;
	  }
	| BrowserNavigateErrorResult {
	const allowedKeys = new Set(['url', 'wait_until']);

	for (const key of Object.keys(input.arguments)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				`browser.navigate does not accept the "${key}" argument.`,
				{
					argument: key,
					reason: 'unexpected_argument',
				},
				false,
			);
		}
	}

	if (typeof input.arguments.url !== 'string' || input.arguments.url.trim().length === 0) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'browser.navigate requires a non-empty url string.',
			{
				argument: 'url',
				reason: 'invalid_url',
			},
			false,
		);
	}

	const waitUntil = normalizeWaitUntil(input.arguments.wait_until);

	if (!waitUntil) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'browser.navigate wait_until must be one of: load, domcontentloaded, networkidle.',
			{
				argument: 'wait_until',
				reason: 'invalid_wait_until',
			},
			false,
		);
	}

	return {
		url: input.arguments.url.trim(),
		wait_until: waitUntil,
	};
}

function toManagerErrorResult(
	input: BrowserNavigateInput,
	error: BrowserManagerError,
): BrowserNavigateErrorResult {
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
			'Browser navigation was aborted before the page became available.',
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

async function navigateSession(
	session: BrowserSessionHandle,
	url: string,
	waitUntil: BrowserWaitUntil,
): Promise<BrowserNavigateSuccessData> {
	await session.page.goto(url, {
		timeout: DEFAULT_NAVIGATION_TIMEOUT_MS,
		waitUntil,
	});

	return {
		title: await session.page.title(),
		url: session.page.url(),
		wait_until: waitUntil,
	};
}

export function createBrowserNavigateTool(
	dependencies: BrowserNavigateDependencies = {},
): ToolDefinition<BrowserNavigateInput, BrowserNavigateResult> {
	const browserManager = dependencies.browser_manager ?? defaultBrowserManager;
	const evaluateUrlPolicy = dependencies.evaluate_url_policy ?? evaluateBrowserUrlPolicy;

	return {
		callable_schema: {
			parameters: {
				url: {
					description: 'Absolute http or https URL to open in the isolated browser context.',
					required: true,
					type: 'string',
				},
				wait_until: {
					description: 'Playwright wait condition for the initial navigation.',
					type: 'string',
				},
			},
		},
		description:
			'Navigates an isolated browser context to a public http/https page using a run-scoped session.',
		async execute(input, context): Promise<BrowserNavigateResult> {
			const validated = validateInput(input);

			if ('status' in validated) {
				return validated;
			}

			const urlPolicy = await evaluateUrlPolicy(validated.url);

			if (urlPolicy.status === 'blocked') {
				return createErrorResult(
					input,
					'PERMISSION_DENIED',
					urlPolicy.detail,
					{
						reason: urlPolicy.reason,
						url: validated.url,
					},
					false,
				);
			}

			try {
				const session = await browserManager.getSession({
					run_id: context.run_id,
					signal: context.signal,
				});
				const output = await navigateSession(
					session,
					urlPolicy.normalized_url,
					validated.wait_until,
				);

				return {
					call_id: input.call_id,
					metadata: {
						isolated_context: true,
						wait_until: validated.wait_until,
					},
					output,
					status: 'success',
					tool_name: 'browser.navigate',
				};
			} catch (error: unknown) {
				if (error instanceof BrowserManagerError) {
					return toManagerErrorResult(input, error);
				}

				if (error instanceof Error && error.name === 'TimeoutError') {
					return createErrorResult(
						input,
						'TIMEOUT',
						`Browser navigation timed out: ${error.message}`,
						{
							url: validated.url,
						},
						true,
					);
				}

				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					error instanceof Error
						? `Browser navigation failed: ${error.message}`
						: 'Browser navigation failed.',
					{
						url: validated.url,
					},
					true,
				);
			}
		},
		metadata: {
			capability_class: 'browser',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			tags: ['browser', 'isolated-context', 'navigate', 'read-only'],
		},
		name: 'browser.navigate',
	};
}

export const browserNavigateTool = createBrowserNavigateTool();
