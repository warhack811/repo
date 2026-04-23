import type {
	ApprovalRequest,
	ApprovalTarget,
	EventActor,
	EventSource,
	RuntimeState,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolMetadata,
	ToolName,
	ToolResult,
	ToolRuntimeEvent,
} from '@runa/types';

import type { RunRecordWriter } from '../persistence/run-store.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { RequestApprovalRequiredResult } from './request-approval.js';

import {
	hasRunStoreConfiguration,
	persistRunState,
	persistToolCall,
} from '../persistence/run-store.js';
import { requestApproval } from './request-approval.js';
import { transitionState } from './state-machine.js';
import {
	buildToolCallCompletedEvent,
	buildToolCallFailedEvent,
	buildToolCallStartedEvent,
} from './tool-events.js';

interface RunToolStepEventContext {
	readonly actor?: EventActor;
	readonly sequence_start?: number;
	readonly session_id?: string;
	readonly source?: EventSource;
}

export interface ToolStateTransition {
	readonly from: RuntimeState;
	readonly to: RuntimeState;
}

interface RunToolStepFailure {
	readonly cause?: unknown;
	readonly code:
		| 'APPROVAL_REQUEST_FAILED'
		| 'INVALID_CURRENT_STATE'
		| 'PERSISTENCE_FAILED'
		| 'TOOL_EXECUTION_FAILED'
		| 'TOOL_INPUT_MISMATCH'
		| 'TOOL_NOT_FOUND';
	readonly message: string;
}

export interface RunToolStepInput {
	readonly approval_target?: ApprovalTarget;
	readonly bypass_approval_gate?: boolean;
	readonly current_state: RuntimeState;
	readonly event_context?: RunToolStepEventContext;
	readonly execution_context: ToolExecutionContext;
	readonly persistence_writer?: RunRecordWriter;
	readonly registry: ToolRegistry;
	readonly run_id: string;
	readonly tool_input: ToolCallInput;
	readonly tool_name: ToolName;
	readonly trace_id: string;
}

export interface RunToolStepSuccess {
	readonly events: readonly ToolRuntimeEvent[];
	readonly final_state: 'TOOL_RESULT_INGESTING';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'completed';
	readonly tool_metadata: ToolMetadata;
	readonly tool_name: ToolName;
	readonly tool_result: ToolResult;
}

export interface RunToolStepApprovalRequiredResult {
	readonly approval_event: RequestApprovalRequiredResult['approval_event'];
	readonly approval_request: ApprovalRequest;
	readonly events: readonly ToolRuntimeEvent[];
	readonly final_state: 'WAITING_APPROVAL';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'approval_required';
	readonly tool_metadata: ToolMetadata;
	readonly tool_name: ToolName;
}

export interface RunToolStepFailureResult {
	readonly events: readonly ToolRuntimeEvent[];
	readonly failure: RunToolStepFailure;
	readonly final_state: 'FAILED';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'failed';
	readonly tool_name: ToolName;
}

export type RunToolStepResult =
	| RunToolStepSuccess
	| RunToolStepApprovalRequiredResult
	| RunToolStepFailureResult;

function buildFailure(
	code: RunToolStepFailure['code'],
	message: string,
	cause?: unknown,
): RunToolStepFailure {
	return {
		cause,
		code,
		message,
	};
}

function appendTransition(
	transitions: ToolStateTransition[],
	from: RuntimeState,
	to: RuntimeState,
): RuntimeState {
	const nextState = transitionState(from, to);

	transitions.push({ from, to: nextState });

	return nextState;
}

function toFailureMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return 'Unknown tool execution failure.';
}

function shouldPersist(input: RunToolStepInput): boolean {
	return input.persistence_writer !== undefined || hasRunStoreConfiguration();
}

async function persistRunStateIfConfigured(
	input: RunToolStepInput,
	currentState: RuntimeState,
	lastErrorCode?: string,
	recordedAt?: string,
): Promise<RunToolStepFailure | undefined> {
	if (!shouldPersist(input)) {
		return undefined;
	}

	try {
		await persistRunState(
			{
				current_state: currentState,
				last_error_code: lastErrorCode,
				recorded_at: recordedAt,
				run_id: input.run_id,
				trace_id: input.trace_id,
			},
			{
				writer: input.persistence_writer,
			},
		);
		return undefined;
	} catch (error: unknown) {
		return buildFailure(
			'PERSISTENCE_FAILED',
			`Run state persistence failed: ${toFailureMessage(error)}`,
			error,
		);
	}
}

