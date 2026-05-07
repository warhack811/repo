import type {
	AgentLoopConfig,
	AgentLoopTokenUsage,
	ApprovalActionKind,
	BoundaryLoopState,
	CancelledStopReason,
	LoopState,
	ModelFinishReason,
	PausedStopReason,
	RuntimeState,
	StopReason,
	TerminalLoopState,
	TerminalStopReason,
	ToolResult,
} from '@runa/types';

export interface StopConditionCancellation {
	readonly actor?: 'system' | 'user';
	readonly requested: boolean;
}

export interface StopConditionFailure {
	readonly error_code?: string;
	readonly error_message?: string;
	readonly retryable?: boolean;
}

export interface StopConditionHumanBoundary {
	readonly action_kind?: ApprovalActionKind;
	readonly approval_id?: string;
	readonly boundary: 'approval' | 'intervention' | 'resume';
	readonly loop_state?: BoundaryLoopState;
}

export interface StopConditionModelSignal {
	readonly finish_reason: ModelFinishReason;
	readonly outcome_kind?: 'assistant_response' | 'tool_call' | 'tool_calls';
}

export interface ToolCallSignature {
	readonly args_hash: string;
	readonly tool_name: string;
}

export interface StopConditionsSnapshot {
	readonly cancellation?: StopConditionCancellation;
	readonly config: Pick<AgentLoopConfig, 'max_turns' | 'stop_conditions' | 'token_limits'>;
	readonly consecutive_tool_failure_count?: number;
	readonly current_loop_state?: LoopState;
	readonly current_runtime_state?: RuntimeState;
	readonly failure?: StopConditionFailure;
	readonly human_boundary?: StopConditionHumanBoundary;
	readonly model?: StopConditionModelSignal;
	readonly recent_tool_calls?: readonly ToolCallSignature[];
	readonly token_usage?: AgentLoopTokenUsage;
	readonly tool_result?: ToolResult;
	readonly turn_count: number;
}

export interface ContinueStopConditionsDecision {
	readonly decision: 'continue';
	readonly loop_state: 'RUNNING';
}

export interface BoundaryStopConditionsDecision {
	readonly decision: 'boundary';
	readonly loop_state: BoundaryLoopState;
	readonly reason: PausedStopReason;
}

export interface TerminalStopConditionsDecision {
	readonly decision: 'terminal';
	readonly loop_state: TerminalLoopState;
	readonly reason: TerminalStopReason;
}

export type StopConditionsDecision =
	| ContinueStopConditionsDecision
	| BoundaryStopConditionsDecision
	| TerminalStopConditionsDecision;

type StopConditionRule = (snapshot: StopConditionsSnapshot) => StopConditionsDecision | undefined;

const DEFAULT_MODEL_STOP_REASONS: readonly ModelFinishReason[] = ['stop'];
const TOKEN_BUDGET_GUARD_RATIO = 0.9;

function toBoundaryDecision(reason: PausedStopReason): BoundaryStopConditionsDecision {
	return {
		decision: 'boundary',
		loop_state: reason.loop_state,
		reason,
	};
}

function toCancelledReason(snapshot: StopConditionsSnapshot): CancelledStopReason {
	return {
		actor: snapshot.cancellation?.actor,
		disposition: 'terminal',
		kind: 'cancelled',
		loop_state: 'CANCELLED',
		turn_count: snapshot.turn_count,
	};
}

function toTerminalDecision(reason: TerminalStopReason): TerminalStopConditionsDecision {
	return {
		decision: 'terminal',
		loop_state: reason.loop_state,
		reason,
	};
}

function shouldStopOnToolError(snapshot: StopConditionsSnapshot): boolean {
	// Default changed from true to false: individual tool errors are now fed back
	// to the model as context so it can try alternative strategies.
	// Set fail_on_tool_error: true explicitly to restore the old single-failure behavior.
	return snapshot.config.stop_conditions?.fail_on_tool_error === true;
}

