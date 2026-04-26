import type {
	DesktopBridgeInvoker,
	ToolCallInput,
	ToolExecutionContext,
	ToolResult,
} from '@runa/types';
import { describe, expect, it, vi } from 'vitest';

import { createDesktopLaunchTool, desktopLaunchTool } from './desktop-launch.js';
import { ToolRegistry, createBuiltInToolRegistry } from './registry.js';

function createInput(argumentsValue: Record<string, unknown>) {
	return {
		arguments: argumentsValue,
		call_id: 'call_desktop_launch',
		tool_name: 'desktop.launch' as const,
	};
}

function createContext(desktopBridge?: DesktopBridgeInvoker): ToolExecutionContext {
	return {
		desktop_bridge: desktopBridge,
		run_id: 'run_desktop_launch',
		trace_id: 'trace_desktop_launch',
		working_directory: process.cwd(),
	};
}

function createBridge(output: unknown) {
	const invokeSpy = vi.fn();
	const bridge: DesktopBridgeInvoker = {
		agent_id: 'desktop-agent-launch',
		capabilities: ['desktop.launch'],
		async invoke<TName extends Extract<ToolCallInput['tool_name'], `desktop.${string}`>>(
			input: ToolCallInput<TName>,
			_context: Pick<ToolExecutionContext, 'run_id' | 'signal' | 'trace_id'>,
		): Promise<ToolResult<TName>> {
			invokeSpy(input);
			return {
				call_id: input.call_id,
				output,
				status: 'success',
				tool_name: input.tool_name,
			} as unknown as ToolResult<TName>;
		},
		supports: (toolName) => toolName === 'desktop.launch',
	};

	return { bridge, invokeSpy };
}

describe('desktopLaunchTool', () => {
	it('launches a whitelisted app through the desktop bridge with approval metadata', async () => {
		const tool = createDesktopLaunchTool();
		const { bridge, invokeSpy } = createBridge({
			launched: true,
			pid: 4242,
			process_name: 'notepad',
		});

		const result = await tool.execute(
			createInput({
				app_name: 'Notepad',
			}),
			createContext(bridge),
		);

		expect(result).toEqual({
			call_id: 'call_desktop_launch',
			output: {
				launched: true,
				pid: 4242,
				process_name: 'notepad',
			},
			status: 'success',
			tool_name: 'desktop.launch',
		});
		expect(invokeSpy).toHaveBeenCalledTimes(1);
		expect(desktopLaunchTool.metadata).toMatchObject({
			capability_class: 'desktop',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'execute',
		});
	});

	it('rejects non-whitelisted app launch requests before bridge dispatch', async () => {
		const tool = createDesktopLaunchTool();
		const { bridge, invokeSpy } = createBridge({
			launched: true,
			process_name: 'powershell',
		});

		const result = await tool.execute(
			createInput({
				app_name: 'powershell',
			}),
			createContext(bridge),
		);

		expect(result).toMatchObject({
			details: {
				reason: 'app_not_whitelisted',
			},
			error_code: 'PERMISSION_DENIED',
			status: 'error',
			tool_name: 'desktop.launch',
		});
		expect(invokeSpy).not.toHaveBeenCalled();
	});

	it('requires the connected desktop agent to advertise launch capability', async () => {
		const tool = createDesktopLaunchTool();
		const bridge: DesktopBridgeInvoker = {
			agent_id: 'desktop-agent-no-launch',
			capabilities: [],
			async invoke<TName extends Extract<ToolCallInput['tool_name'], `desktop.${string}`>>(
				_input: ToolCallInput<TName>,
				_context: Pick<ToolExecutionContext, 'run_id' | 'signal' | 'trace_id'>,
			): Promise<ToolResult<TName>> {
				throw new Error('Bridge invoke should not run when capability is missing.');
			},
			supports: () => false,
		};

		const result = await tool.execute(
			createInput({
				app_name: 'calc',
			}),
			createContext(bridge),
		);

		expect(result).toMatchObject({
			details: {
				reason: 'desktop_agent_capability_unavailable',
			},
			error_code: 'EXECUTION_FAILED',
			status: 'error',
			tool_name: 'desktop.launch',
		});
	});

	it('registers as a built-in desktop tool', () => {
		const registry = new ToolRegistry();

		registry.register(desktopLaunchTool);

		expect(registry.has('desktop.launch')).toBe(true);
		expect(createBuiltInToolRegistry().has('desktop.launch')).toBe(true);
	});
});
