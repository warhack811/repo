import type { ApprovalRequest, TurnProgressEvent } from '@runa/types';

import type {
	PermissionDecision,
	PermissionOutcomeResult,
	RequireApprovalPermissionDecision,
} from '../policy/permission-engine.js';
import type { AgentLoopContinueGate, AgentLoopTurnResult } from './agent-loop.js';
import { buildApprovalRequestedEvent } from './approval-events.js';
import { buildRunFailedEvent, buildStateEnteredEvent } from './runtime-events.js';

const AUTO_CONTINUE_APPROVAL_TARGET_LABEL = 'agent.auto_continue';

interface EvaluateAutoContinuePermissionResult {
	readonly decision: PermissionDecision;
}

interface CreateAutoContinuePolicyGateInput {
	evaluate_permission(
		input: Readonly<{
			readonly requested_max_consecutive_turns?: number;
		}>,
	): Promise<EvaluateAutoContinuePermissionResult> | EvaluateAutoContinuePermissionResult;
	record_outcome(
		input: Readonly<{
			readonly decision: PermissionDecision;
			readonly outcome: 'allowed' | 'denied';
		}>,
	): Promise<PermissionOutcomeResult> | PermissionOutcomeResult;
	remember_approval_decision(
		approval_id: string,
		decision: RequireApprovalPermissionDecision,
	): void;
}

function createApprovalId(runId: string, turnIndex: number): string {
	return `${runId}:approval:auto-continue:${turnIndex}`;
}

function createApprovalRequest(
	input: Readonly<{
		readonly approval_id: string;
		readonly requires_reason: boolean;
		readonly requested_at: string;
		readonly run_id: string;
		readonly trace_id: string;
	}>,
): ApprovalRequest {
	return {
		action_kind: 'tool_execution',
		approval_id: input.approval_id,
		requested_at: input.requested_at,
		requires_reason: input.requires_reason,
		risk_level: 'high',
		run_id: input.run_id,
		status: 'pending',
		summary:
			'Allow the live runtime to continue automatically into the next turn after tool results.',
		target: {
			kind: 'tool_call',
			label: AUTO_CONTINUE_APPROVAL_TARGET_LABEL,
		},
		title: 'Approve auto-continue',
		trace_id: input.trace_id,
	};
}

function createApprovalBoundaryTurnResult(
	input: Readonly<{
		readonly approval_request: ApprovalRequest;
		readonly requested_at: string;
		readonly run_id: string;
		readonly trace_id: string;
		readonly turn_index: number;
	}>,
): AgentLoopTurnResult {
	const approvalEvent = buildApprovalRequestedEvent(
		{
			action_kind: input.approval_request.action_kind,
			approval_id: input.approval_request.approval_id,
			summary: input.approval_request.summary,
			title: input.approval_request.title,
			tool_name: input.approval_request.tool_name,
		},
		{
			actor: {
				type: 'system',
			},
			run_id: input.run_id,
			sequence_no: input.turn_index * 100 + 91,
			source: {
				kind: 'runtime',
			},
			state_after: 'WAITING_APPROVAL',
			state_before: 'TOOL_RESULT_INGESTING',
			timestamp: input.requested_at,
			trace_id: input.trace_id,
		},
	);

	return {
		approval_request: input.approval_request,
		current_loop_state: 'WAITING',
		current_runtime_state: 'WAITING_APPROVAL',
		human_boundary: {
			action_kind: input.approval_request.action_kind,
			approval_id: input.approval_request.approval_id,
			boundary: 'approval',
			loop_state: 'WAITING',
		},
		progress_events: [
			buildStateEnteredEvent(
				{
					previous_state: 'TOOL_RESULT_INGESTING',
					reason: 'auto-continue-approval-required',
					state: 'WAITING_APPROVAL',
				},
				{
					actor: {
						type: 'system',
					},
					run_id: input.run_id,
					sequence_no: input.turn_index * 100 + 90,
					source: {
						kind: 'runtime',
					},
					state_after: 'WAITING_APPROVAL',
					state_before: 'TOOL_RESULT_INGESTING',
					timestamp: input.requested_at,
					trace_id: input.trace_id,
				},
			),
			approvalEvent,
		],
		state_transitions: [
			{
				from: 'TOOL_RESULT_INGESTING',
				to: 'WAITING_APPROVAL',
			},
		],
	};
}

