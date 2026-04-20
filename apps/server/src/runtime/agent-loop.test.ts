import type { CreateAgentLoopInput } from './agent-loop.js';

import { describe, expect, it } from 'vitest';

import { createAgentLoop } from './agent-loop.js';

function createStateEnteredEvent(sequenceNo: number) {
	return {
		event_id: `event_agent_loop_${sequenceNo}`,
		event_type: 'state.entered' as const,
		event_version: 1,
		payload: {
			previous_state: 'MODEL_THINKING' as const,
			reason: 'agent-loop-test',
			state: 'MODEL_THINKING' as const,
		},
		run_id: 'run_agent_loop',
		sequence_no: sequenceNo,
		timestamp: '2026-04-16T10:00:00.000Z',
		trace_id: 'trace_agent_loop',
	};
}

function createAgentLoopInput(overrides: Partial<CreateAgentLoopInput> = {}): CreateAgentLoopInput {
	return {
		config: {
			max_turns: 3,
			stop_conditions: {},
		},
		async execute_turn() {
			return {
				current_loop_state: 'RUNNING',
				current_runtime_state: 'MODEL_THINKING',
				progress_events: [createStateEnteredEvent(1)],
			};
		},
		run_id: 'run_agent_loop',
		trace_id: 'trace_agent_loop',
		...overrides,
	};
}

function expectYield<TValue>(result: IteratorResult<TValue>, message: string): TValue {
	if (result.done) {
		throw new Error(message);
	}

	return result.value;
}

