import type {
	CheckpointRecord,
	LoopBoundaryYield,
	ModelRequest,
	StopReason,
	TurnCompletedYield,
} from '@runa/types';

import { describe, expect, it, vi } from 'vitest';

import type { AgentLoopSnapshot, AgentLoopYieldContext } from './agent-loop.js';

import {
	AgentLoopCheckpointWriteError,
	buildCheckpointRecordFromYield,
	createAgentLoopCheckpointWriter,
	shouldWriteCheckpointForYield,
	writeCheckpointForYield,
} from './agent-loop-checkpointing.js';
import { TOKEN_LIMIT_RECOVERY_METADATA_KEY } from './token-limit-recovery.js';

function createModelRequest(overrides: Partial<ModelRequest> = {}): ModelRequest {
	return {
		messages: [
			{
				content: 'Continue the current task.',
				role: 'user',
			},
		],
		run_id: 'run_checkpoint_loop',
		trace_id: 'trace_checkpoint_loop',
		...overrides,
	};
}

function createSnapshot(overrides: Partial<AgentLoopSnapshot> = {}): AgentLoopSnapshot {
	return {
		config: {
			max_turns: 8,
			stop_conditions: {},
		},
		current_loop_state: 'RUNNING',
		current_runtime_state: 'MODEL_THINKING',
		run_id: 'run_checkpoint_loop',
		trace_id: 'trace_checkpoint_loop',
		turn_count: 1,
		...overrides,
	};
}

function createTurnCompletedYield(overrides: Partial<TurnCompletedYield> = {}): TurnCompletedYield {
	return {
		loop_state: 'RUNNING',
		next_step: 'continue',
		run_id: 'run_checkpoint_loop',
		runtime_state: 'MODEL_THINKING',
		trace_id: 'trace_checkpoint_loop',
		turn_index: 2,
		type: 'turn.completed',
		...overrides,
	};
}

function createWaitingStopReason(
	overrides: Partial<Extract<StopReason, { readonly kind: 'waiting_for_human' }>> = {},
): Extract<StopReason, { readonly kind: 'waiting_for_human' }> {
	return {
		action_kind: 'file_write',
		approval_id: 'approval_checkpoint_loop_1',
		boundary: 'approval',
		disposition: 'paused',
		kind: 'waiting_for_human',
		loop_state: 'WAITING',
		turn_count: 2,
		...overrides,
	};
}

function createLoopBoundaryYield(overrides: Partial<LoopBoundaryYield> = {}): LoopBoundaryYield {
	return {
		loop_state: 'WAITING',
		reason: createWaitingStopReason(),
		run_id: 'run_checkpoint_loop',
		trace_id: 'trace_checkpoint_loop',
		turn_index: 2,
		type: 'loop.boundary',
		...overrides,
	};
}

