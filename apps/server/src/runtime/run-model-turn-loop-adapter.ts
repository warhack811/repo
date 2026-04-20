import type {
	ModelGateway,
	ModelRequest,
	RuntimeState,
	ToolExecutionContext,
	ToolName,
	TurnProgressEvent,
} from '@runa/types';

import type { RunRecordWriter } from '../persistence/run-store.js';
import type { ToolRegistry } from '../tools/registry.js';

import type {
	AgentLoopTurnExecutor,
	AgentLoopTurnInput,
	AgentLoopTurnResult,
} from './agent-loop.js';
import type {
	RunModelTurnApprovalRequiredResult,
	RunModelTurnAssistantResponseResult,
	RunModelTurnFailureResult,
	RunModelTurnInput,
	RunModelTurnResult,
	RunModelTurnToolCallResult,
} from './run-model-turn.js';

import { buildModelUsageEventMetadata } from './model-usage-accounting.js';
import { runModelTurn } from './run-model-turn.js';
import {
	buildModelCompletedEvent,
	buildRunCompletedEvent,
	buildRunFailedEvent,
	buildStateEnteredEvent,
} from './runtime-events.js';

export type AgentLoopModelRequestFactory = (
	input: AgentLoopTurnInput,
) => ModelRequest | Promise<ModelRequest>;

export interface CreateRunModelTurnLoopExecutorInput {
	readonly build_model_request: AgentLoopModelRequestFactory;
	readonly execution_context?: Omit<ToolExecutionContext, 'run_id' | 'trace_id'>;
	readonly model_gateway: ModelGateway;
	readonly persistence_writer?: RunRecordWriter;
	readonly registry: ToolRegistry;
	readonly run_model_turn?: (input: RunModelTurnInput) => Promise<RunModelTurnResult>;
	readonly tool_names?: readonly ToolName[];
}

function buildExecutionContext(
	input: AgentLoopTurnInput,
	baseContext: CreateRunModelTurnLoopExecutorInput['execution_context'],
): ToolExecutionContext {
	return {
		...baseContext,
		run_id: input.run_id,
		trace_id: input.trace_id,
	};
}

function normalizeModelRequest(input: AgentLoopTurnInput, request: ModelRequest): ModelRequest {
	return {
		...request,
		run_id: input.run_id,
		trace_id: input.trace_id,
	};
}

function resolveCurrentState(input: AgentLoopTurnInput): RunModelTurnInput['current_state'] {
	if (input.snapshot.current_runtime_state === 'TOOL_RESULT_INGESTING') {
		return 'MODEL_THINKING';
	}

	return input.snapshot.current_runtime_state ?? 'MODEL_THINKING';
}

function toModelSignal(
	result:
		| RunModelTurnApprovalRequiredResult
		| RunModelTurnAssistantResponseResult
		| RunModelTurnFailureResult
		| RunModelTurnToolCallResult,
): AgentLoopTurnResult['model'] {
	if (result.model_response === undefined || result.model_turn_outcome === undefined) {
		return undefined;
	}

	return {
		finish_reason: result.model_response.finish_reason,
		outcome_kind: result.model_turn_outcome.kind,
	};
}

function getStateTransitionReason(nextState: RuntimeState): string {
	switch (nextState) {
		case 'COMPLETED':
			return 'assistant-response-produced';
		case 'FAILED':
			return 'turn-failed';
		case 'TOOL_EXECUTING':
			return 'tool-call-dispatched';
		case 'TOOL_RESULT_INGESTING':
			return 'tool-result-ingested';
		case 'WAITING_APPROVAL':
			return 'approval-required';
		default:
			return 'state-transition';
	}
}

function createRuntimeProgressEvents(
	turnInput: AgentLoopTurnInput,
	result: RunModelTurnResult,
): readonly TurnProgressEvent[] {
	const events: TurnProgressEvent[] = [];
	let sequenceNo = (turnInput.turn_index - 1) * 10 + 3;
	const timestamp = new Date().toISOString();

	if (result.model_response !== undefined) {
		events.push(
			buildModelCompletedEvent(
				{
					finish_reason: result.model_response.finish_reason,
					model: result.model_response.model,
					output_text: result.model_response.message.content,
					provider: result.model_response.provider,
				},
				{
					actor: {
						type: 'assistant',
					},
					metadata:
						result.resolved_model_request !== undefined
							? buildModelUsageEventMetadata({
									model_request: result.resolved_model_request,
									model_response: result.model_response,
								})
							: undefined,
					run_id: turnInput.run_id,
					sequence_no: sequenceNo,
					source: {
						kind: 'runtime',
					},
					state_after: 'MODEL_THINKING',
					state_before: 'MODEL_THINKING',
					timestamp,
					trace_id: turnInput.trace_id,
				},
			),
		);
		sequenceNo += 1;
	}

	for (const transition of result.continuation_result?.state_transitions ?? []) {
		events.push(
			buildStateEnteredEvent(
				{
					previous_state: transition.from,
					reason: getStateTransitionReason(transition.to),
					state: transition.to,
				},
				{
					actor: {
						type: transition.to === 'COMPLETED' ? 'assistant' : 'system',
					},
					run_id: turnInput.run_id,
					sequence_no: sequenceNo,
					source: {
						kind: 'runtime',
					},
					state_after: transition.to,
					state_before: transition.from,
					timestamp,
					trace_id: turnInput.trace_id,
				},
			),
		);
		sequenceNo += 1;
	}

	if (result.status === 'completed' && result.final_state === 'COMPLETED') {
		events.push(
			buildRunCompletedEvent(
				{
					final_state: 'COMPLETED',
					output_text: result.assistant_text,
				},
				{
					actor: {
						type: 'assistant',
					},
					run_id: turnInput.run_id,
					sequence_no: sequenceNo,
					source: {
						kind: 'runtime',
					},
					state_after: 'COMPLETED',
					state_before: 'MODEL_THINKING',
					timestamp,
					trace_id: turnInput.trace_id,
				},
			),
		);
		sequenceNo += 1;
	}

	if (result.status === 'failed') {
		events.push(
			buildRunFailedEvent(
				{
					error_code: result.failure.code,
					error_message: result.failure.message,
					final_state: 'FAILED',
					retryable: false,
				},
				{
					actor: {
						type: 'system',
					},
					run_id: turnInput.run_id,
					sequence_no: sequenceNo,
					source: {
						kind: 'runtime',
					},
					state_after: 'FAILED',
					state_before: 'MODEL_THINKING',
					timestamp,
					trace_id: turnInput.trace_id,
				},
			),
		);
	}

	return events;
}

