import type { ModelCallableTool, ToolDefinition, ToolName } from '@runa/types';

import type { ToolRegistry } from '../tools/registry.js';

interface BindAvailableToolsFailure {
	readonly code: 'CALLABLE_TOOL_SCHEMA_NOT_FOUND' | 'TOOL_NOT_FOUND';
	readonly message: string;
	readonly tool_name: ToolName;
}

export interface BindAvailableToolsInput {
	readonly registry: ToolRegistry;
	readonly tool_names?: readonly ToolName[];
}

export interface BindAvailableToolsSuccessResult {
	readonly available_tools: readonly ModelCallableTool[];
	readonly selected_tool_names: readonly ToolName[];
	readonly status: 'completed';
}

export interface BindAvailableToolsFailureResult {
	readonly failure: BindAvailableToolsFailure;
	readonly status: 'failed';
}

export type BindAvailableToolsResult =
	| BindAvailableToolsFailureResult
	| BindAvailableToolsSuccessResult;

function createFailure(
	code: BindAvailableToolsFailure['code'],
	toolName: ToolName,
	message: string,
): BindAvailableToolsFailure {
	return {
		code,
		message,
		tool_name: toolName,
	};
}

function getDeterministicToolNames(
	registry: ToolRegistry,
	toolNames?: readonly ToolName[],
): readonly ToolName[] {
	const selectedNames = toolNames ?? registry.list().map((entry) => entry.name);

	return Array.from(new Set(selectedNames)).sort((left, right) => left.localeCompare(right));
}

function toCallableTool(tool: ToolDefinition): ModelCallableTool | undefined {
	if (!tool.callable_schema) {
		return undefined;
	}

	return {
		description: tool.description,
		name: tool.name,
		parameters: tool.callable_schema.parameters,
	};
}

export function bindAvailableTools(input: BindAvailableToolsInput): BindAvailableToolsResult {
	const selectedToolNames = getDeterministicToolNames(input.registry, input.tool_names);
	const availableTools: ModelCallableTool[] = [];

	for (const toolName of selectedToolNames) {
		const tool = input.registry.get(toolName);

		if (!tool) {
			return {
				failure: createFailure(
					'TOOL_NOT_FOUND',
					toolName,
					`Tool registry does not contain ${toolName}.`,
				),
				status: 'failed',
			};
		}

		const callableTool = toCallableTool(tool);

		if (!callableTool) {
			return {
				failure: createFailure(
					'CALLABLE_TOOL_SCHEMA_NOT_FOUND',
					toolName,
					`No callable tool schema is registered for ${toolName}.`,
				),
				status: 'failed',
			};
		}

		availableTools.push(callableTool);
	}

	return {
		available_tools: availableTools,
		selected_tool_names: selectedToolNames,
		status: 'completed',
	};
}
