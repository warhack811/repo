import { createHash } from 'node:crypto';

import type {
	AgentLoopConfig,
	AgentLoopTokenUsage,
	ApprovalRequest,
	LoopBoundaryYield,
	LoopState,
	ModelRequest,
	ModelResponse,
	RuntimeState,
	StopReason,
	ToolArguments,
	ToolResult,
	TurnCompletedYield,
	TurnProgressEvent,
	TurnProgressYield,
	TurnStartedYield,
	TurnYield,
} from '@runa/types';

import type { PendingApprovalToolCall } from '../persistence/approval-store.js';
import type {
	StopConditionCancellation,
	StopConditionFailure,
	StopConditionHumanBoundary,
	StopConditionModelSignal,
	StopConditionsDecision,
	StopConditionsSnapshot,
	ToolCallSignature,
} from './stop-conditions.js';

import { evaluateStopConditions } from './stop-conditions.js';

const MAX_RECENT_TOOL_CALLS = 20;

export interface AgentLoopCancellationSignal {
	readonly actor?: 'system' | 'user';
	is_cancelled(): boolean;
}

export interface AgentLoopSnapshot {
	readonly approval_request?: ApprovalRequest;
	readonly assistant_text?: string;
	readonly config: Pick<AgentLoopConfig, 'max_turns' | 'stop_conditions' | 'token_limits'>;
	readonly current_loop_state: LoopState;
	readonly current_runtime_state?: RuntimeState;
	readonly failure?: StopConditionFailure;
	readonly human_boundary?: StopConditionHumanBoundary;
	readonly model?: StopConditionModelSignal;
	readonly model_response?: ModelResponse;
	readonly pending_tool_call?: PendingApprovalToolCall;
	readonly resolved_model_request?: ModelRequest;
	readonly run_id: string;
	readonly state_transitions?: readonly Readonly<{
		readonly from: RuntimeState;
		readonly to: RuntimeState;
	}>[];
	readonly token_usage?: AgentLoopTokenUsage;
	readonly tool_arguments?: ToolArguments;
	readonly tool_result?: ToolResult;
	readonly trace_id: string;
	readonly turn_count: number;
}

export interface AgentLoopTurnInput {
	readonly config: AgentLoopConfig;
	readonly run_id: string;
	readonly snapshot: AgentLoopSnapshot;
	readonly trace_id: string;
	readonly turn_index: number;
}

export interface AgentLoopTurnResult {
	readonly approval_request?: ApprovalRequest;
	readonly assistant_text?: string;
	readonly current_loop_state?: LoopState;
	readonly current_runtime_state?: RuntimeState;
	readonly failure?: StopConditionFailure;
	readonly human_boundary?: StopConditionHumanBoundary;
	readonly model?: StopConditionModelSignal;
	readonly model_response?: ModelResponse;
	readonly pending_tool_call?: PendingApprovalToolCall;
	readonly progress_events?: readonly TurnProgressEvent[];
	readonly resolved_model_request?: ModelRequest;
	readonly state_transitions?: readonly Readonly<{
		readonly from: RuntimeState;
		readonly to: RuntimeState;
	}>[];
	readonly tool_arguments?: ToolArguments;
	readonly tool_result?: ToolResult;
}

export type AgentLoopTurnExecutor = (input: AgentLoopTurnInput) => Promise<AgentLoopTurnResult>;

export interface AgentLoopContinueGateInput {
	readonly config: AgentLoopConfig;
	readonly run_id: string;
	readonly snapshot: AgentLoopSnapshot;
	readonly trace_id: string;
	readonly turn_index: number;
}

export type AgentLoopContinueGateResult =
	| Readonly<{
			readonly status: 'allow';
	  }>
	| Readonly<{
			readonly status: 'override';
			readonly turn_result: AgentLoopTurnResult;
	  }>;

export type AgentLoopContinueGate = (
	input: AgentLoopContinueGateInput,
) => Promise<AgentLoopContinueGateResult> | AgentLoopContinueGateResult;

export interface AgentLoopYieldContext<TYield extends TurnYield = TurnYield> {
	readonly snapshot: AgentLoopSnapshot;
	readonly stop_reason?: StopReason;
	readonly yield: TYield;
}

export type AgentLoopYieldObserver = (context: AgentLoopYieldContext) => Promise<void> | void;

