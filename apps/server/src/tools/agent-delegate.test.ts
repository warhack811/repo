import type { AgentDelegationRequest, ToolExecutionContext } from '@runa/types';
import { describe, expect, it } from 'vitest';

import { getSubAgentToolAllowlist } from '../runtime/sub-agent-runner.js';
import { agentDelegateTool } from './agent-delegate.js';
import { createBuiltInToolRegistry } from './registry.js';

function createExecutionContext(
	overrides: Partial<ToolExecutionContext> = {},
): ToolExecutionContext {
	return {
		run_id: 'parent_run',
		trace_id: 'trace_1',
		...overrides,
	};
}

describe('agent.delegate tool', () => {
	it('delegates a bounded sequential reviewer task with conservative policy', async () => {
		let observedRequest: AgentDelegationRequest | undefined;
		const result = await agentDelegateTool.execute(
			{
				arguments: {
					context: 'Review only the runtime cancellation files.',
					sub_agent_role: 'reviewer',
					task: 'Review the cancellation foundation for lifecycle risks.',
				},
				call_id: 'call_1',
				tool_name: 'agent.delegate',
			},
			createExecutionContext({
				async delegate_agent(request) {
					observedRequest = request;

					return {
						evidence: [
							{
								label: 'file',
								value: 'apps/server/src/runtime/run-cancellation.ts',
							},
						],
						role: request.role,
						status: 'completed',
						summary: 'The cancellation seam is bounded.',
						turns_used: 3,
					};
				},
			}),
		);

		expect(observedRequest).toEqual({
			context: 'Review only the runtime cancellation files.',
			depth: 1,
			max_turns: 8,
			parent_run_id: 'parent_run',
			role: 'reviewer',
			task: 'Review the cancellation foundation for lifecycle risks.',
			tool_allowlist: ['file.read', 'search.codebase', 'git.diff'],
			trace_id: 'trace_1',
		});
		expect(result).toMatchObject({
			output: {
				depth: 1,
				max_turns: 8,
				role: 'reviewer',
				status: 'completed',
				summary: 'The cancellation seam is bounded.',
				tool_allowlist: ['file.read', 'search.codebase', 'git.diff'],
				turns_used: 3,
			},
			status: 'success',
		});
	});

	it('denies nested sub-agent delegation', async () => {
		const result = await agentDelegateTool.execute(
			{
				arguments: {
					sub_agent_role: 'researcher',
					task: 'Research the narrow cancellation behavior.',
				},
				call_id: 'call_2',
				tool_name: 'agent.delegate',
			},
			createExecutionContext({
				metadata: {
					sub_agent_depth: 1,
				},
			}),
		);

		expect(result).toMatchObject({
			error_code: 'PERMISSION_DENIED',
			status: 'error',
		});
	});

	it('normalizes obvious model role aliases before delegating', async () => {
		let observedRequest: AgentDelegationRequest | undefined;
		const result = await agentDelegateTool.execute(
			{
				arguments: {
					sub_agent_role: 'developer' as never,
					task: 'Implement the bounded renderer hardening change.',
				},
				call_id: 'call_alias',
				tool_name: 'agent.delegate',
			},
			createExecutionContext({
				async delegate_agent(request) {
					observedRequest = request;

					return {
						evidence: [],
						role: request.role,
						status: 'completed',
						summary: 'Implemented.',
						turns_used: 2,
					};
				},
			}),
		);

		expect(observedRequest?.role).toBe('coder');
		expect(result).toMatchObject({
			output: {
				role: 'coder',
			},
			status: 'success',
		});
	});

	it('rejects unknown model role aliases without exposing raw validator copy', async () => {
		const result = await agentDelegateTool.execute(
			{
				arguments: {
					sub_agent_role: 'planner' as never,
					task: 'Plan the bounded renderer hardening change.',
				},
				call_id: 'call_unknown_role',
				tool_name: 'agent.delegate',
			},
			createExecutionContext(),
		);

		expect(result).toMatchObject({
			details: {
				allowed_values: ['researcher', 'reviewer', 'coder'],
				argument: 'sub_agent_role',
				reason: 'invalid_role',
			},
			error_code: 'INVALID_INPUT',
			error_message: 'Runa could not safely choose a sub-agent role for this delegated step.',
			status: 'error',
		});
	});

	it('publishes machine-readable allowed roles in the callable schema', () => {
		const roleParameterName = 'sub_agent_role';

		expect(agentDelegateTool.callable_schema?.parameters?.[roleParameterName]).toMatchObject({
			enum: ['researcher', 'reviewer', 'coder'],
			required: true,
			type: 'string',
		});
	});

	it('keeps approval-required and high-risk tools out of role allowlists', () => {
		const registry = createBuiltInToolRegistry();
		const roles = ['researcher', 'reviewer', 'coder'] as const;

		for (const role of roles) {
			for (const toolName of getSubAgentToolAllowlist(role)) {
				const tool = registry.get(toolName);

				expect(tool, `${role} allowlist tool ${toolName} should be registered`).toBeDefined();
				expect(tool?.metadata.requires_approval).toBe(false);
				expect(tool?.metadata.risk_level).not.toBe('high');
				expect(tool?.metadata.capability_class).not.toBe('desktop');
				expect(tool?.metadata.capability_class).not.toBe('browser');
				expect(tool?.metadata.capability_class).not.toBe('shell');
				expect(tool?.metadata.side_effect_level).not.toBe('write');
				expect(tool?.metadata.side_effect_level).not.toBe('execute');
			}
		}
	});

	it('is registered as a built-in tool', () => {
		const registry = createBuiltInToolRegistry();

		expect(registry.has('agent.delegate')).toBe(true);
		expect(registry.get('agent.delegate')?.metadata).toMatchObject({
			capability_class: 'agent',
			requires_approval: false,
			side_effect_level: 'execute',
		});
	});
});
