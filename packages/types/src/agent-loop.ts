import type {
	ApprovalRuntimeEvent,
	ModelCompletedEvent,
	RunCompletedEvent,
	RunFailedEvent,
	StateEnteredEvent,
	ToolRuntimeEvent,
} from './events.js';
import type { ModelFinishReason } from './gateway.js';
import type { ApprovalActionKind } from './policy.js';
import type { RuntimeState } from './state.js';
import type { ToolErrorCode, ToolName } from './tools.js';

export const loopStates = [
	'RUNNING',
	'WAITING',
	'PAUSED',
	'COMPLETED',
	'FAILED',
	'CANCELLED',
] as const;

export type LoopState = (typeof loopStates)[number];

// LoopState models the loop orchestrator's current status, independent from per-turn RuntimeState.
export type TerminalLoopState = Extract<LoopState, 'COMPLETED' | 'FAILED' | 'CANCELLED'>;

export type BoundaryLoopState = Extract<LoopState, 'WAITING' | 'PAUSED'>;

export type ActiveLoopState = Exclude<LoopState, TerminalLoopState>;

export interface AgentLoopAutoContinueConfig {
	readonly enabled: boolean;
	readonly max_consecutive_turns?: number;
	readonly stop_on_human_boundary?: boolean;
}

export interface AgentLoopTokenConfig {
	readonly max_input_tokens?: number;
	readonly max_output_tokens?: number;
	readonly max_total_tokens?: number;
}

export interface AgentLoopTokenUsage {
	readonly input_tokens: number;
	readonly output_tokens: number;
	readonly total_tokens: number;
}

export interface AgentLoopCompactionConfig {
	readonly enabled?: boolean;
}

export interface AgentLoopStopConditionConfig {
	readonly fail_on_tool_error?: boolean;
	readonly max_consecutive_tool_failures?: number;
	readonly max_repeated_identical_calls?: number;
	readonly pause_on_approval_wait?: boolean;
	readonly stagnation_window_size?: number;
	readonly stop_on_model_finish_reason?: readonly ModelFinishReason[];
}

export interface AgentLoopConfig {
	readonly auto_continue?: AgentLoopAutoContinueConfig;
	readonly compaction?: AgentLoopCompactionConfig;
	readonly max_turns: number;
	readonly metadata?: Readonly<Record<string, unknown>>;
	readonly stop_conditions?: AgentLoopStopConditionConfig;
	readonly token_limits?: AgentLoopTokenConfig;
}

// StopReason explains why the loop reached a resumable boundary or a terminal outcome.
interface StopReasonBase<
	TKind extends string,
	TDisposition extends 'paused' | 'terminal',
	TLoopState extends LoopState,
> {
	readonly disposition: TDisposition;
	readonly kind: TKind;
	readonly loop_state: TLoopState;
	readonly turn_count: number;
}

export interface CompletedStopReason extends StopReasonBase<'completed', 'terminal', 'COMPLETED'> {
	readonly final_runtime_state?: Extract<RuntimeState, 'COMPLETED'>;
}

export interface FailedStopReason extends StopReasonBase<'failed', 'terminal', 'FAILED'> {
	readonly error_code?: string;
	readonly error_message?: string;
	readonly final_runtime_state?: Extract<RuntimeState, 'FAILED'>;
	readonly retryable?: boolean;
}

export interface MaxTurnsReachedStopReason
	extends StopReasonBase<'max_turns_reached', 'terminal', 'FAILED'> {
	readonly max_turns: number;
}

export interface RepeatedToolCallStopReason
	extends StopReasonBase<'repeated_tool_call', 'terminal', 'FAILED'> {
	readonly consecutive_count: number;
	readonly tool_name?: string;
}

export interface StagnationStopReason extends StopReasonBase<'stagnation', 'terminal', 'FAILED'> {
	readonly unique_tool_signatures: number;
	readonly window_size: number;
}

export interface TokenBudgetReachedStopReason
	extends StopReasonBase<'token_budget_reached', 'terminal', 'FAILED'> {
	readonly configured_limit: number;
	readonly limit_kind: 'input_tokens' | 'output_tokens' | 'total_tokens';
	readonly observed_usage: number;
	readonly threshold: number;
	readonly usage: AgentLoopTokenUsage;
}

export interface ModelStopStopReason extends StopReasonBase<'model_stop', 'terminal', 'COMPLETED'> {
	readonly finish_reason: ModelFinishReason;
}

export interface ToolFailureStopReason
	extends StopReasonBase<'tool_failure', 'terminal', 'FAILED'> {
	readonly call_id?: string;
	readonly error_code?: ToolErrorCode;
	readonly retryable?: boolean;
	readonly tool_name?: ToolName;
}

export interface CancelledStopReason extends StopReasonBase<'cancelled', 'terminal', 'CANCELLED'> {
	readonly actor?: 'system' | 'user';
}

export interface WaitingForHumanStopReason
	extends StopReasonBase<'waiting_for_human', 'paused', 'WAITING' | 'PAUSED'> {
	readonly action_kind?: ApprovalActionKind;
	readonly approval_id?: string;
	readonly boundary: 'approval' | 'intervention' | 'resume';
}

export type StopReason =
	| CompletedStopReason
	| FailedStopReason
	| MaxTurnsReachedStopReason
	| RepeatedToolCallStopReason
	| StagnationStopReason
	| TokenBudgetReachedStopReason
	| ModelStopStopReason
	| ToolFailureStopReason
	| CancelledStopReason
	| WaitingForHumanStopReason;

export type PausedStopReason = Extract<StopReason, { readonly disposition: 'paused' }>;

export type TerminalStopReason = Extract<StopReason, { readonly disposition: 'terminal' }>;

export type TurnProgressEvent =
	| ApprovalRuntimeEvent
	| ModelCompletedEvent
	| RunCompletedEvent
	| RunFailedEvent
	| StateEnteredEvent
	| ToolRuntimeEvent;

interface TurnYieldBase<TType extends string, TLoopState extends LoopState = LoopState> {
	readonly loop_state: TLoopState;
	readonly run_id: string;
	readonly trace_id: string;
	readonly turn_index: number;
	readonly type: TType;
}

export interface TurnStartedYield
	extends TurnYieldBase<'turn.started', Extract<LoopState, 'RUNNING'>> {
	readonly max_turns: number;
}

export interface TurnProgressYield extends TurnYieldBase<'turn.progress'> {
	readonly event: TurnProgressEvent;
	readonly runtime_state?: RuntimeState;
}

export interface TurnCompletedYield extends TurnYieldBase<'turn.completed', LoopState> {
	readonly next_step: 'continue' | 'stop' | 'wait';
	readonly runtime_state?: RuntimeState;
}

export interface LoopBoundaryYield
	extends TurnYieldBase<'loop.boundary', BoundaryLoopState | TerminalLoopState> {
	readonly reason: StopReason;
}

export type TurnYield =
	| TurnStartedYield
	| TurnProgressYield
	| TurnCompletedYield
	| LoopBoundaryYield;