export interface CreateAgentLoopInput {
	readonly cancellation_signal?: AgentLoopCancellationSignal;
	readonly config: AgentLoopConfig;
	readonly continue_gate?: AgentLoopContinueGate;
	readonly execute_turn: AgentLoopTurnExecutor;
	readonly initial_loop_state?: Extract<LoopState, 'PAUSED' | 'RUNNING' | 'WAITING'>;
	readonly initial_runtime_state?: RuntimeState;
	readonly initial_tool_result?: ToolResult;
	readonly initial_turn_count?: number;
	readonly on_yield?: AgentLoopYieldObserver;
	readonly run_id: string;
	readonly trace_id: string;
}

export interface AgentLoopResult {
	readonly final_snapshot: AgentLoopSnapshot;
	readonly stop_reason: StopReason;
}

function buildCancellation(input: CreateAgentLoopInput): StopConditionCancellation | undefined {
	if (input.cancellation_signal === undefined) {
		return undefined;
	}

	return {
		actor: input.cancellation_signal.actor,
		requested: input.cancellation_signal.is_cancelled(),
	};
}

function buildStopConditionsSnapshot(
	input: CreateAgentLoopInput,
	snapshot: AgentLoopSnapshot,
	recentToolCalls: readonly ToolCallSignature[],
): StopConditionsSnapshot {
	return {
		cancellation: buildCancellation(input),
		config: {
			max_turns: snapshot.config.max_turns,
			stop_conditions: snapshot.config.stop_conditions,
			token_limits: snapshot.config.token_limits,
		},
		current_loop_state: snapshot.current_loop_state,
		current_runtime_state: snapshot.current_runtime_state,
		failure: snapshot.failure,
		human_boundary: snapshot.human_boundary,
		model: snapshot.model,
		recent_tool_calls: recentToolCalls,
		token_usage: snapshot.token_usage,
		tool_result: snapshot.tool_result,
		turn_count: snapshot.turn_count,
	};
}

function createInitialSnapshot(input: CreateAgentLoopInput): AgentLoopSnapshot {
	return {
		config: {
			max_turns: input.config.max_turns,
			stop_conditions: input.config.stop_conditions,
			token_limits: input.config.token_limits,
		},
		current_loop_state: input.initial_loop_state ?? 'RUNNING',
		current_runtime_state: input.initial_runtime_state ?? 'MODEL_THINKING',
		run_id: input.run_id,
		tool_result: input.initial_tool_result,
		trace_id: input.trace_id,
		turn_count: input.initial_turn_count ?? 0,
	};
}

function createTurnStartedYield(snapshot: AgentLoopSnapshot, turnIndex: number): TurnStartedYield {
	return {
		loop_state: 'RUNNING',
		max_turns: snapshot.config.max_turns,
		run_id: snapshot.run_id,
		trace_id: snapshot.trace_id,
		turn_index: turnIndex,
		type: 'turn.started',
	};
}

function createTurnProgressYields(
	snapshot: AgentLoopSnapshot,
	turnIndex: number,
	events: readonly TurnProgressEvent[] | undefined,
): readonly TurnProgressYield[] {
	if (events === undefined || events.length === 0) {
		return [];
	}

	return events.map((event) => ({
		event,
		loop_state: snapshot.current_loop_state,
		run_id: snapshot.run_id,
		runtime_state: snapshot.current_runtime_state,
		trace_id: snapshot.trace_id,
		turn_index: turnIndex,
		type: 'turn.progress',
	}));
}

function normalizeExecutorFailure(error: unknown): StopConditionFailure {
	if (error instanceof Error) {
		const errorWithCode = error as Error & { code?: string };

		return {
			error_code: errorWithCode.code ?? 'TURN_EXECUTION_FAILED',
			error_message: error.message,
			retryable: false,
		};
	}

	return {
		error_code: 'TURN_EXECUTION_FAILED',
		error_message: 'Unknown turn execution failure.',
		retryable: false,
	};
}

function resolveLoopStateFromTurnResult(
	result: AgentLoopTurnResult,
	previousSnapshot: AgentLoopSnapshot,
): LoopState {
	if (result.current_loop_state !== undefined) {
		return result.current_loop_state;
	}

	if (result.human_boundary !== undefined) {
		return result.human_boundary.loop_state ?? 'WAITING';
	}

	if (result.failure !== undefined || result.current_runtime_state === 'FAILED') {
		return 'FAILED';
	}

	if (result.current_runtime_state === 'COMPLETED') {
		return 'COMPLETED';
	}

	return previousSnapshot.current_loop_state === 'CANCELLED' ? 'CANCELLED' : 'RUNNING';
}

