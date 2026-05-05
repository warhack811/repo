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
	type ManagedBrowserLocator,
	defaultBrowserManager,
} from './browser-manager.js';

const DEFAULT_SELECTOR = 'body';
const EXTRACT_TIMEOUT_MS = 5_000;
const MAX_LINK_COUNT = 20;
const MAX_ROW_COUNT = 20;
const MAX_CELL_COUNT = 10;
const MAX_TEXT_LENGTH = 4_000;
const MAX_TITLE_LENGTH = 200;
const MAX_URL_LENGTH = 400;
const MAX_SELECTOR_LENGTH = 300;

export type BrowserExtractType = 'links' | 'table' | 'text';

export type BrowserExtractArguments = ToolArguments & {
	readonly extract_type?: BrowserExtractType;
	readonly selector?: string;
};

export interface BrowserExtractLinkItem {
	readonly href: string;
	readonly text: string;
}

export interface BrowserExtractTableData {
	readonly headers: readonly string[];
	readonly rows: readonly (readonly string[])[];
}

export type BrowserExtractSuccessData =
	| {
			readonly extract_type: 'links';
			readonly is_truncated: boolean;
			readonly links: readonly BrowserExtractLinkItem[];
			readonly selector?: string;
	  }
	| {
			readonly extract_type: 'table';
			readonly is_truncated: boolean;
			readonly selector?: string;
			readonly table: BrowserExtractTableData;
	  }
	| {
			readonly extract_type: 'text';
			readonly is_truncated: boolean;
			readonly selector?: string;
			readonly text: string;
	  };

export type BrowserExtractInput = ToolCallInput<'browser.extract', BrowserExtractArguments>;

export type BrowserExtractSuccessResult = ToolResultSuccess<
	'browser.extract',
	BrowserExtractSuccessData
>;

export type BrowserExtractErrorResult = ToolResultError<'browser.extract'>;

export type BrowserExtractResult = ToolResult<'browser.extract', BrowserExtractSuccessData>;

interface BrowserExtractDependencies {
	readonly browser_manager?: Pick<typeof defaultBrowserManager, 'getSession'>;
}

function createErrorResult(
	input: BrowserExtractInput,
	error_code: BrowserExtractErrorResult['error_code'],
	error_message: string,
	details?: BrowserExtractErrorResult['details'],
	retryable?: boolean,
): BrowserExtractErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'browser.extract',
	};
}

function normalizeSelector(selector: unknown): string | undefined {
	if (selector === undefined) {
		return undefined;
	}

	if (typeof selector !== 'string') {
		return undefined;
	}

	const normalizedSelector = selector.trim();

	if (normalizedSelector.length === 0 || normalizedSelector.length > MAX_SELECTOR_LENGTH) {
		return undefined;
	}

	return normalizedSelector;
}

function truncateText(
	value: string,
	maxLength: number,
): { readonly text: string; readonly truncated: boolean } {
	const sanitized = sanitizePromptContent(value.trim());

	if (sanitized.length <= maxLength) {
		return {
			text: sanitized,
			truncated: false,
		};
	}

	return {
		text: `${sanitized.slice(0, maxLength - 3)}...`,
		truncated: true,
	};
}

function validateInput(input: BrowserExtractInput):
	| {
			readonly extract_type: BrowserExtractType;
			readonly selector?: string;
	  }
	| BrowserExtractErrorResult {
	const allowedKeys = new Set(['extract_type', 'selector']);

	for (const key of Object.keys(input.arguments)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				`browser.extract does not accept the "${key}" argument.`,
				{
					argument: key,
					reason: 'unexpected_argument',
				},
				false,
			);
		}
	}

	const extractType = input.arguments.extract_type;

	if (extractType !== 'text' && extractType !== 'links' && extractType !== 'table') {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'browser.extract extract_type must be one of: text, links, table.',
			{
				argument: 'extract_type',
				reason: 'invalid_extract_type',
			},
			false,
		);
	}

	const selector = normalizeSelector(input.arguments.selector);

	if (input.arguments.selector !== undefined && selector === undefined) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'browser.extract selector must be a non-empty string up to 300 characters.',
			{
				argument: 'selector',
				reason: 'invalid_selector',
			},
			false,
		);
	}

	return {
		extract_type: extractType,
		selector,
	};
}

