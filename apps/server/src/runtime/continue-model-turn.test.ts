import type { ToolCallInput, ToolDefinition, ToolExecutionContext, ToolResult } from '@runa/types';

import { describe, expect, it } from 'vitest';

import { ToolRegistry } from '../tools/registry.js';

import { continueModelTurn } from './continue-model-turn.js';

function createToolDefinition(
	execute: (input: ToolCallInput, context: ToolExecutionContext) => Promise<ToolResult>,
	metadataOverrides: Partial<ToolDefinition['metadata']> = {},
): ToolDefinition {
	return {
		description: 'Test tool definition for model turn continuation.',
		execute,
		metadata: {
			capability_class: 'file_system',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			...metadataOverrides,
		},
		name: 'file.read',
	};
}

describe('continueModelTurn', () => {
	it('completes the assistant_response path and preserves assistant text', async () => {
		const registry = new ToolRegistry();

		const result = await continueModelTurn({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_continue_assistant',
				trace_id: 'trace_continue_assistant',
			},
			model_turn_outcome: {
				kind: 'assistant_response',
				text: 'Assistant says hello.',
			},
			registry,
			run_id: 'run_continue_assistant',
			trace_id: 'trace_continue_assistant',
		});

		expect(result).toEqual({
			assistant_text: 'Assistant says hello.',
			events: [],
			final_state: 'COMPLETED',
			outcome_kind: 'assistant_response',
			state_transitions: [
				{
					from: 'MODEL_THINKING',
					to: 'COMPLETED',
				},
			],
			status: 'completed',
		});
	});

	it('dispatches and ingests the tool_call path through the existing runtime helpers', async () => {
		const registry = new ToolRegistry();

		registry.register(
			createToolDefinition(async () => ({
				call_id: 'call_continue_tool',
				output: {
					content: 'file body',
					path: 'src/example.ts',
				},
				status: 'success',
				tool_name: 'file.read',
			})),
		);

		const result = await continueModelTurn({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_continue_tool',
				trace_id: 'trace_continue_tool',
				working_directory: 'd:\\ai\\Runa',
			},
			model_turn_outcome: {
				call_id: 'call_continue_tool',
				kind: 'tool_call',
				tool_input: {
					path: 'src/example.ts',
				},
				tool_name: 'file.read',
			},
			registry,
			run_id: 'run_continue_tool',
			trace_id: 'trace_continue_tool',
		});

		expect(result.status).toBe('completed');

		if (result.status !== 'completed' || result.outcome_kind !== 'tool_call') {
			throw new Error('Expected tool_call continuation to complete.');
		}

		expect(result.final_state).toBe('TOOL_RESULT_INGESTING');
		expect(result.suggested_next_state).toBe('MODEL_THINKING');
		expect(result.tool_name).toBe('file.read');
		expect(result.tool_result).toEqual({
			call_id: 'call_continue_tool',
			output: {
				content: 'file body',
				path: 'src/example.ts',
			},
			status: 'success',
			tool_name: 'file.read',
		});
		expect(result.ingested_result).toEqual({
			call_id: 'call_continue_tool',
			kind: 'tool_result',
			output: {
				content: 'file body',
				path: 'src/example.ts',
			},
			result_status: 'success',
			tool_name: 'file.read',
		});
		expect(result.state_transitions).toEqual([
			{
				from: 'MODEL_THINKING',
				to: 'TOOL_EXECUTING',
			},
			{
				from: 'TOOL_EXECUTING',
				to: 'TOOL_RESULT_INGESTING',
			},
		]);
		expect(result.events).toHaveLength(2);
	});

	it('preserves ingested error artifacts for tool_call outcomes', async () => {
		const registry = new ToolRegistry();

		registry.register(
			createToolDefinition(async () => ({
				call_id: 'call_continue_tool_error',
				error_code: 'NOT_FOUND',
				error_message: 'File does not exist.',
				status: 'error',
				tool_name: 'file.read',
			})),
		);

		const result = await continueModelTurn({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_continue_tool_error',
				trace_id: 'trace_continue_tool_error',
			},
			model_turn_outcome: {
				call_id: 'call_continue_tool_error',
				kind: 'tool_call',
				tool_input: {
					path: 'missing.ts',
				},
				tool_name: 'file.read',
			},
			registry,
			run_id: 'run_continue_tool_error',
			trace_id: 'trace_continue_tool_error',
		});

		expect(result.status).toBe('completed');

		if (result.status !== 'completed' || result.outcome_kind !== 'tool_call') {
			throw new Error('Expected errored tool_call continuation to complete with ingestion.');
		}

		expect(result.ingested_result).toEqual({
			call_id: 'call_continue_tool_error',
			error_code: 'NOT_FOUND',
			error_message: 'File does not exist.',
			kind: 'tool_result',
			result_status: 'error',
			tool_name: 'file.read',
		});
	});

	it('returns approval_required for gated tool_call outcomes before execution', async () => {
		const registry = new ToolRegistry();
		let executeCount = 0;

		registry.register({
			...createToolDefinition(
				async () => {
					executeCount += 1;

					return {
						call_id: 'call_continue_approval',
						output: {
							written: true,
						},
						status: 'success',
						tool_name: 'file.write',
					};
				},
				{
					requires_approval: true,
					risk_level: 'medium',
					side_effect_level: 'write',
				},
			),
			name: 'file.write',
		} satisfies ToolDefinition);

		const result = await continueModelTurn({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_continue_approval',
				trace_id: 'trace_continue_approval',
				working_directory: 'd:\\ai\\Runa',
			},
			model_turn_outcome: {
				call_id: 'call_continue_approval',
				kind: 'tool_call',
				tool_input: {
					path: 'src/example.ts',
				},
				tool_name: 'file.write',
			},
			registry,
			run_id: 'run_continue_approval',
			trace_id: 'trace_continue_approval',
		});

		expect(result.status).toBe('approval_required');

		if (result.status !== 'approval_required') {
			throw new Error('Expected approval-required continuation result.');
		}

		expect(result.final_state).toBe('WAITING_APPROVAL');
		expect(result.outcome_kind).toBe('tool_call');
		expect(result.approval_request).toMatchObject({
			action_kind: 'file_write',
			call_id: 'call_continue_approval',
			run_id: 'run_continue_approval',
			tool_name: 'file.write',
		});
		expect(result.state_transitions).toEqual([{ from: 'MODEL_THINKING', to: 'WAITING_APPROVAL' }]);
		expect(result.events).toEqual([]);
		expect(executeCount).toBe(0);
	});

	it('fails clearly for invalid starting state', async () => {
		const result = await continueModelTurn({
			current_state: 'INIT',
			execution_context: {
				run_id: 'run_continue_invalid_state',
				trace_id: 'trace_continue_invalid_state',
			},
			model_turn_outcome: {
				kind: 'assistant_response',
				text: 'hello',
			},
			registry: new ToolRegistry(),
			run_id: 'run_continue_invalid_state',
			trace_id: 'trace_continue_invalid_state',
		});

		expect(result).toEqual({
			call_id: undefined,
			events: [],
			failure: {
				cause: undefined,
				code: 'INVALID_CURRENT_STATE',
				message: 'continueModelTurn expects MODEL_THINKING but received INIT',
			},
			final_state: 'FAILED',
			outcome_kind: undefined,
			state_transitions: [],
			status: 'failed',
			tool_name: undefined,
		});
	});

	it('fails clearly for invalid model turn outcome shapes', async () => {
		const result = await continueModelTurn({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_continue_invalid_shape',
				trace_id: 'trace_continue_invalid_shape',
			},
			model_turn_outcome: {
				kind: 'tool_call',
				tool_name: 'file.read',
			},
			registry: new ToolRegistry(),
			run_id: 'run_continue_invalid_shape',
			trace_id: 'trace_continue_invalid_shape',
		});

		expect(result).toEqual({
			call_id: undefined,
			events: [],
			failure: {
				cause: undefined,
				code: 'INVALID_MODEL_TURN_OUTCOME',
				message:
					'Model turn outcome must be either assistant_response{text} or tool_call{call_id, tool_name, tool_input}.',
			},
			final_state: 'FAILED',
			outcome_kind: undefined,
			state_transitions: [],
			status: 'failed',
			tool_name: undefined,
		});
	});
});