function normalizeUsageToken(value: number | undefined): number | undefined {
	if (!Number.isFinite(value) || value === undefined || value < 0) {
		return undefined;
	}

	return Math.trunc(value);
}

function extractModelResponseTokenUsage(
	modelResponse: ModelResponse | undefined,
): AgentLoopTokenUsage | undefined {
	if (modelResponse?.usage === undefined) {
		return undefined;
	}

	const inputTokens = normalizeUsageToken(modelResponse.usage.input_tokens);
	const outputTokens = normalizeUsageToken(modelResponse.usage.output_tokens);
	const totalTokens =
		normalizeUsageToken(modelResponse.usage.total_tokens) ??
		(inputTokens !== undefined && outputTokens !== undefined
			? inputTokens + outputTokens
			: (inputTokens ?? outputTokens));

	if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
		return undefined;
	}

	return {
		input_tokens: inputTokens ?? 0,
		output_tokens: outputTokens ?? 0,
		total_tokens: totalTokens ?? 0,
	};
}

function mergeTokenUsage(
	existingUsage: AgentLoopTokenUsage | undefined,
	incrementalUsage: AgentLoopTokenUsage | undefined,
): AgentLoopTokenUsage | undefined {
	if (existingUsage === undefined) {
		return incrementalUsage;
	}

	if (incrementalUsage === undefined) {
		return existingUsage;
	}

	return {
		input_tokens: existingUsage.input_tokens + incrementalUsage.input_tokens,
		output_tokens: existingUsage.output_tokens + incrementalUsage.output_tokens,
		total_tokens: existingUsage.total_tokens + incrementalUsage.total_tokens,
	};
}

function applyTurnResult(
	snapshot: AgentLoopSnapshot,
	result: AgentLoopTurnResult,
): AgentLoopSnapshot {
	const tokenUsage = mergeTokenUsage(
		snapshot.token_usage,
		extractModelResponseTokenUsage(result.model_response),
	);

	return {
		...snapshot,
		approval_request: result.approval_request,
		assistant_text: result.assistant_text,
		current_loop_state: resolveLoopStateFromTurnResult(result, snapshot),
		current_runtime_state: result.current_runtime_state ?? snapshot.current_runtime_state,
		failure: result.failure,
		human_boundary: result.human_boundary,
		model: result.model,
		model_response: result.model_response,
		pending_tool_call: result.pending_tool_call,
		resolved_model_request: result.resolved_model_request,
		...(tokenUsage === undefined ? {} : { token_usage: tokenUsage }),
		tool_result: result.tool_result ?? snapshot.tool_result,
		state_transitions: result.state_transitions,
		tool_arguments: result.tool_arguments ?? snapshot.tool_arguments,
		turn_count: snapshot.turn_count + 1,
	};
}

function applyPostTurnOverrideResult(
	snapshot: AgentLoopSnapshot,
	result: AgentLoopTurnResult,
): AgentLoopSnapshot {
	const tokenUsage = mergeTokenUsage(
		snapshot.token_usage,
		extractModelResponseTokenUsage(result.model_response),
	);

	return {
		...snapshot,
		approval_request: result.approval_request,
		assistant_text: result.assistant_text,
		current_loop_state: resolveLoopStateFromTurnResult(result, snapshot),
		current_runtime_state: result.current_runtime_state ?? snapshot.current_runtime_state,
		failure: result.failure,
		human_boundary: result.human_boundary,
		model: result.model,
		model_response: result.model_response,
		pending_tool_call: result.pending_tool_call,
		resolved_model_request: result.resolved_model_request,
		...(tokenUsage === undefined ? {} : { token_usage: tokenUsage }),
		tool_result: result.tool_result ?? snapshot.tool_result,
		state_transitions: result.state_transitions,
		tool_arguments: result.tool_arguments ?? snapshot.tool_arguments,
		turn_count: snapshot.turn_count,
	};
}

