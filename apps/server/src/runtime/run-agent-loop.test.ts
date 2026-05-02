import type {
	CheckpointRecord,
	ModelGateway,
	ModelRequest,
	ModelResponse,
	ModelStreamChunk,
	TurnYield,
} from '@runa/types';

import { describe, expect, it } from 'vitest';

import type { RunRecordWriter } from '../persistence/run-store.js';
import type {
	RunModelTurnApprovalRequiredResult,
	RunModelTurnAssistantResponseResult,
	RunModelTurnInput,
	RunModelTurnResult,
	RunModelTurnToolCallResult,
} from './run-model-turn.js';

import { ToolRegistry } from '../tools/registry.js';
import type { RunAgentLoopInput } from './run-agent-loop.js';

import { runAgentLoop } from './run-agent-loop.js';

class StubModelGateway implements ModelGateway {
	async generate(_request: ModelRequest): Promise<ModelResponse> {
		throw new Error('generate should not be called directly in run-agent-loop tests');
	}

	async *stream(_request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		yield* [];
	}
}

class StubRunRecordWriter implements RunRecordWriter {
	async upsertRun(_record: Parameters<RunRecordWriter['upsertRun']>[0]): Promise<void> {
		return Promise.resolve();
	}

	async upsertToolCall(_record: Parameters<RunRecordWriter['upsertToolCall']>[0]): Promise<void> {
		return Promise.resolve();
	}
}

function createModelRequest(overrides: Partial<ModelRequest> = {}): ModelRequest {
	return {
		messages: [
			{
				content: 'Hello from run-agent-loop test.',
				role: 'user',
			},
		],
		run_id: 'builder_run_id',
		trace_id: 'builder_trace_id',
		...overrides,
	};
}

function createAssistantCompletionResult(): RunModelTurnAssistantResponseResult {
	return {
		assistant_text: 'Assistant final answer.',
		continuation_result: {
			assistant_text: 'Assistant final answer.',
			events: [],
			final_state: 'COMPLETED',
			outcome_kind: 'assistant_response',
			state_transitions: [{ from: 'MODEL_THINKING', to: 'COMPLETED' }],
			status: 'completed',
		},
		final_state: 'COMPLETED',
		model_response: {
			finish_reason: 'stop',
			message: {
				content: 'Assistant final answer.',
				role: 'assistant',
			},
			model: 'claude-3-7-sonnet',
			provider: 'claude',
		},
		model_turn_outcome: {
			kind: 'assistant_response',
			text: 'Assistant final answer.',
		},
		resolved_model_request: createModelRequest(),
		status: 'completed',
	};
}

