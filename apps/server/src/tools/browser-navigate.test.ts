import { describe, expect, it } from 'vitest';

import { BrowserManagerError } from './browser-manager.js';
import { createBrowserNavigateTool } from './browser-navigate.js';

function createInput(argumentsValue: Record<string, unknown>) {
	return {
		arguments: argumentsValue,
		call_id: 'call_browser_navigate',
		tool_name: 'browser.navigate' as const,
	};
}

function createContext() {
	return {
		run_id: 'run_browser_navigate',
		trace_id: 'trace_browser_navigate',
		working_directory: process.cwd(),
	};
}

describe('browser.navigate', () => {
	it('navigates a public URL through an isolated browser session', async () => {
		let currentUrl = 'about:blank';
		const tool = createBrowserNavigateTool({
			browser_manager: {
				getSession: async () => ({
					page: {
						goto: async (url) => {
							currentUrl = url;
							return null;
						},
						locator: () => {
							throw new Error('not implemented');
						},
						title: async () => 'Example Domain',
						url: () => currentUrl,
						waitForLoadState: async () => {},
					},
					run_id: 'run_browser_navigate',
				}),
			},
			evaluate_url_policy: async (url) => ({
				normalized_url: `${url}/`,
				status: 'allowed',
			}),
		});

		const result = await tool.execute(
			createInput({
				url: 'https://example.com',
				wait_until: 'domcontentloaded',
			}),
			createContext(),
		);

		expect(result).toMatchObject({
			metadata: {
				isolated_context: true,
				wait_until: 'domcontentloaded',
			},
			output: {
				title: 'Example Domain',
				url: 'https://example.com/',
				wait_until: 'domcontentloaded',
			},
			status: 'success',
			tool_name: 'browser.navigate',
		});
	});

	it('blocks dangerous or private URLs through the policy gate', async () => {
		const tool = createBrowserNavigateTool({
			browser_manager: {
				getSession: async () => {
					throw new Error('should not execute');
				},
			},
			evaluate_url_policy: async () => ({
				detail: 'Local or private network targets are blocked: localhost.',
				reason: 'local_network',
				status: 'blocked',
			}),
		});

		const result = await tool.execute(
			createInput({
				url: 'http://localhost:3000',
				wait_until: 'load',
			}),
			createContext(),
		);

		expect(result).toMatchObject({
			details: {
				reason: 'local_network',
				url: 'http://localhost:3000',
			},
			error_code: 'PERMISSION_DENIED',
			status: 'error',
			tool_name: 'browser.navigate',
		});
	});

	it('returns a typed browser_binary_unavailable error when no browser binary exists', async () => {
		const tool = createBrowserNavigateTool({
			browser_manager: {
				getSession: async () => {
					throw new BrowserManagerError(
						'browser_binary_unavailable',
						'No Chromium browser binary is available for browser automation.',
					);
				},
			},
			evaluate_url_policy: async (url) => ({
				normalized_url: url,
				status: 'allowed',
			}),
		});

		const result = await tool.execute(
			createInput({
				url: 'https://example.com',
			}),
			createContext(),
		);

		expect(result).toMatchObject({
			details: {
				reason: 'browser_binary_unavailable',
			},
			error_code: 'EXECUTION_FAILED',
			status: 'error',
			tool_name: 'browser.navigate',
		});
	});
});
