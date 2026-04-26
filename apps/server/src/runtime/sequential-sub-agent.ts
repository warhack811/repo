import type {
	AgentDelegationRequest,
	AgentDelegationResult,
	ModelGateway,
	ModelRequest,
	ToolExecutionContext,
	ToolName,
	ToolResult,
} from '@runa/types';

import { ToolRegistry } from '../tools/registry.js';

import type { AgentLoopResult, AgentLoopTurnInput } from './agent-loop.js';
import { bindAvailableTools } from './bind-available-tools.js';
import { runAgentLoop } from './run-agent-loop.js';

export interface RunSequentialSubAgentDelegationInput {
	readonly execution_context?: Omit<ToolExecutionContext, 'run_id' | 'trace_id'>;
	readonly model_gateway: ModelGateway;
	readonly registry: ToolRegistry;
	readonly request: AgentDelegationRequest;
}

const SUB_AGENT_MAX_OUTPUT_TOKENS = 900;

function createMissingToolResult(
	request: AgentDelegationRequest,
	toolName: ToolName,
): AgentDelegationResult {
	return {
		evidence: [
			{
				label: 'missing_tool',
				value: toolName,
			},
		],
		role: request.role,
		status: 'failed',
		summary: `Sub-agent allowlist references missing tool ${toolName}.`,
		turns_used: 0,
	};
}

function createSubAgentRegistry(
	baseRegistry: ToolRegistry,
	toolAllowlist: readonly ToolName[],
): ToolRegistry | AgentDelegationResult {
	const registry = new ToolRegistry();

	for (const toolName of toolAllowlist) {
		const tool = baseRegistry.get(toolName);

		if (!tool) {
			return createMissingToolResult(
				{
					context: undefined,
					depth: 1,
					max_turns: 0,
					parent_run_id: 'unknown',
					role: 'reviewer',
					task: 'missing tool',
					tool_allowlist: toolAllowlist,
					trace_id: 'unknown',
				},
				toolName,
			);
		}

		registry.register(tool);
	}

	return registry;
}

function serializeToolResult(toolResult: ToolResult | undefined): string | undefined {
	if (toolResult === undefined) {
		return undefined;
	}

	if (toolResult.status === 'error') {
		return `Latest tool ${toolResult.tool_name} failed with ${toolResult.error_code}: ${toolResult.error_message}`;
	}

	try {
		return `Latest tool ${toolResult.tool_name} succeeded: ${JSON.stringify(toolResult.output)}`;
	} catch {
		return `Latest tool ${toolResult.tool_name} succeeded.`;
	}
}

function createSubAgentRunId(request: AgentDelegationRequest): string {
	return `${request.parent_run_id}:sub:${request.role}:${String(request.depth)}`;
}

function buildSubAgentPrompt(
	request: AgentDelegationRequest,
	latestToolResult: ToolResult | undefined,
): string {
	return [
		`Role: ${request.role}`,
		`Task: ${request.task}`,
		request.context ? `Context:\n${request.context}` : undefined,
		serializeToolResult(latestToolResult),
		'Return a concise summary with concrete evidence. Stay inside the provided task and tool allowlist.',
	]
		.filter((line): line is string => line !== undefined && line.trim().length > 0)
		.join('\n\n');
}

function buildSubAgentModelRequest(
	request: AgentDelegationRequest,
	registry: ToolRegistry,
	input: AgentLoopTurnInput,
): ModelRequest {
	const availableTools = bindAvailableTools({
		registry,
		tool_names: request.tool_allowlist,
	});

	if (availableTools.status === 'failed') {
		throw new Error(availableTools.failure.message);
	}

	return {
		available_tools: availableTools.available_tools,
		max_output_tokens: SUB_AGENT_MAX_OUTPUT_TOKENS,
		messages: [
			{
				content:
					'You are a bounded Runa sub-agent. You cannot approve risky actions, mutate parent state, or delegate further. Use only the provided tools when necessary.',
				role: 'system',
			},
			{
				content: buildSubAgentPrompt(request, input.snapshot.tool_result),
				role: 'user',
			},
		],
		metadata: {
			sub_agent: {
				depth: request.depth,
				parent_run_id: request.parent_run_id,
				role: request.role,
			},
		},
		run_id: input.run_id,
		trace_id: input.trace_id,
	};
}

async function consumeLoop(loop: ReturnType<typeof runAgentLoop>): Promise<AgentLoopResult> {
	while (true) {
		const next = await loop.next();

		if (next.done) {
			return next.value;
		}
	}
}

function toDelegationResult(
	request: AgentDelegationRequest,
	result: AgentLoopResult,
): AgentDelegationResult {
	const finalSnapshot = result.final_snapshot;
	const latestToolResult = finalSnapshot.tool_result;
	const status =
		finalSnapshot.current_loop_state === 'COMPLETED' && finalSnapshot.assistant_text
			? 'completed'
			: 'failed';
	const evidence = [
		{
			label: 'stop_reason',
			value: result.stop_reason.kind,
		},
		...(latestToolResult
			? [
					{
						label: 'latest_tool',
						value: `${latestToolResult.tool_name}:${latestToolResult.status}`,
					},
				]
			: []),
	];

	return {
		evidence,
		role: request.role,
		status,
		summary:
			finalSnapshot.assistant_text ??
			finalSnapshot.failure?.error_message ??
			'Sub-agent finished without an assistant summary.',
		turns_used: finalSnapshot.turn_count,
	};
}

export async function runSequentialSubAgentDelegation(
	input: RunSequentialSubAgentDelegationInput,
): Promise<AgentDelegationResult> {
	const subRegistry = createSubAgentRegistry(input.registry, input.request.tool_allowlist);

	if (!(subRegistry instanceof ToolRegistry)) {
		return {
			...subRegistry,
			role: input.request.role,
		};
	}

	const result = await consumeLoop(
		runAgentLoop({
			build_model_request: (turnInput) =>
				buildSubAgentModelRequest(input.request, subRegistry, turnInput),
			config: {
				max_turns: input.request.max_turns,
				stop_conditions: {},
			},
			execution_context: {
				...input.execution_context,
				delegate_agent: undefined,
				metadata: {
					...input.execution_context?.metadata,
					sub_agent_depth: input.request.depth,
				},
			},
			model_gateway: input.model_gateway,
			registry: subRegistry,
			run_id: createSubAgentRunId(input.request),
			trace_id: input.request.trace_id,
			tool_names: input.request.tool_allowlist,
		}),
	);

	return toDelegationResult(input.request, result);
}
