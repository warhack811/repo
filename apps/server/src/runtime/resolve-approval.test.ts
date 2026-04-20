import type { ApprovalRequest } from '@runa/types';

import { describe, expect, it } from 'vitest';

import { resolveApproval } from './resolve-approval.js';

function createPendingApprovalRequest(overrides?: Partial<ApprovalRequest>): ApprovalRequest {
	return {
		action_kind: 'file_write',
		approval_id: 'approval_runtime_resolution_1',
		call_id: 'call_runtime_resolution_1',
		requested_at: '2026-04-10T19:00:00.000Z',
		run_id: 'run_runtime_resolution_1',
		status: 'pending',
		summary: 'Write changes to src/app.ts',
		title: 'Approve file write',
		tool_name: 'file.write',
		trace_id: 'trace_runtime_resolution_1',
		...overrides,
	};
}

describe('resolveApproval', () => {
	it('returns MODEL_THINKING for approved decisions', () => {
		const result = resolveApproval({
			approval_request: createPendingApprovalRequest(),
			current_state: 'WAITING_APPROVAL',
			decision: 'approved',
			event_context: {
				sequence_no: 11,
				timestamp: '2026-04-10T19:05:00.000Z',
			},
			run_id: 'run_runtime_resolution_1',
			trace_id: 'trace_runtime_resolution_1',
		});

		expect(result.status).toBe('approved');

		if (result.status !== 'approved') {
			throw new Error('Expected approved result.');
		}

		expect(result.final_state).toBe('MODEL_THINKING');
		expect(result.state_transitions).toEqual([{ from: 'WAITING_APPROVAL', to: 'MODEL_THINKING' }]);
		expect(result.approval_resolution).toEqual({
			approval_id: 'approval_runtime_resolution_1',
			decision: {
				approval_id: 'approval_runtime_resolution_1',
				decision: 'approved',
				note: undefined,
				reason: undefined,
				resolved_at: '2026-04-10T19:05:00.000Z',
			},
			final_status: 'approved',
		});
		expect(result.approval_event.event_type).toBe('approval.resolved');
		expect(result.approval_event.run_id).toBe('run_runtime_resolution_1');
		expect(result.approval_event.trace_id).toBe('trace_runtime_resolution_1');
		expect(result.approval_event.payload).toEqual({
			approval_id: 'approval_runtime_resolution_1',
			decision: 'approved',
			note: undefined,
			resolved_at: '2026-04-10T19:05:00.000Z',
		});
	});

	it('returns FAILED for rejected decisions and preserves note/reason', () => {
		const result = resolveApproval({
			approval_request: createPendingApprovalRequest({
				approval_id: 'approval_runtime_resolution_reject',
				run_id: 'run_runtime_resolution_reject',
				trace_id: 'trace_runtime_resolution_reject',
			}),
			current_state: 'WAITING_APPROVAL',
			decision: 'rejected',
			note: 'Rejected by reviewer',
			reason: 'Command mutates workspace unexpectedly',
			run_id: 'run_runtime_resolution_reject',
			trace_id: 'trace_runtime_resolution_reject',
		});

		expect(result.status).toBe('rejected');

		if (result.status !== 'rejected') {
			throw new Error('Expected rejected result.');
		}

		expect(result.final_state).toBe('FAILED');
		expect(result.state_transitions).toEqual([{ from: 'WAITING_APPROVAL', to: 'FAILED' }]);
		expect(result.approval_resolution).toEqual({
			approval_id: 'approval_runtime_resolution_reject',
			decision: {
				approval_id: 'approval_runtime_resolution_reject',
				decision: 'rejected',
				note: 'Rejected by reviewer',
				reason: 'Command mutates workspace unexpectedly',
				resolved_at: result.approval_resolution.decision.resolved_at,
			},
			final_status: 'rejected',
		});
		expect(result.approval_event.payload).toEqual({
			approval_id: 'approval_runtime_resolution_reject',
			decision: 'rejected',
			note: 'Rejected by reviewer',
			resolved_at: result.approval_resolution.decision.resolved_at,
		});
	});

	it('returns an explicit failure for invalid starting states', () => {
		const result = resolveApproval({
			approval_request: createPendingApprovalRequest(),
			current_state: 'MODEL_THINKING',
			decision: 'approved',
			run_id: 'run_runtime_resolution_invalid',
			trace_id: 'trace_runtime_resolution_invalid',
		});

		expect(result).toEqual({
			failure: {
				code: 'INVALID_CURRENT_STATE',
				message: 'resolveApproval expects WAITING_APPROVAL but received MODEL_THINKING',
			},
			final_state: 'FAILED',
			state_transitions: [],
			status: 'failed',
		});
	});

	it('rejects resolution requests from COMPLETED', () => {
		const result = resolveApproval({
			approval_request: createPendingApprovalRequest(),
			current_state: 'COMPLETED',
			decision: 'rejected',
			run_id: 'run_runtime_resolution_completed',
			trace_id: 'trace_runtime_resolution_completed',
		});

		expect(result.status).toBe('failed');

		if (result.status !== 'failed') {
			throw new Error('Expected invalid state failure.');
		}

		expect(result.failure.code).toBe('INVALID_CURRENT_STATE');
		expect(result.failure.message).toBe(
			'resolveApproval expects WAITING_APPROVAL but received COMPLETED',
		);
		expect(result.final_state).toBe('FAILED');
		expect(result.state_transitions).toEqual([]);
	});
});
