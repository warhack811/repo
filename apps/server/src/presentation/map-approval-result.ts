import type { ApprovalBlock, ApprovalRequest, ApprovalResolution } from '@runa/types';

interface MapApprovalResolutionToBlockInput {
	readonly approval_request: ApprovalRequest;
	readonly approval_resolution: ApprovalResolution;
}

export function mapApprovalRequestToBlock(approvalRequest: ApprovalRequest): ApprovalBlock {
	return {
		created_at: approvalRequest.requested_at,
		id: `approval_block:${approvalRequest.approval_id}:pending`,
		payload: {
			action_kind: approvalRequest.action_kind,
			approval_id: approvalRequest.approval_id,
			call_id: approvalRequest.call_id,
			status: approvalRequest.status,
			summary: approvalRequest.summary,
			target_kind: approvalRequest.target?.kind,
			target_label: approvalRequest.target?.label,
			title: approvalRequest.title,
			tool_name: approvalRequest.tool_name,
		},
		schema_version: 1,
		type: 'approval_block',
	};
}

export function mapApprovalResolutionToBlock(
	input: MapApprovalResolutionToBlockInput,
): ApprovalBlock {
	return {
		created_at: input.approval_resolution.decision.resolved_at,
		id: `approval_block:${input.approval_request.approval_id}:${input.approval_resolution.final_status}`,
		payload: {
			action_kind: input.approval_request.action_kind,
			approval_id: input.approval_request.approval_id,
			call_id: input.approval_request.call_id,
			decision: input.approval_resolution.decision.decision,
			note: input.approval_resolution.decision.note ?? input.approval_resolution.decision.reason,
			status: input.approval_resolution.final_status,
			summary: input.approval_request.summary,
			target_kind: input.approval_request.target?.kind,
			target_label: input.approval_request.target?.label,
			title: input.approval_request.title,
			tool_name: input.approval_request.tool_name,
		},
		schema_version: 1,
		type: 'approval_block',
	};
}
