import type {
	AgentDelegateRole,
	AgentDelegationRequest,
	AgentDelegationResult,
	ToolName,
} from '@runa/types';

export const MAX_SUB_AGENT_DEPTH = 1;
export const DEFAULT_SUB_AGENT_MAX_TURNS = 8;

const ROLE_TOOL_ALLOWLISTS: Readonly<Record<AgentDelegateRole, readonly ToolName[]>> = {
	coder: ['file.read', 'search.codebase', 'git.diff'],
	researcher: ['file.read', 'search.codebase', 'web.search'],
	reviewer: ['file.read', 'search.codebase', 'git.diff'],
};

export interface CreateSubAgentDelegationRequestInput {
	readonly context?: string;
	readonly parent_run_id: string;
	readonly parent_depth?: number;
	readonly role: AgentDelegateRole;
	readonly task: string;
	readonly trace_id: string;
}

export type SubAgentDelegationPlanResult =
	| {
			readonly request: AgentDelegationRequest;
			readonly status: 'ready';
	  }
	| {
			readonly reason: 'max_depth_exceeded';
			readonly status: 'denied';
	  };

export function getSubAgentToolAllowlist(role: AgentDelegateRole): readonly ToolName[] {
	return ROLE_TOOL_ALLOWLISTS[role];
}

export function createSubAgentDelegationRequest(
	input: CreateSubAgentDelegationRequestInput,
): SubAgentDelegationPlanResult {
	const parentDepth = input.parent_depth ?? 0;

	if (parentDepth >= MAX_SUB_AGENT_DEPTH) {
		return {
			reason: 'max_depth_exceeded',
			status: 'denied',
		};
	}

	return {
		request: {
			context: input.context,
			depth: parentDepth + 1,
			max_turns: DEFAULT_SUB_AGENT_MAX_TURNS,
			parent_run_id: input.parent_run_id,
			role: input.role,
			task: input.task,
			tool_allowlist: getSubAgentToolAllowlist(input.role),
			trace_id: input.trace_id,
		},
		status: 'ready',
	};
}

export function createSubAgentUnavailableResult(role: AgentDelegateRole): AgentDelegationResult {
	return {
		evidence: [
			{
				label: 'runner',
				value: 'sub_agent_runner_unavailable',
			},
		],
		role,
		status: 'failed',
		summary: 'Sub-agent runner is not available in this runtime context.',
		turns_used: 0,
	};
}
