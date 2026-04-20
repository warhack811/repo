import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ToolCallInput, ToolDefinition, ToolExecutionContext, ToolResult } from '@runa/types';

import { describe, expect, it } from 'vitest';

import { createFileWriteTool } from '../tools/file-write.js';
import { ToolRegistry } from '../tools/registry.js';
import { InMemoryToolEffectIdempotencyStore } from '../tools/tool-idempotency.js';
import { requestApproval } from './request-approval.js';
import { resolveApproval } from './resolve-approval.js';
import { resumeApprovedToolCall } from './resume-approved-tool-call.js';
import { runToolStep } from './run-tool-step.js';

function createExecutionContext(): ToolExecutionContext {
	return {
		run_id: 'run_resume_approved_tool_call',
		trace_id: 'trace_resume_approved_tool_call',
		working_directory: process.cwd(),
	};
}

function createFakeTool(
	name: ToolCallInput['tool_name'],
	execute: (input: ToolCallInput, context: ToolExecutionContext) => Promise<ToolResult>,
): ToolDefinition {
	return {
		description: `${name} fake tool`,
		execute,
		metadata: {
			capability_class: name.startsWith('shell.') ? 'shell' : 'file_system',
			requires_approval: true,
			risk_level: name.startsWith('shell.') ? 'high' : 'medium',
			side_effect_level: name.startsWith('shell.') ? 'execute' : 'write',
		},
		name,
	};
}

