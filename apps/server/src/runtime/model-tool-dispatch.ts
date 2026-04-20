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

import type {
	RunToolStepApprovalRequiredResult,
	RunToolStepFailureResult,
	RunToolStepSuccess,
	ToolStateTransition,
} from './run-tool-step.js';

import { runToolStep } from './run-tool-step.js';

export interface ModelToolCall<
	TName extends ToolName = ToolName,
	TArguments extends ToolArguments = ToolArguments,
> {
	readonly arguments: TArguments;
	readonly call_id: string;
	readonly tool_name: TName;
}

interface InvalidModelToolCallFailure {
	readonly cause?: unknown;
	readonly code: 'INVALID_MODEL_TOOL_CALL';
	readonly message: string;
}

export interface ModelToolDispatchInput {
	readonly current_state: RuntimeState;
	readonly execution_context: ToolExecutionContext;
	readonly model_tool_call: unknown;
	readonly persistence_writer?: RunRecordWriter;
	readonly registry: ToolRegistry;
	readonly run_id: string;
	readonly trace_id: string;
}

export interface ModelToolDispatchSuccess {
	readonly call_id: string;
	readonly events: readonly ToolRuntimeEvent[];
	readonly final_state: 'TOOL_RESULT_INGESTING';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'completed';
	readonly tool_name: ToolName;
	readonly tool_result: ToolResult;
}

export interface ModelToolDispatchApprovalRequired {
	readonly approval_event: RunToolStepApprovalRequiredResult['approval_event'];
	readonly approval_request: ApprovalRequest;
	readonly call_id: string;
	readonly events: readonly ToolRuntimeEvent[];
	readonly final_state: 'WAITING_APPROVAL';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'approval_required';
	readonly tool_name: ToolName;
}

export interface ModelToolDispatchFailure {
	readonly call_id?: string;
	readonly events: readonly ToolRuntimeEvent[];
	readonly failure: InvalidModelToolCallFailure | RunToolStepFailureResult['failure'];
	readonly final_state: 'FAILED';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'failed';
	readonly tool_name?: ToolName;
}

export type ModelToolDispatchResult =
	| ModelToolDispatchSuccess
	| ModelToolDispatchApprovalRequired
	| ModelToolDispatchFailure;

interface RawModelToolCallShape {
	readonly arguments?: unknown;
	readonly call_id?: unknown;
	readonly tool_name?: unknown;
}

function isToolArguments(value: unknown): value is ToolArguments {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isToolName(value: unknown): value is ToolName {
	return typeof value === 'string' && value.trim().length > 0 && value.includes('.');
}

function isModelToolCall(value: unknown): value is ModelToolCall {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}

	const candidate = value as RawModelToolCallShape;

	return (
		typeof candidate.call_id === 'string' &&
		candidate.call_id.trim().length > 0 &&
		isToolName(candidate.tool_name) &&
		isToolArguments(candidate.arguments)
	);
}

function createInvalidToolCallFailure(
	message: string,
	cause?: unknown,
): InvalidModelToolCallFailure {
	return {
		cause,
		code: 'INVALID_MODEL_TOOL_CALL',
		message,
	};
}

function toFailureResult(
	failure: InvalidModelToolCallFailure,
	callId?: string,
	toolName?: ToolName,
): ModelToolDispatchFailure {
	return {
		call_id: callId,
		events: [],
		failure,
		final_state: 'FAILED',
		state_transitions: [],
		status: 'failed',
		tool_name: toolName,
	};
}

function extractCallId(value: unknown): string | undefined {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return undefined;
	}

	const candidate = value as RawModelToolCallShape;

	return typeof candidate.call_id === 'string' && candidate.call_id.trim().length > 0
		? candidate.call_id
		: undefined;
}

function extractToolName(value: unknown): ToolName | undefined {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return undefined;
	}

	const candidate = value as RawModelToolCallShape;

	return isToolName(candidate.tool_name) ? candidate.tool_name : undefined;
}

function toDispatchResult(
	modelToolCall: ModelToolCall,
	result: RunToolStepSuccess | RunToolStepApprovalRequiredResult | RunToolStepFailureResult,
): ModelToolDispatchResult {
	if (result.status === 'failed') {
		return {
			call_id: modelToolCall.call_id,
			events: result.events,
			failure: result.failure,
			final_state: result.final_state,
			state_transitions: result.state_transitions,
			status: 'failed',
			tool_name: result.tool_name,
		};
	}

	if (result.status === 'approval_required') {
		return {
			approval_event: result.approval_event,
			approval_request: result.approval_request,
			call_id: modelToolCall.call_id,
			events: result.events,
			final_state: result.final_state,
			state_transitions: result.state_transitions,
			status: 'approval_required',
			tool_name: result.tool_name,
		};
	}

	return {
		call_id: modelToolCall.call_id,
		events: result.events,
		final_state: result.final_state,
		state_transitions: result.state_transitions,
		status: 'completed',
		tool_name: result.tool_name,
		tool_result: result.tool_result,
	};
}

export async function dispatchModelToolCall(
	input: ModelToolDispatchInput,
): Promise<ModelToolDispatchResult> {
	if (!isModelToolCall(input.model_tool_call)) {
		return toFailureResult(
			createInvalidToolCallFailure(
				'Model tool call must include non-empty call_id, tool_name, and arguments fields.',
			),
			extractCallId(input.model_tool_call),
			extractToolName(input.model_tool_call),
		);
	}

	const result = await runToolStep({
		current_state: input.current_state,
		execution_context: input.execution_context,
		persistence_writer: input.persistence_writer,
		registry: input.registry,
		run_id: input.run_id,
		tool_input: input.model_tool_call,
		tool_name: input.model_tool_call.tool_name,
		trace_id: input.trace_id,
	});

	return toDispatchResult(input.model_tool_call, result);
}