function createPausedTurnResult(
	input: Readonly<{
		readonly run_id: string;
		readonly trace_id: string;
		readonly turn_index: number;
	}>,
): AgentLoopTurnResult {
	const timestamp = new Date().toISOString();

	return {
		current_loop_state: 'PAUSED',
		current_runtime_state: 'WAITING_APPROVAL',
		human_boundary: {
			boundary: 'resume',
			loop_state: 'PAUSED',
		},
		progress_events: [
			buildStateEnteredEvent(
				{
					previous_state: 'TOOL_RESULT_INGESTING',
					reason: 'session-paused-after-denials',
					state: 'WAITING_APPROVAL',
				},
				{
					actor: {
						type: 'system',
					},
					run_id: input.run_id,
					sequence_no: input.turn_index * 100 + 90,
					source: {
						kind: 'runtime',
					},
					state_after: 'WAITING_APPROVAL',
					state_before: 'TOOL_RESULT_INGESTING',
					timestamp,
					trace_id: input.trace_id,
				},
			),
		],
		state_transitions: [
			{
				from: 'TOOL_RESULT_INGESTING',
				to: 'WAITING_APPROVAL',
			},
		],
	};
}

function createDeniedTurnResult(
	input: Readonly<{
		readonly error_message: string;
		readonly run_id: string;
		readonly trace_id: string;
		readonly turn_index: number;
	}>,
): AgentLoopTurnResult {
	const timestamp = new Date().toISOString();
	const events: readonly TurnProgressEvent[] = [
		buildStateEnteredEvent(
			{
				previous_state: 'TOOL_RESULT_INGESTING',
				reason: 'auto-continue-denied',
				state: 'FAILED',
			},
			{
				actor: {
					type: 'system',
				},
				run_id: input.run_id,
				sequence_no: input.turn_index * 100 + 90,
				source: {
					kind: 'runtime',
				},
				state_after: 'FAILED',
				state_before: 'TOOL_RESULT_INGESTING',
				timestamp,
				trace_id: input.trace_id,
			},
		),
		buildRunFailedEvent(
			{
				error_code: 'AUTO_CONTINUE_DENIED',
				error_message: input.error_message,
				final_state: 'FAILED',
				retryable: false,
			},
			{
				actor: {
					type: 'system',
				},
				run_id: input.run_id,
				sequence_no: input.turn_index * 100 + 91,
				source: {
					kind: 'runtime',
				},
				state_after: 'FAILED',
				state_before: 'MODEL_THINKING',
				timestamp,
				trace_id: input.trace_id,
			},
		),
	];

	return {
		current_loop_state: 'FAILED',
		current_runtime_state: 'FAILED',
		failure: {
			error_code: 'AUTO_CONTINUE_DENIED',
			error_message: input.error_message,
			retryable: false,
		},
		progress_events: events,
		state_transitions: [
			{
				from: 'TOOL_RESULT_INGESTING',
				to: 'FAILED',
			},
		],
	};
}

export function createAutoContinuePolicyGate(
	input: CreateAutoContinuePolicyGateInput,
): AgentLoopContinueGate {
	return async function autoContinuePolicyGate(gateInput) {
		if (gateInput.snapshot.current_runtime_state !== 'TOOL_RESULT_INGESTING') {
			return {
				status: 'allow',
			};
		}

		const permissionEvaluation = await input.evaluate_permission({
			requested_max_consecutive_turns: gateInput.config.auto_continue?.max_consecutive_turns,
		});

		switch (permissionEvaluation.decision.decision) {
			case 'allow':
				await input.record_outcome({
					decision: permissionEvaluation.decision,
					outcome: 'allowed',
				});
				return {
					status: 'allow',
				};
			case 'require_approval': {
				const requestedAt = new Date().toISOString();
				const approvalId = createApprovalId(gateInput.run_id, gateInput.turn_index);
				const approvalRequest = createApprovalRequest({
					approval_id: approvalId,
					requires_reason: permissionEvaluation.decision.approval_requirement.requires_reason,
					requested_at: requestedAt,
					run_id: gateInput.run_id,
					trace_id: gateInput.trace_id,
				});

				input.remember_approval_decision(
					approvalRequest.approval_id,
					permissionEvaluation.decision,
				);

				return {
					status: 'override',
					turn_result: createApprovalBoundaryTurnResult({
						approval_request: approvalRequest,
						requested_at: requestedAt,
						run_id: gateInput.run_id,
						trace_id: gateInput.trace_id,
						turn_index: gateInput.turn_index,
					}),
				};
			}
			case 'pause':
				return {
					status: 'override',
					turn_result: createPausedTurnResult({
						run_id: gateInput.run_id,
						trace_id: gateInput.trace_id,
						turn_index: gateInput.turn_index,
					}),
				};
			case 'deny': {
				const outcomeResult = await input.record_outcome({
					decision: permissionEvaluation.decision,
					outcome: 'denied',
				});
				const denialMessage =
					outcomeResult.pause_transition === 'entered'
						? 'Auto-continue was denied and the session is now paused after consecutive denials.'
						: 'Auto-continue was denied by policy.';

				return {
					status: 'override',
					turn_result: createDeniedTurnResult({
						error_message: denialMessage,
						run_id: gateInput.run_id,
						trace_id: gateInput.trace_id,
						turn_index: gateInput.turn_index,
					}),
				};
			}
		}
	};
}

export { AUTO_CONTINUE_APPROVAL_TARGET_LABEL };
