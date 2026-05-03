import { describe, expect, it, vi } from 'vitest';

import {
	createAutoContinuePermissionRequest,
	createPermissionEngine,
} from '../policy/permission-engine.js';
import type { AgentLoopContinueGateInput } from './agent-loop.js';
import { createAutoContinuePolicyGate } from './auto-continue-policy.js';

function createGateInput(
	overrides: Partial<AgentLoopContinueGateInput> = {},
): AgentLoopContinueGateInput {
	return {
		config: {
			max_turns: 5,
			stop_conditions: {},
		},
		run_id: 'run_auto_continue_policy',
		snapshot: {
			config: {
				max_turns: 5,
				stop_conditions: {},
			},
			current_loop_state: 'RUNNING',
			current_runtime_state: 'TOOL_RESULT_INGESTING',
			run_id: 'run_auto_continue_policy',
			tool_result: {
				call_id: 'call_auto_continue_policy_1',
				output: {
					content: 'ok',
				},
				status: 'success',
				tool_name: 'file.read',
			},
			trace_id: 'trace_auto_continue_policy',
			turn_count: 1,
		},
		trace_id: 'trace_auto_continue_policy',
		turn_index: 1,
		...overrides,
	};
}

describe('createAutoContinuePolicyGate', () => {
	it('returns an approval boundary when auto-continue is explicitly disabled', async () => {
		const engine = createPermissionEngine();
		const rememberApprovalDecision = vi.fn();
		const recordOutcome = vi.fn();
		const initialState = engine.createInitialState();
		const disabledState: typeof initialState = {
			...initialState,
			progressive_trust: {
				...initialState.progressive_trust,
				auto_continue: { enabled: false },
			},
		};
		const gate = createAutoContinuePolicyGate({
			evaluate_permission() {
				return {
					decision: engine.evaluatePermission({
						request: createAutoContinuePermissionRequest(),
						state: disabledState,
					}),
				};
			},
			record_outcome: recordOutcome,
			remember_approval_decision: rememberApprovalDecision,
		});

		const result = await gate(createGateInput());

		expect(result.status).toBe('override');

		if (result.status !== 'override') {
			throw new Error('Expected override result for disabled auto-continue.');
		}

		expect(result.turn_result.current_loop_state).toBe('WAITING');
		expect(result.turn_result.current_runtime_state).toBe('WAITING_APPROVAL');
		expect(result.turn_result.approval_request).toMatchObject({
			action_kind: 'tool_execution',
			status: 'pending',
			title: 'Approve auto-continue',
		});
		expect(result.turn_result.human_boundary).toEqual({
			action_kind: 'tool_execution',
			approval_id: expect.stringContaining(':approval:auto-continue:1'),
			boundary: 'approval',
			loop_state: 'WAITING',
		});
		expect(rememberApprovalDecision).toHaveBeenCalledTimes(1);
		expect(recordOutcome).not.toHaveBeenCalled();
	});

	it('allows continuation and records an allowed outcome when progressive trust is enabled', async () => {
		const engine = createPermissionEngine();
		const initialState = engine.createInitialState();
		const disabledState: typeof initialState = {
			...initialState,
			progressive_trust: {
				...initialState.progressive_trust,
				auto_continue: { enabled: false },
			},
		};
		const request = createAutoContinuePermissionRequest({
			requested_max_consecutive_turns: 4,
		});
		const approvalDecision = engine.evaluatePermission({
			request,
			state: disabledState,
		});

		if (approvalDecision.decision !== 'require_approval') {
			throw new Error('Expected explicitly-disabled auto-continue decision to require approval.');
		}

		const approvedState = engine.recordPermissionOutcome({
			decision: approvalDecision,
			outcome: 'approval_approved',
			state: disabledState,
		}).next_state;
		const recordOutcome = vi.fn(
			(input: { decision: typeof approvalDecision; outcome: 'allowed' | 'denied' }) =>
				engine.recordPermissionOutcome({
					decision: input.decision,
					outcome: input.outcome,
					state: approvedState,
				}),
		);
		const gate = createAutoContinuePolicyGate({
			evaluate_permission() {
				return {
					decision: engine.evaluatePermission({
						request,
						state: approvedState,
					}),
				};
			},
			record_outcome: recordOutcome,
			remember_approval_decision() {},
		});

		const result = await gate(createGateInput());

		expect(result).toEqual({
			status: 'allow',
		});
		expect(recordOutcome).toHaveBeenCalledWith({
			decision: {
				decision: 'allow',
				reason: 'progressive_trust_enabled',
				request,
			},
			outcome: 'allowed',
		});
	});

	it('converts paused sessions into a resumable boundary instead of continuing', async () => {
		const gate = createAutoContinuePolicyGate({
			evaluate_permission() {
				return {
					decision: {
						decision: 'pause',
						pause: {
							consecutive_denials: 3,
							reason: 'denial_threshold',
							threshold: 3,
						},
						reason: 'session_paused_after_denials',
						request: createAutoContinuePermissionRequest(),
					},
				};
			},
			record_outcome() {
				throw new Error('Paused auto-continue must not record an outcome.');
			},
			remember_approval_decision() {
				throw new Error('Paused auto-continue must not remember approval decisions.');
			},
		});

		const result = await gate(createGateInput());

		expect(result.status).toBe('override');

		if (result.status !== 'override') {
			throw new Error('Expected override result for paused sessions.');
		}

		expect(result.turn_result.current_loop_state).toBe('PAUSED');
		expect(result.turn_result.current_runtime_state).toBe('WAITING_APPROVAL');
		expect(result.turn_result.human_boundary).toEqual({
			boundary: 'resume',
			loop_state: 'PAUSED',
		});
	});
});
