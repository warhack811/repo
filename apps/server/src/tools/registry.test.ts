import type { ToolCallInput, ToolDefinition, ToolResult } from '@runa/types';
import { describe, expect, it } from 'vitest';

import {
	ToolAlreadyRegisteredError,
	ToolNotFoundError,
	ToolRegistry,
	createBuiltInToolRegistry,
} from './registry.js';

function createFakeTool<TName extends 'file.read' | 'file.write' | 'shell.exec'>(
	name: TName,
): ToolDefinition<ToolCallInput<TName>, ToolResult<TName, string>> {
	return {
		description: `${name} fake tool`,
		execute: async (input) => ({
			call_id: input.call_id,
			output: `ok:${name}`,
			status: 'success',
			tool_name: name,
		}),
		metadata: {
			capability_class: name.startsWith('shell') ? 'shell' : 'file_system',
			requires_approval: name === 'shell.exec',
			risk_level: name === 'shell.exec' ? 'high' : 'low',
			side_effect_level: name === 'file.read' ? 'read' : 'write',
		},
		name,
	};
}

describe('ToolRegistry', () => {
	it('registers and retrieves a tool', () => {
		const registry = new ToolRegistry();
		const tool = createFakeTool('file.read');

		registry.register(tool);

		expect(registry.has('file.read')).toBe(true);
		expect(registry.get('file.read')).toBe(tool);
	});

	it('throws a typed error for duplicate registrations', () => {
		const registry = new ToolRegistry();
		const tool = createFakeTool('file.read');

		registry.register(tool);

		expect(() => registry.register(tool)).toThrowError(ToolAlreadyRegisteredError);
		expect(() => registry.register(tool)).toThrowError('Tool already registered: file.read');
	});

	it('throws a typed error when getOrThrow misses', () => {
		const registry = new ToolRegistry();

		expect(() => registry.getOrThrow('search.grep')).toThrowError(ToolNotFoundError);
		expect(() => registry.getOrThrow('search.grep')).toThrowError('Tool not found: search.grep');
	});

	it('lists tools in deterministic registration order', () => {
		const registry = new ToolRegistry();

		registry.registerMany([
			createFakeTool('file.read'),
			createFakeTool('file.write'),
			createFakeTool('shell.exec'),
		]);

		expect(registry.list().map((entry) => entry.name)).toEqual([
			'file.read',
			'file.write',
			'shell.exec',
		]);
		expect(registry.listNames()).toEqual(['file.read', 'file.write', 'shell.exec']);
	});

	it('creates a built-in registry that includes the approval-gated desktop family', () => {
		const registry = createBuiltInToolRegistry();

		expect(registry.has('browser.click')).toBe(true);
		expect(registry.has('browser.extract')).toBe(true);
		expect(registry.has('browser.fill')).toBe(true);
		expect(registry.has('browser.navigate')).toBe(true);
		expect(registry.has('desktop.click')).toBe(true);
		expect(registry.has('desktop.clipboard.read')).toBe(true);
		expect(registry.has('desktop.clipboard.write')).toBe(true);
		expect(registry.has('desktop.keypress')).toBe(true);
		expect(registry.has('desktop.launch')).toBe(true);
		expect(registry.has('desktop.scroll')).toBe(true);
		expect(registry.has('desktop.screenshot')).toBe(true);
		expect(registry.has('desktop.type')).toBe(true);
		expect(registry.has('desktop.verify_state')).toBe(true);
		expect(registry.has('desktop.vision_analyze')).toBe(true);
		expect(registry.has('file.share')).toBe(true);
		expect(registry.has('file.watch')).toBe(true);
		expect(registry.has('memory.delete')).toBe(true);
		expect(registry.has('memory.list')).toBe(true);
		expect(registry.has('memory.save')).toBe(true);
		expect(registry.has('memory.search')).toBe(true);
		expect(registry.listNames()).toContain('browser.click');
		expect(registry.listNames()).toContain('browser.extract');
		expect(registry.listNames()).toContain('browser.fill');
		expect(registry.listNames()).toContain('browser.navigate');
		expect(registry.listNames()).toContain('desktop.click');
		expect(registry.listNames()).toContain('desktop.clipboard.read');
		expect(registry.listNames()).toContain('desktop.clipboard.write');
		expect(registry.listNames()).toContain('desktop.keypress');
		expect(registry.listNames()).toContain('desktop.launch');
		expect(registry.listNames()).toContain('desktop.scroll');
		expect(registry.listNames()).toContain('desktop.screenshot');
		expect(registry.listNames()).toContain('desktop.type');
		expect(registry.listNames()).toContain('desktop.verify_state');
		expect(registry.listNames()).toContain('desktop.vision_analyze');
		expect(registry.listNames()).toContain('file.share');
		expect(registry.listNames()).toContain('file.watch');
		expect(registry.listNames()).toContain('memory.delete');
		expect(registry.listNames()).toContain('memory.list');
		expect(registry.listNames()).toContain('memory.save');
		expect(registry.listNames()).toContain('memory.search');
	});

	it('declares an explicit narration policy for every built-in tool', () => {
		const registry = createBuiltInToolRegistry();
		const policiesByToolName = new Map(
			registry.list().map((entry) => [entry.name, entry.metadata.narration_policy] as const),
		);

		expect(registry.list().every((entry) => entry.metadata.narration_policy !== undefined)).toBe(
			true,
		);
		expect(policiesByToolName.get('memory.list')).toBe('none');
		expect(policiesByToolName.get('memory.search')).toBe('none');
		expect(policiesByToolName.get('file.write')).toBe('required');
		expect(policiesByToolName.get('shell.exec')).toBe('required');
		expect(policiesByToolName.get('edit.patch')).toBe('required');
		expect(policiesByToolName.get('file.read')).toBe('optional');
		expect(policiesByToolName.get('search.codebase')).toBe('optional');
	});

	it('keeps built-in names authoritative when another tool tries to reuse them', () => {
		const registry = createBuiltInToolRegistry();
		const conflictingTool = createFakeTool('file.read');

		expect(() => registry.register(conflictingTool)).toThrowError(ToolAlreadyRegisteredError);
		expect(registry.get('file.read')).not.toBe(conflictingTool);
	});
});