function resolveMaxConsecutiveToolFailures(snapshot: StopConditionsSnapshot): number {
	const configured = snapshot.config.stop_conditions?.max_consecutive_tool_failures;

	if (configured !== undefined && Number.isFinite(configured) && configured >= 1) {
		return Math.trunc(configured);
	}

	return 3;
}

function shouldPauseOnApprovalWait(snapshot: StopConditionsSnapshot): boolean {
	return snapshot.config.stop_conditions?.pause_on_approval_wait !== false;
}

function resolveModelStopReasons(snapshot: StopConditionsSnapshot): readonly ModelFinishReason[] {
	const configuredReasons = snapshot.config.stop_conditions?.stop_on_model_finish_reason;

	if (configuredReasons === undefined || configuredReasons.length === 0) {
		return DEFAULT_MODEL_STOP_REASONS;
	}

	return configuredReasons.filter((reason) => reason !== 'error');
}

function evaluateCancellation(
	snapshot: StopConditionsSnapshot,
): StopConditionsDecision | undefined {
	if (snapshot.cancellation?.requested !== true) {
		return undefined;
	}

	return toTerminalDecision(toCancelledReason(snapshot));
}

function evaluateMaxTurns(snapshot: StopConditionsSnapshot): StopConditionsDecision | undefined {
	if (snapshot.turn_count < snapshot.config.max_turns) {
		return undefined;
	}

	return toTerminalDecision({
		disposition: 'terminal',
		kind: 'max_turns_reached',
		loop_state: 'FAILED',
		max_turns: snapshot.config.max_turns,
		turn_count: snapshot.turn_count,
	});
}

function normalizeTokenLimit(limit: number | undefined): number | undefined {
	if (!Number.isFinite(limit) || limit === undefined || limit <= 0) {
		return undefined;
	}

	return Math.trunc(limit);
}

function resolveTokenBudgetThreshold(limit: number): number {
	return Math.max(1, Math.floor(limit * TOKEN_BUDGET_GUARD_RATIO));
}

function evaluateTokenBudget(snapshot: StopConditionsSnapshot): StopConditionsDecision | undefined {
	const tokenUsage = snapshot.token_usage;
	const tokenLimits = snapshot.config.token_limits;

	if (tokenUsage === undefined || tokenLimits === undefined) {
		return undefined;
	}

	const tokenBudgetChecks = [
		{
			configured_limit: normalizeTokenLimit(tokenLimits.max_total_tokens),
			limit_kind: 'total_tokens' as const,
			observed_usage: tokenUsage.total_tokens,
		},
		{
			configured_limit: normalizeTokenLimit(tokenLimits.max_input_tokens),
			limit_kind: 'input_tokens' as const,
			observed_usage: tokenUsage.input_tokens,
		},
		{
			configured_limit: normalizeTokenLimit(tokenLimits.max_output_tokens),
			limit_kind: 'output_tokens' as const,
			observed_usage: tokenUsage.output_tokens,
		},
	];

	for (const check of tokenBudgetChecks) {
		if (check.configured_limit === undefined) {
			continue;
		}

		const threshold = resolveTokenBudgetThreshold(check.configured_limit);

		if (check.observed_usage < threshold) {
			continue;
		}

		return toTerminalDecision({
			configured_limit: check.configured_limit,
			disposition: 'terminal',
			kind: 'token_budget_reached',
			limit_kind: check.limit_kind,
			loop_state: 'FAILED',
			observed_usage: check.observed_usage,
			threshold,
			turn_count: snapshot.turn_count,
			usage: tokenUsage,
		});
	}

	return undefined;
}

