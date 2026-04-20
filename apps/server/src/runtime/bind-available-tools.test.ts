import type {
	ToolCallInput,
	ToolCallableSchema,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
} from '@runa/types';

import { describe, expect, it } from 'vitest';

import { ToolRegistry } from '../tools/registry.js';

import { bindAvailableTools } from './bind-available-tools.js';

function createToolDefinition(
	name: ToolDefinition['name'],
	description: string,
	callableSchema?: ToolCallableSchema,
): ToolDefinition {
	return {
		callable_schema: callableSchema,
		description,
		execute: async (
			_input: ToolCallInput,
			_context: ToolExecutionContext,
		): Promise<ToolResult> => ({
			call_id: 'call_test',
			output: {},
			status: 'success',
			tool_name: name,
		}),
		metadata: {
			capability_class: 'file_system',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
		},
		name,
	};
}

describe('bindAvailableTools', () => {
	it('converts all registry tools into a deterministic callable tool list', () => {
		const registry = new ToolRegistry();

		registry.register(
			createToolDefinition('shell.exec', 'Execute a shell command.', {
				parameters: {
					args: {
						description: 'Argument list for the executable.',
						items: {
							type: 'string',
						},
						type: 'array',
					},
					command: {
						description: 'Executable to run.',
						required: true,
						type: 'string',
					},
					timeout_ms: {
						description: 'Execution timeout in milliseconds.',
						type: 'number',
					},
					working_directory: {
						description: 'Optional working directory for the subprocess.',
						type: 'string',
					},
				},
			}),
		);
		registry.register(
			createToolDefinition('file.read', 'Read a UTF-8 text file.', {
				parameters: {
					encoding: {
						description: 'Optional text encoding.',
						type: 'string',
					},
					path: {
						description: 'Path to read.',
						required: true,
						type: 'string',
					},
				},
			}),
		);
		registry.register(
			createToolDefinition('search.grep', 'Search for a substring.', {
				parameters: {
					case_sensitive: {
						description: 'Whether the substring search should be case sensitive.',
						type: 'boolean',
					},
					include_hidden: {
						description: 'Whether hidden files and directories should be searched.',
						type: 'boolean',
					},
					max_results: {
						description: 'Maximum number of matches to return.',
						type: 'number',
					},
					path: {
						description: 'File or directory path to search.',
						required: true,
						type: 'string',
					},
					query: {
						description: 'Substring query to search for.',
						required: true,
						type: 'string',
					},
				},
			}),
		);

		const result = bindAvailableTools({ registry });

		expect(result.status).toBe('completed');

		if (result.status !== 'completed') {
			throw new Error('Expected callable tools binding to complete.');
		}

		expect(result.selected_tool_names).toEqual(['file.read', 'search.grep', 'shell.exec']);
		expect(result.available_tools).toEqual([
			{
				description: 'Read a UTF-8 text file.',
				name: 'file.read',
				parameters: {
					encoding: {
						description: 'Optional text encoding.',
						type: 'string',
					},
					path: {
						description: 'Path to read.',
						required: true,
						type: 'string',
					},
				},
			},
			{
				description: 'Search for a substring.',
				name: 'search.grep',
				parameters: {
					case_sensitive: {
						description: 'Whether the substring search should be case sensitive.',
						type: 'boolean',
					},
					include_hidden: {
						description: 'Whether hidden files and directories should be searched.',
						type: 'boolean',
					},
					max_results: {
						description: 'Maximum number of matches to return.',
						type: 'number',
					},
					path: {
						description: 'File or directory path to search.',
						required: true,
						type: 'string',
					},
					query: {
						description: 'Substring query to search for.',
						required: true,
						type: 'string',
					},
				},
			},
			{
				description: 'Execute a shell command.',
				name: 'shell.exec',
				parameters: {
					args: {
						description: 'Argument list for the executable.',
						items: {
							type: 'string',
						},
						type: 'array',
					},
					command: {
						description: 'Executable to run.',
						required: true,
						type: 'string',
					},
					timeout_ms: {
						description: 'Execution timeout in milliseconds.',
						type: 'number',
					},
					working_directory: {
						description: 'Optional working directory for the subprocess.',
						type: 'string',
					},
				},
			},
		]);
	});

	it('supports explicit tool name selection with deterministic ordering', () => {
		const registry = new ToolRegistry();

		registry.register(
			createToolDefinition('shell.exec', 'Execute a shell command.', {
				parameters: {
					command: {
						description: 'Executable to run.',
						required: true,
						type: 'string',
					},
				},
			}),
		);
		registry.register(
			createToolDefinition('file.read', 'Read a UTF-8 text file.', {
				parameters: {
					path: {
						description: 'Path to read.',
						required: true,
						type: 'string',
					},
				},
			}),
		);
		registry.register(
			createToolDefinition('search.grep', 'Search for a substring.', {
				parameters: {
					path: {
						description: 'File or directory path to search.',
						required: true,
						type: 'string',
					},
					query: {
						description: 'Substring query to search for.',
						required: true,
						type: 'string',
					},
				},
			}),
		);

		const result = bindAvailableTools({
			registry,
			tool_names: ['shell.exec', 'file.read', 'shell.exec'],
		});

		expect(result.status).toBe('completed');

		if (result.status !== 'completed') {
			throw new Error('Expected explicit callable tools binding to complete.');
		}

		expect(result.selected_tool_names).toEqual(['file.read', 'shell.exec']);
		expect(result.available_tools.map((tool) => tool.name)).toEqual(['file.read', 'shell.exec']);
	});

	it('fails clearly when an explicit tool name is missing from the registry', () => {
		const registry = new ToolRegistry();

		registry.register(
			createToolDefinition('file.read', 'Read a UTF-8 text file.', {
				parameters: {
					path: {
						description: 'Path to read.',
						required: true,
						type: 'string',
					},
				},
			}),
		);

		const result = bindAvailableTools({
			registry,
			tool_names: ['file.read', 'shell.exec'],
		});

		expect(result).toEqual({
			failure: {
				code: 'TOOL_NOT_FOUND',
				message: 'Tool registry does not contain shell.exec.',
				tool_name: 'shell.exec',
			},
			status: 'failed',
		});
	});

	it('fails clearly when a registry tool has no callable schema bridge', () => {
		const registry = new ToolRegistry();

		registry.register(
			createToolDefinition('file.read', 'Read a UTF-8 text file.', {
				parameters: {
					path: {
						description: 'Path to read.',
						required: true,
						type: 'string',
					},
				},
			}),
		);
		registry.register(createToolDefinition('file.custom', 'Custom file tool.'));

		const result = bindAvailableTools({ registry });

		expect(result).toEqual({
			failure: {
				code: 'CALLABLE_TOOL_SCHEMA_NOT_FOUND',
				message: 'No callable tool schema is registered for file.custom.',
				tool_name: 'file.custom',
			},
			status: 'failed',
		});
	});
});
