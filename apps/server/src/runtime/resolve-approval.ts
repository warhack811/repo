import type {
	ApprovalDecisionKind,
	ApprovalRequest,
	ApprovalResolution,
	EventActor,
	EventMetadata,
	EventSource,
	RuntimeState,
} from '@runa/types';

import type { ToolStateTransition } from './run-tool-step.js';

import { buildApprovalResolvedEvent } from './approval-events.js';
import { transitionState } from './state-machine.js';

interface ResolveApprovalEventContext {
	readonly actor?: EventActor;
	readonly metadata?: EventMetadata;
	readonly parent_event_id?: string;
	readonly sequence_no?: number;
	readonly session_id?: string;
	readonly source?: EventSource;
	readonly timestamp?: string;
}

interface ResolveApprovalFailure {
	readonly code: 'INVALID_CURRENT_STATE';
	readonly message: string;
}

type ResolvableApprovalDecision = Extract<ApprovalDecisionKind, 'approved' | 'rejected'>;

export interface ResolveApprovalInput {
	readonly approval_request: ApprovalRequest;
	readonly current_state: RuntimeState;
	readonly decision: ResolvableApprovalDecision;
	readonly event_context?: ResolveApprovalEventContext;
	readonly note?: string;
	readonly reason?: string;
	readonly run_id: string;
	readonly trace_id: string;
}

export interface ResolveApprovalApprovedResult {
	readonly approval_event: ReturnType<typeof buildApprovalResolvedEvent>;
	readonly approval_resolution: ApprovalResolution;
	readonly final_state: 'MODEL_THINKING';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'approved';
}

export interface ResolveApprovalRejectedResult {
	readonly approval_event: ReturnType<typeof buildApprovalResolvedEvent>;
	readonly approval_resolution: ApprovalResolution;
	readonly final_state: 'FAILED';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'rejected';
}

export interface ResolveApprovalFailureResult {
	readonly failure: ResolveApprovalFailure;
	readonly final_state: 'FAILED';
	readonly state_transitions: readonly ToolStateTransition[];
	readonly status: 'failed';
}

export type ResolveApprovalResult =
	| ResolveApprovalApprovedResult
	| ResolveApprovalRejectedResult
	| ResolveApprovalFailureResult;

function createFailure(message: string): ResolveApprovalFailure {
	return {
		code: 'INVALID_CURRENT_STATE',
		message,
	};
}

export function resolveApproval(input: ResolveApprovalInput): ResolveApprovalResult {
	if (input.current_state !== 'WAITING_APPROVAL') {
		return {
			failure: createFailure(
				`resolveApproval expects WAITING_APPROVAL but received ${input.current_state}`,
			),
			final_state: 'FAILED',
			state_transitions: [],
			status: 'failed',
		};
	}

	const currentState: 'WAITING_APPROVAL' = input.current_state;
	const resolvedAt = input.event_context?.timestamp ?? new Date().toISOString();
	const sequenceNo = input.event_context?.sequence_no ?? 1;

	if (input.decision === 'approved') {
		transitionState(currentState, 'MODEL_THINKING');
		const finalState = 'MODEL_THINKING';
		const approvalResolution: ApprovalResolution = {
			approval_id: input.approval_request.approval_id,
			decision: {
				approval_id: input.approval_request.approval_id,
				decision: input.decision,
				note: input.note,
				reason: input.reason,
				resolved_at: resolvedAt,
			},
			final_status: input.decision,
		};
		const approvalEvent = buildApprovalResolvedEvent(
			{
				approval_id: approvalResolution.approval_id,
				decision: approvalResolution.decision.decision,
				note: approvalResolution.decision.note ?? approvalResolution.decision.reason,
				resolved_at: approvalResolution.decision.resolved_at,
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
				timestamp: resolvedAt,
				trace_id: input.trace_id,
			},
		);

		return {
			approval_event: approvalEvent,
			approval_resolution: approvalResolution,
			final_state: finalState,
			state_transitions: [{ from: currentState, to: finalState }],
			status: 'approved',
		};
	}

	transitionState(currentState, 'FAILED');
	const finalState = 'FAILED';
	const approvalResolution: ApprovalResolution = {
		approval_id: input.approval_request.approval_id,
		decision: {
			approval_id: input.approval_request.approval_id,
			decision: input.decision,
			note: input.note,
			reason: input.reason,
			resolved_at: resolvedAt,
		},
		final_status: input.decision,
	};
	const approvalEvent = buildApprovalResolvedEvent(
		{
			approval_id: approvalResolution.approval_id,
			decision: approvalResolution.decision.decision,
			note: approvalResolution.decision.note ?? approvalResolution.decision.reason,
			resolved_at: approvalResolution.decision.resolved_at,
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
			timestamp: resolvedAt,
			trace_id: input.trace_id,
		},
	);

	return {
		approval_event: approvalEvent,
		approval_resolution: approvalResolution,
		final_state: finalState,
		state_transitions: [{ from: currentState, to: finalState }],
		status: 'rejected',
	};
}
