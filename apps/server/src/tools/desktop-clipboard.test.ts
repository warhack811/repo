import type {
	DesktopBridgeInvoker,
	ToolCallInput,
	ToolExecutionContext,
	ToolResult,
} from '@runa/types';
import { describe, expect, it, vi } from 'vitest';

import {
	createDesktopClipboardReadTool,
	createDesktopClipboardWriteTool,
	desktopClipboardReadTool,
	desktopClipboardWriteTool,
} from './desktop-clipboard.js';
import { ToolRegistry, createBuiltInToolRegistry } from './registry.js';

function createReadInput(argumentsValue: Record<string, unknown> = {}) {
	return {
		arguments: argumentsValue,
		call_id: 'call_desktop_clipboard_read',
		tool_name: 'desktop.clipboard.read' as const,
	};
}

function createWriteInput(argumentsValue: Record<string, unknown>) {
	return {
		arguments: argumentsValue,
		call_id: 'call_desktop_clipboard_write',
		tool_name: 'desktop.clipboard.write' as const,
	};
}

function createContext(desktopBridge?: DesktopBridgeInvoker): ToolExecutionContext {
	return {
		desktop_bridge: desktopBridge,
		run_id: 'run_desktop_clipboard',
		trace_id: 'trace_desktop_clipboard',
		working_directory: process.cwd(),
	};
}

function createBridge(
	output: unknown,
	supportedTool: 'desktop.clipboard.read' | 'desktop.clipboard.write',
) {
	const invokeSpy = vi.fn();
	const bridge: DesktopBridgeInvoker = {
		agent_id: 'desktop-agent-clipboard',
		capabilities: [supportedTool],
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
		supports: (toolName) => toolName === supportedTool,
	};

	return { bridge, invokeSpy };
}

describe('desktopClipboardTools', () => {
	it('reads clipboard through the desktop bridge with approval-gated metadata', async () => {
		const tool = createDesktopClipboardReadTool();
		const { bridge, invokeSpy } = createBridge(
			{
				byte_length: 5,
				character_count: 5,
				content: 'hello',
				is_redacted: false,
				is_truncated: false,
			},
			'desktop.clipboard.read',
		);

		const result = await tool.execute(createReadInput(), createContext(bridge));

		expect(result).toMatchObject({
			output: {
				content: 'hello',
				is_redacted: false,
				is_truncated: false,
			},
			status: 'success',
			tool_name: 'desktop.clipboard.read',
		});
		expect(invokeSpy).toHaveBeenCalledTimes(1);
		expect(desktopClipboardReadTool.metadata).toMatchObject({
			capability_class: 'desktop',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'read',
		});
	});

	it('writes bounded clipboard text through the desktop bridge', async () => {
		const tool = createDesktopClipboardWriteTool();
		const { bridge, invokeSpy } = createBridge(
			{
				byte_length: 11,
				character_count: 11,
				written: true,
			},
			'desktop.clipboard.write',
		);

		const result = await tool.execute(
			createWriteInput({
				text: 'hello world',
			}),
			createContext(bridge),
		);

		expect(result).toMatchObject({
			output: {
				byte_length: 11,
				written: true,
			},
			status: 'success',
			tool_name: 'desktop.clipboard.write',
		});
		expect(invokeSpy).toHaveBeenCalledTimes(1);
		expect(desktopClipboardWriteTool.metadata).toMatchObject({
			capability_class: 'desktop',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'write',
		});
	});

	it('rejects oversized clipboard writes before dispatching to the agent', async () => {
		const tool = createDesktopClipboardWriteTool();
		const { bridge, invokeSpy } = createBridge(
			{
				byte_length: 1,
				character_count: 1,
				written: true,
			},
			'desktop.clipboard.write',
		);

		const result = await tool.execute(
			createWriteInput({
				text: 'x'.repeat(10 * 1024 + 1),
			}),
			createContext(bridge),
		);

		expect(result).toMatchObject({
			error_code: 'INVALID_INPUT',
			status: 'error',
			tool_name: 'desktop.clipboard.write',
		});
		expect(invokeSpy).not.toHaveBeenCalled();
	});

	it('requires the desktop agent to advertise clipboard capability', async () => {
		const tool = createDesktopClipboardReadTool();
		const bridge: DesktopBridgeInvoker = {
			agent_id: 'desktop-agent-no-clipboard',
			capabilities: [],
			async invoke<TName extends Extract<ToolCallInput['tool_name'], `desktop.${string}`>>(
				_input: ToolCallInput<TName>,
				_context: Pick<ToolExecutionContext, 'run_id' | 'signal' | 'trace_id'>,
			): Promise<ToolResult<TName>> {
				throw new Error('Bridge invoke should not run when capability is missing.');
			},
			supports: () => false,
		};

		const result = await tool.execute(createReadInput(), createContext(bridge));

		expect(result).toMatchObject({
			details: {
				reason: 'desktop_agent_capability_unavailable',
			},
			error_code: 'EXECUTION_FAILED',
			status: 'error',
			tool_name: 'desktop.clipboard.read',
		});
	});

	it('registers both clipboard tools as built-ins', () => {
		const registry = new ToolRegistry();

		registry.register(desktopClipboardReadTool);
		registry.register(desktopClipboardWriteTool);

		expect(registry.has('desktop.clipboard.read')).toBe(true);
		expect(registry.has('desktop.clipboard.write')).toBe(true);
		expect(createBuiltInToolRegistry().has('desktop.clipboard.read')).toBe(true);
		expect(createBuiltInToolRegistry().has('desktop.clipboard.write')).toBe(true);
	});
});
