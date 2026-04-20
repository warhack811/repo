import type {
	ApprovalRequest,
	RuntimeState,
	ToolArguments,
	ToolExecutionContext,
	ToolName,
	ToolResult,
	ToolRuntimeEvent,
} from '@runa/types';

import type { RunRecordWriter } from '../persistence/run-store.js';
import type { ToolRegistry } from '../tools/registry.js';

import type { IngestedToolResult } from './ingest-tool-result.js';
import type { ModelToolDispatchApprovalRequired } from './model-tool-dispatch.js';
import type { ToolStateTransition } from './run-tool-step.js';

import { ingestToolResult } from './ingest-tool-result.js';
import { dispatchModelToolCall } from './model-tool-dispatch.js';
import { transitionState } from './state-machine.js';

export interface AssistantResponseOutcome {
	readonly kind: 'assistant_response';
	readonly text: string;
}

export interface ToolCallOutcome<
	TName extends ToolName = ToolName,
	TArguments extends ToolArguments = ToolArguments,
> {
	readonly call_id: string;
	readonly kind: 'tool_call';
	readonly tool_input: TArguments;
	readonly tool_name: TName;
}

export type ModelTurnOutcome = AssistantResponseOutcome | ToolCallOutcome;

interface ContinueModelTurnFailure {
	readonly cause?: unknown;
	readonly code:
		| 'INVALID_CURRENT_STATE'
		| 'INVALID_MODEL_TURN_OUTCOME'
		| 'TOOL_DISPATCH_FAILED'
		| 'TOOL_RESULT_INGESTION_FAILED';
	readonly message: string;
}

export interface ContinueModelTurnInput {
	readonly current_state: RuntimeState;
	readonly execution_context: ToolExecutionContext;
	readonly model_turn_outcome: unknown;
	readonly persistence_writer?: RunRecordWriter;
	readonly registry: ToolRegistry;
	readonly run_id: string;
	readonly trace_id: string;
}

export interface ContinueModelTurnAssistantResponseResult {
	readonly assistant_text: string;
	readonly events: readonly ToolRuntimeEvent[];
	readonly final_state: 'COMPLETED';
	readonly outcome_kind: 'assistant_response';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'completed';
}

export interface ContinueModelTurnToolCallResult {
	readonly call_id: string;
	readonly events: readonly ToolRuntimeEvent[];
	readonly final_state: 'TOOL_RESULT_INGESTING';
	readonly ingested_result: IngestedToolResult;
	readonly outcome_kind: 'tool_call';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'completed';
	readonly suggested_next_state: 'MODEL_THINKING';
	readonly tool_name: ToolName;
	readonly tool_result: ToolResult;
}

export interface ContinueModelTurnApprovalRequiredResult {
	readonly approval_event: ModelToolDispatchApprovalRequired['approval_event'];
	readonly approval_request: ApprovalRequest;
	readonly call_id: string;
	readonly events: readonly ToolRuntimeEvent[];
	readonly final_state: 'WAITING_APPROVAL';
	readonly outcome_kind: 'tool_call';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'approval_required';
	readonly tool_name: ToolName;
}

export interface ContinueModelTurnFailureResult {
	readonly call_id?: string;
	readonly events: readonly ToolRuntimeEvent[];
	readonly failure: ContinueModelTurnFailure;
	readonly final_state: 'FAILED';
	readonly outcome_kind?: ModelTurnOutcome['kind'];
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'failed';
	readonly tool_name?: ToolName;
}

export type ContinueModelTurnResult =
	| ContinueModelTurnAssistantResponseResult
	| ContinueModelTurnApprovalRequiredResult
	| ContinueModelTurnToolCallResult
	| ContinueModelTurnFailureResult;

interface RawAssistantResponseOutcome {
	readonly kind?: unknown;
	readonly text?: unknown;
}

interface RawToolCallOutcome {
	readonly call_id?: unknown;
	readonly kind?: unknown;
	readonly tool_input?: unknown;
	readonly tool_name?: unknown;
}