async function persistToolCallIfConfigured(
	input: RunToolStepInput,
	record: Omit<Parameters<typeof persistToolCall>[0], 'run_id' | 'tool_name' | 'trace_id'>,
): Promise<RunToolStepFailure | undefined> {
	if (!shouldPersist(input)) {
		return undefined;
	}

	try {
		await persistToolCall(
			{
				...record,
				run_id: input.run_id,
				tool_name: input.tool_name,
				trace_id: input.trace_id,
			},
			{
				writer: input.persistence_writer,
			},
		);
		return undefined;
	} catch (error: unknown) {
		return buildFailure(
			'PERSISTENCE_FAILED',
			`Tool call persistence failed: ${toFailureMessage(error)}`,
			error,
		);
	}
}

function createFailureResult(
	input: RunToolStepInput,
	transitions: readonly ToolStateTransition[],
	failure: RunToolStepFailure,
	events: readonly ToolRuntimeEvent[],
): RunToolStepFailureResult {
	return {
		events,
		failure,
		final_state: 'FAILED',
		state_transitions: transitions,
		status: 'failed',
		tool_name: input.tool_name,
	};
}

function createApprovalRequiredResult(
	input: RunToolStepInput,
	transitions: readonly ToolStateTransition[],
	approvalRequest: ApprovalRequest,
	approvalEvent: RunToolStepApprovalRequiredResult['approval_event'],
	toolMetadata: ToolMetadata,
): RunToolStepApprovalRequiredResult {
	return {
		approval_event: approvalEvent,
		approval_request: approvalRequest,
		events: [],
		final_state: 'WAITING_APPROVAL',
		state_transitions: transitions,
		status: 'approval_required',
		tool_metadata: toolMetadata,
		tool_name: input.tool_name,
	};
}

function assertMatchingToolInput(input: RunToolStepInput): RunToolStepFailure | undefined {
	if (input.tool_input.tool_name === input.tool_name) {
		return undefined;
	}

	return buildFailure(
		'TOOL_INPUT_MISMATCH',
		`Tool input name mismatch: expected ${input.tool_name} but received ${input.tool_input.tool_name}`,
	);
}

function isTypedToolDefinition(
	tool: ToolDefinition,
): tool is ToolDefinition<ToolCallInput, ToolResult> {
	return true;
}

