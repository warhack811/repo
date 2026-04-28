import { describe, expect, it } from 'vitest';

import { createBrowserClickTool } from './browser-click.js';

class FakeLocator {
	constructor(
		private readonly state: {
			count: number;
			error_text?: string;
			text?: string;
			visible?: boolean;
		},
		private readonly onClick?: () => void,
	) {}

	click = async (): Promise<void> => {
		this.onClick?.();
	};

	count = async (): Promise<number> => this.state.count;

	fill = async (): Promise<void> => {};

	first = (): FakeLocator => this;

	getAttribute = async (): Promise<string | null> => null;

	innerText = async (): Promise<string> => this.state.text ?? '';

	isVisible = async (): Promise<boolean> => this.state.visible ?? true;

	locator = (): FakeLocator => new FakeLocator({ count: 0 });

	nth = (): FakeLocator => this;

	textContent = async (): Promise<string | null> =>
		this.state.error_text ?? this.state.text ?? null;
}

function createPage() {
	let currentUrl = 'https://example.com/login';
	let currentTitle = 'Login';

	return {
		page: {
			goto: async () => null,
			locator: (selector: string) => {
				if (selector === 'button[type="submit"]') {
					return new FakeLocator(
						{
							count: 1,
						},
						() => {
							currentUrl = 'https://example.com/dashboard';
							currentTitle = 'Dashboard';
						},
					);
				}

				if (selector === '[role="alert"]') {
					return new FakeLocator({
						count: 1,
						error_text: 'Wrong password',
						visible: true,
					});
				}

				return new FakeLocator({ count: 0 });
			},
			title: async () => currentTitle,
			url: () => currentUrl,
			waitForLoadState: async () => {},
		},
		run_id: 'run_browser_click',
	};
}

function createInput(argumentsValue: Record<string, unknown>) {
	return {
		arguments: argumentsValue,
		call_id: 'call_browser_click',
		tool_name: 'browser.click' as const,
	};
}

function createContext() {
	return {
		run_id: 'run_browser_click',
		trace_id: 'trace_browser_click',
		working_directory: process.cwd(),
	};
}

describe('browser.click', () => {
	it('returns page-state observations and approval-risk metadata', async () => {
		const tool = createBrowserClickTool({
			browser_manager: {
				getSession: async () => createPage(),
			},
		});

		const result = await tool.execute(
			createInput({
				selector: 'button[type="submit"]',
			}),
			createContext(),
		);

		expect(result).toMatchObject({
			metadata: {
				action_risk: {
					requires_approval: true,
				},
			},
			output: {
				page: {
					navigated: true,
					title: 'Dashboard',
					url: 'https://example.com/dashboard',
					visible_error: 'Wrong password',
				},
				selector: 'button[type="submit"]',
			},
			status: 'success',
		});
	});

	it('returns selector_not_found when no element matches', async () => {
		const tool = createBrowserClickTool({
			browser_manager: {
				getSession: async () => ({
					page: {
						goto: async () => null,
						locator: () => new FakeLocator({ count: 0 }),
						title: async () => 'Example',
						url: () => 'https://example.com',
						waitForLoadState: async () => {},
					},
					run_id: 'run_browser_click',
				}),
			},
		});

		const result = await tool.execute(
			createInput({
				selector: '.missing',
			}),
			createContext(),
		);

		expect(result).toMatchObject({
			details: {
				reason: 'selector_not_found',
				selector: '.missing',
			},
			error_code: 'NOT_FOUND',
			status: 'error',
		});
	});
});
