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
import {
	type ScheduledToolCandidate,
	classifyToolEffectClass,
	classifyToolResourceKey,
	planToolExecutionBatches,
} from './tool-scheduler.js';

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

export interface ToolCallsOutcome {
	readonly kind: 'tool_calls';
	readonly tool_calls: readonly ToolCallOutcome[];
}

export type ModelTurnOutcome = AssistantResponseOutcome | ToolCallOutcome | ToolCallsOutcome;

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
	readonly outcome_kind: 'tool_call' | 'tool_calls';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'completed';
	readonly suggested_next_state: 'MODEL_THINKING';
	readonly tool_name: ToolName;
	readonly tool_result: ToolResult;
	readonly tool_results?: readonly ToolResult[];
}

export interface ContinueModelTurnApprovalRequiredResult {
	readonly approval_event: ModelToolDispatchApprovalRequired['approval_event'];
	readonly approval_request: ApprovalRequest;
	readonly call_id: string;
	readonly events: readonly ToolRuntimeEvent[];
	readonly final_state: 'WAITING_APPROVAL';
	readonly outcome_kind: 'tool_call' | 'tool_calls';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'approval_required';
	readonly tool_name: ToolName;
	readonly tool_result?: ToolResult;
	readonly tool_results?: readonly ToolResult[];
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
	readonly tool_result?: ToolResult;
	readonly tool_results?: readonly ToolResult[];
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

interface RawToolCallsOutcome {
	readonly kind?: unknown;
	readonly tool_calls?: unknown;
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

function isToolCallsOutcome(value: unknown): value is ToolCallsOutcome {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as RawToolCallsOutcome;

	return (
		candidate.kind === 'tool_calls' &&
		Array.isArray(candidate.tool_calls) &&
		candidate.tool_calls.length > 0 &&
		candidate.tool_calls.every((toolCall) => isToolCallOutcome(toolCall))
	);
}

function isModelTurnOutcome(value: unknown): value is ModelTurnOutcome {
	return isAssistantResponseOutcome(value) || isToolCallOutcome(value) || isToolCallsOutcome(value);
}

function createFailureResult(
	failure: ContinueModelTurnFailure,
	options: Readonly<{
		call_id?: string;
		events?: readonly ToolRuntimeEvent[];
		outcome_kind?: ModelTurnOutcome['kind'];
		state_transitions?: readonly ToolStateTransition[];
		tool_name?: ToolName;
		tool_result?: ToolResult;
		tool_results?: readonly ToolResult[];
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
		tool_result: options.tool_result,
		tool_results: options.tool_results,
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

function orderToolResults(
	toolCalls: readonly ToolCallOutcome[],
	resultsByCallId: ReadonlyMap<string, ToolResult>,
): readonly ToolResult[] {
	return toolCalls
		.map((toolCall) => resultsByCallId.get(toolCall.call_id))
		.filter((toolResult): toolResult is ToolResult => toolResult !== undefined);
}

function toToolDispatchFailureMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return 'Unknown failure.';
}

async function continueToolCalls(
	input: ContinueModelTurnInput,
	outcome: ToolCallsOutcome,
): Promise<
	| ContinueModelTurnApprovalRequiredResult
	| ContinueModelTurnToolCallResult
	| ContinueModelTurnFailureResult
> {
	const scheduledCandidates: ScheduledToolCandidate<ToolCallOutcome>[] = [];

	for (const toolCall of outcome.tool_calls) {
		const toolDefinition = input.registry.get(toolCall.tool_name);

		if (!toolDefinition) {
			return createFailureResult(
				createFailure('TOOL_DISPATCH_FAILED', `Tool not found in registry: ${toolCall.tool_name}`),
				{
					call_id: toolCall.call_id,
					outcome_kind: 'tool_calls',
					tool_name: toolCall.tool_name,
				},
			);
		}

		scheduledCandidates.push({
			candidate: toolCall,
			effect_class: classifyToolEffectClass(toolDefinition),
			requires_approval: toolDefinition.metadata.requires_approval,
			resource_key: classifyToolResourceKey(toolDefinition),
		});
	}

	const plan = planToolExecutionBatches(scheduledCandidates);
	const events: ToolRuntimeEvent[] = [];
	const stateTransitions: ToolStateTransition[] = [];
	const resultsByCallId = new Map<string, ToolResult>();
	let lastCompletedResult: ContinueModelTurnToolCallResult | undefined;

	for (const batch of plan.batches) {
		const settledResults = await Promise.allSettled(
			batch.candidates.map((scheduledCandidate) =>
				continueToolCall(input, scheduledCandidate.candidate),
			),
		);

		for (const [index, settledResult] of settledResults.entries()) {
			const scheduledCandidate = batch.candidates[index];

			if (!scheduledCandidate) {
				continue;
			}

			const orderedToolResults = orderToolResults(outcome.tool_calls, resultsByCallId);

			if (settledResult.status === 'rejected') {
				return createFailureResult(
					createFailure(
						'TOOL_DISPATCH_FAILED',
						`Tool dispatch failed: ${toToolDispatchFailureMessage(settledResult.reason)}`,
						settledResult.reason,
					),
					{
						call_id: scheduledCandidate.candidate.call_id,
						events,
						outcome_kind: 'tool_calls',
						state_transitions: stateTransitions,
						tool_name: scheduledCandidate.candidate.tool_name,
						tool_result: lastCompletedResult?.tool_result,
						tool_results: orderedToolResults,
					},
				);
			}

			const result = settledResult.value;
			events.push(...result.events);
			stateTransitions.push(...result.state_transitions);

			if (result.status === 'failed') {
				return createFailureResult(
					createFailure('TOOL_DISPATCH_FAILED', result.failure.message, result.failure),
					{
						call_id: result.call_id,
						events,
						outcome_kind: 'tool_calls',
						state_transitions: stateTransitions,
						tool_name: result.tool_name,
						tool_result: lastCompletedResult?.tool_result,
						tool_results: orderedToolResults,
					},
				);
			}

			if (result.status === 'approval_required') {
				return {
					...result,
					events,
					outcome_kind: 'tool_calls',
					state_transitions: stateTransitions,
					tool_result: orderedToolResults.at(-1),
					tool_results: orderedToolResults,
				};
			}

			resultsByCallId.set(result.call_id, result.tool_result);
			lastCompletedResult = {
				...result,
				outcome_kind: 'tool_calls',
			};
		}
	}

	if (plan.blocked_candidate) {
		const approvalResult = await continueToolCall(input, plan.blocked_candidate.candidate);
		events.push(...approvalResult.events);
		stateTransitions.push(...approvalResult.state_transitions);

		const orderedToolResults = orderToolResults(outcome.tool_calls, resultsByCallId);

		if (approvalResult.status === 'approval_required') {
			return {
				...approvalResult,
				events,
				outcome_kind: 'tool_calls',
				state_transitions: stateTransitions,
				tool_result: orderedToolResults.at(-1),
				tool_results: orderedToolResults,
			};
		}

		if (approvalResult.status === 'failed') {
			return createFailureResult(
				createFailure(
					'TOOL_DISPATCH_FAILED',
					approvalResult.failure.message,
					approvalResult.failure,
				),
				{
					call_id: approvalResult.call_id,
					events,
					outcome_kind: 'tool_calls',
					state_transitions: stateTransitions,
					tool_name: approvalResult.tool_name,
					tool_result: lastCompletedResult?.tool_result,
					tool_results: orderedToolResults,
				},
			);
		}

		resultsByCallId.set(approvalResult.call_id, approvalResult.tool_result);
		lastCompletedResult = {
			...approvalResult,
			outcome_kind: 'tool_calls',
		};
	}

	if (!lastCompletedResult) {
		return createFailureResult(
			createFailure('TOOL_DISPATCH_FAILED', 'No tool calls were executed.'),
			{
				outcome_kind: 'tool_calls',
			},
		);
	}

	return {
		...lastCompletedResult,
		events,
		outcome_kind: 'tool_calls',
		state_transitions: stateTransitions,
		tool_results: orderToolResults(outcome.tool_calls, resultsByCallId),
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

	if (input.model_turn_outcome.kind === 'tool_calls') {
		return continueToolCalls(input, input.model_turn_outcome);
	}

	return continueToolCall(input, input.model_turn_outcome);
}
