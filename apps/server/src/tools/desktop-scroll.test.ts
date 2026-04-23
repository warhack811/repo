import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDesktopScrollTool, desktopScrollTool } from './desktop-scroll.js';
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
		call_id: 'call_desktop_scroll',
		tool_name: 'desktop.scroll' as const,
	};
}

function createContext() {
	return {
		run_id: 'run_desktop_scroll',
		trace_id: 'trace_desktop_scroll',
		working_directory: process.cwd(),
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('desktopScrollTool', () => {
	it('executes a Windows desktop scroll action', async () => {
		const execFileMock = vi.fn<ExecFileStub>((_file, _args, _options, callback) => {
			callback(null, '', '');
			return {} as ReturnType<ExecFileFn>;
		});
		const tool = createDesktopScrollTool({
			execFile: asExecFile(execFileMock),
			platform: 'win32',
		});

		const result = await tool.execute(
			createInput({
				delta_x: 0,
				delta_y: -120,
			}),
			createContext(),
		);

		expect(result).toEqual({
			call_id: 'call_desktop_scroll',
			output: {
				delta_x: 0,
				delta_y: -120,
			},
			status: 'success',
			tool_name: 'desktop.scroll',
		});
		expect(execFileMock.mock.calls[0]?.[1]?.[4]).toContain('0x0800');
		expect(desktopScrollTool.metadata).toMatchObject({
			capability_class: 'desktop',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'execute',
		});
	});

	it('rejects zero scroll input and unsupported platforms', async () => {
		const windowsTool = createDesktopScrollTool({
			execFile: asExecFile(
				vi.fn<ExecFileStub>((_file, _args, _options, callback) => {
					callback(null, '', '');
					return {} as ReturnType<ExecFileFn>;
				}),
			),
			platform: 'win32',
		});
		const linuxTool = createDesktopScrollTool({
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
					delta_x: 0,
					delta_y: 0,
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			error_code: 'INVALID_INPUT',
			status: 'error',
			tool_name: 'desktop.scroll',
		});
		await expect(
			linuxTool.execute(
				createInput({
					delta_y: 120,
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			error_code: 'EXECUTION_FAILED',
			status: 'error',
			tool_name: 'desktop.scroll',
		});
	});

	it('registers as a built-in desktop tool', () => {
		const registry = new ToolRegistry();

		registry.register(desktopScrollTool);

		expect(registry.has('desktop.scroll')).toBe(true);
		expect(createBuiltInToolRegistry().has('desktop.scroll')).toBe(true);
	});
});