describe('createAgentLoop', () => {
	it('starts the first turn and yields turn.started', async () => {
		const loop = createAgentLoop(
			createAgentLoopInput({
				config: {
					max_turns: 1,
					stop_conditions: {
						stop_on_model_finish_reason: ['max_tokens'],
					},
				},
			}),
		);

		const first = await loop.next();

		expect(first.done).toBe(false);
		expect(first.value).toEqual({
			loop_state: 'RUNNING',
			max_turns: 1,
			run_id: 'run_agent_loop',
			trace_id: 'trace_agent_loop',
			turn_index: 1,
			type: 'turn.started',
		});
	});

	it('emits progress and terminal turn.completed after executor execution', async () => {
		const loop = createAgentLoop(
			createAgentLoopInput({
				config: {
					max_turns: 1,
					stop_conditions: {
						stop_on_model_finish_reason: ['max_tokens'],
					},
				},
			}),
		);

		await loop.next();
		const progress = await loop.next();
		const completed = await loop.next();

		expect(progress.done).toBe(false);
		expect(progress.value).toEqual({
			event: createStateEnteredEvent(1),
			loop_state: 'RUNNING',
			run_id: 'run_agent_loop',
			runtime_state: 'MODEL_THINKING',
			trace_id: 'trace_agent_loop',
			turn_index: 1,
			type: 'turn.progress',
		});
		expect(completed.done).toBe(false);
		expect(completed.value).toEqual({
			loop_state: 'FAILED',
			next_step: 'stop',
			run_id: 'run_agent_loop',
			runtime_state: 'MODEL_THINKING',
			trace_id: 'trace_agent_loop',
			turn_index: 1,
			type: 'turn.completed',
		});
	});

	it('returns a terminal result when the stop evaluator decides to stop', async () => {
		const loop = createAgentLoop(
			createAgentLoopInput({
				config: {
					max_turns: 3,
					stop_conditions: {},
				},
				async execute_turn() {
					return {
						current_loop_state: 'COMPLETED',
						current_runtime_state: 'COMPLETED',
						model: {
							finish_reason: 'stop',
							outcome_kind: 'assistant_response',
						},
					};
				},
			}),
		);

		await loop.next();
		const completed = await loop.next();
		const boundary = await loop.next();
		const final = await loop.next();

		expect(completed.value).toEqual({
			loop_state: 'COMPLETED',
			next_step: 'stop',
			run_id: 'run_agent_loop',
			runtime_state: 'COMPLETED',
			trace_id: 'trace_agent_loop',
			turn_index: 1,
			type: 'turn.completed',
		});
		expect(boundary.value).toEqual({
			loop_state: 'COMPLETED',
			reason: {
				disposition: 'terminal',
				finish_reason: 'stop',
				kind: 'model_stop',
				loop_state: 'COMPLETED',
				turn_count: 1,
			},
			run_id: 'run_agent_loop',
			trace_id: 'trace_agent_loop',
			turn_index: 1,
			type: 'loop.boundary',
		});
		expect(final.done).toBe(true);
		expect(final.value).toEqual({
			final_snapshot: {
				config: {
					max_turns: 3,
					stop_conditions: {},
				},
				current_loop_state: 'COMPLETED',
				current_runtime_state: 'COMPLETED',
				failure: undefined,
				human_boundary: undefined,
				model: {
					finish_reason: 'stop',
					outcome_kind: 'assistant_response',
				},
				run_id: 'run_agent_loop',
				tool_result: undefined,
				trace_id: 'trace_agent_loop',
				turn_count: 1,
			},
			stop_reason: {
				disposition: 'terminal',
				finish_reason: 'stop',
				kind: 'model_stop',
				loop_state: 'COMPLETED',
				turn_count: 1,
			},
		});
	});

	it('stops with a boundary yield when approval wait is reached', async () => {
		const loop = createAgentLoop(
			createAgentLoopInput({
				async execute_turn() {
					return {
						current_loop_state: 'WAITING',
						current_runtime_state: 'WAITING_APPROVAL',
						human_boundary: {
							action_kind: 'file_write',
							approval_id: 'approval_agent_loop_1',
							boundary: 'approval',
							loop_state: 'WAITING',
						},
					};
				},
			}),
		);

		await loop.next();
		const completed = await loop.next();
		const boundary = await loop.next();
		const final = await loop.next();

		expect(completed.value).toEqual({
			loop_state: 'WAITING',
			next_step: 'wait',
			run_id: 'run_agent_loop',
			runtime_state: 'WAITING_APPROVAL',
			trace_id: 'trace_agent_loop',
			turn_index: 1,
			type: 'turn.completed',
		});
		expect(boundary.value).toEqual({
			loop_state: 'WAITING',
			reason: {
				action_kind: 'file_write',
				approval_id: 'approval_agent_loop_1',
				boundary: 'approval',
				disposition: 'paused',
				kind: 'waiting_for_human',
				loop_state: 'WAITING',
				turn_count: 1,
			},
			run_id: 'run_agent_loop',
			trace_id: 'trace_agent_loop',
			turn_index: 1,
			type: 'loop.boundary',
		});
		expect(final.done).toBe(true);
	});

	it('continues into the next turn when the stop evaluator returns continue', async () => {
		let callCount = 0;
		const loop = createAgentLoop(
			createAgentLoopInput({
				config: {
					max_turns: 2,
					stop_conditions: {
						stop_on_model_finish_reason: ['max_tokens'],
					},
				},
				async execute_turn() {
					callCount += 1;

					return {
						current_loop_state: 'RUNNING',
						current_runtime_state: 'MODEL_THINKING',
						progress_events: [createStateEnteredEvent(callCount)],
					};
				},
			}),
		);

		expect(expectYield(await loop.next(), 'Expected first turn.started yield.').type).toBe(
			'turn.started',
		);
		expect(expectYield(await loop.next(), 'Expected first turn.progress yield.').type).toBe(
			'turn.progress',
		);
		expect(expectYield(await loop.next(), 'Expected first turn.completed yield.')).toMatchObject({
			next_step: 'continue',
			type: 'turn.completed',
		});
		expect(expectYield(await loop.next(), 'Expected second turn.started yield.')).toEqual({
			loop_state: 'RUNNING',
			max_turns: 2,
			run_id: 'run_agent_loop',
			trace_id: 'trace_agent_loop',
			turn_index: 2,
			type: 'turn.started',
		});
		expect(callCount).toBe(1);
	});

	it('lets a continue gate convert a follow-up turn into a waiting boundary', async () => {
		const loop = createAgentLoop(
			createAgentLoopInput({
				config: {
					max_turns: 3,
					stop_conditions: {
						stop_on_model_finish_reason: ['max_tokens'],
					},
				},
				continue_gate: async () => ({
					status: 'override',
					turn_result: {
						approval_request: {
							action_kind: 'tool_execution',
							approval_id: 'approval_agent_loop_auto_continue_1',
							requested_at: '2026-04-17T22:00:00.000Z',
							run_id: 'run_agent_loop',
							status: 'pending',
							summary: 'Allow auto-continue.',
							target: {
								kind: 'tool_call',
								label: 'agent.auto_continue',
							},
							title: 'Approve auto-continue',
							trace_id: 'trace_agent_loop',
						},
						current_loop_state: 'WAITING',
						current_runtime_state: 'WAITING_APPROVAL',
						human_boundary: {
							action_kind: 'tool_execution',
							approval_id: 'approval_agent_loop_auto_continue_1',
							boundary: 'approval',
							loop_state: 'WAITING',
						},
					},
				}),
			}),
		);

		await loop.next();
		await loop.next();
		const completed = await loop.next();
		const boundary = await loop.next();
		const final = await loop.next();

		expect(completed.value).toEqual({
			loop_state: 'WAITING',
			next_step: 'wait',
			run_id: 'run_agent_loop',
			runtime_state: 'WAITING_APPROVAL',
			trace_id: 'trace_agent_loop',
			turn_index: 1,
			type: 'turn.completed',
		});
		expect(boundary.value).toEqual({
			loop_state: 'WAITING',
			reason: {
				action_kind: 'tool_execution',
				approval_id: 'approval_agent_loop_auto_continue_1',
				boundary: 'approval',
				disposition: 'paused',
				kind: 'waiting_for_human',
				loop_state: 'WAITING',
				turn_count: 1,
			},
			run_id: 'run_agent_loop',
			trace_id: 'trace_agent_loop',
			turn_index: 1,
			type: 'loop.boundary',
		});
		expect(final.done).toBe(true);
	});

	it('enforces the max_turns guard', async () => {
		let callCount = 0;
		const loop = createAgentLoop(
			createAgentLoopInput({
				config: {
					max_turns: 1,
					stop_conditions: {
						stop_on_model_finish_reason: ['max_tokens'],
					},
				},
				async execute_turn() {
					callCount += 1;

					return {
						current_loop_state: 'RUNNING',
						current_runtime_state: 'MODEL_THINKING',
					};
				},
			}),
		);

		await loop.next();
		const completed = await loop.next();
		const boundary = await loop.next();

		expect(completed.value).toMatchObject({
			loop_state: 'FAILED',
			next_step: 'stop',
			type: 'turn.completed',
		});
		expect(boundary.value).toEqual({
			loop_state: 'FAILED',
			reason: {
				disposition: 'terminal',
				kind: 'max_turns_reached',
				loop_state: 'FAILED',
				max_turns: 1,
				turn_count: 1,
			},
			run_id: 'run_agent_loop',
			trace_id: 'trace_agent_loop',
			turn_index: 1,
			type: 'loop.boundary',
		});
		expect(callCount).toBe(1);
	});

	it('stops after repeated identical tool calls across turns', async () => {
		let callCount = 0;
		const loop = createAgentLoop(
			createAgentLoopInput({
				config: {
					max_turns: 10,
					stop_conditions: {
						max_repeated_identical_calls: 3,
						stop_on_model_finish_reason: ['max_tokens'],
					},
				},
				async execute_turn() {
					callCount += 1;

					return {
						current_loop_state: 'RUNNING',
						current_runtime_state: 'MODEL_THINKING',
						tool_arguments: {
							path: 'docs/vision.md',
						},
						tool_result: {
							call_id: `call_agent_loop_repeat_${callCount}`,
							output: {
								content: 'vision',
							},
							status: 'success',
							tool_name: 'file.read',
						},
					};
				},
			}),
		);

		let finalResult: Awaited<ReturnType<ReturnType<typeof createAgentLoop>['next']>> | undefined;
		let lastBoundaryYield: Exclude<typeof finalResult, undefined>['value'] | undefined;

		while (true) {
			const iteration = await loop.next();

			if (iteration.done) {
				finalResult = iteration;
				break;
			}

			if (iteration.value.type === 'loop.boundary') {
				lastBoundaryYield = iteration.value;
			}
		}

		expect(callCount).toBe(3);
		expect(lastBoundaryYield).toEqual({
			loop_state: 'FAILED',
			reason: {
				consecutive_count: 3,
				disposition: 'terminal',
				kind: 'repeated_tool_call',
				loop_state: 'FAILED',
				tool_name: 'file.read',
				turn_count: 3,
			},
			run_id: 'run_agent_loop',
			trace_id: 'trace_agent_loop',
			turn_index: 3,
			type: 'loop.boundary',
		});
		expect(finalResult?.value.stop_reason).toEqual({
			consecutive_count: 3,
			disposition: 'terminal',
			kind: 'repeated_tool_call',
			loop_state: 'FAILED',
			tool_name: 'file.read',
			turn_count: 3,
		});
	});

	it('honors cancellation signals as terminal cancellation', async () => {
		let callCount = 0;
		let cancelled = false;
		const loop = createAgentLoop(
			createAgentLoopInput({
				cancellation_signal: {
					actor: 'user',
					is_cancelled() {
						return cancelled;
					},
				},
				config: {
					max_turns: 3,
					stop_conditions: {
						stop_on_model_finish_reason: ['max_tokens'],
					},
				},
				async execute_turn() {
					callCount += 1;
					cancelled = true;

					return {
						current_loop_state: 'RUNNING',
						current_runtime_state: 'MODEL_THINKING',
					};
				},
			}),
		);

		await loop.next();
		await loop.next();
		const boundary = await loop.next();

		expect(boundary.value).toEqual({
			loop_state: 'CANCELLED',
			reason: {
				actor: 'user',
				disposition: 'terminal',
				kind: 'cancelled',
				loop_state: 'CANCELLED',
				turn_count: 1,
			},
			run_id: 'run_agent_loop',
			trace_id: 'trace_agent_loop',
			turn_index: 1,
			type: 'loop.boundary',
		});
		expect(callCount).toBe(1);
	});

	it('keeps executor seam call counts deterministic across multiple turns', async () => {
		let callCount = 0;
		const loop = createAgentLoop(
			createAgentLoopInput({
				config: {
					max_turns: 2,
					stop_conditions: {
						stop_on_model_finish_reason: ['max_tokens'],
					},
				},
				async execute_turn() {
					callCount += 1;

					if (callCount === 2) {
						return {
							current_loop_state: 'COMPLETED',
							current_runtime_state: 'COMPLETED',
							model: {
								finish_reason: 'stop',
								outcome_kind: 'assistant_response',
							},
						};
					}

					return {
						current_loop_state: 'RUNNING',
						current_runtime_state: 'MODEL_THINKING',
					};
				},
			}),
		);

		while (!(await loop.next()).done) {
			// Consume the generator to completion.
		}

		expect(callCount).toBe(2);
	});

	it('preserves carry-forward tool_result data across continue transitions', async () => {
		let observedToolResult:
			| {
					readonly call_id: string;
					readonly output: {
						readonly content: string;
					};
					readonly status: 'success';
					readonly tool_name: 'file.read';
			  }
			| undefined;
		let callCount = 0;

		const loop = createAgentLoop(
			createAgentLoopInput({
				config: {
					max_turns: 2,
					stop_conditions: {
						stop_on_model_finish_reason: ['max_tokens'],
					},
				},
				async execute_turn(input) {
					callCount += 1;

					if (callCount === 1) {
						return {
							current_loop_state: 'RUNNING',
							current_runtime_state: 'MODEL_THINKING',
							tool_result: {
								call_id: 'call_agent_loop_tool_result',
								output: {
									content: 'tool artifact',
								},
								status: 'success',
								tool_name: 'file.read' as const,
							},
						};
					}

					observedToolResult = input.snapshot.tool_result as typeof observedToolResult;

					return {
						current_loop_state: 'COMPLETED',
						current_runtime_state: 'COMPLETED',
						model: {
							finish_reason: 'stop',
							outcome_kind: 'assistant_response',
						},
					};
				},
			}),
		);

		let finalResult: Awaited<ReturnType<ReturnType<typeof createAgentLoop>['next']>> | undefined;

		while (true) {
			const iteration = await loop.next();

			if (iteration.done) {
				finalResult = iteration;
				break;
			}
		}

		expect(observedToolResult).toEqual({
			call_id: 'call_agent_loop_tool_result',
			output: {
				content: 'tool artifact',
			},
			status: 'success',
			tool_name: 'file.read',
		});
		expect(finalResult?.value.final_snapshot.tool_result).toEqual({
			call_id: 'call_agent_loop_tool_result',
			output: {
				content: 'tool artifact',
			},
			status: 'success',
			tool_name: 'file.read',
		});
	});

	it('stops when cumulative token usage reaches the configured total token threshold', async () => {
		let callCount = 0;
		const loop = createAgentLoop(
			createAgentLoopInput({
				config: {
					max_turns: 5,
					stop_conditions: {
						stop_on_model_finish_reason: ['max_tokens'],
					},
					token_limits: {
						max_total_tokens: 100,
					},
				},
				async execute_turn() {
					callCount += 1;

					return {
						current_loop_state: 'RUNNING',
						current_runtime_state: 'MODEL_THINKING',
						model_response: {
							finish_reason: 'max_tokens',
							message: {
								content: `turn ${callCount}`,
								role: 'assistant',
							},
							model: 'test-model',
							provider: 'test-provider',
							usage: {
								input_tokens: 20,
								output_tokens: 25,
								total_tokens: 45,
							},
						},
					};
				},
			}),
		);

		let finalResult: Awaited<ReturnType<ReturnType<typeof createAgentLoop>['next']>> | undefined;
		let lastBoundaryYield: Exclude<typeof finalResult, undefined>['value'] | undefined;

		while (true) {
			const iteration = await loop.next();

			if (iteration.done) {
				finalResult = iteration;
				break;
			}

			if (iteration.value.type === 'loop.boundary') {
				lastBoundaryYield = iteration.value;
			}
		}

		expect(callCount).toBe(2);
		expect(lastBoundaryYield).toEqual({
			loop_state: 'FAILED',
			reason: {
				configured_limit: 100,
				disposition: 'terminal',
				kind: 'token_budget_reached',
				limit_kind: 'total_tokens',
				loop_state: 'FAILED',
				observed_usage: 90,
				threshold: 90,
				turn_count: 2,
				usage: {
					input_tokens: 40,
					output_tokens: 50,
					total_tokens: 90,
				},
			},
			run_id: 'run_agent_loop',
			trace_id: 'trace_agent_loop',
			turn_index: 2,
			type: 'loop.boundary',
		});
		expect(finalResult?.value.final_snapshot.token_usage).toEqual({
			input_tokens: 40,
			output_tokens: 50,
			total_tokens: 90,
		});
	});

	it('keeps running when token usage is present but no token limits are configured', async () => {
		let callCount = 0;
		const loop = createAgentLoop(
			createAgentLoopInput({
				config: {
					max_turns: 3,
					stop_conditions: {},
				},
				async execute_turn() {
					callCount += 1;

					if (callCount === 2) {
						return {
							current_loop_state: 'COMPLETED',
							current_runtime_state: 'COMPLETED',
							model: {
								finish_reason: 'stop',
								outcome_kind: 'assistant_response',
							},
							model_response: {
								finish_reason: 'stop',
								message: {
									content: 'done',
									role: 'assistant',
								},
								model: 'test-model',
								provider: 'test-provider',
								usage: {
									input_tokens: 500,
									output_tokens: 250,
									total_tokens: 750,
								},
							},
						};
					}

					return {
						current_loop_state: 'RUNNING',
						current_runtime_state: 'MODEL_THINKING',
						model_response: {
							finish_reason: 'max_tokens',
							message: {
								content: 'still running',
								role: 'assistant',
							},
							model: 'test-model',
							provider: 'test-provider',
							usage: {
								input_tokens: 500,
								output_tokens: 250,
								total_tokens: 750,
							},
						},
					};
				},
			}),
		);

		let finalResult: Awaited<ReturnType<ReturnType<typeof createAgentLoop>['next']>> | undefined;

		while (true) {
			const iteration = await loop.next();

			if (iteration.done) {
				finalResult = iteration;
				break;
			}
		}

		expect(callCount).toBe(2);
		expect(finalResult?.value.stop_reason).toEqual({
			disposition: 'terminal',
			finish_reason: 'stop',
			kind: 'model_stop',
			loop_state: 'COMPLETED',
			turn_count: 2,
		});
		expect(finalResult?.value.final_snapshot.token_usage).toEqual({
			input_tokens: 1000,
			output_tokens: 500,
			total_tokens: 1500,
		});
	});
});
