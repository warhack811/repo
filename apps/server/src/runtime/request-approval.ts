import type {
	ApprovalActionKind,
	ApprovalRequest,
	ApprovalTarget,
	EventActor,
	EventMetadata,
	EventSource,
	RuntimeState,
	ToolDefinition,
	ToolName,
} from '@runa/types';

import type { ToolStateTransition } from './run-tool-step.js';

import { buildApprovalRequestedEvent } from './approval-events.js';
import { transitionState } from './state-machine.js';

interface RequestApprovalEventContext {
	readonly actor?: EventActor;
	readonly metadata?: EventMetadata;
	readonly parent_event_id?: string;
	readonly sequence_no?: number;
	readonly session_id?: string;
	readonly source?: EventSource;
	readonly timestamp?: string;
}

interface RequestApprovalFailure {
	readonly code: 'INVALID_CURRENT_STATE';
	readonly message: string;
}

export interface RequestApprovalInput {
	readonly call_id?: string;
	readonly current_state: RuntimeState;
	readonly event_context?: RequestApprovalEventContext;
	readonly requires_reason?: boolean;
	readonly run_id: string;
	readonly summary?: string;
	readonly target?: ApprovalTarget;
	readonly title?: string;
	readonly tool_definition: ToolDefinition;
	readonly trace_id: string;
}

export interface RequestApprovalNotRequiredResult {
	readonly final_state: RuntimeState;
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'approval_not_required';
	readonly tool_name: ToolName;
}

export interface RequestApprovalRequiredResult {
	readonly approval_event: ReturnType<typeof buildApprovalRequestedEvent>;
	readonly approval_request: ApprovalRequest;
	readonly final_state: 'WAITING_APPROVAL';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'approval_required';
	readonly tool_name: ToolName;
}

export interface RequestApprovalFailureResult {
	readonly failure: RequestApprovalFailure;
	readonly final_state: 'FAILED';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'failed';
	readonly tool_name: ToolName;
}

export type RequestApprovalResult =
	| RequestApprovalNotRequiredResult
	| RequestApprovalRequiredResult
	| RequestApprovalFailureResult;

function createFailure(message: string): RequestApprovalFailure {
	return {
		code: 'INVALID_CURRENT_STATE',
		message,
	};
}

function buildApprovalActionKind(tool: ToolDefinition): ApprovalActionKind {
	if (
		tool.name === 'file.write' ||
		(tool.metadata.capability_class === 'file_system' &&
			tool.metadata.side_effect_level === 'write')
	) {
		return 'file_write';
	}

	if (
		tool.name === 'shell.exec' ||
		(tool.metadata.capability_class === 'shell' && tool.metadata.side_effect_level === 'execute')
	) {
		return 'shell_execution';
	}

	return 'tool_execution';
}

function buildApprovalId(input: RequestApprovalInput, sequenceNo: number): string {
	if (input.call_id) {
		return `${input.run_id}:approval:${input.call_id}`;
	}

	return `${input.run_id}:approval:${input.tool_definition.name}:${sequenceNo}`;
}

function buildDefaultTitle(tool: ToolDefinition): string {
	return `Approval required for ${tool.name}`;
}

function buildDefaultSummary(tool: ToolDefinition): string {
	return tool.description;
}

function buildDefaultTarget(input: RequestApprovalInput): ApprovalTarget {
	return {
		call_id: input.call_id,
		kind: 'tool_call',
		label: input.tool_definition.name,
		tool_name: input.tool_definition.name,
	};
}

export function requestApproval(input: RequestApprovalInput): RequestApprovalResult {
	if (input.current_state !== 'MODEL_THINKING') {
		return {
			failure: createFailure(
				`requestApproval expects MODEL_THINKING but received ${input.current_state}`,
			),
			final_state: 'FAILED',
			state_transitions: [],
			status: 'failed',
			tool_name: input.tool_definition.name,
		};
	}

	if (!input.tool_definition.metadata.requires_approval) {
		return {
			final_state: input.current_state,
			state_transitions: [],
			status: 'approval_not_required',
			tool_name: input.tool_definition.name,
		};
	}

	const currentState: 'MODEL_THINKING' = input.current_state;
	const sequenceNo = input.event_context?.sequence_no ?? 1;
	transitionState(currentState, 'WAITING_APPROVAL');
	const finalState = 'WAITING_APPROVAL';
	const actionKind = buildApprovalActionKind(input.tool_definition);
	const approvalId = buildApprovalId(input, sequenceNo);
	const title = input.title ?? buildDefaultTitle(input.tool_definition);
	const summary = input.summary ?? buildDefaultSummary(input.tool_definition);
	const approvalRequest: ApprovalRequest = {
		action_kind: actionKind,
		approval_id: approvalId,
		call_id: input.call_id,
		requested_at: input.event_context?.timestamp ?? new Date().toISOString(),
		requires_reason: input.requires_reason,
		risk_level: input.tool_definition.metadata.risk_level,
		run_id: input.run_id,
		status: 'pending',
		summary,
		target: input.target ?? buildDefaultTarget(input),
		title,
		tool_name: input.tool_definition.name,
		trace_id: input.trace_id,
	};

	const approvalEvent = buildApprovalRequestedEvent(
		{
			action_kind: approvalRequest.action_kind,
			approval_id: approvalRequest.approval_id,
			call_id: approvalRequest.call_id,
			summary: approvalRequest.summary,
			title: approvalRequest.title,
			tool_name: approvalRequest.tool_name,
		},
		{
			actor: input.event_context?.actor,
			metadata: input.event_context?.metadata,
			parent_event_id: input.event_context?.parent_event_id,
			run_id: input.run_id,
			sequence_no: sequenceNo,
			session_id: input.event_context?.session_id,
			source: input.event_context?.source,
			state_after: finalState,
			state_before: currentState,
			timestamp: approvalRequest.requested_at,
			trace_id: input.trace_id,
		},
	);

	return {
		approval_event: approvalEvent,
		approval_request: approvalRequest,
		final_state: finalState,
		state_transitions: [
			{
				from: currentState,
				to: finalState,
			},
		],
		status: 'approval_required',
		tool_name: input.tool_definition.name,
	};
}
