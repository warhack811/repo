import type { SubscriptionTier, UsageMetricKey, UsageWindow } from './subscription.js';
import type { ToolName, ToolRiskLevel } from './tools.js';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export type ResolvedApprovalStatus = Exclude<ApprovalStatus, 'pending'>;

export type ApprovalActionKind = 'tool_execution' | 'file_write' | 'shell_execution';

export type ApprovalDecisionKind = Extract<
	ResolvedApprovalStatus,
	'approved' | 'rejected' | 'expired' | 'cancelled'
>;

export type ApprovalTargetKind = 'tool_call' | 'file_path' | 'shell_command';

export interface ApprovalTarget {
	readonly kind: ApprovalTargetKind;
	readonly label: string;
	readonly call_id?: string;
	readonly command_preview?: string;
	readonly path?: string;
	readonly tool_name?: ToolName;
}

export interface ApprovalRequest {
	readonly approval_id: string;
	readonly run_id: string;
	readonly trace_id: string;
	readonly action_kind: ApprovalActionKind;
	readonly status: 'pending';
	readonly title: string;
	readonly summary: string;
	readonly requested_at: string;
	readonly target?: ApprovalTarget;
	readonly call_id?: string;
	readonly risk_level?: ToolRiskLevel;
	readonly requires_reason?: boolean;
	readonly tool_name?: ToolName;
	readonly user_label_tr?: string;
	readonly user_summary_tr?: string;
}

export interface ApprovalDecision {
	readonly approval_id: string;
	readonly decision: ApprovalDecisionKind;
	readonly note?: string;
	readonly reason?: string;
	readonly resolved_at: string;
}

export interface ApprovalResolution {
	readonly approval_id: string;
	readonly decision: ApprovalDecision;
	readonly final_status: ResolvedApprovalStatus;
}

export const usageLimitScopes = ['http_request', 'ws_run_request'] as const;

export type UsageLimitScope = (typeof usageLimitScopes)[number];

export const usageLimitRejectionKinds = ['quota_exhausted', 'rate_limited'] as const;

export type UsageLimitRejectionKind = (typeof usageLimitRejectionKinds)[number];

export interface UsageLimitRejection {
	readonly kind: UsageLimitRejectionKind;
	readonly limit: number;
	readonly metric: UsageMetricKey;
	readonly remaining: number;
	readonly resets_at?: string;
	readonly retry_after_seconds?: number;
	readonly scope: UsageLimitScope;
	readonly tier?: SubscriptionTier;
	readonly window: UsageWindow | 'minute';
}
