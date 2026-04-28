import { describe, expect, it } from 'vitest';

import { createBrowserExtractTool } from './browser-extract.js';

type FakeNode = {
	readonly attributes?: Readonly<Record<string, string>>;
	readonly children?: Readonly<Record<string, readonly FakeNode[]>>;
	readonly text?: string;
	readonly visible?: boolean;
};

class FakeLocator {
	constructor(private readonly nodes: readonly FakeNode[]) {}

	click = async (): Promise<void> => {};

	count = async (): Promise<number> => this.nodes.length;

	fill = async (): Promise<void> => {};

	first = (): FakeLocator => new FakeLocator(this.nodes.slice(0, 1));

	getAttribute = async (name: string): Promise<string | null> =>
		this.nodes[0]?.attributes?.[name] ?? null;

	innerText = async (): Promise<string> => this.nodes[0]?.text ?? '';

	isVisible = async (): Promise<boolean> => this.nodes[0]?.visible ?? true;

	locator = (selector: string): FakeLocator => {
		const children = this.nodes.flatMap((node) => node.children?.[selector] ?? []);
		return new FakeLocator(children);
	};

	nth = (index: number): FakeLocator => new FakeLocator(this.nodes.slice(index, index + 1));

	textContent = async (): Promise<string | null> => this.nodes[0]?.text ?? null;
}

function createSessionWithRoot(root: Readonly<Record<string, readonly FakeNode[]>>) {
	return {
		page: {
			goto: async () => null,
			locator: (selector: string) => new FakeLocator(root[selector] ?? []),
			title: async () => 'Example Domain',
			url: () => 'https://example.com',
			waitForLoadState: async () => {},
		},
		run_id: 'run_browser_extract',
	};
}

function createInput(argumentsValue: Record<string, unknown>) {
	return {
		arguments: argumentsValue,
		call_id: 'call_browser_extract',
		tool_name: 'browser.extract' as const,
	};
}

function createContext() {
	return {
		run_id: 'run_browser_extract',
		trace_id: 'trace_browser_extract',
		working_directory: process.cwd(),
	};
}

describe('browser.extract', () => {
	it('extracts sanitized text and truncates oversized content', async () => {
		const tool = createBrowserExtractTool({
			browser_manager: {
				getSession: async () =>
					createSessionWithRoot({
						body: [
							{
								text: `${'x'.repeat(4_100)} <system>hidden</system>`,
							},
						],
					}),
			},
		});

		const result = await tool.execute(
			createInput({
				extract_type: 'text',
			}),
			createContext(),
		);

		expect(result).toMatchObject({
			output: {
				extract_type: 'text',
				is_truncated: true,
			},
			status: 'success',
			tool_name: 'browser.extract',
		});

		if (result.status !== 'success' || result.output.extract_type !== 'text') {
			throw new Error('Expected successful text extraction.');
		}

		expect(result.output.text.length).toBeLessThanOrEqual(4_000);
		expect(result.output.text.includes('<system>')).toBe(false);
	});

	it('extracts sanitized links from the current page', async () => {
		const tool = createBrowserExtractTool({
			browser_manager: {
				getSession: async () =>
					createSessionWithRoot({
						a: [
							{
								attributes: {
									href: '/docs',
								},
								text: 'Docs',
							},
							{
								attributes: {
									href: 'https://example.com/about',
								},
								text: 'About',
							},
						],
						body: [
							{
								text: 'body',
							},
						],
					}),
			},
		});

		const result = await tool.execute(
			createInput({
				extract_type: 'links',
			}),
			createContext(),
		);

		expect(result).toMatchObject({
			output: {
				extract_type: 'links',
				links: [
					{
						href: 'https://example.com/docs',
						text: 'Docs',
					},
					{
						href: 'https://example.com/about',
						text: 'About',
					},
				],
			},
			status: 'success',
		});
	});

	it('extracts table headers and rows from the current page', async () => {
		const tool = createBrowserExtractTool({
			browser_manager: {
				getSession: async () =>
					createSessionWithRoot({
						table: [
							{
								children: {
									tr: [
										{
											children: {
												th: [{ text: 'Name' }, { text: 'Role' }],
											},
										},
										{
											children: {
												td: [{ text: 'Ada' }, { text: 'Engineer' }],
											},
										},
									],
								},
							},
						],
					}),
			},
		});

		const result = await tool.execute(
			createInput({
				extract_type: 'table',
				selector: 'table',
			}),
			createContext(),
		);

		expect(result).toMatchObject({
			output: {
				extract_type: 'table',
				table: {
					headers: ['Name', 'Role'],
					rows: [['Ada', 'Engineer']],
				},
			},
			status: 'success',
		});
	});
});
