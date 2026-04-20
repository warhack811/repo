import { describe, expect, it } from 'vitest';

import type { ToolDefinition } from '@runa/types';

import {
	PermissionEngineError,
	createAutoContinuePermissionRequest,
	createPermissionEngine,
	createToolPermissionRequest,
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

	it('keeps auto-continue disabled by default until explicitly approved', () => {
		const engine = createPermissionEngine({
			now: () => '2026-04-17T20:10:00.000Z',
		});
		const initialState = engine.createInitialState();
		const request = createAutoContinuePermissionRequest({
			requested_max_consecutive_turns: 5,
		});

		const firstDecision = engine.evaluatePermission({
			request,
			state: initialState,
		});

		expect(firstDecision).toEqual({
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
			decision: firstDecision,
			outcome: 'approval_approved',
			state: initialState,
		});
		const secondDecision = engine.evaluatePermission({
			request,
			state: approvalOutcome.next_state,
		});

		expect(approvalOutcome.next_state.progressive_trust.auto_continue).toEqual({
			enabled: true,
			enabled_at: '2026-04-17T20:10:00.000Z',
			max_consecutive_turns: 5,
		});
		expect(secondDecision).toEqual({
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
