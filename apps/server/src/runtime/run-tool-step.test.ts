import { resolve } from 'node:path';

import type { ToolCallInput, ToolDefinition, ToolExecutionContext, ToolResult } from '@runa/types';

import { describe, expect, it } from 'vitest';

import type { RunRecordWriter } from '../persistence/run-store.js';
import { ToolRegistry } from '../tools/registry.js';
import { resolveApproval } from './resolve-approval.js';
import { runToolStep } from './run-tool-step.js';

function createExecutionContext(): ToolExecutionContext {
	return {
		run_id: 'run_tool_step',
		trace_id: 'trace_tool_step',
		working_directory: process.cwd(),
	};
}

function createToolInput(toolName: ToolCallInput['tool_name']): ToolCallInput {
	return {
		arguments: {},
		call_id: 'call_tool_step',
		tool_name: toolName,
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

function createPersistenceRecorder(): {
	readonly runRecords: Parameters<RunRecordWriter['upsertRun']>[0][];
	readonly toolCallRecords: Parameters<RunRecordWriter['upsertToolCall']>[0][];
	readonly writer: RunRecordWriter;
} {
	const runRecords: Parameters<RunRecordWriter['upsertRun']>[0][] = [];
	const toolCallRecords: Parameters<RunRecordWriter['upsertToolCall']>[0][] = [];

	return {
		runRecords,
		toolCallRecords,
		writer: {
			async upsertRun(record) {
				runRecords.push(record);
			},
			async upsertToolCall(record) {
				toolCallRecords.push(record);
			},
		},
	};
}

describe('runToolStep', () => {
	it('executes a registered tool and advances to TOOL_RESULT_INGESTING', async () => {
		const registry = new ToolRegistry();
		const persistence = createPersistenceRecorder();
		const toolResult: ToolResult = {
			call_id: 'call_tool_step',
			output: {
				content: 'ok',
			},
			status: 'success',
			tool_name: 'file.read',
		};

		registry.register(createFakeTool('file.read', async () => toolResult));

		const result = await runToolStep({
			current_state: 'MODEL_THINKING',
			execution_context: createExecutionContext(),
			persistence_writer: persistence.writer,
			registry,
			run_id: 'run_tool_step',
			tool_input: createToolInput('file.read'),
			tool_name: 'file.read',
			trace_id: 'trace_tool_step',
		});

		expect(result.status).toBe('completed');

		if (result.status !== 'completed') {
			throw new Error('Expected successful tool orchestration result.');
		}

		expect(result.final_state).toBe('TOOL_RESULT_INGESTING');
		expect(result.state_transitions).toEqual([
			{ from: 'MODEL_THINKING', to: 'TOOL_EXECUTING' },
			{ from: 'TOOL_EXECUTING', to: 'TOOL_RESULT_INGESTING' },
		]);
		expect(result.tool_result).toBe(toolResult);
		expect(result.events.map((event) => event.event_type)).toEqual([
			'tool.call.started',
			'tool.call.completed',
		]);
		expect(persistence.runRecords.map((record) => record.current_state)).toEqual([
			'TOOL_EXECUTING',
			'TOOL_RESULT_INGESTING',
		]);
		expect(persistence.toolCallRecords.map((record) => record.status)).toEqual([
			'started',
			'completed',
		]);
		expect(persistence.toolCallRecords[1]).toMatchObject({
			call_id: 'call_tool_step',
			result_summary: 'Object{content}',
			state_after: 'TOOL_RESULT_INGESTING',
			state_before: 'TOOL_EXECUTING',
			status: 'completed',
			tool_name: 'file.read',
		});
	});

	it('fails deterministically when the declared tool name does not match the tool_input surface', async () => {
		const registry = new ToolRegistry();
		const persistence = createPersistenceRecorder();
		let executeCount = 0;

		registry.register(
			createFakeTool('file.read', async () => {
				executeCount += 1;

				return {
					call_id: 'call_tool_step_mismatch',
					output: {
						content: 'should not execute',
					},
					status: 'success',
					tool_name: 'file.read',
				};
			}),
		);

		const result = await runToolStep({
			current_state: 'MODEL_THINKING',
			execution_context: createExecutionContext(),
			persistence_writer: persistence.writer,
			registry,
			run_id: 'run_tool_step_mismatch',
			tool_input: {
				arguments: {},
				call_id: 'call_tool_step_mismatch',
				tool_name: 'file.write',
			},
			tool_name: 'file.read',
			trace_id: 'trace_tool_step_mismatch',
		});

		expect(result.status).toBe('failed');

		if (result.status !== 'failed') {
			throw new Error('Expected tool input mismatch failure result.');
		}

		expect(executeCount).toBe(0);
		expect(result.failure.code).toBe('TOOL_INPUT_MISMATCH');
		expect(result.final_state).toBe('FAILED');
		expect(result.state_transitions).toEqual([{ from: 'MODEL_THINKING', to: 'FAILED' }]);
		expect(result.events.map((event) => event.event_type)).toEqual(['tool.call.failed']);
		expect(result.events[0]?.payload).toMatchObject({
			call_id: 'call_tool_step_mismatch',
			error_code: 'TOOL_INPUT_MISMATCH',
			tool_name: 'file.read',
		});
		expect(persistence.runRecords.map((record) => record.current_state)).toEqual(['FAILED']);
		expect(persistence.toolCallRecords).toEqual([
			expect.objectContaining({
				call_id: 'call_tool_step_mismatch',
				error_code: 'TOOL_INPUT_MISMATCH',
				state_after: 'FAILED',
				state_before: 'MODEL_THINKING',
				status: 'failed',
				tool_name: 'file.read',
			}),
		]);
	});

	it('returns an explicit failure when the tool is missing from the registry', async () => {
		const registry = new ToolRegistry();
		const persistence = createPersistenceRecorder();

		const result = await runToolStep({
			current_state: 'MODEL_THINKING',
			execution_context: createExecutionContext(),
			persistence_writer: persistence.writer,
			registry,
			run_id: 'run_tool_step_missing',
			tool_input: createToolInput('file.read'),
			tool_name: 'file.read',
			trace_id: 'trace_tool_step_missing',
		});

		expect(result).toMatchObject({
			final_state: 'FAILED',
			status: 'failed',
			tool_name: 'file.read',
		});

		if (result.status !== 'failed') {
			throw new Error('Expected missing tool failure result.');
		}

		expect(result.failure.code).toBe('TOOL_NOT_FOUND');
		expect(result.state_transitions).toEqual([{ from: 'MODEL_THINKING', to: 'FAILED' }]);
		expect(result.events.map((event) => event.event_type)).toEqual(['tool.call.failed']);
		expect(persistence.runRecords.map((record) => record.current_state)).toEqual(['FAILED']);
		expect(persistence.toolCallRecords).toEqual([
			expect.objectContaining({
				error_code: 'TOOL_NOT_FOUND',
				state_after: 'FAILED',
				state_before: 'MODEL_THINKING',
				status: 'failed',
				tool_name: 'file.read',
			}),
		]);
	});

	it('converts thrown tool exceptions into an explicit orchestration failure', async () => {
		const registry = new ToolRegistry();
		const persistence = createPersistenceRecorder();

		registry.register(
			createFakeTool('file.write', async () => {
				throw new Error('simulated tool crash');
			}),
		);

		const result = await runToolStep({
			current_state: 'MODEL_THINKING',
			execution_context: createExecutionContext(),
			persistence_writer: persistence.writer,
			registry,
			run_id: 'run_tool_step_throw',
			tool_input: createToolInput('file.write'),
			tool_name: 'file.write',
			trace_id: 'trace_tool_step_throw',
		});

		expect(result).toMatchObject({
			final_state: 'FAILED',
			status: 'failed',
			tool_name: 'file.write',
		});

		if (result.status !== 'failed') {
			throw new Error('Expected thrown tool failure result.');
		}

		expect(result.failure.code).toBe('TOOL_EXECUTION_FAILED');
		expect(result.state_transitions).toEqual([
			{ from: 'MODEL_THINKING', to: 'TOOL_EXECUTING' },
			{ from: 'TOOL_EXECUTING', to: 'FAILED' },
		]);
		expect(result.events.map((event) => event.event_type)).toEqual([
			'tool.call.started',
			'tool.call.failed',
		]);
		expect(persistence.runRecords.map((record) => record.current_state)).toEqual([
			'TOOL_EXECUTING',
			'FAILED',
		]);
		expect(persistence.toolCallRecords.map((record) => record.status)).toEqual([
			'started',
			'failed',
		]);
		expect(persistence.toolCallRecords[1]).toMatchObject({
			error_code: 'TOOL_EXECUTION_FAILED',
			state_after: 'FAILED',
			state_before: 'TOOL_EXECUTING',
			tool_name: 'file.write',
		});
	});

	it('carries typed tool error results without interpreting them', async () => {
		const registry = new ToolRegistry();
		const toolResult: ToolResult = {
			call_id: 'call_tool_step',
			error_code: 'INVALID_INPUT',
			error_message: 'tool level error',
			status: 'error',
			tool_name: 'search.grep',
		};

		registry.register(createFakeTool('search.grep', async () => toolResult));

		const result = await runToolStep({
			current_state: 'MODEL_THINKING',
			execution_context: createExecutionContext(),
			registry,
			run_id: 'run_tool_step_result_error',
			tool_input: createToolInput('search.grep'),
			tool_name: 'search.grep',
			trace_id: 'trace_tool_step_result_error',
		});

		expect(result.status).toBe('completed');

		if (result.status !== 'completed') {
			throw new Error('Expected completed result for typed tool error surface.');
		}

		expect(result.tool_result).toBe(toolResult);
		expect(result.final_state).toBe('TOOL_RESULT_INGESTING');
		expect(result.events).toHaveLength(2);
		expect(result.events[1]?.event_type).toBe('tool.call.completed');
		expect(result.events[1]?.payload).toMatchObject({
			result_status: 'error',
		});
	});

	it('threads shell session lifecycle metadata into completed tool events', async () => {
		const registry = new ToolRegistry();
		const shellSessionMetadata = {
			kind: 'shell_session_lifecycle',
			next_action_hint: 'read_later_or_stop',
			redacted_occurrence_count: 0,
			redacted_source_kinds: [],
			redaction_applied: false,
			secret_values_exposed: false,
			session_id: 'session_run_tool_step',
			status: 'running',
			tool_name: 'shell.session.read',
		};
		const toolResult: ToolResult = {
			call_id: 'call_tool_step',
			metadata: {
				shell_session: shellSessionMetadata,
			},
			output: {
				has_output: false,
				runtime_feedback: 'Shell session session_run_tool_step is still running.',
			},
			status: 'success',
			tool_name: 'shell.session.read',
		};

		registry.register(createFakeTool('shell.session.read', async () => toolResult));

		const result = await runToolStep({
			bypass_approval_gate: true,
			current_state: 'MODEL_THINKING',
			execution_context: createExecutionContext(),
			registry,
			run_id: 'run_tool_step',
			tool_input: {
				arguments: {
					session_id: 'session_run_tool_step',
				},
				call_id: 'call_tool_step',
				tool_name: 'shell.session.read',
			},
			tool_name: 'shell.session.read',
			trace_id: 'trace_tool_step',
		});

		expect(result.status).toBe('completed');

		if (result.status !== 'completed') {
			throw new Error('Expected shell session read to complete.');
		}

		expect(result.events[1]?.metadata).toEqual({
			shell_session: shellSessionMetadata,
		});
	});

	it('returns approval_required without executing the tool when approval is needed', async () => {
		const registry = new ToolRegistry();
		const persistence = createPersistenceRecorder();
		let executeCount = 0;

		registry.register(
			createFakeTool(
				'file.write',
				async () => {
					executeCount += 1;

					return {
						call_id: 'call_tool_step',
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

		const result = await runToolStep({
			current_state: 'MODEL_THINKING',
			execution_context: createExecutionContext(),
			persistence_writer: persistence.writer,
			registry,
			run_id: 'run_tool_step_approval',
			tool_input: {
				arguments: {
					path: 'src/example.ts',
				},
				call_id: 'call_tool_step',
				tool_name: 'file.write',
			},
			tool_name: 'file.write',
			trace_id: 'trace_tool_step_approval',
		});

		expect(result.status).toBe('approval_required');

		if (result.status !== 'approval_required') {
			throw new Error('Expected approval-required tool orchestration result.');
		}

		expect(executeCount).toBe(0);
		expect(result.final_state).toBe('WAITING_APPROVAL');
		expect(result.state_transitions).toEqual([{ from: 'MODEL_THINKING', to: 'WAITING_APPROVAL' }]);
		expect(result.approval_request).toMatchObject({
			action_kind: 'file_write',
			call_id: 'call_tool_step',
			run_id: 'run_tool_step_approval',
			status: 'pending',
			tool_name: 'file.write',
			trace_id: 'trace_tool_step_approval',
		});
		expect(result.approval_request.target).toMatchObject({
			call_id: 'call_tool_step',
			kind: 'file_path',
			label: resolve(process.cwd(), 'src/example.ts'),
			tool_name: 'file.write',
		});
		expect(result.approval_event.payload).toMatchObject({
			action_kind: 'file_write',
			approval_id: result.approval_request.approval_id,
			call_id: 'call_tool_step',
			tool_name: 'file.write',
		});
		expect(result.events).toEqual([]);
		expect(persistence.runRecords.map((record) => record.current_state)).toEqual([
			'WAITING_APPROVAL',
		]);
		expect(persistence.toolCallRecords).toEqual([]);
	});

	it('threads an explicit approval target into the approval request when provided', async () => {
		const registry = new ToolRegistry();

		registry.register(
			createFakeTool(
				'desktop.screenshot',
				async () => ({
					call_id: 'call_tool_step_desktop_target',
					output: {
						ok: true,
					},
					status: 'success',
					tool_name: 'desktop.screenshot',
				}),
				{
					capability_class: 'desktop',
					requires_approval: true,
					risk_level: 'high',
					side_effect_level: 'execute',
				},
			),
		);

		const result = await runToolStep({
			approval_target: {
				call_id: 'call_tool_step_desktop_target',
				kind: 'tool_call',
				label: 'Target Workstation',
				tool_name: 'desktop.screenshot',
			},
			current_state: 'MODEL_THINKING',
			execution_context: createExecutionContext(),
			registry,
			run_id: 'run_tool_step_desktop_target',
			tool_input: {
				arguments: {},
				call_id: 'call_tool_step_desktop_target',
				tool_name: 'desktop.screenshot',
			},
			tool_name: 'desktop.screenshot',
			trace_id: 'trace_tool_step_desktop_target',
		});

		expect(result.status).toBe('approval_required');

		if (result.status !== 'approval_required') {
			throw new Error('Expected approval-required result for desktop target propagation.');
		}

		expect(result.approval_request.target).toEqual({
			call_id: 'call_tool_step_desktop_target',
			kind: 'tool_call',
			label: 'Target Workstation',
			tool_name: 'desktop.screenshot',
		});
	});

	it('executes an approval-gated tool when bypass_approval_gate is explicitly enabled', async () => {
		const registry = new ToolRegistry();
		const persistence = createPersistenceRecorder();
		let executeCount = 0;

		registry.register(
			createFakeTool(
				'file.write',
				async () => {
					executeCount += 1;

					return {
						call_id: 'call_tool_step_bypass',
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

		const result = await runToolStep({
			bypass_approval_gate: true,
			current_state: 'MODEL_THINKING',
			execution_context: createExecutionContext(),
			persistence_writer: persistence.writer,
			registry,
			run_id: 'run_tool_step_bypass',
			tool_input: {
				arguments: {
					path: 'src/app.ts',
				},
				call_id: 'call_tool_step_bypass',
				tool_name: 'file.write',
			},
			tool_name: 'file.write',
			trace_id: 'trace_tool_step_bypass',
		});

		expect(result.status).toBe('completed');

		if (result.status !== 'completed') {
			throw new Error('Expected bypassed approval tool execution to complete.');
		}

		expect(executeCount).toBe(1);
		expect(result.final_state).toBe('TOOL_RESULT_INGESTING');
		expect(result.state_transitions).toEqual([
			{ from: 'MODEL_THINKING', to: 'TOOL_EXECUTING' },
			{ from: 'TOOL_EXECUTING', to: 'TOOL_RESULT_INGESTING' },
		]);
		expect(result.events.map((event) => event.event_type)).toEqual([
			'tool.call.started',
			'tool.call.completed',
		]);
		expect(result.tool_name).toBe('file.write');
		expect(result.tool_metadata).toMatchObject({
			requires_approval: true,
			side_effect_level: 'write',
		});
		expect(persistence.runRecords.map((record) => record.current_state)).toEqual([
			'TOOL_EXECUTING',
			'TOOL_RESULT_INGESTING',
		]);
		expect(persistence.toolCallRecords.map((record) => record.status)).toEqual([
			'started',
			'completed',
		]);
	});

	it('keeps the gated tool unexecuted when the approval is rejected', async () => {
		const registry = new ToolRegistry();
		let executeCount = 0;

		registry.register(
			createFakeTool(
				'shell.exec',
				async () => {
					executeCount += 1;

					return {
						call_id: 'call_tool_step',
						output: {
							stdout: 'should not run',
						},
						status: 'success',
						tool_name: 'shell.exec',
					};
				},
				{
					requires_approval: true,
					risk_level: 'high',
					side_effect_level: 'execute',
				},
			),
		);

		const gatedResult = await runToolStep({
			current_state: 'MODEL_THINKING',
			execution_context: createExecutionContext(),
			registry,
			run_id: 'run_tool_step_rejected',
			tool_input: createToolInput('shell.exec'),
			tool_name: 'shell.exec',
			trace_id: 'trace_tool_step_rejected',
		});

		expect(gatedResult.status).toBe('approval_required');

		if (gatedResult.status !== 'approval_required') {
			throw new Error('Expected approval-required result before rejection.');
		}

		const resolutionResult = resolveApproval({
			approval_request: gatedResult.approval_request,
			current_state: gatedResult.final_state,
			decision: 'rejected',
			run_id: 'run_tool_step_rejected',
			trace_id: 'trace_tool_step_rejected',
		});

		expect(resolutionResult).toMatchObject({
			final_state: 'FAILED',
			status: 'rejected',
		});
		expect(executeCount).toBe(0);
	});

	it('returns an explicit failure for invalid starting state', async () => {
		const registry = new ToolRegistry();

		registry.register(
			createFakeTool('file.list', async () => ({
				call_id: 'call_tool_step',
				output: {},
				status: 'success',
				tool_name: 'file.list',
			})),
		);

		const result = await runToolStep({
			current_state: 'INIT',
			execution_context: createExecutionContext(),
			registry,
			run_id: 'run_tool_step_init',
			tool_input: createToolInput('file.list'),
			tool_name: 'file.list',
			trace_id: 'trace_tool_step_init',
		});

		expect(result).toMatchObject({
			final_state: 'FAILED',
			status: 'failed',
			tool_name: 'file.list',
		});

		if (result.status !== 'failed') {
			throw new Error('Expected invalid state failure result.');
		}

		expect(result.failure.code).toBe('INVALID_CURRENT_STATE');
		expect(result.state_transitions).toEqual([]);
		expect(result.events).toEqual([]);
	});
});