function createApprovalRequiredResult(): RunModelTurnApprovalRequiredResult {
	return {
		approval_event: {
			event_id: 'event_run_agent_loop_approval_1',
			event_type: 'approval.requested',
			event_version: 1,
			payload: {
				action_kind: 'file_write',
				approval_id: 'approval_run_agent_loop_1',
				call_id: 'call_run_agent_loop_approval_1',
				summary: 'Write changes to src/app.ts',
				title: 'Approve file write',
				tool_name: 'file.write',
			},
			run_id: 'run_agent_loop_runtime',
			timestamp: '2026-04-16T12:00:00.000Z',
			trace_id: 'trace_agent_loop_runtime',
		},
		approval_request: {
			action_kind: 'file_write',
			approval_id: 'approval_run_agent_loop_1',
			call_id: 'call_run_agent_loop_approval_1',
			requested_at: '2026-04-16T12:00:00.000Z',
			run_id: 'run_agent_loop_runtime',
			status: 'pending',
			summary: 'Write changes to src/app.ts',
			target: {
				call_id: 'call_run_agent_loop_approval_1',
				kind: 'tool_call',
				label: 'file.write',
				tool_name: 'file.write',
			},
			title: 'Approve file write',
			tool_name: 'file.write',
			trace_id: 'trace_agent_loop_runtime',
		},
		continuation_result: {
			approval_event: {
				event_id: 'event_run_agent_loop_approval_1',
				event_type: 'approval.requested',
				event_version: 1,
				payload: {
					action_kind: 'file_write',
					approval_id: 'approval_run_agent_loop_1',
					call_id: 'call_run_agent_loop_approval_1',
					summary: 'Write changes to src/app.ts',
					title: 'Approve file write',
					tool_name: 'file.write',
				},
				run_id: 'run_agent_loop_runtime',
				timestamp: '2026-04-16T12:00:00.000Z',
				trace_id: 'trace_agent_loop_runtime',
			},
			approval_request: {
				action_kind: 'file_write',
				approval_id: 'approval_run_agent_loop_1',
				call_id: 'call_run_agent_loop_approval_1',
				requested_at: '2026-04-16T12:00:00.000Z',
				run_id: 'run_agent_loop_runtime',
				status: 'pending',
				summary: 'Write changes to src/app.ts',
				target: {
					call_id: 'call_run_agent_loop_approval_1',
					kind: 'tool_call',
					label: 'file.write',
					tool_name: 'file.write',
				},
				title: 'Approve file write',
				tool_name: 'file.write',
				trace_id: 'trace_agent_loop_runtime',
			},
			call_id: 'call_run_agent_loop_approval_1',
			events: [],
			final_state: 'WAITING_APPROVAL',
			outcome_kind: 'tool_call',
			state_transitions: [{ from: 'MODEL_THINKING', to: 'WAITING_APPROVAL' }],
			status: 'approval_required',
			tool_name: 'file.write',
		},
		final_state: 'WAITING_APPROVAL',
		model_response: {
			finish_reason: 'stop',
			message: {
				content: 'Calling file.write',
				role: 'assistant',
			},
			model: 'claude-3-7-sonnet',
			provider: 'claude',
			tool_call_candidate: {
				call_id: 'call_run_agent_loop_approval_1',
				tool_input: {
					path: 'src/app.ts',
				},
				tool_name: 'file.write',
			},
		},
		model_turn_outcome: {
			call_id: 'call_run_agent_loop_approval_1',
			kind: 'tool_call',
			tool_input: {
				path: 'src/app.ts',
			},
			tool_name: 'file.write',
		},
		resolved_model_request: createModelRequest(),
		status: 'approval_required',
	};
}

function createToolContinuationResult(): RunModelTurnToolCallResult {
	return {
		continuation_result: {
			call_id: 'call_run_agent_loop_tool_1',
			events: [
				{
					event_id: 'event_run_agent_loop_tool_1',
					event_type: 'tool.call.started',
					event_version: 1,
					payload: {
						call_id: 'call_run_agent_loop_tool_1',
						tool_name: 'file.read',
					},
					run_id: 'run_agent_loop_runtime',
					timestamp: '2026-04-16T12:05:00.000Z',
					trace_id: 'trace_agent_loop_runtime',
				},
			],
			final_state: 'TOOL_RESULT_INGESTING',
			ingested_result: {
				call_id: 'call_run_agent_loop_tool_1',
				kind: 'tool_result',
				output: {
					content: 'file body',
				},
				result_status: 'success',
				tool_name: 'file.read',
			},
			outcome_kind: 'tool_call',
			state_transitions: [
				{ from: 'MODEL_THINKING', to: 'TOOL_EXECUTING' },
				{ from: 'TOOL_EXECUTING', to: 'TOOL_RESULT_INGESTING' },
			],
			status: 'completed',
			suggested_next_state: 'MODEL_THINKING',
			tool_name: 'file.read',
			tool_result: {
				call_id: 'call_run_agent_loop_tool_1',
				output: {
					content: 'file body',
				},
				status: 'success',
				tool_name: 'file.read',
			},
		},
		final_state: 'TOOL_RESULT_INGESTING',
		ingested_result: {
			call_id: 'call_run_agent_loop_tool_1',
			kind: 'tool_result',
			output: {
				content: 'file body',
			},
			result_status: 'success',
			tool_name: 'file.read',
		},
		model_response: {
			finish_reason: 'stop',
			message: {
				content: 'Calling file.read',
				role: 'assistant',
			},
			model: 'claude-3-7-sonnet',
			provider: 'claude',
			tool_call_candidate: {
				call_id: 'call_run_agent_loop_tool_1',
				tool_input: {
					path: 'src/example.ts',
				},
				tool_name: 'file.read',
			},
		},
		model_turn_outcome: {
			call_id: 'call_run_agent_loop_tool_1',
			kind: 'tool_call',
			tool_input: {
				path: 'src/example.ts',
			},
			tool_name: 'file.read',
		},
		resolved_model_request: createModelRequest(),
		status: 'completed',
		suggested_next_state: 'MODEL_THINKING',
		tool_result: {
			call_id: 'call_run_agent_loop_tool_1',
			output: {
				content: 'file body',
			},
			status: 'success',
			tool_name: 'file.read',
		},
	};
}

