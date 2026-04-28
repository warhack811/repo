import type { ModelGateway, ToolExecutionContext } from '@runa/types';
import { describe, expect, it } from 'vitest';

import { ToolRegistry } from '../tools/registry.js';
import { type ManagedProcessHandle, RunProcessRegistry } from './process-registry.js';
import { runAgentLoop } from './run-agent-loop.js';
import { createRunCancellationScope } from './run-cancellation.js';
import type { RunModelTurnInput, RunModelTurnResult } from './run-model-turn.js';

function createModelGateway(): ModelGateway {
	return {
		async generate() {
			throw new Error('generate should not be called in this test.');
		},
		async *stream() {
			yield {
				text_delta: '',
				type: 'text.delta',
			};
		},
	};
}

function createCompletedRunModelTurn(
	onExecutionContext: (context: ToolExecutionContext) => void,
): (input: RunModelTurnInput) => Promise<RunModelTurnResult> {
	return async (input) => {
		onExecutionContext(input.execution_context);

		return {
			assistant_text: 'done',
			continuation_result: {
				assistant_text: 'done',
				events: [],
				final_state: 'COMPLETED',
				outcome_kind: 'assistant_response',
				state_transitions: [
					{
						from: 'MODEL_THINKING',
						to: 'COMPLETED',
					},
				],
				status: 'completed',
			},
			final_state: 'COMPLETED',
			model_response: {
				finish_reason: 'stop',
				message: {
					content: 'done',
					role: 'assistant',
				},
				model: 'test-model',
				provider: 'test',
			},
			model_turn_outcome: {
				kind: 'assistant_response',
				text: 'done',
			},
			resolved_model_request: {
				messages: [],
				run_id: 'run_1',
				trace_id: 'trace_1',
			},
			status: 'completed',
		};
	};
}

describe('run-scoped cancellation foundation', () => {
	it('fans out parent cancellation to child scopes and cleans child processes', async () => {
		let killed = false;
		const processHandle: ManagedProcessHandle = {
			pid: 1234,
			kill() {
				killed = true;
				return true;
			},
		};
		const processRegistry = new RunProcessRegistry({
			platform: 'win32',
			process_tree_killer({ handle }) {
				handle.kill('SIGTERM');
			},
		});
		const parentScope = createRunCancellationScope({
			process_registry: processRegistry,
			run_id: 'parent_run',
		});
		const childScope = parentScope.create_child_scope('child_run');

		processRegistry.register({
			handle: processHandle,
			label: 'sub-agent-tool-process',
			run_id: childScope.run_id,
		});

		const cleanup = await parentScope.cancel({
			actor: 'user',
			reason: 'user cancelled parent run',
		});

		expect(parentScope.is_cancelled()).toBe(true);
		expect(childScope.is_cancelled()).toBe(true);
		expect(killed).toBe(true);
		expect(cleanup.child_results).toHaveLength(1);
		expect(cleanup.child_results[0]?.process_cleanup).toMatchObject({
			failures: [],
			killed_count: 1,
			run_id: 'child_run',
		});
		expect(processRegistry.list('child_run')).toEqual([]);
	});

	it('threads the run cancellation tool signal into runAgentLoop execution context', async () => {
		const scope = createRunCancellationScope({
			run_id: 'run_1',
		});
		let observedSignal: ToolExecutionContext['signal'];
		const loop = runAgentLoop({
			build_model_request: () => ({
				messages: [],
				run_id: 'run_1',
				trace_id: 'trace_1',
			}),
			cancellation_signal: scope.signal,
			config: {
				max_turns: 2,
			},
			model_gateway: createModelGateway(),
			registry: new ToolRegistry(),
			run_id: 'run_1',
			run_model_turn: createCompletedRunModelTurn((context) => {
				observedSignal = context.signal;
			}),
			trace_id: 'trace_1',
		});

		for await (const _yield of loop) {
			// Drain the loop.
		}

		expect(observedSignal).toBe(scope.tool_signal);
		expect(observedSignal?.aborted).toBe(false);
	});
});
