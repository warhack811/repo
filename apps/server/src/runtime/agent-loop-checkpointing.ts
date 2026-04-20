import type {
	CheckpointMeta,
	CheckpointMetadata,
	CheckpointRecord,
	CheckpointScope,
	LoopBoundaryYield,
	LoopState,
	MetadataOnlyCheckpointRecord,
	NonTerminalRuntimeState,
	ResumeContext,
	RuntimeState,
	StopReason,
	TerminalRuntimeState,
	TurnCompletedYield,
	TurnYield,
} from '@runa/types';

import type {
	AgentLoopSnapshot,
	AgentLoopYieldContext,
	AgentLoopYieldObserver,
} from './agent-loop.js';
import type { TokenLimitRecoveryMetadata } from './token-limit-recovery.js';

import { TOKEN_LIMIT_RECOVERY_METADATA_KEY } from './token-limit-recovery.js';

export interface AgentLoopCheckpointManager {
	saveCheckpoint(record: CheckpointRecord): Promise<CheckpointRecord>;
}

export interface BuildCheckpointRecordFromYieldInput {
	readonly checkpointed_at?: string;
	readonly parent_checkpoint_id?: string;
	readonly snapshot: AgentLoopSnapshot;
	readonly yield: LoopBoundaryYield | TurnCompletedYield;
}

export interface WriteCheckpointForYieldInput extends BuildCheckpointRecordFromYieldInput {
	readonly checkpoint_manager: AgentLoopCheckpointManager;
}

export interface CreateAgentLoopCheckpointWriterInput {
	readonly checkpoint_manager: AgentLoopCheckpointManager;
	readonly now?: () => string;
}

const NEXT_STEP_METADATA_KEY = 'next_step';
const STOP_REASON_DISPOSITION_METADATA_KEY = 'stop_reason_disposition';
const STOP_REASON_KIND_METADATA_KEY = 'stop_reason_kind';

export class AgentLoopCheckpointWriteError extends Error {
	override readonly cause?: unknown;
	readonly code = 'AGENT_LOOP_CHECKPOINT_WRITE_FAILED';
	readonly checkpoint_id: string;
	readonly yield_type: LoopBoundaryYield['type'] | TurnCompletedYield['type'];

	constructor(
		message: string,
		options: Readonly<{
			readonly cause?: unknown;
			readonly checkpoint_id: string;
			readonly yield_type: LoopBoundaryYield['type'] | TurnCompletedYield['type'];
		}>,
	) {
		super(message);
		this.cause = options.cause;
		this.checkpoint_id = options.checkpoint_id;
		this.name = 'AgentLoopCheckpointWriteError';
		this.yield_type = options.yield_type;
	}
}

function isTurnCompletedYield(yieldValue: TurnYield): yieldValue is TurnCompletedYield {
	return yieldValue.type === 'turn.completed';
}

function isLoopBoundaryYield(yieldValue: TurnYield): yieldValue is LoopBoundaryYield {
	return yieldValue.type === 'loop.boundary';
}

function isTerminalLoopState(
	loopState: LoopState,
): loopState is Extract<LoopState, 'COMPLETED' | 'FAILED' | 'CANCELLED'> {
	return loopState === 'COMPLETED' || loopState === 'FAILED' || loopState === 'CANCELLED';
}

function isTerminalRuntimeState(
	runtimeState: RuntimeState | undefined,
): runtimeState is TerminalRuntimeState {
	return runtimeState === 'COMPLETED' || runtimeState === 'FAILED';
}

function isNonTerminalRuntimeState(
	runtimeState: RuntimeState | undefined,
): runtimeState is NonTerminalRuntimeState {
	return (
		runtimeState === 'INIT' ||
		runtimeState === 'MODEL_THINKING' ||
		runtimeState === 'WAITING_APPROVAL' ||
		runtimeState === 'TOOL_EXECUTING' ||
		runtimeState === 'TOOL_RESULT_INGESTING'
	);
}

