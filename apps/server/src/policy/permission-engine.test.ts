import { describe, expect, it } from 'vitest';

import type { ToolDefinition } from '@runa/types';

import {
	PermissionEngineError,
	createAutoContinuePermissionRequest,
	createPermissionEngine,
	createToolPermissionRequest,
	normalizeApprovalMode,
	normalizePermissionEngineState,
} from './permission-engine.js';

function createToolDefinition(
	input: Readonly<{
		readonly name: ToolDefinition['name'];
		readonly capability_class: ToolDefinition['metadata']['capability_class'];
		readonly requires_approval: boolean;
		readonly risk_level: ToolDefinition['metadata']['risk_level'];
		readonly side_effect_level: ToolDefinition['metadata']['side_effect_level'];
	}>,
): ToolDefinition {
	return {
		description: `Tool ${input.name}`,
		execute: async () => ({
			call_id: 'call_unused',
			output: 'ok',
			status: 'success',
			tool_name: input.name,
		}),
		metadata: {
			capability_class: input.capability_class,
			requires_approval: input.requires_approval,
			risk_level: input.risk_level,
			side_effect_level: input.side_effect_level,
		},
		name: input.name,
	};
}

describe('permission-engine', () => {
	it('defaults to the standard approval mode for backward-compatible state', () => {
		const engine = createPermissionEngine();

		expect(engine.createInitialState().progressive_trust.approval_mode).toEqual({
			mode: 'standard',
		});
		expect(normalizeApprovalMode(undefined)).toBe('standard');
		expect(normalizeApprovalMode('invalid-mode')).toBe('standard');
	});

	it('returns allow for a safe capability', () => {
		const engine = createPermissionEngine();
		const decision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				tool_definition: createToolDefinition({
					capability_class: 'file_system',
					name: 'file.read',
					requires_approval: false,
					risk_level: 'low',
					side_effect_level: 'read',
				}),
			}),
			state: engine.createInitialState(),
		});

		expect(decision).toEqual({
			decision: 'allow',
			reason: 'safe_capability',
			request: expect.objectContaining({
				capability: expect.objectContaining({
					capability_id: 'file.read',
				}),
				kind: 'tool_execution',
			}),
		});
	});

	it('returns require_approval for capabilities flagged by tool metadata', () => {
		const engine = createPermissionEngine();
		const decision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				call_id: 'call_permission_engine_1',
				tool_definition: createToolDefinition({
					capability_class: 'file_system',
					name: 'file.write',
					requires_approval: true,
					risk_level: 'medium',
					side_effect_level: 'write',
				}),
			}),
			state: engine.createInitialState(),
		});

		expect(decision).toEqual({
			approval_requirement: {
				action_kind: 'file_write',
				requires_reason: false,
				source: 'capability',
			},
			decision: 'require_approval',
			reason: 'approval_required_by_capability',
			request: expect.objectContaining({
				call_id: 'call_permission_engine_1',
			}),
		});
	});

	it('requires approval for every capability in ask-every-time mode after hard gates pass', () => {
		const engine = createPermissionEngine({
			now: () => '2026-05-03T09:00:00.000Z',
		});
		const state = engine.applyApprovalMode({
			approval_mode: 'ask-every-time',
			state: engine.createInitialState(),
		});
		const decision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				tool_definition: createToolDefinition({
					capability_class: 'file_system',
					name: 'file.read',
					requires_approval: false,
					risk_level: 'low',
					side_effect_level: 'read',
				}),
			}),
			state,
		});

		expect(decision).toEqual({
			approval_requirement: {
				action_kind: 'tool_execution',
				requires_reason: false,
				source: 'policy',
			},
			decision: 'require_approval',
			reason: 'approval_required_by_mode',
			request: expect.objectContaining({
				capability: expect.objectContaining({
					capability_id: 'file.read',
				}),
			}),
		});
	});

	it('returns a controlled deny decision for hard-denied capabilities', () => {
		const engine = createPermissionEngine({
			hard_denied_capability_ids: ['shell.exec'],
		});
		const decision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				tool_definition: createToolDefinition({
					capability_class: 'shell',
					name: 'shell.exec',
					requires_approval: true,
					risk_level: 'high',
					side_effect_level: 'execute',
				}),
			}),
			state: engine.createInitialState(),
		});

		expect(decision).toEqual({
			decision: 'deny',
			denial: {
				capability_id: 'shell.exec',
				source: 'policy',
			},
			reason: 'capability_hard_denied',
			request: expect.objectContaining({
				capability: expect.objectContaining({
					capability_id: 'shell.exec',
				}),
			}),
		});
	});

	it('keeps hard-deny precedence over ask-every-time mode', () => {
		const engine = createPermissionEngine({
			hard_denied_capability_ids: ['shell.exec'],
		});
		const state = engine.applyApprovalMode({
			approval_mode: 'ask-every-time',
			state: engine.createInitialState(),
		});
		const decision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				tool_definition: createToolDefinition({
					capability_class: 'shell',
					name: 'shell.exec',
					requires_approval: true,
					risk_level: 'high',
					side_effect_level: 'execute',
				}),
			}),
			state,
		});

		expect(decision.decision).toBe('deny');
		expect(decision.reason).toBe('capability_hard_denied');
	});

	it('opens a role-aware tool authorization seam without changing the default runtime path', () => {
		const engine = createPermissionEngine();
		const decision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				actor_role: 'viewer',
				tool_definition: createToolDefinition({
					capability_class: 'shell',
					name: 'shell.exec',
					requires_approval: true,
					risk_level: 'high',
					side_effect_level: 'execute',
				}),
			}),
			state: engine.createInitialState(),
		});

		expect(decision).toEqual({
			decision: 'deny',
			denial: {
				capability_id: 'shell.exec',
				source: 'authorization',
			},
			reason: 'authorization_role_denied',
			request: expect.objectContaining({
				capability: expect.objectContaining({
					actor_role: 'viewer',
					capability_id: 'shell.exec',
				}),
			}),
		});
	});

	it('keeps authorization precedence over trusted-session mode', () => {
		const engine = createPermissionEngine();
		const state = engine.applyApprovalMode({
			approval_mode: 'trusted-session',
			state: engine.createInitialState(),
		});
		const decision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				actor_role: 'viewer',
				tool_definition: createToolDefinition({
					capability_class: 'shell',
					name: 'shell.exec',
					requires_approval: true,
					risk_level: 'high',
					side_effect_level: 'execute',
				}),
			}),
			state,
		});

		expect(decision.decision).toBe('deny');
		expect(decision.reason).toBe('authorization_role_denied');
	});

	it('allows low-risk read tools in trusted-session mode and tracks the bounded allowance', () => {
		const engine = createPermissionEngine({
			now: () => '2026-05-03T09:10:00.000Z',
		});
		const state = engine.applyApprovalMode({
			approval_mode: 'trusted-session',
			state: engine.createInitialState(),
		});
		const decision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				tool_definition: createToolDefinition({
					capability_class: 'file_system',
					name: 'file.read',
					requires_approval: false,
					risk_level: 'low',
					side_effect_level: 'read',
				}),
			}),
			state,
		});

		expect(decision).toEqual({
			decision: 'allow',
			reason: 'progressive_trust_enabled',
			request: expect.objectContaining({
				capability: expect.objectContaining({
					capability_id: 'file.read',
				}),
			}),
		});

		const outcome = engine.recordPermissionOutcome({
			decision,
			outcome: 'allowed',
			state,
		});

		expect(outcome.next_state.progressive_trust.trusted_session).toMatchObject({
			approved_capability_count: 1,
			consumed_turns: 1,
			enabled: true,
			enabled_at: '2026-05-03T09:10:00.000Z',
			max_approved_capabilities: 50,
			max_turns: 20,
		});
	});

	it('stops trusted-session auto-allow after the max turn boundary', () => {
		const engine = createPermissionEngine({
			now: () => '2026-05-03T09:20:00.000Z',
		});
		let state = engine.createInitialState();

		for (let index = 0; index < 21; index += 1) {
			state = engine.applyApprovalMode({
				approval_mode: 'trusted-session',
				state,
			});
		}

		const decision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				tool_definition: createToolDefinition({
					capability_class: 'file_system',
					name: 'file.read',
					requires_approval: true,
					risk_level: 'medium',
					side_effect_level: 'read',
				}),
			}),
			state,
		});

		expect(state.progressive_trust.trusted_session).toMatchObject({
			consumed_turns: 21,
			max_turns: 20,
		});
		expect(decision.decision).toBe('require_approval');
		expect(decision.reason).toBe('approval_required_by_capability');
	});

	it('stops trusted-session auto-allow after the persisted TTL boundary', () => {
		const engine = createPermissionEngine({
			now: () => '2026-05-03T10:00:00.001Z',
		});
		const state = {
			...engine.createInitialState(),
			progressive_trust: {
				approval_mode: {
					mode: 'trusted-session' as const,
				},
				auto_continue: {
					enabled: false,
				},
				trusted_session: {
					approved_capability_count: 0,
					consumed_turns: 1,
					enabled: true,
					enabled_at: '2026-05-03T09:00:00.000Z',
					expires_at: '2026-05-03T10:00:00.000Z',
					max_approved_capabilities: 50,
					max_turns: 20,
				},
			},
		};

		const decision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				tool_definition: createToolDefinition({
					capability_class: 'file_system',
					name: 'file.read',
					requires_approval: true,
					risk_level: 'medium',
					side_effect_level: 'read',
				}),
			}),
			state,
		});

		expect(decision.decision).toBe('require_approval');
		expect(decision.reason).toBe('approval_required_by_capability');
	});

	it('stops trusted-session auto-allow at the max approved capability boundary', () => {
		const engine = createPermissionEngine({
			now: () => '2026-05-03T09:30:00.000Z',
		});
		const state = {
			...engine.createInitialState(),
			progressive_trust: {
				approval_mode: {
					mode: 'trusted-session' as const,
				},
				auto_continue: {
					enabled: false,
				},
				trusted_session: {
					approved_capability_count: 50,
					consumed_turns: 1,
					enabled: true,
					enabled_at: '2026-05-03T09:00:00.000Z',
					expires_at: '2026-05-03T10:00:00.000Z',
					max_approved_capabilities: 50,
					max_turns: 20,
				},
			},
		};

		const decision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				tool_definition: createToolDefinition({
					capability_class: 'file_system',
					name: 'file.read',
					requires_approval: true,
					risk_level: 'medium',
					side_effect_level: 'read',
				}),
			}),
			state,
		});

		expect(decision.decision).toBe('require_approval');
		expect(decision.reason).toBe('approval_required_by_capability');
	});

	it('keeps persisted trusted-session states with exceeded limits behind approval', () => {
		const engine = createPermissionEngine({
			now: () => '2026-05-03T09:30:00.000Z',
		});
		const hydratedState = normalizePermissionEngineState({
			...engine.createInitialState(),
			progressive_trust: {
				approval_mode: {
					mode: 'trusted-session',
				},
				auto_continue: {
					enabled: false,
				},
				trusted_session: {
					approved_capability_count: 2,
					consumed_turns: 21,
					enabled: true,
					enabled_at: '2026-05-03T09:00:00.000Z',
					expires_at: '2026-05-03T10:00:00.000Z',
					max_approved_capabilities: 50,
					max_turns: 20,
				},
			},
		});

		const decision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				tool_definition: createToolDefinition({
					capability_class: 'file_system',
					name: 'file.read',
					requires_approval: true,
					risk_level: 'medium',
					side_effect_level: 'read',
				}),
			}),
			state: hydratedState,
		});

		expect(decision.decision).toBe('require_approval');
		expect(decision.reason).toBe('approval_required_by_capability');
	});

	it('normalizes invalid trusted-session timestamps and counters into a safe disabled state', () => {
		const engine = createPermissionEngine();
		const state = normalizePermissionEngineState({
			...engine.createInitialState(),
			progressive_trust: {
				approval_mode: {
					mode: 'trusted-session',
				},
				auto_continue: {
					enabled: false,
				},
				trusted_session: {
					approved_capability_count: Number.NaN,
					consumed_turns: -1,
					enabled: true,
					enabled_at: 'not-a-date',
					expires_at: undefined,
					max_approved_capabilities: 50,
					max_turns: 20,
				},
			},
		});

		expect(state.progressive_trust.trusted_session).toEqual({
			approved_capability_count: 0,
			consumed_turns: 0,
			enabled: false,
		});
	});

	it('keeps high-risk execution behind approval even in trusted-session mode', () => {
		const engine = createPermissionEngine();
		const state = engine.applyApprovalMode({
			approval_mode: 'trusted-session',
			state: engine.createInitialState(),
		});
		const decision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				tool_definition: createToolDefinition({
					capability_class: 'shell',
					name: 'shell.exec',
					requires_approval: true,
					risk_level: 'high',
					side_effect_level: 'execute',
				}),
			}),
			state,
		});

		expect(decision.decision).toBe('require_approval');
		expect(decision.reason).toBe('approval_required_by_capability');
	});

	it('tracks consecutive denials and preserves in-memory state without persistence', () => {
		const engine = createPermissionEngine({
			now: () => '2026-04-17T20:00:00.000Z',
		});
		const decision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				tool_definition: createToolDefinition({
					capability_class: 'file_system',
					name: 'edit.patch',
					requires_approval: true,
					risk_level: 'medium',
					side_effect_level: 'write',
				}),
			}),
			state: engine.createInitialState(),
		});

		const firstOutcome = engine.recordPermissionOutcome({
			decision,
			outcome: 'approval_rejected',
			state: engine.createInitialState(),
		});
		const secondOutcome = engine.recordPermissionOutcome({
			decision,
			outcome: 'approval_rejected',
			state: firstOutcome.next_state,
		});

		expect(firstOutcome.next_state.denial_tracking).toMatchObject({
			consecutive_denials: 1,
			last_denied_capability_id: 'edit.patch',
			threshold: 3,
		});
		expect(secondOutcome.next_state.denial_tracking).toMatchObject({
			consecutive_denials: 2,
			last_denied_capability_id: 'edit.patch',
			threshold: 3,
		});
		expect(secondOutcome.pause_transition).toBe('none');
	});

	it('pauses the session after three consecutive denials', () => {
		const engine = createPermissionEngine({
			now: () => '2026-04-17T20:05:00.000Z',
		});
		const decision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				tool_definition: createToolDefinition({
					capability_class: 'file_system',
					name: 'file.write',
					requires_approval: true,
					risk_level: 'medium',
					side_effect_level: 'write',
				}),
			}),
			state: engine.createInitialState(),
		});

		const first = engine.recordPermissionOutcome({
			decision,
			outcome: 'approval_rejected',
			state: engine.createInitialState(),
		});
		const second = engine.recordPermissionOutcome({
			decision,
			outcome: 'approval_rejected',
			state: first.next_state,
		});
		const third = engine.recordPermissionOutcome({
			decision,
			outcome: 'approval_rejected',
			state: second.next_state,
		});

		expect(third.next_state.denial_tracking.consecutive_denials).toBe(3);
		expect(third.next_state.session_pause).toEqual({
			active: true,
			paused_at: '2026-04-17T20:05:00.000Z',
			reason: 'denial_threshold',
		});
		expect(third.pause_transition).toBe('entered');

		const pausedDecision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				tool_definition: createToolDefinition({
					capability_class: 'file_system',
					name: 'file.read',
					requires_approval: false,
					risk_level: 'low',
					side_effect_level: 'read',
				}),
			}),
			state: third.next_state,
		});

		expect(pausedDecision).toEqual({
			decision: 'pause',
			pause: {
				consecutive_denials: 3,
				reason: 'denial_threshold',
				threshold: 3,
			},
			reason: 'session_paused_after_denials',
			request: expect.objectContaining({
				capability: expect.objectContaining({
					capability_id: 'file.read',
				}),
			}),
		});
	});

	it('allows auto-continue by default and records explicit approval when re-enabled from disabled state', () => {
		const engine = createPermissionEngine({
			now: () => '2026-04-17T20:10:00.000Z',
		});
		const initialState = engine.createInitialState();
		const request = createAutoContinuePermissionRequest({
			requested_max_consecutive_turns: 5,
		});

		const defaultDecision = engine.evaluatePermission({
			request,
			state: initialState,
		});

		expect(defaultDecision).toEqual({
			decision: 'allow',
			reason: 'progressive_trust_enabled',
			request,
		});

		const disabledState: typeof initialState = {
			...initialState,
			progressive_trust: {
				...initialState.progressive_trust,
				auto_continue: { enabled: false },
			},
		};

		const disabledDecision = engine.evaluatePermission({
			request,
			state: disabledState,
		});

		expect(disabledDecision).toEqual({
			approval_requirement: {
				action_kind: 'auto_continue',
				requires_reason: true,
				source: 'progressive_trust',
			},
			decision: 'require_approval',
			reason: 'auto_continue_disabled',
			request,
		});

		const approvalOutcome = engine.recordPermissionOutcome({
			decision: disabledDecision,
			outcome: 'approval_approved',
			state: disabledState,
		});
		const reEnabledDecision = engine.evaluatePermission({
			request,
			state: approvalOutcome.next_state,
		});

		expect(approvalOutcome.next_state.progressive_trust.auto_continue).toEqual({
			enabled: true,
			enabled_at: '2026-04-17T20:10:00.000Z',
			max_consecutive_turns: 5,
		});
		expect(reEnabledDecision).toEqual({
			decision: 'allow',
			reason: 'progressive_trust_enabled',
			request,
		});
	});

	it('clears paused denial state when the session is explicitly resumed', () => {
		const engine = createPermissionEngine();
		const pausedState = {
			...engine.createInitialState(),
			denial_tracking: {
				consecutive_denials: 3,
				last_denial_at: '2026-04-17T20:15:00.000Z',
				last_denied_capability_id: 'shell.exec',
				threshold: 3,
			},
			session_pause: {
				active: true,
				paused_at: '2026-04-17T20:15:00.000Z',
				reason: 'denial_threshold' as const,
			},
		};

		const result = engine.recordPermissionOutcome({
			decision: {
				decision: 'pause',
				pause: {
					consecutive_denials: 3,
					reason: 'denial_threshold',
					threshold: 3,
				},
				reason: 'session_paused_after_denials',
				request: createToolPermissionRequest({
					tool_definition: createToolDefinition({
						capability_class: 'file_system',
						name: 'file.read',
						requires_approval: false,
						risk_level: 'low',
						side_effect_level: 'read',
					}),
				}),
			},
			outcome: 'session_resumed',
			state: pausedState,
		});

		expect(result.next_state.denial_tracking).toEqual({
			consecutive_denials: 0,
			threshold: 3,
		});
		expect(result.next_state.session_pause).toEqual({
			active: false,
		});
		expect(result.pause_transition).toBe('cleared');
	});

	it('rejects invalid outcome/decision combinations with a controlled typed error', () => {
		const engine = createPermissionEngine();
		const allowDecision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				tool_definition: createToolDefinition({
					capability_class: 'file_system',
					name: 'file.read',
					requires_approval: false,
					risk_level: 'low',
					side_effect_level: 'read',
				}),
			}),
			state: engine.createInitialState(),
		});

		expect(() =>
			engine.recordPermissionOutcome({
				decision: allowDecision,
				outcome: 'approval_approved',
				state: engine.createInitialState(),
			}),
		).toThrowError(PermissionEngineError);
	});
});