function toManagerErrorResult(
	input: BrowserExtractInput,
	error: BrowserManagerError,
): BrowserExtractErrorResult {
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
			'Browser extraction was aborted before a page became available.',
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

function isBlankPage(url: string): boolean {
	return url === 'about:blank' || url === '';
}

async function assertNavigatedPage(
	input: BrowserExtractInput,
	pageUrl: string,
): Promise<BrowserExtractErrorResult | undefined> {
	if (!isBlankPage(pageUrl)) {
		return undefined;
	}

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

async function ensureLocatorExists(
	input: BrowserExtractInput,
	locator: ManagedBrowserLocator,
	selector: string,
): Promise<BrowserExtractErrorResult | undefined> {
	if ((await locator.count()) > 0) {
		return undefined;
	}

	return createErrorResult(
		input,
		'NOT_FOUND',
		`No element matched selector: ${selector}`,
		{
			reason: 'selector_not_found',
			selector,
		},
		false,
	);
}

async function extractText(
	locator: ManagedBrowserLocator,
	selector: string | undefined,
): Promise<BrowserExtractSuccessData> {
	const text = truncateText(
		await locator.innerText({ timeout: EXTRACT_TIMEOUT_MS }),
		MAX_TEXT_LENGTH,
	);

	return {
		extract_type: 'text',
		is_truncated: text.truncated,
		selector,
		text: text.text,
	};
}

async function extractLinks(
	locator: ManagedBrowserLocator,
	pageUrl: string,
	selector: string | undefined,
): Promise<BrowserExtractSuccessData> {
	const links: BrowserExtractLinkItem[] = [];
	let isTruncated = false;
	const linkLocator = selector ? locator.locator('a') : locator;

	if (selector) {
		const href = await locator.getAttribute('href', { timeout: EXTRACT_TIMEOUT_MS });

		if (href) {
			const resolvedUrl = truncateText(new URL(href, pageUrl).toString(), MAX_URL_LENGTH);
			const linkText = truncateText(
				(await locator.textContent({ timeout: EXTRACT_TIMEOUT_MS })) ?? '',
				MAX_TITLE_LENGTH,
			);
			links.push({
				href: resolvedUrl.text,
				text: linkText.text,
			});
			isTruncated = resolvedUrl.truncated || linkText.truncated;
		}
	}

	const count = await linkLocator.count();

	for (let index = 0; index < count; index += 1) {
		if (links.length >= MAX_LINK_COUNT) {
			isTruncated = true;
			break;
		}

		const link = linkLocator.nth(index);
		const href = await link.getAttribute('href', { timeout: EXTRACT_TIMEOUT_MS });

		if (!href) {
			continue;
		}

		const resolvedUrl = truncateText(new URL(href, pageUrl).toString(), MAX_URL_LENGTH);
		const linkText = truncateText(
			(await link.textContent({ timeout: EXTRACT_TIMEOUT_MS })) ?? '',
			MAX_TITLE_LENGTH,
		);

		links.push({
			href: resolvedUrl.text,
			text: linkText.text,
		});
		isTruncated ||= resolvedUrl.truncated || linkText.truncated;
	}

	return {
		extract_type: 'links',
		is_truncated: isTruncated,
		links,
		selector,
	};
}

async function extractTable(
	locator: ManagedBrowserLocator,
	selector: string | undefined,
): Promise<BrowserExtractSuccessData> {
	const rowsLocator = locator.locator('tr');
	const rowCount = await rowsLocator.count();
	const rows: string[][] = [];
	const headers: string[] = [];
	let isTruncated = rowCount > MAX_ROW_COUNT;

	for (let rowIndex = 0; rowIndex < Math.min(rowCount, MAX_ROW_COUNT); rowIndex += 1) {
		const row = rowsLocator.nth(rowIndex);
		const headerCells = row.locator('th');
		const dataCells = row.locator('td');
		const headerCount = await headerCells.count();
		const dataCount = await dataCells.count();

		if (rowIndex === 0 && headerCount > 0) {
			isTruncated ||= headerCount > MAX_CELL_COUNT;

			for (let cellIndex = 0; cellIndex < Math.min(headerCount, MAX_CELL_COUNT); cellIndex += 1) {
				const headerText = truncateText(
					await headerCells.nth(cellIndex).innerText({ timeout: EXTRACT_TIMEOUT_MS }),
					MAX_TITLE_LENGTH,
				);
				headers.push(headerText.text);
				isTruncated ||= headerText.truncated;
			}

			continue;
		}

		const cells: string[] = [];
		const targetCells = dataCount > 0 ? dataCells : headerCells;
		const targetCount = dataCount > 0 ? dataCount : headerCount;
		isTruncated ||= targetCount > MAX_CELL_COUNT;

		for (let cellIndex = 0; cellIndex < Math.min(targetCount, MAX_CELL_COUNT); cellIndex += 1) {
			const cellText = truncateText(
				await targetCells.nth(cellIndex).innerText({ timeout: EXTRACT_TIMEOUT_MS }),
				MAX_TITLE_LENGTH,
			);
			cells.push(cellText.text);
			isTruncated ||= cellText.truncated;
		}

		rows.push(cells);
	}

	return {
		extract_type: 'table',
		is_truncated: isTruncated,
		selector,
		table: {
			headers,
			rows,
		},
	};
}

export function createBrowserExtractTool(
	dependencies: BrowserExtractDependencies = {},
): ToolDefinition<BrowserExtractInput, BrowserExtractResult> {
	const browserManager = dependencies.browser_manager ?? defaultBrowserManager;

	return {
		callable_schema: {
			parameters: {
				extract_type: {
					description: 'Text, links, or table extraction mode for the current browser page.',
					required: true,
					type: 'string',
				},
				selector: {
					description: 'Optional CSS selector scoping the extraction target.',
					type: 'string',
				},
			},
		},
		description:
			'Extracts sanitized text, links, or table data from the current isolated browser page.',
		async execute(input, context): Promise<BrowserExtractResult> {
			const validated = validateInput(input);

			if ('status' in validated) {
				return validated;
			}

			try {
				const session = await browserManager.getSession({
					run_id: context.run_id,
					signal: context.signal,
				});
				const blankPageError = await assertNavigatedPage(input, session.page.url());

				if (blankPageError) {
					return blankPageError;
				}

				const effectiveSelector = validated.selector ?? DEFAULT_SELECTOR;
				const locator = session.page.locator(effectiveSelector).first();
				const missingLocatorError = await ensureLocatorExists(input, locator, effectiveSelector);

				if (missingLocatorError) {
					return missingLocatorError;
				}

				const output =
					validated.extract_type === 'text'
						? await extractText(locator, validated.selector)
						: validated.extract_type === 'links'
							? await extractLinks(
									validated.selector ? locator : session.page.locator('a'),
									session.page.url(),
									validated.selector,
								)
							: await extractTable(locator, validated.selector);

				return {
					call_id: input.call_id,
					output,
					status: 'success',
					tool_name: 'browser.extract',
				};
			} catch (error: unknown) {
				if (error instanceof BrowserManagerError) {
					return toManagerErrorResult(input, error);
				}

				if (error instanceof Error && error.name === 'TimeoutError') {
					return createErrorResult(
						input,
						'TIMEOUT',
						`Browser extraction timed out: ${error.message}`,
						undefined,
						true,
					);
				}

				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					error instanceof Error
						? `Browser extraction failed: ${error.message}`
						: 'Browser extraction failed.',
					undefined,
					true,
				);
			}
		},
		metadata: {
			capability_class: 'browser',
			narration_policy: 'optional',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			tags: ['browser', 'extract', 'read-only', 'sanitize', 'truncate'],
		},
		name: 'browser.extract',
	};
}

export const browserExtractTool = createBrowserExtractTool();
