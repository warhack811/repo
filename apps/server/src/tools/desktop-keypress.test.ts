import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDesktopKeypressTool, desktopKeypressTool } from './desktop-keypress.js';
import { ToolRegistry, createBuiltInToolRegistry } from './registry.js';

type ExecFileFn = typeof import('node:child_process').execFile;
type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;
type ExecFileStub = (
	file: string,
	args: readonly string[],
	options: Readonly<Record<string, unknown>>,
	callback: ExecFileCallback,
) => ReturnType<ExecFileFn>;

function asExecFile(fn: ExecFileStub): ExecFileFn {
	return fn as unknown as ExecFileFn;
}

function createInput(argumentsValue: Record<string, unknown>) {
	return {
		arguments: argumentsValue,
		call_id: 'call_desktop_keypress',
		tool_name: 'desktop.keypress' as const,
	};
}

function createContext() {
	return {
		run_id: 'run_desktop_keypress',
		trace_id: 'trace_desktop_keypress',
		working_directory: process.cwd(),
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('desktopKeypressTool', () => {
	it('executes a supported keyboard shortcut through PowerShell SendKeys', async () => {
		const execFileMock = vi.fn<ExecFileStub>((_file, _args, _options, callback) => {
			callback(null, '', '');
			return {} as ReturnType<ExecFileFn>;
		});
		const tool = createDesktopKeypressTool({
			execFile: asExecFile(execFileMock),
			platform: 'win32',
		});

		const result = await tool.execute(
			createInput({
				key: 'enter',
				modifiers: ['ctrl', 'shift'],
			}),
			createContext(),
		);

		expect(result).toEqual({
			call_id: 'call_desktop_keypress',
			output: {
				key: 'enter',
				modifiers: ['ctrl', 'shift'],
			},
			status: 'success',
			tool_name: 'desktop.keypress',
		});
		expect(execFileMock.mock.calls[0]?.[1]?.[4]).toContain("'^+{ENTER}'");
		expect(desktopKeypressTool.metadata).toMatchObject({
			capability_class: 'desktop',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'execute',
		});
	});

	it('rejects unsupported keys and modifiers', async () => {
		const tool = createDesktopKeypressTool({
			execFile: asExecFile(
				vi.fn<ExecFileStub>((_file, _args, _options, callback) => {
					callback(null, '', '');
					return {} as ReturnType<ExecFileFn>;
				}),
			),
			platform: 'win32',
		});

		await expect(
			tool.execute(
				createInput({
					key: 'meta',
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			error_code: 'INVALID_INPUT',
			status: 'error',
			tool_name: 'desktop.keypress',
		});
		await expect(
			tool.execute(
				createInput({
					key: 'enter',
					modifiers: ['meta'],
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			error_code: 'INVALID_INPUT',
			status: 'error',
			tool_name: 'desktop.keypress',
		});
	});

	it('registers as a built-in desktop tool', () => {
		const registry = new ToolRegistry();

		registry.register(desktopKeypressTool);

		expect(registry.has('desktop.keypress')).toBe(true);
		expect(createBuiltInToolRegistry().has('desktop.keypress')).toBe(true);
	});
});
