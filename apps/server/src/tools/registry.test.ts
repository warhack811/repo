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

	it('creates a built-in registry that includes desktop screenshot', () => {
		const registry = createBuiltInToolRegistry();

		expect(registry.has('desktop.screenshot')).toBe(true);
		expect(registry.listNames()).toContain('desktop.screenshot');
	});
});
