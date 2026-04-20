import { describe, expect, it } from 'vitest';

import { buildApprovalRequestedEvent, buildApprovalResolvedEvent } from './approval-events.js';

describe('approval-events', () => {
	it('builds approval.requested with deterministic ids and carried metadata', () => {
		const metadata = {
			reason: 'write-risk-review',
		};

		const event = buildApprovalRequestedEvent(
			{
				action_kind: 'file_write',
				approval_id: 'approval_event_requested_1',
				call_id: 'call_event_requested_1',
				summary: 'Apply the auth middleware patch.',
				title: 'Approve auth middleware patch',
				tool_name: 'file.write',
			},
			{
				actor: {
					id: 'assistant_approval_event',
					type: 'assistant',
				},
				metadata,
				parent_event_id: 'event_parent_approval_requested_1',
				run_id: 'run_approval_requested_1',
				sequence_no: 3,
				session_id: 'session_approval_requested_1',
				source: {
					id: 'request-approval',
					kind: 'runtime',
				},
				state_after: 'WAITING_APPROVAL',
				state_before: 'MODEL_THINKING',
				timestamp: '2026-04-12T16:00:00.000Z',
				trace_id: 'trace_approval_requested_1',
			},
		);

		expect(event).toEqual({
			actor: {
				id: 'assistant_approval_event',
				type: 'assistant',
			},
			event_id: 'run_approval_requested_1:approval.requested:3',
			event_type: 'approval.requested',
			event_version: 1,
			metadata,
			parent_event_id: 'event_parent_approval_requested_1',
			payload: {
				action_kind: 'file_write',
				approval_id: 'approval_event_requested_1',
				call_id: 'call_event_requested_1',
				summary: 'Apply the auth middleware patch.',
				title: 'Approve auth middleware patch',
				tool_name: 'file.write',
			},
			run_id: 'run_approval_requested_1',
			sequence_no: 3,
			session_id: 'session_approval_requested_1',
			source: {
				id: 'request-approval',
				kind: 'runtime',
			},
			state_after: 'WAITING_APPROVAL',
			state_before: 'MODEL_THINKING',
			timestamp: '2026-04-12T16:00:00.000Z',
			trace_id: 'trace_approval_requested_1',
		});
	});

	it('builds approval.resolved with a terminal decision payload', () => {
		const event = buildApprovalResolvedEvent(
			{
				approval_id: 'approval_event_resolved_1',
				decision: 'rejected',
				note: 'Risk still unclear.',
				resolved_at: '2026-04-12T16:05:00.000Z',
			},
			{
				run_id: 'run_approval_resolved_1',
				sequence_no: 4,
				state_after: 'FAILED',
				state_before: 'WAITING_APPROVAL',
				timestamp: '2026-04-12T16:05:00.000Z',
				trace_id: 'trace_approval_resolved_1',
			},
		);

		expect(event).toEqual({
			event_id: 'run_approval_resolved_1:approval.resolved:4',
			event_type: 'approval.resolved',
			event_version: 1,
			payload: {
				approval_id: 'approval_event_resolved_1',
				decision: 'rejected',
				note: 'Risk still unclear.',
				resolved_at: '2026-04-12T16:05:00.000Z',
			},
			run_id: 'run_approval_resolved_1',
			sequence_no: 4,
			state_after: 'FAILED',
			state_before: 'WAITING_APPROVAL',
			timestamp: '2026-04-12T16:05:00.000Z',
			trace_id: 'trace_approval_resolved_1',
		});
	});
});
