import type { ApprovalBlock, ApprovalRequest, ApprovalResolution } from '@runa/types';

import { createBuiltInToolRegistry } from '../tools/registry.js';

interface MapApprovalResolutionToBlockInput {
	readonly approval_request: ApprovalRequest;
	readonly approval_resolution: ApprovalResolution;
}

const builtInToolRegistry = createBuiltInToolRegistry();

function resolveToolCopy(input: ApprovalRequest): Readonly<{
	readonly user_label_tr?: string;
	readonly user_summary_tr?: string;
}> {
	if (input.tool_name) {
		const toolDefinition = builtInToolRegistry.get(input.tool_name);

		return {
			user_label_tr: input.user_label_tr ?? toolDefinition?.user_label_tr,
			user_summary_tr: input.user_summary_tr ?? toolDefinition?.user_summary_tr,
		};
	}

	return {
		user_label_tr: input.user_label_tr,
		user_summary_tr: input.user_summary_tr,
	};
}

export function mapApprovalRequestToBlock(approvalRequest: ApprovalRequest): ApprovalBlock {
	const toolCopy = resolveToolCopy(approvalRequest);

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
			...(toolCopy.user_label_tr ? { user_label_tr: toolCopy.user_label_tr } : {}),
			...(toolCopy.user_summary_tr ? { user_summary_tr: toolCopy.user_summary_tr } : {}),
		},
		schema_version: 1,
		type: 'approval_block',
	};
}

export function mapApprovalResolutionToBlock(
	input: MapApprovalResolutionToBlockInput,
): ApprovalBlock {
	const toolCopy = resolveToolCopy(input.approval_request);

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
			...(toolCopy.user_label_tr ? { user_label_tr: toolCopy.user_label_tr } : {}),
			...(toolCopy.user_summary_tr ? { user_summary_tr: toolCopy.user_summary_tr } : {}),
		},
		schema_version: 1,
		type: 'approval_block',
	};
}
