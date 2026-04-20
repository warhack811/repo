import type { ToolCallInput, ToolDefinition, ToolExecutionContext, ToolResult } from '@runa/types';

import { describe, expect, it } from 'vitest';

import { ToolRegistry } from '../tools/registry.js';

import { dispatchModelToolCall } from './model-tool-dispatch.js';

function createExecutionContext(): ToolExecutionContext {
	return {
		run_id: 'run_model_tool_dispatch',
		trace_id: 'trace_model_tool_dispatch',
		working_directory: process.cwd(),
	};
}

function createFakeTool(
	name: ToolCallInput['tool_name'],
	execute: (input: ToolCallInput, context: ToolExecutionContext) => Promise<ToolResult>,
	metadataOverrides: Partial<ToolDefinition['metadata']> = {},
): ToolDefinition {
	return {
		description: `${name} fake tool`,
		execute,
		metadata: {
			capability_class: name.startsWith('shell.') ? 'shell' : 'file_system',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			...metadataOverrides,
		},
		name,
	};
}

describe('dispatchModelToolCall', () => {
	it('dispatches a valid internal tool call through the registry and preserves call_id', async () => {
		const registry = new ToolRegistry();
		const toolResult: ToolResult = {
			call_id: 'call_dispatch_success',
			output: {
				content: 'ok',
			},
			status: 'success',
			tool_name: 'file.read',
		};

		registry.register(createFakeTool('file.read', async () => toolResult));

		const result = await dispatchModelToolCall({
			current_state: 'MODEL_THINKING',
			execution_context: createExecutionContext(),
			model_tool_call: {
				arguments: {
					path: 'README.md',
				},
				call_id: 'call_dispatch_success',
				tool_name: 'file.read',
			},
			registry,
			run_id: 'run_model_tool_dispatch',
			trace_id: 'trace_model_tool_dispatch',
		});

		expect(result.status).toBe('completed');

		if (result.status !== 'completed') {
			throw new Error('Expected completed dispatch result.');
		}

		expect(result.call_id).toBe('call_dispatch_success');
		expect(result.tool_name).toBe('file.read');
		expect(result.tool_result).toBe(toolResult);
		expect(result.state_transitions).toEqual([
			{ from: 'MODEL_THINKING', to: 'TOOL_EXECUTING' },
			{ from: 'TOOL_EXECUTING', to: 'TOOL_RESULT_INGESTING' },
		]);
		expect(result.events.map((event) => event.event_type)).toEqual([
			'tool.call.started',
			'tool.call.completed',
		]);
	});

	it('returns an explicit failure when the registry does not contain the requested tool', async () => {
		const registry = new ToolRegistry();

		const result = await dispatchModelToolCall({
			current_state: 'MODEL_THINKING',
			execution_context: createExecutionContext(),
			model_tool_call: {
				arguments: {
					path: 'README.md',
				},
				call_id: 'call_dispatch_missing',
				tool_name: 'file.read',
			},
			registry,
			run_id: 'run_model_tool_dispatch_missing',
			trace_id: 'trace_model_tool_dispatch_missing',
		});

		expect(result.status).toBe('failed');

		if (result.status !== 'failed') {
			throw new Error('Expected missing tool dispatch failure.');
		}

		expect(result.call_id).toBe('call_dispatch_missing');
		expect(result.tool_name).toBe('file.read');
		expect(result.failure.code).toBe('TOOL_NOT_FOUND');
		expect(result.state_transitions).toEqual([{ from: 'MODEL_THINKING', to: 'FAILED' }]);
		expect(result.events.map((event) => event.event_type)).toEqual(['tool.call.failed']);
	});

	it('returns an explicit failure for an invalid internal tool call shape', async () => {
		const registry = new ToolRegistry();

		const result = await dispatchModelToolCall({
			current_state: 'MODEL_THINKING',
			execution_context: createExecutionContext(),
			model_tool_call: {
				arguments: 'not-an-object',
				call_id: '',
				tool_name: 'file.read',
			},
			registry,
			run_id: 'run_model_tool_dispatch_invalid',
			trace_id: 'trace_model_tool_dispatch_invalid',
		});

		expect(result.status).toBe('failed');

		if (result.status !== 'failed') {
			throw new Error('Expected invalid tool call failure.');
		}

		expect(result.failure.code).toBe('INVALID_MODEL_TOOL_CALL');
		expect(result.state_transitions).toEqual([]);
		expect(result.events).toEqual([]);
	});

	it('carries typed tool error results without interpreting them', async () => {
		const registry = new ToolRegistry();
		const toolResult: ToolResult = {
			call_id: 'call_dispatch_error_surface',
			error_code: 'INVALID_INPUT',
			error_message: 'tool level validation failed',
			status: 'error',
			tool_name: 'search.grep',
		};

		registry.register(createFakeTool('search.grep', async () => toolResult));

		const result = await dispatchModelToolCall({
			current_state: 'MODEL_THINKING',
			execution_context: createExecutionContext(),
			model_tool_call: {
				arguments: {
					path: '.',
					query: 'needle',
				},
				call_id: 'call_dispatch_error_surface',
				tool_name: 'search.grep',
			},
			registry,
			run_id: 'run_model_tool_dispatch_error_surface',
			trace_id: 'trace_model_tool_dispatch_error_surface',
		});

		expect(result.status).toBe('completed');

		if (result.status !== 'completed') {
			throw new Error('Expected completed dispatch result carrying tool error surface.');
		}

		expect(result.call_id).toBe('call_dispatch_error_surface');
		expect(result.tool_result).toBe(toolResult);
		expect(result.events[1]?.event_type).toBe('tool.call.completed');
	});

	it('returns approval_required when the tool is gated by approval metadata', async () => {
		const registry = new ToolRegistry();
		let executeCount = 0;

		registry.register(
			createFakeTool(
				'file.write',
				async () => {
					executeCount += 1;

					return {
						call_id: 'call_dispatch_requires_approval',
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
		);

		const result = await dispatchModelToolCall({
			current_state: 'MODEL_THINKING',
			execution_context: createExecutionContext(),
			model_tool_call: {
				arguments: {
					path: 'README.md',
				},
				call_id: 'call_dispatch_requires_approval',
				tool_name: 'file.write',
			},
			registry,
			run_id: 'run_model_tool_dispatch_requires_approval',
			trace_id: 'trace_model_tool_dispatch_requires_approval',
		});

		expect(result.status).toBe('approval_required');

		if (result.status !== 'approval_required') {
			throw new Error('Expected approval-required dispatch result.');
		}

		expect(result.final_state).toBe('WAITING_APPROVAL');
		expect(result.approval_request).toMatchObject({
			action_kind: 'file_write',
			call_id: 'call_dispatch_requires_approval',
			run_id: 'run_model_tool_dispatch_requires_approval',
			tool_name: 'file.write',
		});
		expect(result.state_transitions).toEqual([{ from: 'MODEL_THINKING', to: 'WAITING_APPROVAL' }]);
		expect(result.events).toEqual([]);
		expect(executeCount).toBe(0);
	});
});