function createRunAgentLoopInput(overrides: Partial<RunAgentLoopInput> = {}): RunAgentLoopInput {
	return {
		build_model_request() {
			return createModelRequest();
		},
		config: {
			max_turns: 3,
			stop_conditions: {},
		},
		model_gateway: new StubModelGateway(),
		registry: new ToolRegistry(),
		run_id: 'run_agent_loop_runtime',
		run_model_turn: async () => createAssistantCompletionResult(),
		trace_id: 'trace_agent_loop_runtime',
		...overrides,
	};
}

async function collectUntilTurnCompleted(
	generator: AsyncGenerator<TurnYield>,
): Promise<readonly TurnYield[]> {
	const yields: TurnYield[] = [];

	while (true) {
		const iteration = await generator.next();

		if (iteration.done) {
			throw new Error('Expected turn.completed before generator completion.');
		}

		yields.push(iteration.value);

		if (iteration.value.type === 'turn.completed') {
			return yields;
		}
	}
}

describe('runAgentLoop', () => {
	it('wires the adapter and loop engine together and yields turn.started', async () => {
		const generator = runAgentLoop(createRunAgentLoopInput());

		await expect(generator.next()).resolves.toEqual({
			done: false,
			value: {
				loop_state: 'RUNNING',
				max_turns: 3,
				run_id: 'run_agent_loop_runtime',
				trace_id: 'trace_agent_loop_runtime',
				turn_index: 1,
				type: 'turn.started',
			},
		});
	});

	it('returns the expected final result for assistant completion', async () => {
		const generator = runAgentLoop(createRunAgentLoopInput());

		await generator.next();
		const turnYields = await collectUntilTurnCompleted(generator);
		const turnCompleted = turnYields.at(-1);
		const boundary = await generator.next();
		const final = await generator.next();

		expect(turnYields.slice(0, -1).map((yieldValue) => yieldValue.type)).toEqual([
			'turn.progress',
			'turn.progress',
			'turn.progress',
		]);
		expect(turnCompleted).toEqual({
			loop_state: 'COMPLETED',
			next_step: 'stop',
			run_id: 'run_agent_loop_runtime',
			runtime_state: 'COMPLETED',
			trace_id: 'trace_agent_loop_runtime',
			turn_index: 1,
			type: 'turn.completed',
		});
		expect(boundary).toEqual({
			done: false,
			value: {
				loop_state: 'COMPLETED',
				reason: {
					disposition: 'terminal',
					finish_reason: 'stop',
					kind: 'model_stop',
					loop_state: 'COMPLETED',
					turn_count: 1,
				},
				run_id: 'run_agent_loop_runtime',
				trace_id: 'trace_agent_loop_runtime',
				turn_index: 1,
				type: 'loop.boundary',
			},
		});
		expect(final).toMatchObject({
			done: true,
			value: {
				final_snapshot: {
					config: {
						max_turns: 3,
						stop_conditions: {},
					},
					current_loop_state: 'COMPLETED',
					current_runtime_state: 'COMPLETED',
					model: {
						finish_reason: 'stop',
						outcome_kind: 'assistant_response',
					},
					run_id: 'run_agent_loop_runtime',
					trace_id: 'trace_agent_loop_runtime',
					turn_count: 1,
				},
				stop_reason: {
					disposition: 'terminal',
					finish_reason: 'stop',
					kind: 'model_stop',
					loop_state: 'COMPLETED',
					turn_count: 1,
				},
			},
		});
	});

	it('stops on approval boundary and returns a boundary yield', async () => {
		const generator = runAgentLoop(
			createRunAgentLoopInput({
				run_model_turn: async () => createApprovalRequiredResult(),
			}),
		);

		await generator.next();
		const turnYields = await collectUntilTurnCompleted(generator);
		const progressEvents = turnYields
			.filter((yieldValue) => yieldValue.type === 'turn.progress')
			.map((yieldValue) => yieldValue.event.event_type);
		const turnCompleted = turnYields.at(-1);
		const boundary = await generator.next();
		const final = await generator.next();

		expect(progressEvents).toEqual(['model.completed', 'state.entered', 'approval.requested']);
		expect(turnCompleted).toEqual({
			loop_state: 'WAITING',
			next_step: 'wait',
			run_id: 'run_agent_loop_runtime',
			runtime_state: 'WAITING_APPROVAL',
			trace_id: 'trace_agent_loop_runtime',
			turn_index: 1,
			type: 'turn.completed',
		});
		expect(boundary).toEqual({
			done: false,
			value: {
				loop_state: 'WAITING',
				reason: {
					action_kind: 'file_write',
					approval_id: 'approval_run_agent_loop_1',
					boundary: 'approval',
					disposition: 'paused',
					kind: 'waiting_for_human',
					loop_state: 'WAITING',
					turn_count: 1,
				},
				run_id: 'run_agent_loop_runtime',
				trace_id: 'trace_agent_loop_runtime',
				turn_index: 1,
				type: 'loop.boundary',
			},
		});
		expect(final.done).toBe(true);
	});

	it('forwards config and runtime dependencies through the wiring layer', async () => {
		const modelGateway = new StubModelGateway();
		const registry = new ToolRegistry();
		const persistenceWriter = new StubRunRecordWriter();
		let capturedBuildModelRequestInput:
			| Parameters<NonNullable<Parameters<typeof runAgentLoop>[0]['build_model_request']>>[0]
			| undefined;
		let capturedRunModelTurnInput: RunModelTurnInput | undefined;

		const generator = runAgentLoop(
			createRunAgentLoopInput({
				build_model_request(input) {
					capturedBuildModelRequestInput = input;

					return createModelRequest({
						run_id: 'builder_should_be_overridden',
						trace_id: 'builder_should_be_overridden',
					});
				},
				config: {
					max_turns: 7,
					stop_conditions: {
						stop_on_model_finish_reason: ['stop'],
					},
				},
				execution_context: {
					working_directory: 'd:\\ai\\Runa',
				},
				model_gateway: modelGateway,
				persistence_writer: persistenceWriter,
				registry,
				run_id: 'run_agent_loop_forwarded',
				run_model_turn: async (input) => {
					capturedRunModelTurnInput = input;
					return createAssistantCompletionResult();
				},
				tool_names: ['file.read'],
				trace_id: 'trace_agent_loop_forwarded',
			}),
		);

		await generator.next();
		await generator.next();

		expect(capturedBuildModelRequestInput).toMatchObject({
			config: {
				max_turns: 7,
				stop_conditions: {
					stop_on_model_finish_reason: ['stop'],
				},
			},
			run_id: 'run_agent_loop_forwarded',
			trace_id: 'trace_agent_loop_forwarded',
			turn_index: 1,
		});
		expect(capturedRunModelTurnInput).toEqual({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_agent_loop_forwarded',
				trace_id: 'trace_agent_loop_forwarded',
				working_directory: 'd:\\ai\\Runa',
			},
			model_gateway: modelGateway,
			model_request: {
				messages: [
					{
						content: 'Hello from run-agent-loop test.',
						role: 'user',
					},
				],
				run_id: 'run_agent_loop_forwarded',
				trace_id: 'trace_agent_loop_forwarded',
			},
			persistence_writer: persistenceWriter,
			registry,
			run_id: 'run_agent_loop_forwarded',
			token_limit_recovery: expect.any(Object),
			tool_call_repair_recovery: expect.any(Object),
			tool_names: ['file.read'],
			trace_id: 'trace_agent_loop_forwarded',
		});
	});

	it('honors cancellation signals before invoking the turn adapter', async () => {
		let callCount = 0;
		const generator = runAgentLoop(
			createRunAgentLoopInput({
				cancellation_signal: {
					actor: 'user',
					is_cancelled() {
						return true;
					},
				},
				run_model_turn: async () => {
					callCount += 1;
					return createAssistantCompletionResult();
				},
			}),
		);

		const boundary = await generator.next();
		const final = await generator.next();

		expect(boundary).toEqual({
			done: false,
			value: {
				loop_state: 'CANCELLED',
				reason: {
					actor: 'user',
					disposition: 'terminal',
					kind: 'cancelled',
					loop_state: 'CANCELLED',
					turn_count: 0,
				},
				run_id: 'run_agent_loop_runtime',
				trace_id: 'trace_agent_loop_runtime',
				turn_index: 0,
				type: 'loop.boundary',
			},
		});
		expect(final.done).toBe(true);
		expect(callCount).toBe(0);
	});

	it('keeps the wiring deterministic across multiple turns', async () => {
		let buildModelRequestCallCount = 0;
		let runModelTurnCallCount = 0;
		let secondTurnObservedToolResult:
			| {
					readonly call_id: string;
					readonly output: {
						readonly content: string;
					};
					readonly status: 'success';
					readonly tool_name: 'file.read';
			  }
			| undefined;

		const generator = runAgentLoop(
			createRunAgentLoopInput({
				build_model_request(input) {
					buildModelRequestCallCount += 1;

					if (input.turn_index === 2) {
						secondTurnObservedToolResult = input.snapshot.tool_result as
							| typeof secondTurnObservedToolResult
							| undefined;
					}

					return createModelRequest({
						messages: [
							{
								content: `Turn ${input.turn_index}`,
								role: 'user',
							},
						],
					});
				},
				config: {
					max_turns: 2,
					stop_conditions: {
						stop_on_model_finish_reason: ['max_tokens'],
					},
				},
				run_model_turn: async (input) => {
					runModelTurnCallCount += 1;

					if (runModelTurnCallCount === 2) {
						return createAssistantCompletionResult();
					}

					return createToolContinuationResult();
				},
			}),
		);

		await generator.next();
		await collectUntilTurnCompleted(generator);
		const secondTurnStarted = await generator.next();
		await collectUntilTurnCompleted(generator);
		await generator.next();
		await generator.next();

		expect(secondTurnStarted).toEqual({
			done: false,
			value: {
				loop_state: 'RUNNING',
				max_turns: 2,
				run_id: 'run_agent_loop_runtime',
				trace_id: 'trace_agent_loop_runtime',
				turn_index: 2,
				type: 'turn.started',
			},
		});
		expect(buildModelRequestCallCount).toBe(2);
		expect(runModelTurnCallCount).toBe(2);
		expect(secondTurnObservedToolResult).toEqual({
			call_id: 'call_run_agent_loop_tool_1',
			output: {
				content: 'file body',
			},
			status: 'success',
			tool_name: 'file.read',
		});
	});

	it('writes turn and boundary checkpoints when a checkpoint manager is provided', async () => {
		const savedRecords: CheckpointRecord[] = [];
		const generator = runAgentLoop(
			createRunAgentLoopInput({
				checkpoint_manager: {
					async saveCheckpoint(record: CheckpointRecord): Promise<CheckpointRecord> {
						savedRecords.push(record);
						return record;
					},
				},
				run_model_turn: async () => createApprovalRequiredResult(),
			}),
		);

		await generator.next();
		await collectUntilTurnCompleted(generator);
		await generator.next();
		await generator.next();

		expect(savedRecords.map((record) => record.meta.trigger)).toEqual([
			'turn_boundary',
			'loop_boundary',
		]);
		expect(savedRecords[0]?.meta.checkpoint_id).toBe(
			'checkpoint_run_agent_loop_runtime_turn_boundary_1',
		);
		expect(savedRecords[1]?.meta.parent_checkpoint_id).toBe(
			'checkpoint_run_agent_loop_runtime_turn_boundary_1',
		);
		expect(savedRecords[1]?.resume).toMatchObject({
			cursor: {
				boundary: 'approval',
			},
			disposition: 'resumable',
		});
	});
});