function createTurnCompletedYield(
	snapshot: AgentLoopSnapshot,
	turnIndex: number,
	decision: StopConditionsDecision,
): TurnCompletedYield {
	if (decision.decision === 'continue') {
		return {
			loop_state: decision.loop_state,
			next_step: 'continue',
			run_id: snapshot.run_id,
			runtime_state: snapshot.current_runtime_state,
			trace_id: snapshot.trace_id,
			turn_index: turnIndex,
			type: 'turn.completed',
		};
	}

	if (decision.decision === 'boundary') {
		return {
			loop_state: decision.loop_state,
			next_step: 'wait',
			run_id: snapshot.run_id,
			runtime_state: snapshot.current_runtime_state,
			trace_id: snapshot.trace_id,
			turn_index: turnIndex,
			type: 'turn.completed',
		};
	}

	return {
		loop_state: decision.loop_state,
		next_step: 'stop',
		run_id: snapshot.run_id,
		runtime_state: snapshot.current_runtime_state,
		trace_id: snapshot.trace_id,
		turn_index: turnIndex,
		type: 'turn.completed',
	};
}

function createLoopBoundaryYield(
	snapshot: AgentLoopSnapshot,
	turnIndex: number,
	reason: StopReason,
): LoopBoundaryYield {
	return {
		loop_state: reason.loop_state,
		reason,
		run_id: snapshot.run_id,
		trace_id: snapshot.trace_id,
		turn_index: turnIndex,
		type: 'loop.boundary',
	};
}

function toFinalResult(snapshot: AgentLoopSnapshot, stopReason: StopReason): AgentLoopResult {
	return {
		final_snapshot: {
			...snapshot,
			current_loop_state: stopReason.loop_state,
		},
		stop_reason: stopReason,
	};
}

function getDecisionReason(
	decision: Exclude<StopConditionsDecision, { readonly decision: 'continue' }>,
): StopReason {
	return decision.reason;
}

function normalizeSnapshotForNextTurn(snapshot: AgentLoopSnapshot): AgentLoopSnapshot {
	return {
		...snapshot,
		current_loop_state: 'RUNNING',
	};
}

function stableSerialize(value: unknown): string {
	if (value === null) {
		return 'null';
	}

	if (value === undefined) {
		return 'undefined';
	}

	if (value instanceof Date) {
		return JSON.stringify(value.toISOString());
	}

	if (Array.isArray(value)) {
		return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
	}

	if (typeof value === 'object') {
		const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));

		return `{${entries
			.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
			.join(',')}}`;
	}

	if (typeof value === 'bigint') {
		return JSON.stringify(value.toString());
	}

	return JSON.stringify(value);
}

function computeArgsHash(args: unknown): string {
	return createHash('sha256')
		.update(stableSerialize(args ?? {}))
		.digest('hex')
		.slice(0, 16);
}

function appendRecentToolCall(
	recentToolCalls: readonly ToolCallSignature[],
	signature: ToolCallSignature,
): readonly ToolCallSignature[] {
	const nextRecentToolCalls = [...recentToolCalls, signature];

	return nextRecentToolCalls.length > MAX_RECENT_TOOL_CALLS
		? nextRecentToolCalls.slice(-MAX_RECENT_TOOL_CALLS)
		: nextRecentToolCalls;
}

function updateRecentToolCalls(
	recentToolCalls: readonly ToolCallSignature[],
	previousSnapshot: AgentLoopSnapshot,
	nextSnapshot: AgentLoopSnapshot,
): readonly ToolCallSignature[] {
	if (nextSnapshot.tool_result === undefined) {
		return recentToolCalls;
	}

	if (
		previousSnapshot.tool_result?.call_id === nextSnapshot.tool_result.call_id &&
		previousSnapshot.tool_result.tool_name === nextSnapshot.tool_result.tool_name
	) {
		return recentToolCalls;
	}

	return appendRecentToolCall(recentToolCalls, {
		args_hash: computeArgsHash(nextSnapshot.tool_arguments),
		tool_name: nextSnapshot.tool_result.tool_name,
	});
}

async function notifyYield(
	input: CreateAgentLoopInput,
	context: AgentLoopYieldContext,
): Promise<void> {
	await input.on_yield?.(context);
}