function createFailure(
	code: ContinueModelTurnFailure['code'],
	message: string,
	cause?: unknown,
): ContinueModelTurnFailure {
	return {
		cause,
		code,
		message,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isToolArguments(value: unknown): value is ToolArguments {
	return isRecord(value);
}

function isToolName(value: unknown): value is ToolName {
	return typeof value === 'string' && value.trim().length > 0 && value.includes('.');
}

function isAssistantResponseOutcome(value: unknown): value is AssistantResponseOutcome {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as RawAssistantResponseOutcome;

	return candidate.kind === 'assistant_response' && typeof candidate.text === 'string';
}

function isToolCallOutcome(value: unknown): value is ToolCallOutcome {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as RawToolCallOutcome;

	return (
		candidate.kind === 'tool_call' &&
		typeof candidate.call_id === 'string' &&
		candidate.call_id.trim().length > 0 &&
		isToolName(candidate.tool_name) &&
		isToolArguments(candidate.tool_input)
	);
}

function isModelTurnOutcome(value: unknown): value is ModelTurnOutcome {
	return isAssistantResponseOutcome(value) || isToolCallOutcome(value);
}

function createFailureResult(
	failure: ContinueModelTurnFailure,
	options: Readonly<{
		call_id?: string;
		events?: readonly ToolRuntimeEvent[];
		outcome_kind?: ModelTurnOutcome['kind'];
		state_transitions?: readonly ToolStateTransition[];
		tool_name?: ToolName;
	}> = {},
): ContinueModelTurnFailureResult {
	return {
		call_id: options.call_id,
		events: options.events ?? [],
		failure,
		final_state: 'FAILED',
		outcome_kind: options.outcome_kind,
		state_transitions: options.state_transitions ?? [],
		status: 'failed',
		tool_name: options.tool_name,
	};
}

export function continueAssistantResponseFastPath(
	input: Pick<ContinueModelTurnInput, 'current_state'>,
	outcome: AssistantResponseOutcome,
): ContinueModelTurnAssistantResponseResult {
	const completedState: 'COMPLETED' = transitionState(
		input.current_state,
		'COMPLETED',
	) as 'COMPLETED';

	return {
		assistant_text: outcome.text,
		events: [],
		final_state: completedState,
		outcome_kind: 'assistant_response',
		state_transitions: [
			{
				from: input.current_state,
				to: completedState,
			},
		],
		status: 'completed',
	};
}

async function continueToolCall(
	input: ContinueModelTurnInput,
	outcome: ToolCallOutcome,
): Promise<
	| ContinueModelTurnApprovalRequiredResult
	| ContinueModelTurnToolCallResult
	| ContinueModelTurnFailureResult
> {
	const dispatchResult = await dispatchModelToolCall({
		current_state: input.current_state,
		execution_context: input.execution_context,
		model_tool_call: {
			arguments: outcome.tool_input,
			call_id: outcome.call_id,
			tool_name: outcome.tool_name,
		},
		persistence_writer: input.persistence_writer,
		registry: input.registry,
		run_id: input.run_id,
		trace_id: input.trace_id,
	});

	if (dispatchResult.status === 'approval_required') {
		return {
			approval_event: dispatchResult.approval_event,
			approval_request: dispatchResult.approval_request,
			call_id: dispatchResult.call_id,
			events: dispatchResult.events,
			final_state: dispatchResult.final_state,
			outcome_kind: 'tool_call',
			state_transitions: dispatchResult.state_transitions,
			status: 'approval_required',
			tool_name: dispatchResult.tool_name,
		};
	}

	if (dispatchResult.status === 'failed') {
		return createFailureResult(
			createFailure('TOOL_DISPATCH_FAILED', dispatchResult.failure.message, dispatchResult.failure),
			{
				call_id: dispatchResult.call_id,
				events: dispatchResult.events,
				outcome_kind: 'tool_call',
				state_transitions: dispatchResult.state_transitions,
				tool_name: dispatchResult.tool_name,
			},
		);
	}

	const ingestionResult = ingestToolResult({
		call_id: dispatchResult.call_id,
		current_state: dispatchResult.final_state,
		run_id: input.run_id,
		tool_name: dispatchResult.tool_name,
		tool_result: dispatchResult.tool_result,
		trace_id: input.trace_id,
	});

	if (ingestionResult.status === 'failed') {
		return createFailureResult(
			createFailure(
				'TOOL_RESULT_INGESTION_FAILED',
				ingestionResult.failure.message,
				ingestionResult.failure,
			),
			{
				call_id: ingestionResult.call_id,
				events: dispatchResult.events,
				outcome_kind: 'tool_call',
				state_transitions: dispatchResult.state_transitions,
				tool_name: ingestionResult.tool_name,
			},
		);
	}

	return {
		call_id: ingestionResult.call_id,
		events: dispatchResult.events,
		final_state: ingestionResult.final_state,
		ingested_result: ingestionResult.ingested_result,
		outcome_kind: 'tool_call',
		state_transitions: dispatchResult.state_transitions,
		status: 'completed',
		suggested_next_state: ingestionResult.suggested_next_state,
		tool_name: ingestionResult.tool_name,
		tool_result: ingestionResult.tool_result,
	};
}

export async function continueModelTurn(
	input: ContinueModelTurnInput,
): Promise<ContinueModelTurnResult> {
	if (input.current_state !== 'MODEL_THINKING') {
		return createFailureResult(
			createFailure(
				'INVALID_CURRENT_STATE',
				`continueModelTurn expects MODEL_THINKING but received ${input.current_state}`,
			),
		);
	}

	if (!isModelTurnOutcome(input.model_turn_outcome)) {
		return createFailureResult(
			createFailure(
				'INVALID_MODEL_TURN_OUTCOME',
				'Model turn outcome must be either assistant_response{text} or tool_call{call_id, tool_name, tool_input}.',
			),
		);
	}

	if (input.model_turn_outcome.kind === 'assistant_response') {
		return continueAssistantResponseFastPath(input, input.model_turn_outcome);
	}

	return continueToolCall(input, input.model_turn_outcome);
}