function buildCheckpointId(
	runId: string,
	yieldValue: LoopBoundaryYield | TurnCompletedYield,
): string {
	if (yieldValue.type === 'turn.completed') {
		return `checkpoint_${runId}_turn_boundary_${yieldValue.turn_index}`;
	}

	return `checkpoint_${runId}_loop_boundary_${yieldValue.turn_index}`;
}

function buildCheckpointScope(snapshot: AgentLoopSnapshot): CheckpointScope {
	return {
		kind: 'run',
		run_id: snapshot.run_id,
		subject_id: snapshot.run_id,
		trace_id: snapshot.trace_id,
	};
}

function normalizeTokenLimitRecoveryMetadata(
	value: unknown,
): TokenLimitRecoveryMetadata | undefined {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return undefined;
	}

	return value as TokenLimitRecoveryMetadata;
}

function buildCheckpointMetadata(
	snapshot: AgentLoopSnapshot,
	yieldValue: LoopBoundaryYield | TurnCompletedYield,
): CheckpointMetadata | undefined {
	const metadata: Record<string, unknown> = {
		checkpoint_source: yieldValue.type,
	};
	const recoveryMetadata = normalizeTokenLimitRecoveryMetadata(
		snapshot.resolved_model_request?.metadata?.[TOKEN_LIMIT_RECOVERY_METADATA_KEY],
	);

	if (isTurnCompletedYield(yieldValue)) {
		metadata[NEXT_STEP_METADATA_KEY] = yieldValue.next_step;
	}

	if (isLoopBoundaryYield(yieldValue)) {
		metadata[STOP_REASON_KIND_METADATA_KEY] = yieldValue.reason.kind;
		metadata[STOP_REASON_DISPOSITION_METADATA_KEY] = yieldValue.reason.disposition;
	}

	if (recoveryMetadata !== undefined) {
		metadata[TOKEN_LIMIT_RECOVERY_METADATA_KEY] = recoveryMetadata;
	}

	return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function resolveResumeBoundary(
	yieldValue: LoopBoundaryYield | TurnCompletedYield,
	snapshot: AgentLoopSnapshot,
): 'approval' | 'loop' | 'turn' {
	if (yieldValue.type === 'turn.completed') {
		if (yieldValue.next_step === 'continue') {
			return 'turn';
		}

		if (snapshot.human_boundary?.boundary === 'approval') {
			return 'approval';
		}

		return 'loop';
	}

	if (yieldValue.reason.kind === 'waiting_for_human' && yieldValue.reason.boundary === 'approval') {
		return 'approval';
	}

	return 'loop';
}

function buildTerminalResumeContext(
	loopState: Extract<LoopState, 'COMPLETED' | 'FAILED' | 'CANCELLED'>,
	runtimeState: RuntimeState | undefined,
	stopReason: StopReason | undefined,
): ResumeContext {
	return {
		disposition: 'terminal',
		final_loop_state: loopState,
		final_runtime_state: isTerminalRuntimeState(runtimeState) ? runtimeState : undefined,
		stop_reason: stopReason,
	};
}

function buildResumeContext(
	input: BuildCheckpointRecordFromYieldInput,
	checkpointId: string,
): ResumeContext {
	const runtimeState = input.snapshot.current_runtime_state;
	const resumableStopReason =
		isLoopBoundaryYield(input.yield) && input.yield.reason.kind === 'waiting_for_human'
			? input.yield.reason
			: undefined;

	if (isTurnCompletedYield(input.yield) && input.yield.next_step === 'stop') {
		if (!isTerminalLoopState(input.yield.loop_state)) {
			throw new AgentLoopCheckpointWriteError(
				'Terminal turn.completed checkpoint requires a terminal loop_state.',
				{
					checkpoint_id: checkpointId,
					yield_type: input.yield.type,
				},
			);
		}

		return buildTerminalResumeContext(input.yield.loop_state, runtimeState, undefined);
	}

	if (isTerminalLoopState(input.yield.loop_state)) {
		const stopReason = isLoopBoundaryYield(input.yield) ? input.yield.reason : undefined;

		return buildTerminalResumeContext(input.yield.loop_state, runtimeState, stopReason);
	}

	return {
		cursor: {
			boundary: resolveResumeBoundary(input.yield, input.snapshot),
			checkpoint_id: checkpointId,
			checkpoint_version: 1,
			checkpointed_at: input.checkpointed_at ?? new Date().toISOString(),
			loop_state: input.yield.loop_state,
			run_id: input.snapshot.run_id,
			runtime_state: isNonTerminalRuntimeState(runtimeState) ? runtimeState : undefined,
			trace_id: input.snapshot.trace_id,
			turn_index: input.yield.turn_index,
		},
		disposition: 'resumable',
		loop_config: input.snapshot.config,
		stop_reason: resumableStopReason,
	};
}

export function shouldWriteCheckpointForYield(
	yieldValue: TurnYield,
): yieldValue is LoopBoundaryYield | TurnCompletedYield {
	return yieldValue.type === 'turn.completed' || yieldValue.type === 'loop.boundary';
}

export function buildCheckpointRecordFromYield(
	input: BuildCheckpointRecordFromYieldInput,
): MetadataOnlyCheckpointRecord {
	const checkpointedAt = input.checkpointed_at ?? new Date().toISOString();
	const checkpointId = buildCheckpointId(input.snapshot.run_id, input.yield);
	const meta: CheckpointMeta = {
		checkpoint_id: checkpointId,
		checkpoint_version: 1,
		checkpointed_at: checkpointedAt,
		created_at: checkpointedAt,
		loop_state: input.yield.loop_state,
		metadata: buildCheckpointMetadata(input.snapshot, input.yield),
		parent_checkpoint_id: input.parent_checkpoint_id,
		persistence_mode: 'metadata_only',
		run_id: input.snapshot.run_id,
		runtime_state: input.snapshot.current_runtime_state,
		schema_version: 1,
		scope: buildCheckpointScope(input.snapshot),
		status: 'ready',
		stop_reason: isLoopBoundaryYield(input.yield) ? input.yield.reason : undefined,
		trace_id: input.snapshot.trace_id,
		trigger: input.yield.type === 'turn.completed' ? 'turn_boundary' : 'loop_boundary',
		turn_index: input.yield.turn_index,
		updated_at: checkpointedAt,
	};

	return {
		blob_refs: [],
		meta: {
			...meta,
			persistence_mode: 'metadata_only',
		},
		resume: buildResumeContext(
			{
				...input,
				checkpointed_at: checkpointedAt,
			},
			checkpointId,
		),
	};
}

export async function writeCheckpointForYield(
	input: WriteCheckpointForYieldInput,
): Promise<CheckpointRecord> {
	const record = buildCheckpointRecordFromYield(input);

	try {
		return await input.checkpoint_manager.saveCheckpoint(record);
	} catch (error: unknown) {
		throw new AgentLoopCheckpointWriteError(
			`Failed to persist checkpoint for ${input.yield.type} at turn ${input.yield.turn_index}.`,
			{
				cause: error,
				checkpoint_id: record.meta.checkpoint_id,
				yield_type: input.yield.type,
			},
		);
	}
}

export function createAgentLoopCheckpointWriter(
	input: CreateAgentLoopCheckpointWriterInput,
): AgentLoopYieldObserver {
	let previousCheckpointId: string | undefined;

	return async function checkpointWriter(context: AgentLoopYieldContext): Promise<void> {
		if (!shouldWriteCheckpointForYield(context.yield)) {
			return;
		}

		const checkpointedAt = input.now?.() ?? new Date().toISOString();
		const persistedRecord = await writeCheckpointForYield({
			checkpoint_manager: input.checkpoint_manager,
			checkpointed_at: checkpointedAt,
			parent_checkpoint_id: previousCheckpointId,
			snapshot: context.snapshot,
			yield: context.yield,
		});

		previousCheckpointId = persistedRecord.meta.checkpoint_id;
	};
}