export async function runToolStep(input: RunToolStepInput): Promise<RunToolStepResult> {
	const transitions: ToolStateTransition[] = [];
	const events: ToolRuntimeEvent[] = [];
	const sequenceStart = input.event_context?.sequence_start ?? 1;
	const startedAt = new Date().toISOString();

	if (input.current_state !== 'MODEL_THINKING') {
		return createFailureResult(
			input,
			transitions,
			buildFailure(
				'INVALID_CURRENT_STATE',
				`runToolStep expects MODEL_THINKING but received ${input.current_state}`,
			),
			events,
		);
	}

	const mismatchedInputFailure = assertMatchingToolInput(input);

	if (mismatchedInputFailure) {
		appendTransition(transitions, input.current_state, 'FAILED');
		events.push(
			buildToolCallFailedEvent(
				{
					call_id: input.tool_input.call_id,
					error_code: mismatchedInputFailure.code,
					error_message: mismatchedInputFailure.message,
					retryable: false,
					tool_name: input.tool_name,
				},
				{
					actor: input.event_context?.actor,
					run_id: input.run_id,
					sequence_no: sequenceStart,
					session_id: input.event_context?.session_id,
					source: input.event_context?.source,
					state_after: 'FAILED',
					state_before: input.current_state,
					trace_id: input.trace_id,
				},
			),
		);

		const toolCallPersistenceFailure = await persistToolCallIfConfigured(input, {
			call_id: input.tool_input.call_id,
			completed_at: startedAt,
			created_at: startedAt,
			error_code: mismatchedInputFailure.code,
			state_after: 'FAILED',
			state_before: input.current_state,
			status: 'failed',
			tool_input: input.tool_input.arguments,
		});

		if (toolCallPersistenceFailure) {
			return createFailureResult(input, transitions, toolCallPersistenceFailure, events);
		}

		const runStatePersistenceFailure = await persistRunStateIfConfigured(
			input,
			'FAILED',
			mismatchedInputFailure.code,
			startedAt,
		);

		if (runStatePersistenceFailure) {
			return createFailureResult(input, transitions, runStatePersistenceFailure, events);
		}

		return createFailureResult(input, transitions, mismatchedInputFailure, events);
	}

	const registeredTool = input.registry.get(input.tool_name);

	if (!registeredTool) {
		appendTransition(transitions, input.current_state, 'FAILED');
		const failure = buildFailure(
			'TOOL_NOT_FOUND',
			`Tool not found in registry: ${input.tool_name}`,
		);

		events.push(
			buildToolCallFailedEvent(
				{
					call_id: input.tool_input.call_id,
					error_code: failure.code,
					error_message: failure.message,
					retryable: false,
					tool_name: input.tool_name,
				},
				{
					actor: input.event_context?.actor,
					run_id: input.run_id,
					sequence_no: sequenceStart,
					session_id: input.event_context?.session_id,
					source: input.event_context?.source,
					state_after: 'FAILED',
					state_before: input.current_state,
					trace_id: input.trace_id,
				},
			),
		);

		const toolCallPersistenceFailure = await persistToolCallIfConfigured(input, {
			call_id: input.tool_input.call_id,
			completed_at: startedAt,
			created_at: startedAt,
			error_code: failure.code,
			state_after: 'FAILED',
			state_before: input.current_state,
			status: 'failed',
			tool_input: input.tool_input.arguments,
		});

		if (toolCallPersistenceFailure) {
			return createFailureResult(input, transitions, toolCallPersistenceFailure, events);
		}

		const runStatePersistenceFailure = await persistRunStateIfConfigured(
			input,
			'FAILED',
			failure.code,
			startedAt,
		);

		if (runStatePersistenceFailure) {
			return createFailureResult(input, transitions, runStatePersistenceFailure, events);
		}

		return createFailureResult(input, transitions, failure, events);
	}

	if (!isTypedToolDefinition(registeredTool)) {
		appendTransition(transitions, input.current_state, 'FAILED');
		const failure = buildFailure(
			'TOOL_EXECUTION_FAILED',
			`Registry entry is not executable as a tool: ${input.tool_name}`,
		);

		const runStatePersistenceFailure = await persistRunStateIfConfigured(
			input,
			'FAILED',
			failure.code,
			startedAt,
		);

		if (runStatePersistenceFailure) {
			return createFailureResult(input, transitions, runStatePersistenceFailure, events);
		}

		return createFailureResult(input, transitions, failure, events);
	}

	if (input.bypass_approval_gate !== true) {
		const approvalResult = requestApproval({
			call_id: input.tool_input.call_id,
			current_state: input.current_state,
			event_context: {
				actor: input.event_context?.actor,
				sequence_no: sequenceStart,
				session_id: input.event_context?.session_id,
				source: input.event_context?.source,
				timestamp: startedAt,
			},
			run_id: input.run_id,
			target: input.approval_target,
			tool_definition: registeredTool,
			trace_id: input.trace_id,
		});

		if (approvalResult.status === 'failed') {
			const failure = buildFailure(
				'APPROVAL_REQUEST_FAILED',
				approvalResult.failure.message,
				approvalResult.failure,
			);
			const failedAt = new Date().toISOString();
			const runStatePersistenceFailure = await persistRunStateIfConfigured(
				input,
				'FAILED',
				failure.code,
				failedAt,
			);

			return createFailureResult(
				input,
				approvalResult.state_transitions,
				runStatePersistenceFailure ?? failure,
				events,
			);
		}

		if (approvalResult.status === 'approval_required') {
			const approvalPersistenceFailure = await persistRunStateIfConfigured(
				input,
				approvalResult.final_state,
				undefined,
				approvalResult.approval_request.requested_at,
			);

			if (approvalPersistenceFailure) {
				return createFailureResult(
					input,
					approvalResult.state_transitions,
					approvalPersistenceFailure,
					events,
				);
			}

			return createApprovalRequiredResult(
				input,
				approvalResult.state_transitions,
				approvalResult.approval_request,
				approvalResult.approval_event,
				registeredTool.metadata,
			);
		}
	}

	appendTransition(transitions, input.current_state, 'TOOL_EXECUTING');
	events.push(
		buildToolCallStartedEvent(
			{
				call_id: input.tool_input.call_id,
				tool_name: input.tool_name,
			},
			{
				actor: input.event_context?.actor,
				run_id: input.run_id,
				sequence_no: sequenceStart,
				session_id: input.event_context?.session_id,
				source: input.event_context?.source,
				state_after: 'TOOL_EXECUTING',
				state_before: 'MODEL_THINKING',
				trace_id: input.trace_id,
			},
		),
	);

	const toolCallStartPersistenceFailure = await persistToolCallIfConfigured(input, {
		call_id: input.tool_input.call_id,
		created_at: startedAt,
		state_after: 'TOOL_EXECUTING',
		state_before: 'MODEL_THINKING',
		status: 'started',
		tool_input: input.tool_input.arguments,
	});

	if (toolCallStartPersistenceFailure) {
		return createFailureResult(input, transitions, toolCallStartPersistenceFailure, events);
	}

	const toolExecutingPersistenceFailure = await persistRunStateIfConfigured(
		input,
		'TOOL_EXECUTING',
		undefined,
		startedAt,
	);

	if (toolExecutingPersistenceFailure) {
		return createFailureResult(input, transitions, toolExecutingPersistenceFailure, events);
	}

	try {
		const toolResult = await registeredTool.execute(input.tool_input, input.execution_context);
		const completedAt = new Date().toISOString();

		appendTransition(transitions, 'TOOL_EXECUTING', 'TOOL_RESULT_INGESTING');
		events.push(
			buildToolCallCompletedEvent(
				{
					call_id: input.tool_input.call_id,
					result_status: toolResult.status,
					tool_name: input.tool_name,
				},
				{
					actor: input.event_context?.actor,
					run_id: input.run_id,
					sequence_no: sequenceStart + 1,
					session_id: input.event_context?.session_id,
					source: input.event_context?.source,
					state_after: 'TOOL_RESULT_INGESTING',
					state_before: 'TOOL_EXECUTING',
					trace_id: input.trace_id,
				},
			),
		);

		const toolCallCompletionPersistenceFailure = await persistToolCallIfConfigured(input, {
			call_id: input.tool_input.call_id,
			completed_at: completedAt,
			created_at: startedAt,
			state_after: 'TOOL_RESULT_INGESTING',
			state_before: 'TOOL_EXECUTING',
			status: 'completed',
			tool_input: input.tool_input.arguments,
			tool_result: toolResult,
		});

		if (toolCallCompletionPersistenceFailure) {
			return createFailureResult(input, transitions, toolCallCompletionPersistenceFailure, events);
		}

		const toolResultIngestingPersistenceFailure = await persistRunStateIfConfigured(
			input,
			'TOOL_RESULT_INGESTING',
			undefined,
			completedAt,
		);

		if (toolResultIngestingPersistenceFailure) {
			return createFailureResult(input, transitions, toolResultIngestingPersistenceFailure, events);
		}

		return {
			events,
			final_state: 'TOOL_RESULT_INGESTING',
			state_transitions: transitions,
			status: 'completed',
			tool_metadata: registeredTool.metadata,
			tool_name: input.tool_name,
			tool_result: toolResult,
		};
	} catch (error: unknown) {
		appendTransition(transitions, 'TOOL_EXECUTING', 'FAILED');
		const failure = buildFailure(
			'TOOL_EXECUTION_FAILED',
			`Tool execution failed: ${toFailureMessage(error)}`,
			error,
		);
		const failedAt = new Date().toISOString();

		events.push(
			buildToolCallFailedEvent(
				{
					call_id: input.tool_input.call_id,
					error_code: failure.code,
					error_message: failure.message,
					retryable: false,
					tool_name: input.tool_name,
				},
				{
					actor: input.event_context?.actor,
					run_id: input.run_id,
					sequence_no: sequenceStart + 1,
					session_id: input.event_context?.session_id,
					source: input.event_context?.source,
					state_after: 'FAILED',
					state_before: 'TOOL_EXECUTING',
					trace_id: input.trace_id,
				},
			),
		);

		const toolCallFailurePersistence = await persistToolCallIfConfigured(input, {
			call_id: input.tool_input.call_id,
			completed_at: failedAt,
			created_at: startedAt,
			error_code: failure.code,
			state_after: 'FAILED',
			state_before: 'TOOL_EXECUTING',
			status: 'failed',
			tool_input: input.tool_input.arguments,
		});

		if (toolCallFailurePersistence) {
			return createFailureResult(input, transitions, toolCallFailurePersistence, events);
		}

		const failedStatePersistence = await persistRunStateIfConfigured(
			input,
			'FAILED',
			failure.code,
			failedAt,
		);

		if (failedStatePersistence) {
			return createFailureResult(input, transitions, failedStatePersistence, events);
		}

		return createFailureResult(input, transitions, failure, events);
	}
}