function evaluateRepeatedToolCall(
	snapshot: StopConditionsSnapshot,
): StopConditionsDecision | undefined {
	const maxRepeats = snapshot.config.stop_conditions?.max_repeated_identical_calls ?? 3;
	const recentCalls = snapshot.recent_tool_calls;

	if (!recentCalls || recentCalls.length < maxRepeats) {
		return undefined;
	}

	const tail = recentCalls.slice(-maxRepeats);
	const [firstSignature] = tail;

	if (
		firstSignature === undefined ||
		!tail.every(
			(call) =>
				call.tool_name === firstSignature.tool_name && call.args_hash === firstSignature.args_hash,
		)
	) {
		return undefined;
	}

	if (firstSignature.tool_name === 'shell.session.read') {
		return undefined;
	}

	return toTerminalDecision({
		consecutive_count: maxRepeats,
		disposition: 'terminal',
		kind: 'repeated_tool_call',
		loop_state: 'FAILED',
		tool_name: firstSignature.tool_name,
		turn_count: snapshot.turn_count,
	});
}

function evaluateStagnation(snapshot: StopConditionsSnapshot): StopConditionsDecision | undefined {
	const windowSize = snapshot.config.stop_conditions?.stagnation_window_size ?? 6;
	const recentCalls = snapshot.recent_tool_calls;

	if (!recentCalls || recentCalls.length < windowSize) {
		return undefined;
	}

	const window = recentCalls.slice(-windowSize);
	const uniqueSignatures = new Set(window.map((call) => `${call.tool_name}::${call.args_hash}`));

	if (uniqueSignatures.size >= Math.ceil(windowSize / 2)) {
		return undefined;
	}

	return toTerminalDecision({
		disposition: 'terminal',
		kind: 'stagnation',
		loop_state: 'FAILED',
		turn_count: snapshot.turn_count,
		unique_tool_signatures: uniqueSignatures.size,
		window_size: windowSize,
	});
}

function evaluateToolFailure(snapshot: StopConditionsSnapshot): StopConditionsDecision | undefined {
	if (snapshot.tool_result?.status !== 'error') {
		return undefined;
	}

	// When fail_on_tool_error is explicitly true, preserve the legacy single-failure behavior.
	if (shouldStopOnToolError(snapshot)) {
		return toTerminalDecision({
			call_id: snapshot.tool_result.call_id,
			disposition: 'terminal',
			error_code: snapshot.tool_result.error_code,
			kind: 'tool_failure',
			loop_state: 'FAILED',
			retryable: snapshot.tool_result.retryable,
			tool_name: snapshot.tool_result.tool_name,
			turn_count: snapshot.turn_count,
		});
	}

	// Soft failure mode: only terminate after N consecutive tool failures.
	// Individual errors are fed back to the model so it can try alternatives.
	const consecutiveFailures = snapshot.consecutive_tool_failure_count ?? 0;
	const maxConsecutive = resolveMaxConsecutiveToolFailures(snapshot);

	if (consecutiveFailures >= maxConsecutive) {
		return toTerminalDecision({
			call_id: snapshot.tool_result.call_id,
			consecutive_count: consecutiveFailures,
			disposition: 'terminal',
			error_code: snapshot.tool_result.error_code,
			kind: 'tool_failure',
			loop_state: 'FAILED',
			retryable: false,
			tool_name: snapshot.tool_result.tool_name,
			turn_count: snapshot.turn_count,
		});
	}

	// Below the consecutive threshold: let the loop continue so the model can recover.
	return undefined;
}

function evaluateGenericFailure(
	snapshot: StopConditionsSnapshot,
): StopConditionsDecision | undefined {
	if (snapshot.failure === undefined && snapshot.current_runtime_state !== 'FAILED') {
		return undefined;
	}

	return toTerminalDecision({
		disposition: 'terminal',
		error_code: snapshot.failure?.error_code,
		error_message: snapshot.failure?.error_message,
		final_runtime_state: snapshot.current_runtime_state === 'FAILED' ? 'FAILED' : undefined,
		kind: 'failed',
		loop_state: 'FAILED',
		retryable: snapshot.failure?.retryable,
		turn_count: snapshot.turn_count,
	});
}