function toProgressEvents(
	turnInput: AgentLoopTurnInput,
	result: RunModelTurnResult,
): AgentLoopTurnResult['progress_events'] {
	const runtimeEvents = createRuntimeProgressEvents(turnInput, result);

	if (result.status === 'approval_required') {
		return [...runtimeEvents, ...result.continuation_result.events, result.approval_event];
	}

	if (result.status === 'completed') {
		return [...runtimeEvents, ...result.continuation_result.events];
	}

	return runtimeEvents;
}

function mapAssistantCompletion(
	turnInput: AgentLoopTurnInput,
	result: RunModelTurnAssistantResponseResult,
): AgentLoopTurnResult {
	return {
		assistant_text: result.assistant_text,
		current_loop_state: 'COMPLETED',
		current_runtime_state: result.final_state,
		model: toModelSignal(result),
		model_response: result.model_response,
		progress_events: toProgressEvents(turnInput, result),
		resolved_model_request: result.resolved_model_request,
		state_transitions: result.continuation_result.state_transitions,
	};
}

function mapApprovalBoundary(
	turnInput: AgentLoopTurnInput,
	result: RunModelTurnApprovalRequiredResult,
	workingDirectory: string | undefined,
): AgentLoopTurnResult {
	return {
		approval_request: result.approval_request,
		current_loop_state: 'WAITING',
		current_runtime_state: result.final_state,
		human_boundary: {
			action_kind: result.approval_request.action_kind,
			approval_id: result.approval_request.approval_id,
			boundary: 'approval',
			loop_state: 'WAITING',
		},
		model: toModelSignal(result),
		model_response: result.model_response,
		pending_tool_call: {
			tool_input: result.model_turn_outcome.tool_input,
			working_directory: workingDirectory,
		},
		progress_events: toProgressEvents(turnInput, result),
		resolved_model_request: result.resolved_model_request,
		state_transitions: result.continuation_result.state_transitions,
	};
}

function mapFailure(
	turnInput: AgentLoopTurnInput,
	result: RunModelTurnFailureResult,
): AgentLoopTurnResult {
	return {
		current_loop_state: 'FAILED',
		current_runtime_state: result.final_state,
		failure: {
			error_code: result.failure.code,
			error_message: result.failure.message,
			retryable: false,
		},
		model: toModelSignal(result),
		model_response: result.model_response,
		progress_events: toProgressEvents(turnInput, result),
		resolved_model_request: result.resolved_model_request,
		state_transitions: result.continuation_result?.state_transitions,
	};
}

function mapToolContinuation(
	turnInput: AgentLoopTurnInput,
	result: RunModelTurnToolCallResult,
): AgentLoopTurnResult {
	return {
		current_loop_state: 'RUNNING',
		current_runtime_state: result.final_state,
		model: toModelSignal(result),
		model_response: result.model_response,
		progress_events: toProgressEvents(turnInput, result),
		resolved_model_request: result.resolved_model_request,
		state_transitions: result.continuation_result.state_transitions,
		tool_arguments: result.model_turn_outcome.tool_input,
		tool_result: result.tool_result,
	};
}

export function mapRunModelTurnResultToAgentLoopTurnResult(
	turnInput: AgentLoopTurnInput,
	result: RunModelTurnResult,
	options: Readonly<{
		readonly working_directory?: string;
	}> = {},
): AgentLoopTurnResult {
	if (result.status === 'approval_required') {
		return mapApprovalBoundary(turnInput, result, options.working_directory);
	}

	if (result.status === 'failed') {
		return mapFailure(turnInput, result);
	}

	if (result.final_state === 'COMPLETED') {
		return mapAssistantCompletion(turnInput, result);
	}

	return mapToolContinuation(turnInput, result);
}

export function createRunModelTurnLoopExecutor(
	input: CreateRunModelTurnLoopExecutorInput,
): AgentLoopTurnExecutor {
	const runModelTurnDependency = input.run_model_turn ?? runModelTurn;

	return async function runModelTurnLoopExecutor(
		turnInput: AgentLoopTurnInput,
	): Promise<AgentLoopTurnResult> {
		const modelRequest = normalizeModelRequest(
			turnInput,
			await input.build_model_request(turnInput),
		);

		const runModelTurnResult = await runModelTurnDependency({
			current_state: resolveCurrentState(turnInput),
			execution_context: buildExecutionContext(turnInput, input.execution_context),
			model_gateway: input.model_gateway,
			model_request: modelRequest,
			persistence_writer: input.persistence_writer,
			registry: input.registry,
			run_id: turnInput.run_id,
			tool_names: input.tool_names,
			trace_id: turnInput.trace_id,
		});

		return mapRunModelTurnResultToAgentLoopTurnResult(turnInput, runModelTurnResult, {
			working_directory: input.execution_context?.working_directory,
		});
	};
}
