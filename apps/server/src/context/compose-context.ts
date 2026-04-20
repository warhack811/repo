import type { RuntimeState, ToolArtifactRef, ToolErrorCode, ToolName } from '@runa/types';

import type { MemoryLayer } from './compose-memory-context.js';
import type { WorkspaceLayer } from './compose-workspace-context.js';

const CORE_RULES = [
	'Work semantically, deterministically, and with typed contracts.',
	'Use registered tools only; do not bypass the ToolRegistry.',
	'Respect the runtime state machine and valid typed transitions.',
	'Treat tool results as structured runtime data before any follow-up model turn.',
	'Prefer production-grade core behavior over fallback hacks.',
	'Do not use tools for simple greetings, acknowledgments, or conversational filler; answer directly.',
	'Respond in the same language used by the user in their request.',
] as const;

export interface ContextToolResultReference {
	readonly artifact_ref?: ToolArtifactRef;
	readonly call_id: string;
	readonly error_code?: ToolErrorCode;
	readonly error_message?: string;
	readonly output?: unknown;
	readonly result_status: 'error' | 'success';
	readonly tool_name: ToolName;
}

export interface ComposeContextInput {
	readonly current_state: RuntimeState;
	readonly latest_tool_result?: ContextToolResultReference;
	readonly memory_layer?: MemoryLayer;
	readonly run_id: string;
	readonly trace_id: string;
	readonly workspace_layer?: WorkspaceLayer;
	readonly working_directory?: string;
}

export interface CoreRulesLayer {
	readonly content: {
		readonly principles: readonly string[];
	};
	readonly kind: 'instruction';
	readonly name: 'core_rules';
}

export interface RunLayer {
	readonly content: {
		readonly current_state: RuntimeState;
		readonly latest_tool_result?: {
			readonly artifact_attached: boolean;
			readonly call_id: string;
			readonly error_code?: ToolErrorCode;
			readonly error_message?: string;
			readonly output_kind?: 'array' | 'boolean' | 'null' | 'number' | 'object' | 'string';
			readonly result_status: 'error' | 'success';
			readonly tool_name: ToolName;
		};
		readonly run_id: string;
		readonly trace_id: string;
		readonly working_directory?: string;
	};
	readonly kind: 'runtime';
	readonly name: 'run_layer';
}

export type ComposedContextLayer = CoreRulesLayer | MemoryLayer | RunLayer | WorkspaceLayer;

export interface ComposedContext {
	readonly layers: readonly ComposedContextLayer[];
}

function detectOutputKind(
	output: unknown,
): 'array' | 'boolean' | 'null' | 'number' | 'object' | 'string' {
	if (output === null) {
		return 'null';
	}

	if (Array.isArray(output)) {
		return 'array';
	}

	switch (typeof output) {
		case 'boolean':
			return 'boolean';
		case 'number':
			return 'number';
		case 'string':
			return 'string';
		default:
			return 'object';
	}
}

function buildCoreRulesLayer(): CoreRulesLayer {
	return {
		content: {
			principles: CORE_RULES,
		},
		kind: 'instruction',
		name: 'core_rules',
	};
}

function buildRunLayer(input: ComposeContextInput): RunLayer {
	return {
		content: {
			current_state: input.current_state,
			latest_tool_result: input.latest_tool_result
				? {
						artifact_attached: input.latest_tool_result.artifact_ref !== undefined,
						call_id: input.latest_tool_result.call_id,
						error_code: input.latest_tool_result.error_code,
						error_message: input.latest_tool_result.error_message,
						output_kind:
							input.latest_tool_result.result_status === 'success'
								? detectOutputKind(input.latest_tool_result.output)
								: undefined,
						result_status: input.latest_tool_result.result_status,
						tool_name: input.latest_tool_result.tool_name,
					}
				: undefined,
			run_id: input.run_id,
			trace_id: input.trace_id,
			working_directory: input.working_directory,
		},
		kind: 'runtime',
		name: 'run_layer',
	};
}

export function composeContext(input: ComposeContextInput): ComposedContext {
	const layers: ComposedContextLayer[] = [buildCoreRulesLayer(), buildRunLayer(input)];

	if (input.workspace_layer) {
		layers.push(input.workspace_layer);
	}

	if (input.memory_layer) {
		layers.push(input.memory_layer);
	}

	return {
		layers,
	};
}
