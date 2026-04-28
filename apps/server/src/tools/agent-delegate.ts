import type {
	AgentDelegateRole,
	AgentDelegationRequest,
	AgentDelegationResult,
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
} from '@runa/types';

import {
	createSubAgentDelegationRequest,
	createSubAgentUnavailableResult,
} from '../runtime/sub-agent-runner.js';

type AgentDelegateArguments = ToolArguments & {
	readonly context?: string;
	readonly sub_agent_role: AgentDelegateRole;
	readonly task: string;
};

type AgentDelegateCallInput = ToolCallInput<'agent.delegate', AgentDelegateArguments>;

const AGENT_DELEGATE_ROLES = ['researcher', 'reviewer', 'coder'] as const;

interface AgentDelegateOutput extends AgentDelegationResult {
	readonly depth: number;
	readonly max_turns: number;
	readonly tool_allowlist: readonly string[];
}

function createErrorResult(
	input: ToolCallInput<'agent.delegate'>,
	error_code: Extract<ToolResult<'agent.delegate'>, { readonly status: 'error' }>['error_code'],
	error_message: string,
	details?: Readonly<Record<string, unknown>>,
	retryable?: boolean,
): ToolResult<'agent.delegate'> {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: input.tool_name,
	};
}

function createSuccessResult(
	input: AgentDelegateCallInput,
	output: AgentDelegateOutput,
): ToolResult<'agent.delegate', AgentDelegateOutput> {
	return {
		call_id: input.call_id,
		metadata: {
			delegation_depth: output.depth,
			sub_agent_role: output.role,
			turns_used: output.turns_used,
		},
		output,
		status: 'success',
		tool_name: input.tool_name,
	};
}

function isAgentDelegateRole(value: unknown): value is AgentDelegateRole {
	return value === 'coder' || value === 'researcher' || value === 'reviewer';
}

function normalizeAgentDelegateRole(value: unknown): AgentDelegateRole | undefined {
	if (isAgentDelegateRole(value)) {
		return value;
	}

	if (typeof value !== 'string') {
		return undefined;
	}

	const normalizedValue = value
		.trim()
		.toLocaleLowerCase()
		.replace(/[\s_-]+/gu, '');

	switch (normalizedValue) {
		case 'research':
		case 'researchagent':
		case 'researcher':
		case 'searcher':
			return 'researcher';
		case 'audit':
		case 'auditor':
		case 'qa':
		case 'review':
		case 'reviewagent':
		case 'reviewer':
			return 'reviewer';
		case 'code':
		case 'codeagent':
		case 'coder':
		case 'developer':
		case 'engineer':
		case 'implementer':
			return 'coder';
		default:
			return undefined;
	}
}

function resolveParentDepth(metadata: ToolExecutionContext['metadata']): number {
	const candidate = metadata as { readonly sub_agent_depth?: unknown } | undefined;

	return typeof candidate?.sub_agent_depth === 'number' ? candidate.sub_agent_depth : 0;
}

function validateAgentDelegateArguments(input: ToolCallInput<'agent.delegate'>):
	| {
			readonly arguments: AgentDelegateArguments;
			readonly status: 'ok';
	  }
	| ToolResult<'agent.delegate'> {
	const allowedKeys = new Set(['context', 'sub_agent_role', 'task']);

	for (const key of Object.keys(input.arguments)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				`agent.delegate does not accept the "${key}" argument.`,
				{
					argument: key,
					reason: 'unexpected_argument',
				},
				false,
			);
		}
	}

	const { context, sub_agent_role, task } = input.arguments;
	const normalizedRole = normalizeAgentDelegateRole(sub_agent_role);

	if (!normalizedRole) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'Runa could not safely choose a sub-agent role for this delegated step.',
			{
				argument: 'sub_agent_role',
				allowed_values: AGENT_DELEGATE_ROLES,
				reason: 'invalid_role',
			},
			false,
		);
	}

	if (typeof task !== 'string' || task.trim().length < 8 || task.length > 4_000) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'agent.delegate task must be a string between 8 and 4000 characters.',
			{
				argument: 'task',
				reason: 'invalid_task',
			},
			false,
		);
	}

	if (context !== undefined && (typeof context !== 'string' || context.length > 8_000)) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'agent.delegate context must be a string up to 8000 characters when provided.',
			{
				argument: 'context',
				reason: 'invalid_context',
			},
			false,
		);
	}

	return {
		arguments: {
			context,
			sub_agent_role: normalizedRole,
			task: task.trim(),
		},
		status: 'ok',
	};
}

function toOutput(
	result: AgentDelegationResult,
	request: AgentDelegationRequest,
): AgentDelegateOutput {
	return {
		depth: request.depth,
		evidence: result.evidence,
		max_turns: request.max_turns,
		role: result.role,
		status: result.status,
		summary: result.summary,
		tool_allowlist: request.tool_allowlist,
		turns_used: result.turns_used,
	};
}

export const agentDelegateTool: ToolDefinition<AgentDelegateCallInput> = {
	callable_schema: {
		parameters: {
			context: {
				description: 'Optional bounded context for the sub-agent.',
				type: 'string',
			},
			sub_agent_role: {
				description:
					'Required. Choose exactly one role: researcher for information gathering, reviewer for critique/risk checks, or coder for bounded implementation work.',
				enum: AGENT_DELEGATE_ROLES,
				required: true,
				type: 'string',
			},
			task: {
				description: 'The bounded task to delegate.',
				required: true,
				type: 'string',
			},
		},
	},
	description: 'Delegate one bounded task to a conservative sequential sub-agent.',
	metadata: {
		capability_class: 'agent',
		requires_approval: false,
		risk_level: 'medium',
		side_effect_level: 'execute',
		tags: ['delegation', 'sequential', 'sub-agent'],
	},
	name: 'agent.delegate',
	async execute(input, context: ToolExecutionContext) {
		const validatedArguments = validateAgentDelegateArguments(input);

		if (validatedArguments.status !== 'ok') {
			return validatedArguments;
		}

		const delegateArguments = validatedArguments.arguments;
		const plan = createSubAgentDelegationRequest({
			context: delegateArguments.context,
			parent_depth: resolveParentDepth(context.metadata),
			parent_run_id: context.run_id,
			role: delegateArguments.sub_agent_role,
			task: delegateArguments.task,
			trace_id: context.trace_id,
		});

		if (plan.status === 'denied') {
			return createErrorResult(
				input,
				'PERMISSION_DENIED',
				'Nested sub-agent delegation is not allowed.',
				{
					reason: plan.reason,
				},
				false,
			);
		}

		const result =
			context.delegate_agent === undefined
				? createSubAgentUnavailableResult(delegateArguments.sub_agent_role)
				: await context.delegate_agent(plan.request);

		return createSuccessResult(input, toOutput(result, plan.request));
	},
};
