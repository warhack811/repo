import type {
	AgentLoopConfig,
	LoopState,
	ResumableResumeContext,
	RuntimeState,
	TurnYield,
} from '@runa/types';

import type { CheckpointRecord } from '@runa/types';

import type { AgentLoopCheckpointManager } from './agent-loop-checkpointing.js';
import type { AgentLoopResult } from './agent-loop.js';
import type { ResolveResumeCheckpointResult } from './checkpoint-manager.js';
import type { RunAgentLoopInput } from './run-agent-loop.js';

import { runAgentLoop } from './run-agent-loop.js';

export interface AgentLoopResumeCheckpointManager {
	resolveResumeCheckpoint(
		input: Readonly<{
			readonly checkpoint_id: string;
		}>,
	): Promise<ResolveResumeCheckpointResult>;
	saveCheckpoint?: AgentLoopCheckpointManager['saveCheckpoint'];
}

export interface ResumeAgentLoopInput
	extends Omit<
		RunAgentLoopInput,
		| 'checkpoint_manager'
		| 'config'
		| 'initial_loop_state'
		| 'initial_runtime_state'
		| 'initial_turn_count'
		| 'run_id'
		| 'trace_id'
	> {
	readonly checkpoint_id: string;
	readonly checkpoint_manager: AgentLoopResumeCheckpointManager;
	readonly config_override?: AgentLoopConfig;
}

export interface ResumeAgentLoopRunInput {
	readonly config: AgentLoopConfig;
	readonly initial_loop_state: Extract<LoopState, 'PAUSED' | 'RUNNING' | 'WAITING'>;
	readonly initial_runtime_state?: RuntimeState;
	readonly initial_turn_count: number;
	readonly run_id: string;
	readonly trace_id: string;
}

export interface ResolveAgentLoopResumeInput {
	readonly checkpoint_id: string;
	readonly checkpoint_manager: AgentLoopResumeCheckpointManager;
	readonly config_override?: AgentLoopConfig;
}

export interface MissingAgentLoopResumeResult {
	readonly checkpoint_id: string;
	readonly status: 'missing';
}

export interface TerminalAgentLoopResumeResult {
	readonly checkpoint: CheckpointRecord;
	readonly checkpoint_id: string;
	readonly reason: 'terminal_checkpoint';
	readonly status: 'terminal';
}

export interface InvalidAgentLoopResumeResult {
	readonly checkpoint: CheckpointRecord;
	readonly checkpoint_id: string;
	readonly reason: 'missing_loop_config';
	readonly status: 'invalid';
}

export interface ResolvedAgentLoopResumeResult {
	readonly checkpoint: CheckpointRecord;
	readonly checkpoint_id: string;
	readonly resume: ResumableResumeContext;
	readonly run_agent_loop_input: ResumeAgentLoopRunInput;
	readonly status: 'resumable';
}

export type ResolveAgentLoopResumeResult =
	| InvalidAgentLoopResumeResult
	| MissingAgentLoopResumeResult
	| ResolvedAgentLoopResumeResult
	| TerminalAgentLoopResumeResult;

export interface ResumedAgentLoopResult {
	readonly generator: AsyncGenerator<TurnYield, AgentLoopResult, void>;
	readonly resumed_from: ResolvedAgentLoopResumeResult;
	readonly status: 'resumed';
}

export type ResumeAgentLoopResult =
	| InvalidAgentLoopResumeResult
	| MissingAgentLoopResumeResult
	| ResumedAgentLoopResult
	| TerminalAgentLoopResumeResult;

export class AgentLoopResumeError extends Error {
	override readonly cause?: unknown;
	readonly checkpoint_id: string;
	readonly code = 'AGENT_LOOP_RESUME_FAILED';

	constructor(
		message: string,
		options: Readonly<{
			readonly cause?: unknown;
			readonly checkpoint_id: string;
		}>,
	) {
		super(message);
		this.cause = options.cause;
		this.checkpoint_id = options.checkpoint_id;
		this.name = 'AgentLoopResumeError';
	}
}

function isSupportedInitialLoopState(
	loopState: ResumableResumeContext['cursor']['loop_state'],
): loopState is Extract<LoopState, 'PAUSED' | 'RUNNING' | 'WAITING'> {
	return loopState === 'PAUSED' || loopState === 'RUNNING' || loopState === 'WAITING';
}

