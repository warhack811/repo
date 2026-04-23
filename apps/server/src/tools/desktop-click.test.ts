import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
	DesktopBridgeInvoker,
	ToolCallInput,
	ToolExecutionContext,
	ToolResult,
} from '@runa/types';

import { createDesktopClickTool, desktopClickTool } from './desktop-click.js';
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
		call_id: 'call_desktop_click',
		tool_name: 'desktop.click' as const,
	};
}

function createContext() {
	return {
		run_id: 'run_desktop_click',
		trace_id: 'trace_desktop_click',
		working_directory: process.cwd(),
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('desktopClickTool', () => {
	it('executes a Windows desktop click with approval-gated metadata', async () => {
		const execFileMock = vi.fn<ExecFileStub>((_file, _args, _options, callback) => {
			callback(null, '', '');
			return {} as ReturnType<ExecFileFn>;
		});
		const tool = createDesktopClickTool({
			execFile: asExecFile(execFileMock),
			platform: 'win32',
		});

		const result = await tool.execute(
			createInput({
				button: 'right',
				click_count: 2,
				x: 320,
				y: 240,
			}),
			createContext(),
		);

		expect(result).toEqual({
			call_id: 'call_desktop_click',
			output: {
				button: 'right',
				click_count: 2,
				position: {
					x: 320,
					y: 240,
				},
			},
			status: 'success',
			tool_name: 'desktop.click',
		});
		expect(execFileMock).toHaveBeenCalledTimes(1);
		expect(execFileMock.mock.calls[0]?.[0]).toBe('powershell.exe');
		expect(execFileMock.mock.calls[0]?.[1]).toContain('-STA');
		expect(execFileMock.mock.calls[0]?.[1]?.[4]).toContain('SetCursorPos(320, 240)');
		expect(execFileMock.mock.calls[0]?.[1]?.[4]).toContain('0x0008');
		expect(desktopClickTool.metadata).toMatchObject({
			capability_class: 'desktop',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'execute',
		});
	});

	it('rejects invalid click arguments and unsupported platforms', async () => {
		const windowsTool = createDesktopClickTool({
			execFile: asExecFile(
				vi.fn<ExecFileStub>((_file, _args, _options, callback) => {
					callback(null, '', '');
					return {} as ReturnType<ExecFileFn>;
				}),
			),
			platform: 'win32',
		});
		const linuxTool = createDesktopClickTool({
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
					click_count: 0,
					x: 10,
					y: 20,
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			error_code: 'INVALID_INPUT',
			status: 'error',
			tool_name: 'desktop.click',
		});
		await expect(
			linuxTool.execute(
				createInput({
					x: 10,
					y: 20,
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			error_code: 'EXECUTION_FAILED',
			status: 'error',
			tool_name: 'desktop.click',
		});
	});

	it('wraps PowerShell execution failures into typed tool errors', async () => {
		const tool = createDesktopClickTool({
			execFile: asExecFile((_file, _args, _options, callback) => {
				callback(new Error('desktop injector failed'), '', 'Access is denied');
				return {} as ReturnType<ExecFileFn>;
			}),
			platform: 'win32',
		});

		await expect(
			tool.execute(
				createInput({
					x: 10,
					y: 20,
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			error_code: 'PERMISSION_DENIED',
			status: 'error',
			tool_name: 'desktop.click',
		});
	});

	it('prefers a connected desktop bridge result over local host click execution', async () => {
		const execFileMock = vi.fn<ExecFileStub>((_file, _args, _options, callback) => {
			callback(null, '', '');
			return {} as ReturnType<ExecFileFn>;
		});
		const invokeSpy = vi.fn();
		const desktopBridge: DesktopBridgeInvoker = {
			agent_id: 'desktop-agent-1',
			capabilities: ['desktop.click'],
			async invoke<TName extends Extract<ToolCallInput['tool_name'], `desktop.${string}`>>(
				_input: ToolCallInput<TName>,
				_context: Pick<ToolExecutionContext, 'run_id' | 'signal' | 'trace_id'>,
			): Promise<ToolResult<TName>> {
				invokeSpy();
				return {
					call_id: 'call_desktop_click',
					output: {
						button: 'left',
						click_count: 1,
						position: {
							x: 144,
							y: 288,
						},
					},
					status: 'success',
					tool_name: 'desktop.click',
				} as unknown as ToolResult<TName>;
			},
			supports: () => true,
		};
		const tool = createDesktopClickTool({
			execFile: asExecFile(execFileMock),
			platform: 'linux',
		});

		const result = await tool.execute(
			createInput({
				x: 10,
				y: 20,
			}),
			{
				...createContext(),
				desktop_bridge: desktopBridge,
			},
		);

		expect(execFileMock).not.toHaveBeenCalled();
		expect(invokeSpy).toHaveBeenCalledTimes(1);
		expect(result).toMatchObject({
			output: {
				position: {
					x: 144,
					y: 288,
				},
			},
			status: 'success',
			tool_name: 'desktop.click',
		});
	});

	it('returns a typed error when a connected desktop bridge lacks click capability', async () => {
		const execFileMock = vi.fn<ExecFileStub>((_file, _args, _options, callback) => {
			callback(null, '', '');
			return {} as ReturnType<ExecFileFn>;
		});
		const invokeSpy = vi.fn();
		const desktopBridge: DesktopBridgeInvoker = {
			agent_id: 'desktop-agent-1',
			capabilities: [],
			async invoke<TName extends Extract<ToolCallInput['tool_name'], `desktop.${string}`>>(
				_input: ToolCallInput<TName>,
				_context: Pick<ToolExecutionContext, 'run_id' | 'signal' | 'trace_id'>,
			): Promise<ToolResult<TName>> {
				invokeSpy();
				throw new Error('Bridge invoke should not run when capability is missing.');
			},
			supports: () => false,
		};
		const tool = createDesktopClickTool({
			execFile: asExecFile(execFileMock),
			platform: 'win32',
		});

		const result = await tool.execute(
			createInput({
				x: 10,
				y: 20,
			}),
			{
				...createContext(),
				desktop_bridge: desktopBridge,
			},
		);

		expect(execFileMock).not.toHaveBeenCalled();
		expect(invokeSpy).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			details: {
				reason: 'desktop_agent_capability_unavailable',
			},
			error_code: 'EXECUTION_FAILED',
			status: 'error',
			tool_name: 'desktop.click',
		});
	});

	it('registers as a built-in desktop tool', () => {
		const registry = new ToolRegistry();

		registry.register(desktopClickTool);

		expect(registry.has('desktop.click')).toBe(true);
		expect(createBuiltInToolRegistry().has('desktop.click')).toBe(true);
	});
});
