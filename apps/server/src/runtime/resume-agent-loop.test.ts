import type {
	MetadataOnlyCheckpointRecord,
	ModelGateway,
	ModelRequest,
	ModelResponse,
	ModelStreamChunk,
	ResumableResumeContext,
	TerminalResumeContext,
} from '@runa/types';

import { describe, expect, it } from 'vitest';

import type { ResolveResumeCheckpointResult } from './checkpoint-manager.js';
import type { RunModelTurnAssistantResponseResult, RunModelTurnInput } from './run-model-turn.js';

import { ToolRegistry } from '../tools/registry.js';
import { resolveAgentLoopResume, resumeAgentLoop } from './resume-agent-loop.js';

class StubModelGateway implements ModelGateway {
	async generate(_request: ModelRequest): Promise<ModelResponse> {
		throw new Error('generate should not be called directly in resume-agent-loop tests');
	}

	async *stream(_request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		yield* [];
	}
}

function createModelRequest(overrides: Partial<ModelRequest> = {}): ModelRequest {
	return {
		messages: [
			{
				content: 'Resume the current task.',
				role: 'user',
			},
		],
		run_id: 'run_resume_loop',
		trace_id: 'trace_resume_loop',
		...overrides,
	};
}

function createAssistantCompletionResult(): RunModelTurnAssistantResponseResult {
	return {
		assistant_text: 'Resumed assistant answer.',
		continuation_result: {
			assistant_text: 'Resumed assistant answer.',
			events: [],
			final_state: 'COMPLETED',
			outcome_kind: 'assistant_response',
			state_transitions: [{ from: 'MODEL_THINKING', to: 'COMPLETED' }],
			status: 'completed',
		},
		final_state: 'COMPLETED',
		model_response: {
			finish_reason: 'stop',
			message: {
				content: 'Resumed assistant answer.',
				role: 'assistant',
			},
			model: 'claude-3-7-sonnet',
			provider: 'claude',
		},
		model_turn_outcome: {
			kind: 'assistant_response',
			text: 'Resumed assistant answer.',
		},
		resolved_model_request: createModelRequest(),
		status: 'completed',
	};
}

function createResumableCheckpointRecord(
	overrides: Partial<MetadataOnlyCheckpointRecord> = {},
): MetadataOnlyCheckpointRecord {
	return {
		blob_refs: [],
		meta: {
			checkpoint_id: 'checkpoint_resume_loop_4',
			checkpoint_version: 1,
			checkpointed_at: '2026-04-17T17:00:00.000Z',
			created_at: '2026-04-17T17:00:00.000Z',
			loop_state: 'WAITING',
			metadata: {
				checkpoint_source: 'loop.boundary',
			},
			parent_checkpoint_id: 'checkpoint_resume_loop_3',
			persistence_mode: 'metadata_only',
			run_id: 'run_resume_loop',
			runtime_state: 'WAITING_APPROVAL',
			schema_version: 1,
			scope: {
				kind: 'run',
				run_id: 'run_resume_loop',
				subject_id: 'run_resume_loop',
				trace_id: 'trace_resume_loop',
			},
			status: 'ready',
			stop_reason: {
				action_kind: 'file_write',
				approval_id: 'approval_resume_loop_4',
				boundary: 'approval',
				disposition: 'paused',
				kind: 'waiting_for_human',
				loop_state: 'WAITING',
				turn_count: 4,
			},
			trace_id: 'trace_resume_loop',
			trigger: 'loop_boundary',
			turn_index: 4,
			updated_at: '2026-04-17T17:00:00.000Z',
		},
		resume: {
			cursor: {
				boundary: 'approval',
				checkpoint_id: 'checkpoint_resume_loop_4',
				checkpoint_version: 1,
				checkpointed_at: '2026-04-17T17:00:00.000Z',
				loop_state: 'WAITING',
				run_id: 'run_resume_loop',
				runtime_state: 'WAITING_APPROVAL',
				trace_id: 'trace_resume_loop',
				turn_index: 4,
			},
			disposition: 'resumable',
			loop_config: {
				max_turns: 8,
				stop_conditions: {},
			},
			stop_reason: {
				action_kind: 'file_write',
				approval_id: 'approval_resume_loop_4',
				boundary: 'approval',
				disposition: 'paused',
				kind: 'waiting_for_human',
				loop_state: 'WAITING',
				turn_count: 4,
			},
		} satisfies ResumableResumeContext,
		...overrides,
	};
}

