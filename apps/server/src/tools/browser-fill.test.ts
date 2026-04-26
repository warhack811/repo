import { describe, expect, it } from 'vitest';

import { createBrowserFillTool } from './browser-fill.js';

class FakeLocator {
	filledValue = '';

	constructor(
		private readonly state: {
			count: number;
			error_text?: string;
			visible?: boolean;
		},
	) {}

	click = async (): Promise<void> => {};

	count = async (): Promise<number> => this.state.count;

	fill = async (value: string): Promise<void> => {
		this.filledValue = value;
	};

	first = (): FakeLocator => this;

	getAttribute = async (): Promise<string | null> => null;

	innerText = async (): Promise<string> => '';

	isVisible = async (): Promise<boolean> => this.state.visible ?? true;

	locator = (): FakeLocator => new FakeLocator({ count: 0 });

	nth = (): FakeLocator => this;

	textContent = async (): Promise<string | null> => this.state.error_text ?? null;
}

function createInput(argumentsValue: Record<string, unknown>) {
	return {
		arguments: argumentsValue,
		call_id: 'call_browser_fill',
		tool_name: 'browser.fill' as const,
	};
}

function createContext() {
	return {
		run_id: 'run_browser_fill',
		trace_id: 'trace_browser_fill',
		working_directory: process.cwd(),
	};
}

describe('browser.fill', () => {
	it('returns approval-risk metadata without echoing the raw filled value', async () => {
		const fieldLocator = new FakeLocator({ count: 1 });
		const tool = createBrowserFillTool({
			browser_manager: {
				getSession: async () => ({
					page: {
						goto: async () => null,
						locator: (selector: string) => {
							if (selector === 'input[name="password"]') {
								return fieldLocator;
							}

							if (selector === '[role="alert"]') {
								return new FakeLocator({
									count: 1,
									error_text: 'Validation failed',
									visible: true,
								});
							}

							return new FakeLocator({ count: 0 });
						},
						title: async () => 'Login',
						url: () => 'https://example.com/login',
						waitForLoadState: async () => {},
					},
					run_id: 'run_browser_fill',
				}),
			},
		});

		const result = await tool.execute(
			createInput({
				selector: 'input[name="password"]',
				value: 'super-secret-password',
			}),
			createContext(),
		);

		expect(result).toMatchObject({
			metadata: {
				action_risk: {
					reasons: expect.arrayContaining(['authentication-field']),
					requires_approval: true,
					risk_class: 'authentication',
				},
			},
			output: {
				page: {
					navigated: false,
					title: 'Login',
					url: 'https://example.com/login',
					visible_error: 'Validation failed',
				},
				selector: 'input[name="password"]',
				value_length: 'super-secret-password'.length,
			},
			status: 'success',
		});

		if (result.status !== 'success') {
			throw new Error('Expected successful fill.');
		}

		expect(JSON.stringify(result.output)).not.toContain('super-secret-password');
		expect(fieldLocator.filledValue).toBe('super-secret-password');
	});

	it('rejects invalid selector input', async () => {
		const tool = createBrowserFillTool({
			browser_manager: {
				getSession: async () => {
					throw new Error('should not execute');
				},
			},
		});

		const result = await tool.execute(
			createInput({
				selector: '',
				value: 'x',
			}),
			createContext(),
		);

		expect(result).toMatchObject({
			details: {
				argument: 'selector',
				reason: 'invalid_selector',
			},
			error_code: 'INVALID_INPUT',
			status: 'error',
		});
	});
});
