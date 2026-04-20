import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDesktopScreenshotTool, desktopScreenshotTool } from './desktop-screenshot.js';
import { ToolRegistry, createBuiltInToolRegistry } from './registry.js';

function createInput(argumentsValue: Record<string, unknown> = {}) {
	return {
		arguments: argumentsValue,
		call_id: 'call_desktop_screenshot',
		tool_name: 'desktop.screenshot' as const,
	};
}

function createContext() {
	return {
		run_id: 'run_desktop_screenshot',
		trace_id: 'trace_desktop_screenshot',
		working_directory: process.cwd(),
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('desktopScreenshotTool', () => {
	it('returns base64-encoded png data from a captured buffer', async () => {
		const screenshotBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 102, 97, 107, 101]);
		const tool = createDesktopScreenshotTool({
			capture: vi.fn(async () => screenshotBuffer),
		});

		const result = await tool.execute(createInput(), createContext());

		expect(result.status).toBe('success');

		if (result.status !== 'success') {
			throw new Error('Expected desktop.screenshot to succeed.');
		}

		expect(result.output).toEqual({
			base64_data: screenshotBuffer.toString('base64'),
			byte_length: screenshotBuffer.byteLength,
			format: 'png',
			mime_type: 'image/png',
		});
	});

	it('hydrates a file-backed capture path into base64 output', async () => {
		const screenshotBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 102, 105, 108, 101]);
		const screenshotPath = join(process.cwd(), 'tmp-desktop-screenshot-test.png');
		const tool = createDesktopScreenshotTool({
			capture: vi.fn(async () => screenshotPath),
			readFile,
		});

		try {
			await writeFile(screenshotPath, screenshotBuffer);

			const result = await tool.execute(createInput(), createContext());

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected file-backed desktop.screenshot to succeed.');
			}

			expect(result.output.base64_data).toBe(screenshotBuffer.toString('base64'));
		} finally {
			await readFile(screenshotPath).then(
				async () =>
					rm(screenshotPath, {
						force: true,
					}),
				() => undefined,
			);
		}
	});

	it('rejects unexpected arguments and wraps capture failures into typed errors', async () => {
		const invalidTool = createDesktopScreenshotTool();
		const failingTool = createDesktopScreenshotTool({
			capture: vi.fn(async () => {
				throw new Error('screen capture backend unavailable');
			}),
		});
		const invalidCaptureTool = createDesktopScreenshotTool({
			capture: vi.fn(async () => Buffer.from('not-a-png')),
		});

		await expect(
			invalidTool.execute(createInput({ format: 'jpg' }), createContext()),
		).resolves.toMatchObject({
			error_code: 'INVALID_INPUT',
			status: 'error',
			tool_name: 'desktop.screenshot',
		});
		await expect(failingTool.execute(createInput(), createContext())).resolves.toMatchObject({
			error_code: 'EXECUTION_FAILED',
			status: 'error',
			tool_name: 'desktop.screenshot',
		});
		await expect(invalidCaptureTool.execute(createInput(), createContext())).resolves.toMatchObject(
			{
				error_code: 'EXECUTION_FAILED',
				status: 'error',
				tool_name: 'desktop.screenshot',
			},
		);
	});

	it('is compatible with ToolRegistry and built-in registry helpers', () => {
		const registry = new ToolRegistry();

		registry.register(desktopScreenshotTool);

		expect(registry.has('desktop.screenshot')).toBe(true);
		expect(createBuiltInToolRegistry().has('desktop.screenshot')).toBe(true);
	});

	it('keeps approval-gated high-risk desktop metadata', () => {
		expect(desktopScreenshotTool.metadata).toMatchObject({
			capability_class: 'desktop',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'read',
		});
	});
});