function createRunningCheckpointRecord(
	overrides: Partial<MetadataOnlyCheckpointRecord> = {},
): MetadataOnlyCheckpointRecord {
	const baseRecord = createResumableCheckpointRecord();

	return {
		...baseRecord,
		meta: {
			...baseRecord.meta,
			checkpoint_id: 'checkpoint_resume_loop_turn_2',
			loop_state: 'RUNNING',
			run_id: 'run_resume_loop_running',
			runtime_state: 'MODEL_THINKING',
			stop_reason: undefined,
			trace_id: 'trace_resume_loop_running',
			turn_index: 2,
			scope: {
				kind: 'run',
				run_id: 'run_resume_loop_running',
				subject_id: 'run_resume_loop_running',
				trace_id: 'trace_resume_loop_running',
			},
		},
		resume: {
			cursor: {
				boundary: 'turn',
				checkpoint_id: 'checkpoint_resume_loop_turn_2',
				checkpoint_version: 1,
				checkpointed_at: '2026-04-17T17:05:00.000Z',
				loop_state: 'RUNNING',
				run_id: 'run_resume_loop_running',
				runtime_state: 'MODEL_THINKING',
				trace_id: 'trace_resume_loop_running',
				turn_index: 2,
			},
			disposition: 'resumable',
			loop_config: {
				max_turns: 8,
				stop_conditions: {},
			},
			stop_reason: undefined,
		} satisfies ResumableResumeContext,
		...overrides,
	};
}

function createTerminalCheckpointRecord(): MetadataOnlyCheckpointRecord {
	return {
		blob_refs: [],
		meta: {
			checkpoint_id: 'checkpoint_resume_loop_terminal',
			checkpoint_version: 1,
			checkpointed_at: '2026-04-17T17:10:00.000Z',
			created_at: '2026-04-17T17:10:00.000Z',
			loop_state: 'COMPLETED',
			metadata: {
				checkpoint_source: 'loop.boundary',
			},
			parent_checkpoint_id: 'checkpoint_resume_loop_turn_2',
			persistence_mode: 'metadata_only',
			run_id: 'run_resume_loop_running',
			runtime_state: 'COMPLETED',
			schema_version: 1,
			scope: {
				kind: 'run',
				run_id: 'run_resume_loop_running',
				subject_id: 'run_resume_loop_running',
				trace_id: 'trace_resume_loop_running',
			},
			status: 'ready',
			stop_reason: {
				disposition: 'terminal',
				finish_reason: 'stop',
				kind: 'model_stop',
				loop_state: 'COMPLETED',
				turn_count: 3,
			},
			trace_id: 'trace_resume_loop_running',
			trigger: 'loop_boundary',
			turn_index: 3,
			updated_at: '2026-04-17T17:10:00.000Z',
		},
		resume: {
			disposition: 'terminal',
			final_loop_state: 'COMPLETED',
			final_runtime_state: 'COMPLETED',
			stop_reason: {
				disposition: 'terminal',
				finish_reason: 'stop',
				kind: 'model_stop',
				loop_state: 'COMPLETED',
				turn_count: 3,
			},
		} satisfies TerminalResumeContext,
	};
}

function createCheckpointManager(result: ResolveResumeCheckpointResult): {
	resolveResumeCheckpoint: (
		input: Readonly<{
			readonly checkpoint_id: string;
		}>,
	) => Promise<ResolveResumeCheckpointResult>;
} {
	return {
		async resolveResumeCheckpoint(): Promise<ResolveResumeCheckpointResult> {
			return result;
		},
	};
}

