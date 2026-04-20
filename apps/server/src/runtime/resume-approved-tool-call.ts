import type {
	ApprovalRequest,
	ApprovalResolution,
	RuntimeState,
	ToolCallInput,
	ToolExecutionContext,
	ToolName,
	ToolResult,
	ToolRuntimeEvent,
} from '@runa/types';

import type { RunRecordWriter } from '../persistence/run-store.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { ToolStateTransition } from './run-tool-step.js';

import { runToolStep } from './run-tool-step.js';

interface ResumeApprovedToolCallFailure {
	readonly cause?: unknown;
	readonly code:
		| 'INVALID_APPROVAL_REQUEST'
		| 'INVALID_APPROVAL_RESOLUTION'
		| 'INVALID_CURRENT_STATE'
		| 'TOOL_REPLAY_FAILED'
		| 'UNEXPECTED_APPROVAL_REQUIRED';
	readonly message: string;
}

export interface ResumeApprovedToolCallInput {
	readonly approval_request: ApprovalRequest;
	readonly approval_resolution: ApprovalResolution;
	readonly call_id: string;
	readonly current_state: RuntimeState;
	readonly execution_context: ToolExecutionContext;
	readonly persistence_writer?: RunRecordWriter;
	readonly registry: ToolRegistry;
	readonly run_id: string;
	readonly tool_input: ToolCallInput;
	readonly tool_name: ToolName;
	readonly trace_id: string;
}

export interface ResumeApprovedToolCallCompletedResult {
	readonly call_id: string;
	readonly events: readonly ToolRuntimeEvent[];
	readonly final_state: 'TOOL_RESULT_INGESTING';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'completed';
	readonly tool_name: ToolName;
	readonly tool_result: ToolResult;
}

export interface ResumeApprovedToolCallRejectedResult {
	readonly call_id: string;
	readonly events: readonly ToolRuntimeEvent[];
	readonly final_state: 'FAILED';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'rejected';
	readonly tool_name: ToolName;
}

export interface ResumeApprovedToolCallFailureResult {
	readonly call_id: string;
	readonly events: readonly ToolRuntimeEvent[];
	readonly failure: ResumeApprovedToolCallFailure;
	readonly final_state: 'FAILED';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'failed';
	readonly tool_name: ToolName;
}

export type ResumeApprovedToolCallResult =
	| ResumeApprovedToolCallCompletedResult
	| ResumeApprovedToolCallRejectedResult
	| ResumeApprovedToolCallFailureResult;

function createFailure(
	code: ResumeApprovedToolCallFailure['code'],
	message: string,
	cause?: unknown,
): ResumeApprovedToolCallFailure {
	return {
		cause,
		code,
		message,
	};
}

function createFailureResult(
	input: ResumeApprovedToolCallInput,
	failure: ResumeApprovedToolCallFailure,
	stateTransitions: readonly ToolStateTransition[] = [],
	events: readonly ToolRuntimeEvent[] = [],
): ResumeApprovedToolCallFailureResult {
	return {
		call_id: input.call_id,
		events,
		failure,
		final_state: 'FAILED',
		state_transitions: stateTransitions,
		status: 'failed',
		tool_name: input.tool_name,
	};
}

function hasMatchingReplayIdentity(input: ResumeApprovedToolCallInput): boolean {
	return (
		input.approval_request.approval_id === input.approval_resolution.approval_id &&
		input.approval_request.run_id === input.run_id &&
		input.approval_request.trace_id === input.trace_id &&
		input.approval_request.tool_name === input.tool_name &&
		input.approval_request.call_id === input.call_id &&
		input.tool_input.call_id === input.call_id &&
		input.tool_input.tool_name === input.tool_name
	);
}

export async function resumeApprovedToolCall(
	input: ResumeApprovedToolCallInput,
): Promise<ResumeApprovedToolCallResult> {
	if (!hasMatchingReplayIdentity(input)) {
		return createFailureResult(
			input,
			createFailure(
				'INVALID_APPROVAL_REQUEST',
				'Approval request and pending tool call identity must match run_id, trace_id, tool_name, and call_id.',
			),
		);
	}

	if (input.approval_resolution.decision.decision !== input.approval_resolution.final_status) {
		return createFailureResult(
			input,
			createFailure(
				'INVALID_APPROVAL_RESOLUTION',
				'Approval resolution decision and final_status must match.',
			),
		);
	}

	if (input.approval_resolution.final_status === 'rejected') {
		if (input.current_state !== 'FAILED') {
			return createFailureResult(
				input,
				createFailure(
					'INVALID_CURRENT_STATE',
					`resumeApprovedToolCall expects FAILED after rejected approval but received ${input.current_state}`,
				),
			);
		}

		return {
			call_id: input.call_id,
			events: [],
			final_state: 'FAILED',
			state_transitions: [],
			status: 'rejected',
			tool_name: input.tool_name,
		};
	}

	if (input.approval_resolution.final_status !== 'approved') {
		return createFailureResult(
			input,
			createFailure(
				'INVALID_APPROVAL_RESOLUTION',
				`resumeApprovedToolCall only supports approved resolutions but received ${input.approval_resolution.final_status}`,
			),
		);
	}

	if (input.current_state !== 'MODEL_THINKING') {
		return createFailureResult(
			input,
			createFailure(
				'INVALID_CURRENT_STATE',
				`resumeApprovedToolCall expects MODEL_THINKING after approved resolution but received ${input.current_state}`,
			),
		);
	}

	const replayResult = await runToolStep({
		bypass_approval_gate: true,
		current_state: input.current_state,
		execution_context: input.execution_context,
		persistence_writer: input.persistence_writer,
		registry: input.registry,
		run_id: input.run_id,
		tool_input: input.tool_input,
		tool_name: input.tool_name,
		trace_id: input.trace_id,
	});

	if (replayResult.status === 'approval_required') {
		return createFailureResult(
			input,
			createFailure(
				'UNEXPECTED_APPROVAL_REQUIRED',
				'Approved replay attempted to request approval again.',
			),
			replayResult.state_transitions,
			replayResult.events,
		);
	}

	if (replayResult.status === 'failed') {
		return createFailureResult(
			input,
			createFailure('TOOL_REPLAY_FAILED', replayResult.failure.message, replayResult.failure),
			replayResult.state_transitions,
			replayResult.events,
		);
	}

	return {
		call_id: input.call_id,
		events: replayResult.events,
		final_state: replayResult.final_state,
		state_transitions: replayResult.state_transitions,
		status: 'completed',
		tool_name: replayResult.tool_name,
		tool_result: replayResult.tool_result,
	};
}
