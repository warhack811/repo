import type {
	AgentDelegationRequest,
	ModelRequest,
	ModelResponse,
	ModelStreamChunk,
} from '@runa/types';
import { describe, expect, it, vi } from 'vitest';

import { ToolRegistry } from '../tools/registry.js';
import { searchCodebaseTool } from '../tools/search-codebase.js';

import { runSequentialSubAgentDelegation } from './sequential-sub-agent.js';

class StubGateway {
	readonly generateMock = vi.fn(
		async (request: ModelRequest): Promise<ModelResponse> => ({
			finish_reason: 'stop',
			message: {
				content: `Reviewed with ${request.available_tools?.map((tool) => tool.name).join(',') ?? 'no tools'}.`,
				role: 'assistant',
			},
			model: request.model ?? 'stub-sub-agent-model',
			provider: 'stub',
		}),
	);

	generate(request: ModelRequest): Promise<ModelResponse> {
		return this.generateMock(request);
	}

	stream(): AsyncIterable<ModelStreamChunk> {
		return {
			[Symbol.asyncIterator](): AsyncIterator<ModelStreamChunk> {
				return {
					next: async () =>
						({
							done: true,
							value: undefined,
						}) as IteratorResult<ModelStreamChunk>,
				};
			},
		};
	}
}

function createRequest(overrides: Partial<AgentDelegationRequest> = {}): AgentDelegationRequest {
	return {
		depth: 1,
		max_turns: 3,
		parent_run_id: 'run_parent',
		role: 'reviewer',
		task: 'Review the changed files for obvious regressions.',
		tool_allowlist: ['search.codebase'],
		trace_id: 'trace_parent',
		...overrides,
	};
}

describe('runSequentialSubAgentDelegation', () => {
	it('runs a bounded sub-agent with only the requested allowlisted tools', async () => {
		const gateway = new StubGateway();
		const registry = new ToolRegistry();
		registry.register(searchCodebaseTool);

		const result = await runSequentialSubAgentDelegation({
			model_gateway: gateway,
			registry,
			request: createRequest(),
		});

		expect(result).toMatchObject({
			role: 'reviewer',
			status: 'completed',
			summary: 'Reviewed with search.codebase.',
			turns_used: 1,
		});
		expect(gateway.generateMock).toHaveBeenCalledTimes(1);
		expect(gateway.generateMock.mock.calls[0]?.[0]).toMatchObject({
			available_tools: [
				expect.objectContaining({
					name: 'search.codebase',
				}),
			],
			metadata: {
				sub_agent: {
					depth: 1,
					parent_run_id: 'run_parent',
					role: 'reviewer',
				},
			},
			run_id: 'run_parent:sub:reviewer:1',
			trace_id: 'trace_parent',
		});
	});

	it('fails closed when the role allowlist references a missing registry tool', async () => {
		const result = await runSequentialSubAgentDelegation({
			model_gateway: new StubGateway(),
			registry: new ToolRegistry(),
			request: createRequest(),
		});

		expect(result).toMatchObject({
			evidence: [
				{
					label: 'missing_tool',
					value: 'search.codebase',
				},
			],
			role: 'reviewer',
			status: 'failed',
			turns_used: 0,
		});
	});
});