function buildResumeRunInput(
	resume: ResumableResumeContext,
	configOverride: AgentLoopConfig | undefined,
): ResumeAgentLoopRunInput | undefined {
	const resolvedConfig = configOverride ?? resume.loop_config;

	if (resolvedConfig === undefined) {
		return undefined;
	}

	return {
		config: resolvedConfig,
		initial_loop_state: isSupportedInitialLoopState(resume.cursor.loop_state)
			? resume.cursor.loop_state
			: 'RUNNING',
		initial_runtime_state: resume.cursor.runtime_state,
		initial_turn_count: resume.cursor.turn_index,
		run_id: resume.cursor.run_id,
		trace_id: resume.cursor.trace_id,
	};
}

function toCheckpointWriter(
	checkpointManager: AgentLoopResumeCheckpointManager,
): AgentLoopCheckpointManager | undefined {
	if (checkpointManager.saveCheckpoint === undefined) {
		return undefined;
	}

	return {
		saveCheckpoint: checkpointManager.saveCheckpoint,
	};
}

export async function resolveAgentLoopResume(
	input: ResolveAgentLoopResumeInput,
): Promise<ResolveAgentLoopResumeResult> {
	let resolvedCheckpoint: ResolveResumeCheckpointResult;

	try {
		resolvedCheckpoint = await input.checkpoint_manager.resolveResumeCheckpoint({
			checkpoint_id: input.checkpoint_id,
		});
	} catch (error: unknown) {
		throw new AgentLoopResumeError(
			`Failed to resolve checkpoint "${input.checkpoint_id}" for agent loop resume.`,
			{
				cause: error,
				checkpoint_id: input.checkpoint_id,
			},
		);
	}

	if (resolvedCheckpoint.status === 'missing') {
		return {
			checkpoint_id: input.checkpoint_id,
			status: 'missing',
		};
	}

	if (resolvedCheckpoint.status === 'terminal') {
		return {
			checkpoint: resolvedCheckpoint.checkpoint,
			checkpoint_id: input.checkpoint_id,
			reason: 'terminal_checkpoint',
			status: 'terminal',
		};
	}

	const runAgentLoopInput = buildResumeRunInput(resolvedCheckpoint.resume, input.config_override);

	if (runAgentLoopInput === undefined) {
		return {
			checkpoint: resolvedCheckpoint.checkpoint,
			checkpoint_id: input.checkpoint_id,
			reason: 'missing_loop_config',
			status: 'invalid',
		};
	}

	return {
		checkpoint: resolvedCheckpoint.checkpoint,
		checkpoint_id: input.checkpoint_id,
		resume: resolvedCheckpoint.resume,
		run_agent_loop_input: runAgentLoopInput,
		status: 'resumable',
	};
}

export async function resumeAgentLoop(input: ResumeAgentLoopInput): Promise<ResumeAgentLoopResult> {
	const resolvedResume = await resolveAgentLoopResume({
		checkpoint_id: input.checkpoint_id,
		checkpoint_manager: input.checkpoint_manager,
		config_override: input.config_override,
	});

	if (resolvedResume.status !== 'resumable') {
		return resolvedResume;
	}

	const generator = runAgentLoop({
		build_model_request: input.build_model_request,
		cancellation_signal: input.cancellation_signal,
		checkpoint_manager: toCheckpointWriter(input.checkpoint_manager),
		config: resolvedResume.run_agent_loop_input.config,
		execution_context: input.execution_context,
		initial_loop_state: resolvedResume.run_agent_loop_input.initial_loop_state,
		initial_runtime_state: resolvedResume.run_agent_loop_input.initial_runtime_state,
		initial_turn_count: resolvedResume.run_agent_loop_input.initial_turn_count,
		model_gateway: input.model_gateway,
		persistence_writer: input.persistence_writer,
		registry: input.registry,
		run_id: resolvedResume.run_agent_loop_input.run_id,
		run_model_turn: input.run_model_turn,
		tool_names: input.tool_names,
		trace_id: resolvedResume.run_agent_loop_input.trace_id,
	});

	return {
		generator,
		resumed_from: resolvedResume,
		status: 'resumed',
	};
}
