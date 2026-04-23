import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDesktopTypeTool, desktopTypeTool } from './desktop-type.js';
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
		call_id: 'call_desktop_type',
		tool_name: 'desktop.type' as const,
	};
}

function createContext() {
	return {
		run_id: 'run_desktop_type',
		trace_id: 'trace_desktop_type',
		working_directory: process.cwd(),
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('desktopTypeTool', () => {
	it('serializes text into SendKeys tokens and executes via PowerShell', async () => {
		const execFileMock = vi.fn<ExecFileStub>((_file, _args, _options, callback) => {
			callback(null, '', '');
			return {} as ReturnType<ExecFileFn>;
		});
		const tool = createDesktopTypeTool({
			execFile: asExecFile(execFileMock),
			platform: 'win32',
		});

		const result = await tool.execute(
			createInput({
				delay_ms: 25,
				text: 'A+\nB',
			}),
			createContext(),
		);

		expect(result).toEqual({
			call_id: 'call_desktop_type',
			output: {
				character_count: 4,
				delay_ms: 25,
			},
			status: 'success',
			tool_name: 'desktop.type',
		});
		expect(execFileMock).toHaveBeenCalledTimes(1);
		expect(execFileMock.mock.calls[0]?.[1]?.[4]).toContain("'A'");
		expect(execFileMock.mock.calls[0]?.[1]?.[4]).toContain("'{+}'");
		expect(execFileMock.mock.calls[0]?.[1]?.[4]).toContain("'{ENTER}'");
		expect(desktopTypeTool.metadata).toMatchObject({
			capability_class: 'desktop',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'execute',
		});
	});

	it('rejects invalid type arguments and unsupported platforms', async () => {
		const windowsTool = createDesktopTypeTool({
			execFile: asExecFile(
				vi.fn<ExecFileStub>((_file, _args, _options, callback) => {
					callback(null, '', '');
					return {} as ReturnType<ExecFileFn>;
				}),
			),
			platform: 'win32',
		});
		const linuxTool = createDesktopTypeTool({
			execFile: asExecFile(
				vi.fn<ExecFileStub>((_file, _args, _options, callback) => {
					callback(null, '', '');
					return {} as ReturnType<ExecFileFn>;
				}),
			),
			platform: 'linux',
		});

		await expect(
			windowsTool.execute(
				createInput({
					text: '',
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			error_code: 'INVALID_INPUT',
			status: 'error',
			tool_name: 'desktop.type',
		});
		await expect(
			linuxTool.execute(
				createInput({
					text: 'hello',
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			error_code: 'EXECUTION_FAILED',
			status: 'error',
			tool_name: 'desktop.type',
		});
	});

	it('registers as a built-in desktop tool', () => {
		const registry = new ToolRegistry();

		registry.register(desktopTypeTool);

		expect(registry.has('desktop.type')).toBe(true);
		expect(createBuiltInToolRegistry().has('desktop.type')).toBe(true);
	});
});