describe('resumeApprovedToolCall', () => {
	it('replays an approved pending tool call through the existing execution path', async () => {
		const registry = new ToolRegistry();
		let executeCount = 0;

		registry.register(
			createFakeTool('file.write', async () => {
				executeCount += 1;

				return {
					call_id: 'call_resume_approved_1',
					output: {
						written: true,
					},
					status: 'success',
					tool_name: 'file.write',
				};
			}),
		);

		const gatedResult = await runToolStep({
			current_state: 'MODEL_THINKING',
			execution_context: createExecutionContext(),
			registry,
			run_id: 'run_resume_approved_1',
			tool_input: {
				arguments: {
					content: 'hello',
					path: 'src/example.ts',
				},
				call_id: 'call_resume_approved_1',
				tool_name: 'file.write',
			},
			tool_name: 'file.write',
			trace_id: 'trace_resume_approved_1',
		});

		expect(gatedResult.status).toBe('approval_required');

		if (gatedResult.status !== 'approval_required') {
			throw new Error('Expected approval_required result before replay.');
		}

		const resolutionResult = resolveApproval({
			approval_request: gatedResult.approval_request,
			current_state: gatedResult.final_state,
			decision: 'approved',
			run_id: 'run_resume_approved_1',
			trace_id: 'trace_resume_approved_1',
		});

		expect(resolutionResult.status).toBe('approved');

		if (resolutionResult.status !== 'approved') {
			throw new Error('Expected approved resolution before replay.');
		}

		const replayResult = await resumeApprovedToolCall({
			approval_request: gatedResult.approval_request,
			approval_resolution: resolutionResult.approval_resolution,
			call_id: 'call_resume_approved_1',
			current_state: resolutionResult.final_state,
			execution_context: {
				run_id: 'run_resume_approved_1',
				trace_id: 'trace_resume_approved_1',
				working_directory: 'd:\\ai\\Runa',
			},
			registry,
			run_id: 'run_resume_approved_1',
			tool_input: {
				arguments: {
					content: 'hello',
					path: 'src/example.ts',
				},
				call_id: 'call_resume_approved_1',
				tool_name: 'file.write',
			},
			tool_name: 'file.write',
			trace_id: 'trace_resume_approved_1',
		});

		expect(replayResult.status).toBe('completed');

		if (replayResult.status !== 'completed') {
			throw new Error('Expected approved tool call replay to complete.');
		}

		expect(executeCount).toBe(1);
		expect(replayResult.final_state).toBe('TOOL_RESULT_INGESTING');
		expect(replayResult.state_transitions).toEqual([
			{ from: 'MODEL_THINKING', to: 'TOOL_EXECUTING' },
			{ from: 'TOOL_EXECUTING', to: 'TOOL_RESULT_INGESTING' },
		]);
		expect(replayResult.events.map((event) => event.event_type)).toEqual([
			'tool.call.started',
			'tool.call.completed',
		]);
		expect(replayResult.tool_result).toEqual({
			call_id: 'call_resume_approved_1',
			output: {
				written: true,
			},
			status: 'success',
			tool_name: 'file.write',
		});
	});

	it('does not execute replay for rejected resolutions', async () => {
		const registry = new ToolRegistry();
		let executeCount = 0;

		registry.register(
			createFakeTool('shell.exec', async () => {
				executeCount += 1;

				return {
					call_id: 'call_resume_rejected_1',
					output: {
						stdout: 'should not run',
					},
					status: 'success',
					tool_name: 'shell.exec',
				};
			}),
		);
		const shellExecDefinition = registry.get('shell.exec');

		if (!shellExecDefinition) {
			throw new Error('Expected shell.exec to be registered.');
		}

		const approvalRequestResult = requestApproval({
			call_id: 'call_resume_rejected_1',
			current_state: 'MODEL_THINKING',
			run_id: 'run_resume_rejected_1',
			tool_definition: shellExecDefinition,
			trace_id: 'trace_resume_rejected_1',
		});

		expect(approvalRequestResult.status).toBe('approval_required');

		if (approvalRequestResult.status !== 'approval_required') {
			throw new Error('Expected approval_required request result.');
		}

		const resolutionResult = resolveApproval({
			approval_request: approvalRequestResult.approval_request,
			current_state: approvalRequestResult.final_state,
			decision: 'rejected',
			run_id: 'run_resume_rejected_1',
			trace_id: 'trace_resume_rejected_1',
		});

		expect(resolutionResult.status).toBe('rejected');

		if (resolutionResult.status !== 'rejected') {
			throw new Error('Expected rejected resolution.');
		}

		const replayResult = await resumeApprovedToolCall({
			approval_request: approvalRequestResult.approval_request,
			approval_resolution: resolutionResult.approval_resolution,
			call_id: 'call_resume_rejected_1',
			current_state: resolutionResult.final_state,
			execution_context: {
				run_id: 'run_resume_rejected_1',
				trace_id: 'trace_resume_rejected_1',
			},
			registry,
			run_id: 'run_resume_rejected_1',
			tool_input: {
				arguments: {
					command: 'echo',
				},
				call_id: 'call_resume_rejected_1',
				tool_name: 'shell.exec',
			},
			tool_name: 'shell.exec',
			trace_id: 'trace_resume_rejected_1',
		});

		expect(replayResult).toEqual({
			call_id: 'call_resume_rejected_1',
			events: [],
			final_state: 'FAILED',
			state_transitions: [],
			status: 'rejected',
			tool_name: 'shell.exec',
		});
		expect(executeCount).toBe(0);
	});

	it('fails clearly when approved replay starts from a non-MODEL_THINKING state', async () => {
		const registry = new ToolRegistry();

		registry.register(
			createFakeTool('file.write', async () => ({
				call_id: 'call_resume_invalid_state_1',
				output: {
					written: true,
				},
				status: 'success',
				tool_name: 'file.write',
			})),
		);
		const fileWriteDefinition = registry.get('file.write');

		if (!fileWriteDefinition) {
			throw new Error('Expected file.write to be registered.');
		}

		const approvalRequestResult = requestApproval({
			call_id: 'call_resume_invalid_state_1',
			current_state: 'MODEL_THINKING',
			run_id: 'run_resume_invalid_state_1',
			tool_definition: fileWriteDefinition,
			trace_id: 'trace_resume_invalid_state_1',
		});

		if (approvalRequestResult.status !== 'approval_required') {
			throw new Error('Expected approval_required request result.');
		}

		const resolutionResult = resolveApproval({
			approval_request: approvalRequestResult.approval_request,
			current_state: approvalRequestResult.final_state,
			decision: 'approved',
			run_id: 'run_resume_invalid_state_1',
			trace_id: 'trace_resume_invalid_state_1',
		});

		if (resolutionResult.status !== 'approved') {
			throw new Error('Expected approved resolution.');
		}

		const replayResult = await resumeApprovedToolCall({
			approval_request: approvalRequestResult.approval_request,
			approval_resolution: resolutionResult.approval_resolution,
			call_id: 'call_resume_invalid_state_1',
			current_state: 'WAITING_APPROVAL',
			execution_context: {
				run_id: 'run_resume_invalid_state_1',
				trace_id: 'trace_resume_invalid_state_1',
			},
			registry,
			run_id: 'run_resume_invalid_state_1',
			tool_input: {
				arguments: {
					content: 'hello',
					path: 'src/example.ts',
				},
				call_id: 'call_resume_invalid_state_1',
				tool_name: 'file.write',
			},
			tool_name: 'file.write',
			trace_id: 'trace_resume_invalid_state_1',
		});

		expect(replayResult.status).toBe('failed');

		if (replayResult.status !== 'failed') {
			throw new Error('Expected invalid state replay failure.');
		}

		expect(replayResult.failure).toEqual({
			cause: undefined,
			code: 'INVALID_CURRENT_STATE',
			message:
				'resumeApprovedToolCall expects MODEL_THINKING after approved resolution but received WAITING_APPROVAL',
		});
	});

	it('fails clearly when approval identity does not match the pending tool call', async () => {
		const registry = new ToolRegistry();

		registry.register(
			createFakeTool('file.write', async () => ({
				call_id: 'call_resume_identity_1',
				output: {
					written: true,
				},
				status: 'success',
				tool_name: 'file.write',
			})),
		);
		const fileWriteDefinition = registry.get('file.write');

		if (!fileWriteDefinition) {
			throw new Error('Expected file.write to be registered.');
		}

		const approvalRequestResult = requestApproval({
			call_id: 'call_resume_identity_1',
			current_state: 'MODEL_THINKING',
			run_id: 'run_resume_identity_1',
			tool_definition: fileWriteDefinition,
			trace_id: 'trace_resume_identity_1',
		});

		if (approvalRequestResult.status !== 'approval_required') {
			throw new Error('Expected approval_required request result.');
		}

		const resolutionResult = resolveApproval({
			approval_request: approvalRequestResult.approval_request,
			current_state: approvalRequestResult.final_state,
			decision: 'approved',
			run_id: 'run_resume_identity_1',
			trace_id: 'trace_resume_identity_1',
		});

		if (resolutionResult.status !== 'approved') {
			throw new Error('Expected approved resolution.');
		}

		const replayResult = await resumeApprovedToolCall({
			approval_request: approvalRequestResult.approval_request,
			approval_resolution: resolutionResult.approval_resolution,
			call_id: 'call_resume_identity_mismatch',
			current_state: resolutionResult.final_state,
			execution_context: {
				run_id: 'run_resume_identity_1',
				trace_id: 'trace_resume_identity_1',
			},
			registry,
			run_id: 'run_resume_identity_1',
			tool_input: {
				arguments: {
					content: 'hello',
					path: 'src/example.ts',
				},
				call_id: 'call_resume_identity_mismatch',
				tool_name: 'file.write',
			},
			tool_name: 'file.write',
			trace_id: 'trace_resume_identity_1',
		});

		expect(replayResult.status).toBe('failed');

		if (replayResult.status !== 'failed') {
			throw new Error('Expected invalid identity replay failure.');
		}

		expect(replayResult.failure).toEqual({
			cause: undefined,
			code: 'INVALID_APPROVAL_REQUEST',
			message:
				'Approval request and pending tool call identity must match run_id, trace_id, tool_name, and call_id.',
		});
	});

	it('does not re-apply the same file.write effect when an approved replay is repeated', async () => {
		const workspace = await mkdtemp(join(tmpdir(), 'runa-resume-approved-idempotency-'));
		const registry = new ToolRegistry();

		registry.register(
			createFileWriteTool({
				idempotencyStore: new InMemoryToolEffectIdempotencyStore(),
				readFile,
				stat,
				writeFile,
			}),
		);

		try {
			const gatedResult = await runToolStep({
				current_state: 'MODEL_THINKING',
				execution_context: {
					run_id: 'run_resume_idempotent_replay_1',
					trace_id: 'trace_resume_idempotent_replay_1',
					working_directory: workspace,
				},
				registry,
				run_id: 'run_resume_idempotent_replay_1',
				tool_input: {
					arguments: {
						content: 'approved content',
						path: 'note.txt',
					},
					call_id: 'call_resume_idempotent_replay_1',
					tool_name: 'file.write',
				},
				tool_name: 'file.write',
				trace_id: 'trace_resume_idempotent_replay_1',
			});

			if (gatedResult.status !== 'approval_required') {
				throw new Error('Expected approval_required result before idempotent replay.');
			}

			const resolutionResult = resolveApproval({
				approval_request: gatedResult.approval_request,
				current_state: gatedResult.final_state,
				decision: 'approved',
				run_id: 'run_resume_idempotent_replay_1',
				trace_id: 'trace_resume_idempotent_replay_1',
			});

			if (resolutionResult.status !== 'approved') {
				throw new Error('Expected approved resolution for idempotent replay test.');
			}

			const firstReplay = await resumeApprovedToolCall({
				approval_request: gatedResult.approval_request,
				approval_resolution: resolutionResult.approval_resolution,
				call_id: 'call_resume_idempotent_replay_1',
				current_state: resolutionResult.final_state,
				execution_context: {
					run_id: 'run_resume_idempotent_replay_1',
					trace_id: 'trace_resume_idempotent_replay_1',
					working_directory: workspace,
				},
				registry,
				run_id: 'run_resume_idempotent_replay_1',
				tool_input: {
					arguments: {
						content: 'approved content',
						path: 'note.txt',
					},
					call_id: 'call_resume_idempotent_replay_1',
					tool_name: 'file.write',
				},
				tool_name: 'file.write',
				trace_id: 'trace_resume_idempotent_replay_1',
			});
			const secondReplay = await resumeApprovedToolCall({
				approval_request: gatedResult.approval_request,
				approval_resolution: resolutionResult.approval_resolution,
				call_id: 'call_resume_idempotent_replay_1',
				current_state: resolutionResult.final_state,
				execution_context: {
					run_id: 'run_resume_idempotent_replay_1',
					trace_id: 'trace_resume_idempotent_replay_1',
					working_directory: workspace,
				},
				registry,
				run_id: 'run_resume_idempotent_replay_1',
				tool_input: {
					arguments: {
						content: 'approved content',
						path: 'note.txt',
					},
					call_id: 'call_resume_idempotent_replay_1',
					tool_name: 'file.write',
				},
				tool_name: 'file.write',
				trace_id: 'trace_resume_idempotent_replay_1',
			});

			expect(firstReplay.status).toBe('completed');
			expect(secondReplay.status).toBe('completed');

			if (firstReplay.status !== 'completed' || secondReplay.status !== 'completed') {
				throw new Error('Expected completed results for repeated approved replay.');
			}

			expect(firstReplay.tool_result).toMatchObject({
				output: {
					effect: 'applied',
					path: join(workspace, 'note.txt'),
				},
				status: 'success',
				tool_name: 'file.write',
			});
			expect(secondReplay.tool_result).toMatchObject({
				output: {
					bytes_written: 0,
					effect: 'already_applied',
					path: join(workspace, 'note.txt'),
				},
				status: 'success',
				tool_name: 'file.write',
			});
			expect(firstReplay.events.map((event) => event.event_type)).toEqual([
				'tool.call.started',
				'tool.call.completed',
			]);
			expect(secondReplay.events.map((event) => event.event_type)).toEqual([
				'tool.call.started',
				'tool.call.completed',
			]);
			await expect(readFile(join(workspace, 'note.txt'), 'utf8')).resolves.toBe('approved content');
		} finally {
			await rm(workspace, {
				force: true,
				recursive: true,
			});
		}
	});
});
