import { describe, expect, it } from 'vitest';

import type { ToolDefinition } from '@runa/types';

import { createPermissionEngine } from '../policy/permission-engine.js';
import { createWebSocketPolicyWiring } from './policy-wiring.js';

function createSocket() {
	return {
		close() {},
		on() {},
		send() {},
	};
}

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

describe('websocket policy wiring', () => {
	it('reconstructs approval decisions without socket-local memory for approval resolution', () => {
		const socket = createSocket();
		const wiring = createWebSocketPolicyWiring();
		const tool = createToolDefinition({
			capability_class: 'file_system',
			name: 'file.write',
			requires_approval: true,
			risk_level: 'medium',
			side_effect_level: 'write',
		});

		const resolved = wiring.resolveApprovalDecision(socket, {
			pending_approval: {
				approval_request: {
					action_kind: 'file_write',
					approval_id: 'approval_policy_wiring_fallback_1',
					call_id: 'call_policy_wiring_fallback_1',
					requested_at: '2026-04-21T12:00:00.000Z',
					run_id: 'run_policy_wiring_fallback_1',
					status: 'pending',
					summary: 'Write the file after approval.',
					target: {
						call_id: 'call_policy_wiring_fallback_1',
						kind: 'tool_call',
						label: 'file.write',
						tool_name: 'file.write',
					},
					title: 'Approve file write',
					tool_name: 'file.write',
					trace_id: 'trace_policy_wiring_fallback_1',
				},
				next_sequence_no: 4,
				pending_tool_call: {
					tool_input: {
						content: 'hello',
						path: 'src/example.ts',
					},
					working_directory: 'd:\\ai\\Runa',
				},
			},
			tool_definition: tool,
		});

		expect(resolved).toEqual({
			approval_requirement: {
				action_kind: 'file_write',
				requires_reason: false,
				source: 'capability',
			},
			decision: 'require_approval',
			reason: 'approval_required_by_capability',
			request: {
				call_id: 'call_policy_wiring_fallback_1',
				capability: {
					action_kind: 'file_write',
					capability_class: 'file_system',
					capability_id: 'file.write',
					requires_approval: true,
					risk_level: 'medium',
					side_effect_level: 'write',
					tool_name: 'file.write',
				},
				kind: 'tool_execution',
			},
		});
	});

	it('resets denial tracking after allowed and approval_approved outcomes', async () => {
		const socket = createSocket();
		const wiring = createWebSocketPolicyWiring({
			permission_engine: createPermissionEngine({
				approval_required_capability_ids: ['file.write'],
			}),
		});
		const approvalTool = createToolDefinition({
			capability_class: 'file_system',
			name: 'file.write',
			requires_approval: false,
			risk_level: 'medium',
			side_effect_level: 'write',
		});
		const safeTool = createToolDefinition({
			capability_class: 'file_system',
			name: 'file.read',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
		});

		const firstApprovalDecision = (
			await wiring.evaluateToolPermission(socket, {
				call_id: 'call_reset_1',
				tool_definition: approvalTool,
			})
		).decision;

		expect(firstApprovalDecision.decision).toBe('require_approval');

		if (firstApprovalDecision.decision !== 'require_approval') {
			throw new Error('Expected a require_approval decision for the first gated tool.');
		}

		await wiring.recordOutcome(socket, {
			decision: firstApprovalDecision,
			outcome: 'approval_rejected',
		});

		expect((await wiring.getState(socket)).denial_tracking.consecutive_denials).toBe(1);

		const allowDecision = (
			await wiring.evaluateToolPermission(socket, {
				call_id: 'call_reset_2',
				tool_definition: safeTool,
			})
		).decision;

		expect(allowDecision.decision).toBe('allow');

		await wiring.recordOutcome(socket, {
			decision: allowDecision,
			outcome: 'allowed',
		});

		expect((await wiring.getState(socket)).denial_tracking).toEqual({
			consecutive_denials: 0,
			threshold: 3,
		});

		const secondApprovalDecision = (
			await wiring.evaluateToolPermission(socket, {
				call_id: 'call_reset_3',
				tool_definition: approvalTool,
			})
		).decision;

		expect(secondApprovalDecision.decision).toBe('require_approval');

		if (secondApprovalDecision.decision !== 'require_approval') {
			throw new Error('Expected a require_approval decision after allow reset.');
		}

		await wiring.recordOutcome(socket, {
			decision: secondApprovalDecision,
			outcome: 'approval_rejected',
		});
		await wiring.recordOutcome(socket, {
			decision: secondApprovalDecision,
			outcome: 'approval_approved',
		});

		expect((await wiring.getState(socket)).denial_tracking).toEqual({
			consecutive_denials: 0,
			threshold: 3,
		});
		expect((await wiring.getState(socket)).session_pause).toEqual({
			active: false,
		});
	});

	it('enables progressive trust for auto-continue only after explicit approval and tracks rejection state', async () => {
		const socket = createSocket();
		const wiring = createWebSocketPolicyWiring({
			permission_engine: createPermissionEngine({
				now: () => '2026-04-17T21:00:00.000Z',
			}),
		});

		const firstDecision = (
			await wiring.evaluateAutoContinuePermission(socket, {
				requested_max_consecutive_turns: 4,
			})
		).decision;

		expect(firstDecision.decision).toBe('require_approval');

		if (firstDecision.decision !== 'require_approval') {
			throw new Error('Expected auto-continue to require approval by default.');
		}

		await wiring.recordOutcome(socket, {
			decision: firstDecision,
			outcome: 'approval_rejected',
		});

		expect((await wiring.getState(socket)).denial_tracking).toEqual({
			consecutive_denials: 1,
			last_denial_at: '2026-04-17T21:00:00.000Z',
			last_denied_capability_id: 'agent.auto_continue',
			threshold: 3,
		});
		expect((await wiring.getState(socket)).progressive_trust.auto_continue).toEqual({
			enabled: false,
		});

		await wiring.recordOutcome(socket, {
			decision: firstDecision,
			outcome: 'approval_approved',
		});

		expect((await wiring.getState(socket)).denial_tracking).toEqual({
			consecutive_denials: 0,
			threshold: 3,
		});
		expect((await wiring.getState(socket)).progressive_trust.auto_continue).toEqual({
			enabled: true,
			enabled_at: '2026-04-17T21:00:00.000Z',
			max_consecutive_turns: 4,
		});
		expect((await wiring.evaluateAutoContinuePermission(socket)).decision).toEqual({
			decision: 'allow',
			reason: 'progressive_trust_enabled',
			request: expect.objectContaining({
				kind: 'auto_continue',
			}),
		});
	});

	it('requires approval with a reason for high-risk desktop screenshot capability', async () => {
		const socket = createSocket();
		const wiring = createWebSocketPolicyWiring();
		const desktopScreenshotTool = createToolDefinition({
			capability_class: 'desktop',
			name: 'desktop.screenshot',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'read',
		});

		const decision = (
			await wiring.evaluateToolPermission(socket, {
				call_id: 'call_desktop_screenshot_1',
				tool_definition: desktopScreenshotTool,
			})
		).decision;

		expect(decision).toEqual({
			approval_requirement: {
				action_kind: 'tool_execution',
				requires_reason: true,
				source: 'capability',
			},
			decision: 'require_approval',
			reason: 'approval_required_by_capability',
			request: expect.objectContaining({
				call_id: 'call_desktop_screenshot_1',
				capability: expect.objectContaining({
					capability_class: 'desktop',
					capability_id: 'desktop.screenshot',
					risk_level: 'high',
					side_effect_level: 'read',
					tool_name: 'desktop.screenshot',
				}),
			}),
		});

		await wiring.recordOutcome(socket, {
			decision,
			outcome: 'approval_rejected',
		});

		expect((await wiring.getState(socket)).denial_tracking).toEqual({
			consecutive_denials: 1,
			last_denied_capability_id: 'desktop.screenshot',
			last_denial_at: expect.any(String),
			threshold: 3,
		});
	});
});
