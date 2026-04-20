import type {
	AgentLoopConfig,
	ModelGateway,
	RuntimeState,
	ToolExecutionContext,
	ToolName,
	ToolResult,
	TurnYield,
} from '@runa/types';

import type { RunRecordWriter } from '../persistence/run-store.js';
import type { ToolRegistry } from '../tools/registry.js';

import type { AgentLoopCheckpointManager } from './agent-loop-checkpointing.js';
import type {
	AgentLoopCancellationSignal,
	AgentLoopContinueGate,
	AgentLoopResult,
	CreateAgentLoopInput,
} from './agent-loop.js';
import type {
	AgentLoopModelRequestFactory,
	CreateRunModelTurnLoopExecutorInput,
} from './run-model-turn-loop-adapter.js';
import type { RunModelTurnInput, RunModelTurnResult } from './run-model-turn.js';

import { createAgentLoopCheckpointWriter } from './agent-loop-checkpointing.js';
import { createAgentLoop } from './agent-loop.js';
import { createRunModelTurnLoopExecutor } from './run-model-turn-loop-adapter.js';

export interface RunAgentLoopInput {
	readonly build_model_request: AgentLoopModelRequestFactory;
	readonly cancellation_signal?: AgentLoopCancellationSignal;
	readonly checkpoint_manager?: AgentLoopCheckpointManager;
	readonly config: AgentLoopConfig;
	readonly continue_gate?: AgentLoopContinueGate;
	readonly execution_context?: Omit<ToolExecutionContext, 'run_id' | 'trace_id'>;
	readonly initial_loop_state?: CreateAgentLoopInput['initial_loop_state'];
	readonly initial_runtime_state?: RuntimeState;
	readonly initial_tool_result?: ToolResult;
	readonly initial_turn_count?: number;
	readonly model_gateway: ModelGateway;
	readonly on_yield?: CreateAgentLoopInput['on_yield'];
	readonly persistence_writer?: RunRecordWriter;
	readonly registry: ToolRegistry;
	readonly run_id: string;
	readonly run_model_turn?: (input: RunModelTurnInput) => Promise<RunModelTurnResult>;
	readonly tool_names?: readonly ToolName[];
	readonly trace_id: string;
}

function toExecutorInput(input: RunAgentLoopInput): CreateRunModelTurnLoopExecutorInput {
	return {
		build_model_request: input.build_model_request,
		execution_context: input.execution_context,
		model_gateway: input.model_gateway,
		persistence_writer: input.persistence_writer,
		registry: input.registry,
		run_model_turn: input.run_model_turn,
		tool_names: input.tool_names,
	};
}

export function runAgentLoop(
	input: RunAgentLoopInput,
): AsyncGenerator<TurnYield, AgentLoopResult, void> {
	const checkpointOnYield =
		input.checkpoint_manager === undefined
			? undefined
			: createAgentLoopCheckpointWriter({
					checkpoint_manager: input.checkpoint_manager,
				});

	const onYield: CreateAgentLoopInput['on_yield'] =
		checkpointOnYield === undefined
			? input.on_yield
			: async (context) => {
					await checkpointOnYield(context);
					await input.on_yield?.(context);
				};

	return createAgentLoop({
		cancellation_signal: input.cancellation_signal,
		config: input.config,
		continue_gate: input.continue_gate,
		execute_turn: createRunModelTurnLoopExecutor(toExecutorInput(input)),
		initial_loop_state: input.initial_loop_state,
		initial_runtime_state: input.initial_runtime_state,
		initial_tool_result: input.initial_tool_result,
		initial_turn_count: input.initial_turn_count,
		on_yield: onYield,
		run_id: input.run_id,
		trace_id: input.trace_id,
	});
}
