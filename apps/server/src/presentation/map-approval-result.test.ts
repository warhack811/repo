import type { ApprovalRequest, ApprovalResolution } from '@runa/types';

import { describe, expect, it } from 'vitest';

import { mapApprovalRequestToBlock, mapApprovalResolutionToBlock } from './map-approval-result.js';

function createApprovalRequest(overrides?: Partial<ApprovalRequest>): ApprovalRequest {
	return {
		action_kind: 'file_write',
		approval_id: 'approval_block_1',
		call_id: 'call_approval_block_1',
		requested_at: '2026-04-10T20:00:00.000Z',
		run_id: 'run_approval_block_1',
		status: 'pending',
		summary: 'Write changes to src/app.ts',
		target: {
			kind: 'tool_call',
			label: 'Target Workstation',
			tool_name: 'file.write',
		},
		title: 'Approve file write',
		tool_name: 'file.write',
		trace_id: 'trace_approval_block_1',
		...overrides,
	};
}

describe('map-approval-result', () => {
	it('maps an ApprovalRequest into an approval_block', () => {
		expect(mapApprovalRequestToBlock(createApprovalRequest())).toEqual({
			created_at: '2026-04-10T20:00:00.000Z',
			id: 'approval_block:approval_block_1:pending',
			payload: {
				action_kind: 'file_write',
				approval_id: 'approval_block_1',
				call_id: 'call_approval_block_1',
				status: 'pending',
				summary: 'Write changes to src/app.ts',
				target_kind: 'tool_call',
				target_label: 'Target Workstation',
				title: 'Approve file write',
				tool_name: 'file.write',
				user_label_tr: 'Dosya yazma',
				user_summary_tr: 'Belirtilen dosyaya degisiklik yazilir.',
			},
			schema_version: 1,
			type: 'approval_block',
		});
	});

	it('maps an ApprovalResolution into a resolved approval_block', () => {
		const approvalRequest = createApprovalRequest({
			approval_id: 'approval_block_resolved',
		});
		const approvalResolution: ApprovalResolution = {
			approval_id: 'approval_block_resolved',
			decision: {
				approval_id: 'approval_block_resolved',
				decision: 'rejected',
				note: 'Rejected by reviewer',
				reason: 'Mutates workspace',
				resolved_at: '2026-04-10T20:10:00.000Z',
			},
			final_status: 'rejected',
		};

		expect(
			mapApprovalResolutionToBlock({
				approval_request: approvalRequest,
				approval_resolution: approvalResolution,
			}),
		).toEqual({
			created_at: '2026-04-10T20:10:00.000Z',
			id: 'approval_block:approval_block_resolved:rejected',
			payload: {
				action_kind: 'file_write',
				approval_id: 'approval_block_resolved',
				call_id: 'call_approval_block_1',
				decision: 'rejected',
				note: 'Rejected by reviewer',
				status: 'rejected',
				summary: 'Write changes to src/app.ts',
				target_kind: 'tool_call',
				target_label: 'Target Workstation',
				title: 'Approve file write',
				tool_name: 'file.write',
				user_label_tr: 'Dosya yazma',
				user_summary_tr: 'Belirtilen dosyaya degisiklik yazilir.',
			},
			schema_version: 1,
			type: 'approval_block',
		});
	});
});