function evaluateModelStop(snapshot: StopConditionsSnapshot): StopConditionsDecision | undefined {
	if (
		snapshot.model === undefined ||
		snapshot.model.outcome_kind === 'tool_call' ||
		snapshot.model.outcome_kind === 'tool_calls'
	) {
		return undefined;
	}

	const stopReasons = resolveModelStopReasons(snapshot);

	if (!stopReasons.includes(snapshot.model.finish_reason)) {
		return undefined;
	}

	return toTerminalDecision({
		disposition: 'terminal',
		finish_reason: snapshot.model.finish_reason,
		kind: 'model_stop',
		loop_state: 'COMPLETED',
		turn_count: snapshot.turn_count,
	});
}

function evaluateHumanBoundary(
	snapshot: StopConditionsSnapshot,
): StopConditionsDecision | undefined {
	if (snapshot.current_runtime_state === 'WAITING_APPROVAL') {
		return toBoundaryDecision({
			action_kind: snapshot.human_boundary?.action_kind,
			approval_id: snapshot.human_boundary?.approval_id,
			boundary: 'approval',
			disposition: 'paused',
			kind: 'waiting_for_human',
			loop_state: snapshot.human_boundary?.loop_state ?? 'WAITING',
			turn_count: snapshot.turn_count,
		});
	}

	if (snapshot.human_boundary === undefined) {
		return undefined;
	}

	if (snapshot.human_boundary.boundary === 'approval' && !shouldPauseOnApprovalWait(snapshot)) {
		return undefined;
	}

	return toBoundaryDecision({
		action_kind: snapshot.human_boundary.action_kind,
		approval_id: snapshot.human_boundary.approval_id,
		boundary: snapshot.human_boundary.boundary,
		disposition: 'paused',
		kind: 'waiting_for_human',
		loop_state: snapshot.human_boundary.loop_state ?? 'WAITING',
		turn_count: snapshot.turn_count,
	});
}

function evaluateTerminalLoopState(
	snapshot: StopConditionsSnapshot,
): StopConditionsDecision | undefined {
	if (snapshot.current_loop_state === 'CANCELLED') {
		return toTerminalDecision(toCancelledReason(snapshot));
	}

	if (snapshot.current_loop_state === 'FAILED') {
		return toTerminalDecision({
			disposition: 'terminal',
			error_code: snapshot.failure?.error_code,
			error_message: snapshot.failure?.error_message,
			final_runtime_state: snapshot.current_runtime_state === 'FAILED' ? 'FAILED' : undefined,
			kind: 'failed',
			loop_state: 'FAILED',
			retryable: snapshot.failure?.retryable,
			turn_count: snapshot.turn_count,
		});
	}

	if (
		snapshot.current_runtime_state === 'COMPLETED' ||
		snapshot.current_loop_state === 'COMPLETED'
	) {
		return toTerminalDecision({
			disposition: 'terminal',
			final_runtime_state: snapshot.current_runtime_state === 'COMPLETED' ? 'COMPLETED' : undefined,
			kind: 'completed',
			loop_state: 'COMPLETED',
			turn_count: snapshot.turn_count,
		});
	}

	return undefined;
}

const stopConditionRules: readonly StopConditionRule[] = [
	evaluateCancellation,
	evaluateMaxTurns,
	evaluateTokenBudget,
	evaluateRepeatedToolCall,
	evaluateStagnation,
	evaluateToolFailure,
	evaluateGenericFailure,
	evaluateModelStop,
	evaluateHumanBoundary,
	evaluateTerminalLoopState,
];

export function evaluateStopConditions(snapshot: StopConditionsSnapshot): StopConditionsDecision {
	for (const rule of stopConditionRules) {
		const decision = rule(snapshot);

		if (decision !== undefined) {
			return decision;
		}
	}

	return {
		decision: 'continue',
		loop_state: 'RUNNING',
	};
}

export function isBoundaryStopDecision(
	decision: StopConditionsDecision,
): decision is BoundaryStopConditionsDecision {
	return decision.decision === 'boundary';
}

export function isTerminalStopDecision(
	decision: StopConditionsDecision,
): decision is TerminalStopConditionsDecision {
	return decision.decision === 'terminal';
}

export function getStopReason(decision: StopConditionsDecision): StopReason | undefined {
	if (decision.decision === 'continue') {
		return undefined;
	}

	return decision.reason;
}