describe('agent-loop-checkpointing', () => {
	it('builds a deterministic metadata-only checkpoint record for turn.completed', () => {
		const record = buildCheckpointRecordFromYield({
			checkpointed_at: '2026-04-17T16:00:00.000Z',
			parent_checkpoint_id: 'checkpoint_run_checkpoint_loop_turn_boundary_1',
			snapshot: createSnapshot({
				current_runtime_state: 'TOOL_RESULT_INGESTING',
				resolved_model_request: createModelRequest({
					metadata: {
						[TOKEN_LIMIT_RECOVERY_METADATA_KEY]: {
							retry_count: 1,
							strategy_name: 'microcompact',
						},
					},
				}),
			}),
			yield: createTurnCompletedYield({
				next_step: 'continue',
				runtime_state: 'TOOL_RESULT_INGESTING',
				turn_index: 2,
			}),
		});

		expect(record).toEqual({
			blob_refs: [],
			meta: {
				checkpoint_id: 'checkpoint_run_checkpoint_loop_turn_boundary_2',
				checkpoint_version: 1,
				checkpointed_at: '2026-04-17T16:00:00.000Z',
				created_at: '2026-04-17T16:00:00.000Z',
				loop_state: 'RUNNING',
				metadata: {
					checkpoint_source: 'turn.completed',
					next_step: 'continue',
					token_limit_recovery: {
						retry_count: 1,
						strategy_name: 'microcompact',
					},
				},
				parent_checkpoint_id: 'checkpoint_run_checkpoint_loop_turn_boundary_1',
				persistence_mode: 'metadata_only',
				run_id: 'run_checkpoint_loop',
				runtime_state: 'TOOL_RESULT_INGESTING',
				schema_version: 1,
				scope: {
					kind: 'run',
					run_id: 'run_checkpoint_loop',
					subject_id: 'run_checkpoint_loop',
					trace_id: 'trace_checkpoint_loop',
				},
				status: 'ready',
				stop_reason: undefined,
				trace_id: 'trace_checkpoint_loop',
				trigger: 'turn_boundary',
				turn_index: 2,
				updated_at: '2026-04-17T16:00:00.000Z',
			},
			resume: {
				cursor: {
					boundary: 'turn',
					checkpoint_id: 'checkpoint_run_checkpoint_loop_turn_boundary_2',
					checkpoint_version: 1,
					checkpointed_at: '2026-04-17T16:00:00.000Z',
					loop_state: 'RUNNING',
					run_id: 'run_checkpoint_loop',
					runtime_state: 'TOOL_RESULT_INGESTING',
					trace_id: 'trace_checkpoint_loop',
					turn_index: 2,
				},
				disposition: 'resumable',
				loop_config: {
					max_turns: 8,
					stop_conditions: {},
				},
				stop_reason: undefined,
			},
		});
	});

	it('builds a resumable approval boundary checkpoint for loop.boundary', () => {
		const record = buildCheckpointRecordFromYield({
			checkpointed_at: '2026-04-17T16:05:00.000Z',
			snapshot: createSnapshot({
				current_loop_state: 'WAITING',
				current_runtime_state: 'WAITING_APPROVAL',
				human_boundary: {
					action_kind: 'file_write',
					approval_id: 'approval_checkpoint_loop_1',
					boundary: 'approval',
					loop_state: 'WAITING',
				},
				turn_count: 2,
			}),
			yield: createLoopBoundaryYield(),
		});

		expect(record.resume).toEqual({
			cursor: {
				boundary: 'approval',
				checkpoint_id: 'checkpoint_run_checkpoint_loop_loop_boundary_2',
				checkpoint_version: 1,
				checkpointed_at: '2026-04-17T16:05:00.000Z',
				loop_state: 'WAITING',
				run_id: 'run_checkpoint_loop',
				runtime_state: 'WAITING_APPROVAL',
				trace_id: 'trace_checkpoint_loop',
				turn_index: 2,
			},
			disposition: 'resumable',
			loop_config: {
				max_turns: 8,
				stop_conditions: {},
			},
			stop_reason: createWaitingStopReason(),
		});
		expect(record.meta.stop_reason).toEqual(createWaitingStopReason());
		expect(record.meta.trigger).toBe('loop_boundary');
	});

	it('builds a terminal checkpoint when the loop reaches a terminal boundary', () => {
		const record = buildCheckpointRecordFromYield({
			checkpointed_at: '2026-04-17T16:10:00.000Z',
			snapshot: createSnapshot({
				current_loop_state: 'COMPLETED',
				current_runtime_state: 'COMPLETED',
				turn_count: 2,
			}),
			yield: createLoopBoundaryYield({
				loop_state: 'COMPLETED',
				reason: {
					disposition: 'terminal',
					finish_reason: 'stop',
					kind: 'model_stop',
					loop_state: 'COMPLETED',
					turn_count: 2,
				},
			}),
		});

		expect(record.resume).toEqual({
			disposition: 'terminal',
			final_loop_state: 'COMPLETED',
			final_runtime_state: 'COMPLETED',
			stop_reason: {
				disposition: 'terminal',
				finish_reason: 'stop',
				kind: 'model_stop',
				loop_state: 'COMPLETED',
				turn_count: 2,
			},
		});
	});

	it('writes checkpoints through the manager seam and links parent ids deterministically', async () => {
		const savedRecords: CheckpointRecord[] = [];
		const saveCheckpoint = vi.fn(async (record: CheckpointRecord) => {
			savedRecords.push(record);
			return record;
		});
		const writer = createAgentLoopCheckpointWriter({
			checkpoint_manager: {
				saveCheckpoint,
			},
			now: () => '2026-04-17T16:15:00.000Z',
		});

		const completedContext: AgentLoopYieldContext = {
			snapshot: createSnapshot({
				current_runtime_state: 'MODEL_THINKING',
				turn_count: 2,
			}),
			yield: createTurnCompletedYield({
				next_step: 'wait',
				turn_index: 2,
			}),
		};
		const boundaryContext: AgentLoopYieldContext = {
			snapshot: createSnapshot({
				current_loop_state: 'WAITING',
				current_runtime_state: 'WAITING_APPROVAL',
				turn_count: 2,
			}),
			yield: createLoopBoundaryYield(),
		};

		expect(shouldWriteCheckpointForYield(completedContext.yield)).toBe(true);
		expect(shouldWriteCheckpointForYield(boundaryContext.yield)).toBe(true);

		await writer(completedContext);
		await writer(boundaryContext);

		expect(saveCheckpoint).toHaveBeenCalledTimes(2);
		expect(savedRecords[0]?.meta.parent_checkpoint_id).toBeUndefined();
		expect(savedRecords[1]?.meta.parent_checkpoint_id).toBe(
			'checkpoint_run_checkpoint_loop_turn_boundary_2',
		);
		expect(savedRecords[0]?.meta.persistence_mode).toBe('metadata_only');
		expect(savedRecords[1]?.meta.persistence_mode).toBe('metadata_only');
	});

	it('wraps checkpoint manager write failures in a controlled typed error', async () => {
		await expect(
			writeCheckpointForYield({
				checkpoint_manager: {
					async saveCheckpoint(): Promise<CheckpointRecord> {
						throw new Error('database unavailable');
					},
				},
				checkpointed_at: '2026-04-17T16:20:00.000Z',
				snapshot: createSnapshot(),
				yield: createTurnCompletedYield(),
			}),
		).rejects.toMatchObject({
			checkpoint_id: 'checkpoint_run_checkpoint_loop_turn_boundary_2',
			code: 'AGENT_LOOP_CHECKPOINT_WRITE_FAILED',
			yield_type: 'turn.completed',
		});
	});
});
