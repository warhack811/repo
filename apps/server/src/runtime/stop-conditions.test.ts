import type { StopConditionsSnapshot } from './stop-conditions.js';

import { describe, expect, it } from 'vitest';

import {
	evaluateStopConditions,
	getStopReason,
	isBoundaryStopDecision,
	isTerminalStopDecision,
} from './stop-conditions.js';

function createSnapshot(overrides: Partial<StopConditionsSnapshot> = {}): StopConditionsSnapshot {
	return {
		config: {
			max_turns: 5,
			stop_conditions: {},
		},
		turn_count: 1,
		...overrides,
	};
}

describe('evaluateStopConditions', () => {
	it('returns a terminal stop when the max turn limit is reached', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				turn_count: 5,
			}),
		);

		expect(decision).toEqual({
			decision: 'terminal',
			loop_state: 'FAILED',
			reason: {
				disposition: 'terminal',
				kind: 'max_turns_reached',
				loop_state: 'FAILED',
				max_turns: 5,
				turn_count: 5,
			},
		});
	});

	it('returns a terminal cancellation when user cancel is requested', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				cancellation: {
					actor: 'user',
					requested: true,
				},
			}),
		);

		expect(decision).toEqual({
			decision: 'terminal',
			loop_state: 'CANCELLED',
			reason: {
				actor: 'user',
				disposition: 'terminal',
				kind: 'cancelled',
				loop_state: 'CANCELLED',
				turn_count: 1,
			},
		});
	});

	it('returns a paused boundary for approval wait states', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				current_runtime_state: 'WAITING_APPROVAL',
				human_boundary: {
					action_kind: 'file_write',
					approval_id: 'approval_stop_conditions_1',
					boundary: 'approval',
					loop_state: 'WAITING',
				},
			}),
		);

		expect(decision).toEqual({
			decision: 'boundary',
			loop_state: 'WAITING',
			reason: {
				action_kind: 'file_write',
				approval_id: 'approval_stop_conditions_1',
				boundary: 'approval',
				disposition: 'paused',
				kind: 'waiting_for_human',
				loop_state: 'WAITING',
				turn_count: 1,
			},
		});
	});

	it('returns a terminal failure for tool errors when fail_on_tool_error is explicitly true', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				config: {
					max_turns: 5,
					stop_conditions: {
						fail_on_tool_error: true,
					},
				},
				tool_result: {
					call_id: 'call_stop_conditions_tool_error',
					error_code: 'EXECUTION_FAILED',
					error_message: 'Tool execution failed.',
					retryable: false,
					status: 'error',
					tool_name: 'shell.exec',
				},
			}),
		);

		expect(decision).toEqual({
			decision: 'terminal',
			loop_state: 'FAILED',
			reason: {
				call_id: 'call_stop_conditions_tool_error',
				disposition: 'terminal',
				error_code: 'EXECUTION_FAILED',
				kind: 'tool_failure',
				loop_state: 'FAILED',
				retryable: false,
				tool_name: 'shell.exec',
				turn_count: 1,
			},
		});
	});

	it('returns continue on a single tool error by default (soft failure mode)', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				tool_result: {
					call_id: 'call_soft_failure',
					error_code: 'EXECUTION_FAILED',
					error_message: 'Tool execution failed.',
					retryable: false,
					status: 'error',
					tool_name: 'shell.exec',
				},
			}),
		);

		expect(decision).toEqual({
			decision: 'continue',
			loop_state: 'RUNNING',
		});
	});

	it('returns a terminal failure after 3 consecutive tool failures in soft mode', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				consecutive_tool_failure_count: 3,
				tool_result: {
					call_id: 'call_consecutive_failure',
					error_code: 'EXECUTION_FAILED',
					error_message: 'Tool execution failed.',
					retryable: false,
					status: 'error',
					tool_name: 'shell.exec',
				},
			}),
		);

		expect(decision).toEqual({
			decision: 'terminal',
			loop_state: 'FAILED',
			reason: {
				call_id: 'call_consecutive_failure',
				consecutive_count: 3,
				disposition: 'terminal',
				error_code: 'EXECUTION_FAILED',
				kind: 'tool_failure',
				loop_state: 'FAILED',
				retryable: false,
				tool_name: 'shell.exec',
				turn_count: 1,
			},
		});
	});

	it('returns continue when no stop condition is matched', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				model: {
					finish_reason: 'stop',
					outcome_kind: 'tool_call',
				},
			}),
		);

		expect(decision).toEqual({
			decision: 'continue',
			loop_state: 'RUNNING',
		});
		expect(getStopReason(decision)).toBeUndefined();
	});

	it('returns a repeated_tool_call terminal decision after three identical tool signatures', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				recent_tool_calls: [
					{
						args_hash: 'same',
						tool_name: 'search.codebase',
					},
					{
						args_hash: 'same',
						tool_name: 'search.codebase',
					},
					{
						args_hash: 'same',
						tool_name: 'search.codebase',
					},
				],
				turn_count: 3,
			}),
		);

		expect(decision).toEqual({
			decision: 'terminal',
			loop_state: 'FAILED',
			reason: {
				consecutive_count: 3,
				disposition: 'terminal',
				kind: 'repeated_tool_call',
				loop_state: 'FAILED',
				tool_name: 'search.codebase',
				turn_count: 3,
			},
		});
	});

	it('does not stop shell session polling on the early repeated-tool guard', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				recent_tool_calls: [
					{
						args_hash: 'same-session-read',
						tool_name: 'shell.session.read',
					},
					{
						args_hash: 'same-session-read',
						tool_name: 'shell.session.read',
					},
					{
						args_hash: 'same-session-read',
						tool_name: 'shell.session.read',
					},
				],
				turn_count: 3,
			}),
		);

		expect(decision).toEqual({
			decision: 'continue',
			loop_state: 'RUNNING',
		});
	});

	it('still stops unproductive shell session polling through stagnation', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				config: {
					max_turns: 10,
					stop_conditions: {},
				},
				recent_tool_calls: [
					{ args_hash: 'same-session-read', tool_name: 'shell.session.read' },
					{ args_hash: 'same-session-read', tool_name: 'shell.session.read' },
					{ args_hash: 'same-session-read', tool_name: 'shell.session.read' },
					{ args_hash: 'same-session-read', tool_name: 'shell.session.read' },
					{ args_hash: 'same-session-read', tool_name: 'shell.session.read' },
					{ args_hash: 'same-session-read', tool_name: 'shell.session.read' },
				],
				turn_count: 6,
			}),
		);

		expect(decision).toEqual({
			decision: 'terminal',
			loop_state: 'FAILED',
			reason: {
				disposition: 'terminal',
				kind: 'stagnation',
				loop_state: 'FAILED',
				turn_count: 6,
				unique_tool_signatures: 1,
				window_size: 6,
			},
		});
	});

	it('returns continue when identical tool signatures stay below the repeat threshold', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				recent_tool_calls: [
					{
						args_hash: 'same',
						tool_name: 'search.codebase',
					},
					{
						args_hash: 'same',
						tool_name: 'search.codebase',
					},
				],
				turn_count: 2,
			}),
		);

		expect(decision).toEqual({
			decision: 'continue',
			loop_state: 'RUNNING',
		});
	});

	it('returns a token_budget_reached terminal decision for total token usage near the limit', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				config: {
					max_turns: 10,
					stop_conditions: {},
					token_limits: {
						max_total_tokens: 100,
					},
				},
				token_usage: {
					input_tokens: 48,
					output_tokens: 42,
					total_tokens: 90,
				},
				turn_count: 2,
			}),
		);

		expect(decision).toEqual({
			decision: 'terminal',
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
					input_tokens: 48,
					output_tokens: 42,
					total_tokens: 90,
				},
			},
		});
	});

	it('returns a token_budget_reached terminal decision for input token usage near the limit', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				config: {
					max_turns: 10,
					stop_conditions: {},
					token_limits: {
						max_input_tokens: 100,
					},
				},
				token_usage: {
					input_tokens: 90,
					output_tokens: 12,
					total_tokens: 102,
				},
				turn_count: 2,
			}),
		);

		expect(decision).toEqual({
			decision: 'terminal',
			loop_state: 'FAILED',
			reason: {
				configured_limit: 100,
				disposition: 'terminal',
				kind: 'token_budget_reached',
				limit_kind: 'input_tokens',
				loop_state: 'FAILED',
				observed_usage: 90,
				threshold: 90,
				turn_count: 2,
				usage: {
					input_tokens: 90,
					output_tokens: 12,
					total_tokens: 102,
				},
			},
		});
	});

	it('returns a token_budget_reached terminal decision for output token usage near the limit', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				config: {
					max_turns: 10,
					stop_conditions: {},
					token_limits: {
						max_output_tokens: 50,
					},
				},
				token_usage: {
					input_tokens: 20,
					output_tokens: 45,
					total_tokens: 65,
				},
				turn_count: 2,
			}),
		);

		expect(decision).toEqual({
			decision: 'terminal',
			loop_state: 'FAILED',
			reason: {
				configured_limit: 50,
				disposition: 'terminal',
				kind: 'token_budget_reached',
				limit_kind: 'output_tokens',
				loop_state: 'FAILED',
				observed_usage: 45,
				threshold: 45,
				turn_count: 2,
				usage: {
					input_tokens: 20,
					output_tokens: 45,
					total_tokens: 65,
				},
			},
		});
	});

	it('returns continue when token usage exists but token limits are not configured', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				token_usage: {
					input_tokens: 900,
					output_tokens: 450,
					total_tokens: 1350,
				},
			}),
		);

		expect(decision).toEqual({
			decision: 'continue',
			loop_state: 'RUNNING',
		});
	});

	it('returns a stagnation terminal decision when the recent window has too few unique signatures', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				config: {
					max_turns: 10,
					stop_conditions: {},
				},
				recent_tool_calls: [
					{ args_hash: 'alpha', tool_name: 'search.codebase' },
					{ args_hash: 'beta', tool_name: 'search.codebase' },
					{ args_hash: 'alpha', tool_name: 'search.codebase' },
					{ args_hash: 'beta', tool_name: 'search.codebase' },
					{ args_hash: 'alpha', tool_name: 'search.codebase' },
					{ args_hash: 'beta', tool_name: 'search.codebase' },
				],
				turn_count: 6,
			}),
		);

		expect(decision).toEqual({
			decision: 'terminal',
			loop_state: 'FAILED',
			reason: {
				disposition: 'terminal',
				kind: 'stagnation',
				loop_state: 'FAILED',
				turn_count: 6,
				unique_tool_signatures: 2,
				window_size: 6,
			},
		});
	});

	it('returns continue when the recent window still shows enough unique tool signatures', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				config: {
					max_turns: 10,
					stop_conditions: {},
				},
				recent_tool_calls: [
					{ args_hash: 'a', tool_name: 'search.codebase' },
					{ args_hash: 'b', tool_name: 'search.codebase' },
					{ args_hash: 'c', tool_name: 'search.codebase' },
					{ args_hash: 'd', tool_name: 'search.codebase' },
					{ args_hash: 'a', tool_name: 'search.codebase' },
					{ args_hash: 'b', tool_name: 'search.codebase' },
				],
				turn_count: 6,
			}),
		);

		expect(decision).toEqual({
			decision: 'continue',
			loop_state: 'RUNNING',
		});
	});

	it('returns continue when no recent tool history is available', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				recent_tool_calls: undefined,
			}),
		);

		expect(decision).toEqual({
			decision: 'continue',
			loop_state: 'RUNNING',
		});
	});

	it('honors max_repeated_identical_calls config overrides', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				config: {
					max_turns: 10,
					stop_conditions: {
						max_repeated_identical_calls: 5,
					},
				},
				recent_tool_calls: [
					{ args_hash: 'same', tool_name: 'search.codebase' },
					{ args_hash: 'same', tool_name: 'search.codebase' },
					{ args_hash: 'same', tool_name: 'search.codebase' },
					{ args_hash: 'same', tool_name: 'search.codebase' },
				],
				turn_count: 4,
			}),
		);

		expect(decision).toEqual({
			decision: 'continue',
			loop_state: 'RUNNING',
		});
	});

	it('applies a deterministic priority order when multiple conditions match', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				cancellation: {
					actor: 'user',
					requested: true,
				},
				current_runtime_state: 'WAITING_APPROVAL',
				human_boundary: {
					approval_id: 'approval_stop_conditions_2',
					boundary: 'approval',
				},
				model: {
					finish_reason: 'stop',
					outcome_kind: 'assistant_response',
				},
				tool_result: {
					call_id: 'call_stop_conditions_priority',
					error_code: 'EXECUTION_FAILED',
					error_message: 'Tool error should lose to explicit cancellation.',
					status: 'error',
					tool_name: 'shell.exec',
				},
				turn_count: 5,
			}),
		);

		expect(isTerminalStopDecision(decision)).toBe(true);

		if (!isTerminalStopDecision(decision)) {
			throw new Error('Expected terminal priority decision.');
		}

		expect(decision.reason.kind).toBe('cancelled');
		expect(decision.loop_state).toBe('CANCELLED');
	});

	it('produces a model-stop terminal decision for assistant responses with a stop finish_reason', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				model: {
					finish_reason: 'stop',
					outcome_kind: 'assistant_response',
				},
			}),
		);

		expect(isTerminalStopDecision(decision)).toBe(true);

		if (!isTerminalStopDecision(decision)) {
			throw new Error('Expected terminal model-stop decision.');
		}

		expect(decision.reason).toEqual({
			disposition: 'terminal',
			finish_reason: 'stop',
			kind: 'model_stop',
			loop_state: 'COMPLETED',
			turn_count: 1,
		});
	});

	it('recognizes explicit human intervention boundaries independently from approval waits', () => {
		const decision = evaluateStopConditions(
			createSnapshot({
				human_boundary: {
					boundary: 'intervention',
					loop_state: 'PAUSED',
				},
			}),
		);

		expect(isBoundaryStopDecision(decision)).toBe(true);

		if (!isBoundaryStopDecision(decision)) {
			throw new Error('Expected boundary decision.');
		}

		expect(decision.reason).toEqual({
			action_kind: undefined,
			approval_id: undefined,
			boundary: 'intervention',
			disposition: 'paused',
			kind: 'waiting_for_human',
			loop_state: 'PAUSED',
			turn_count: 1,
		});
	});
});
