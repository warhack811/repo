import { describe, expect, it } from 'vitest';
import type { RenderBlock } from '../../../ws-types.js';

import { getApprovalRiskLevel } from './approvalRisk.js';

type ApprovalBlock = Extract<RenderBlock, { type: 'approval_block' }>;
type ApprovalOverrides = Partial<Omit<ApprovalBlock, 'payload'>> & {
	payload?: Partial<ApprovalBlock['payload'] & { risk_level?: unknown }>;
};

function createApprovalBlock(overrides: ApprovalOverrides = {}): ApprovalBlock {
	const base: ApprovalBlock = {
		created_at: '2026-05-13T12:00:00.000Z',
		id: 'approval:risk',
		payload: {
			action_kind: 'tool_execution',
			approval_id: 'approval_risk',
			status: 'pending',
			summary: 'Approval pending.',
			title: 'Approval required',
			tool_name: 'file.read',
		},
		schema_version: 1,
		type: 'approval_block',
	};

	return {
		...base,
		...overrides,
		payload: {
			...base.payload,
			...(overrides.payload ?? {}),
		},
	};
}

describe('getApprovalRiskLevel', () => {
	it('uses server risk level when present', () => {
		const block = createApprovalBlock({
			payload: {
				risk_level: 'high',
				tool_name: 'file.read',
			},
		});

		expect(getApprovalRiskLevel(block)).toBe('high');
	});

	it('maps high-risk tool names', () => {
		const block = createApprovalBlock({
			payload: {
				tool_name: 'shell.exec',
			},
		});

		expect(getApprovalRiskLevel(block)).toBe('high');
	});

	it('maps medium-risk tool names', () => {
		const block = createApprovalBlock({
			payload: {
				tool_name: 'file.write',
			},
		});

		expect(getApprovalRiskLevel(block)).toBe('medium');
	});

	it('defaults to low risk for unknown tool names', () => {
		const block = createApprovalBlock({
			payload: {
				tool_name: 'file.read',
			},
		});

		expect(getApprovalRiskLevel(block)).toBe('low');
	});
});