async function applyContinueGateIfNeeded(
	input: CreateAgentLoopInput,
	snapshot: AgentLoopSnapshot,
	recentToolCalls: readonly ToolCallSignature[],
	turnIndex: number,
): Promise<{
	readonly gated_snapshot: AgentLoopSnapshot;
	readonly progress_events: readonly TurnProgressEvent[];
}> {
	const initialDecision = evaluateStopConditions(
		buildStopConditionsSnapshot(input, snapshot, recentToolCalls),
	);

	if (initialDecision.decision !== 'continue' || input.continue_gate === undefined) {
		return {
			gated_snapshot: snapshot,
			progress_events: [],
		};
	}

	const gateResult = await input.continue_gate({
		config: input.config,
		run_id: input.run_id,
		snapshot,
		trace_id: input.trace_id,
		turn_index: turnIndex,
	});

	if (gateResult.status !== 'override') {
		return {
			gated_snapshot: snapshot,
			progress_events: [],
		};
	}

	const gatedSnapshot = applyPostTurnOverrideResult(snapshot, gateResult.turn_result);

	return {
		gated_snapshot: gatedSnapshot,
		progress_events: gateResult.turn_result.progress_events ?? [],
	};
}

export async function* createAgentLoop(
	input: CreateAgentLoopInput,
): AsyncGenerator<TurnYield, AgentLoopResult, void> {
	let snapshot = createInitialSnapshot(input);
	let recentToolCalls: readonly ToolCallSignature[] = [];

	while (true) {
		const preTurnDecision = evaluateStopConditions(
			buildStopConditionsSnapshot(input, snapshot, recentToolCalls),
		);

		if (preTurnDecision.decision !== 'continue') {
			const reason = getDecisionReason(preTurnDecision);
			const boundaryYield = createLoopBoundaryYield(snapshot, snapshot.turn_count, reason);
			await notifyYield(input, {
				snapshot,
				stop_reason: reason,
				yield: boundaryYield,
			});
			yield boundaryYield;
			return toFinalResult(snapshot, reason);
		}

		const turnIndex = snapshot.turn_count + 1;
		const startedYield = createTurnStartedYield(snapshot, turnIndex);
		await notifyYield(input, {
			snapshot,
			yield: startedYield,
		});
		yield startedYield;

		let turnResult: AgentLoopTurnResult;
		const turnStartSnapshot = snapshot;

		try {
			turnResult = await input.execute_turn({
				config: input.config,
				run_id: input.run_id,
				snapshot,
				trace_id: input.trace_id,
				turn_index: turnIndex,
			});
		} catch (error: unknown) {
			turnResult = {
				current_loop_state: 'FAILED',
				current_runtime_state: 'FAILED',
				failure: normalizeExecutorFailure(error),
			};
		}

		snapshot = applyTurnResult(snapshot, turnResult);
		recentToolCalls = updateRecentToolCalls(recentToolCalls, turnStartSnapshot, snapshot);

		for (const progressYield of createTurnProgressYields(
			snapshot,
			turnIndex,
			turnResult.progress_events,
		)) {
			await notifyYield(input, {
				snapshot,
				yield: progressYield,
			});
			yield progressYield;
		}

		const preGateSnapshot = snapshot;
		const gatedTurn = await applyContinueGateIfNeeded(input, snapshot, recentToolCalls, turnIndex);
		snapshot = gatedTurn.gated_snapshot;
		recentToolCalls = updateRecentToolCalls(recentToolCalls, preGateSnapshot, snapshot);

		for (const progressYield of createTurnProgressYields(
			snapshot,
			turnIndex,
			gatedTurn.progress_events,
		)) {
			await notifyYield(input, {
				snapshot,
				yield: progressYield,
			});
			yield progressYield;
		}

		const postTurnDecision = evaluateStopConditions(
			buildStopConditionsSnapshot(input, snapshot, recentToolCalls),
		);
		const completedYield = createTurnCompletedYield(snapshot, turnIndex, postTurnDecision);
		await notifyYield(input, {
			snapshot,
			yield: completedYield,
		});
		yield completedYield;

		if (postTurnDecision.decision === 'continue') {
			snapshot = normalizeSnapshotForNextTurn(snapshot);

			continue;
		}

		const reason = getDecisionReason(postTurnDecision);
		const boundaryYield = createLoopBoundaryYield(snapshot, turnIndex, reason);
		await notifyYield(input, {
			snapshot,
			stop_reason: reason,
			yield: boundaryYield,
		});
		yield boundaryYield;
		return toFinalResult(snapshot, reason);
	}
}