describe('resume-agent-loop', () => {
	it('builds a resumable runAgentLoop start input from a metadata-only checkpoint', async () => {
		const checkpoint = createResumableCheckpointRecord();
		const result = await resolveAgentLoopResume({
			checkpoint_id: checkpoint.meta.checkpoint_id,
			checkpoint_manager: createCheckpointManager({
				checkpoint,
				resume: checkpoint.resume as ResumableResumeContext,
				status: 'resumable',
			}),
		});

		expect(result).toEqual({
			checkpoint,
			checkpoint_id: 'checkpoint_resume_loop_4',
			resume: checkpoint.resume,
			run_agent_loop_input: {
				config: {
					max_turns: 8,
					stop_conditions: {},
				},
				initial_loop_state: 'WAITING',
				initial_runtime_state: 'WAITING_APPROVAL',
				initial_turn_count: 4,
				run_id: 'run_resume_loop',
				trace_id: 'trace_resume_loop',
			},
			status: 'resumable',
		});
	});

	it('does not resume terminal checkpoints and returns a controlled terminal result', async () => {
		const checkpoint = createTerminalCheckpointRecord();
		const result = await resolveAgentLoopResume({
			checkpoint_id: checkpoint.meta.checkpoint_id,
			checkpoint_manager: createCheckpointManager({
				checkpoint,
				resume: checkpoint.resume as TerminalResumeContext,
				status: 'terminal',
			}),
		});

		expect(result).toEqual({
			checkpoint,
			checkpoint_id: 'checkpoint_resume_loop_terminal',
			reason: 'terminal_checkpoint',
			status: 'terminal',
		});
	});

	it('returns a controlled missing result when the checkpoint does not exist', async () => {
		await expect(
			resolveAgentLoopResume({
				checkpoint_id: 'checkpoint_missing_resume',
				checkpoint_manager: createCheckpointManager({
					checkpoint_id: 'checkpoint_missing_resume',
					status: 'missing',
				}),
			}),
		).resolves.toEqual({
			checkpoint_id: 'checkpoint_missing_resume',
			status: 'missing',
		});
	});

	it('restores run_id, trace_id, and turn index into the resumed loop generator', async () => {
		const checkpoint = createRunningCheckpointRecord();
		let capturedRunModelTurnInput: RunModelTurnInput | undefined;
		const result = await resumeAgentLoop({
			build_model_request() {
				return createModelRequest();
			},
			checkpoint_id: checkpoint.meta.checkpoint_id,
			checkpoint_manager: createCheckpointManager({
				checkpoint,
				resume: checkpoint.resume as ResumableResumeContext,
				status: 'resumable',
			}),
			model_gateway: new StubModelGateway(),
			registry: new ToolRegistry(),
			run_model_turn: async (input) => {
				capturedRunModelTurnInput = input;
				return createAssistantCompletionResult();
			},
		});

		expect(result.status).toBe('resumed');

		if (result.status !== 'resumed') {
			throw new Error('Expected resumed agent loop result.');
		}

		await expect(result.generator.next()).resolves.toEqual({
			done: false,
			value: {
				loop_state: 'RUNNING',
				max_turns: 8,
				run_id: 'run_resume_loop_running',
				trace_id: 'trace_resume_loop_running',
				turn_index: 3,
				type: 'turn.started',
			},
		});

		await result.generator.next();

		expect(capturedRunModelTurnInput?.run_id).toBe('run_resume_loop_running');
		expect(capturedRunModelTurnInput?.trace_id).toBe('trace_resume_loop_running');
		expect(capturedRunModelTurnInput?.model_request.run_id).toBe('run_resume_loop_running');
		expect(capturedRunModelTurnInput?.model_request.trace_id).toBe('trace_resume_loop_running');
	});
});
