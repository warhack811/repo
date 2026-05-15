import type { RenderBlock } from '@runa/types';
import { describe, expect, it } from 'vitest';

import {
	adaptApprovalBlock,
	adaptRunTimelineBlock,
	adaptToolResultBlock,
} from './runActivityAdapter.js';

const createdAt = '2026-05-15T11:00:00.000Z';

describe('runActivityAdapter', () => {
	it('maps timeline items into readable activity rows', () => {
		const block: Extract<RenderBlock, { type: 'run_timeline_block' }> = {
			created_at: createdAt,
			id: 'timeline:block',
			payload: {
				items: [
					{
						kind: 'run_started',
						label: 'Run started',
						state: 'active',
					},
				],
				summary: 'Timeline summary',
				title: 'Run Timeline',
			},
			schema_version: 1,
			type: 'run_timeline_block',
		};

		const rows = adaptRunTimelineBlock(block, false);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			kind: 'timeline',
			status: 'running',
			title: 'Runa işi başlattı',
		});
	});

	it('maps successful tool results as collapsed-ready rows', () => {
		const block: Extract<RenderBlock, { type: 'tool_result' }> = {
			created_at: createdAt,
			id: 'tool:success',
			payload: {
				call_id: 'call_success',
				status: 'success',
				summary: 'file.read completed successfully.',
				tool_name: 'file.read',
				user_label_tr: 'Dosya okuma',
			},
			schema_version: 1,
			type: 'tool_result',
		};

		const row = adaptToolResultBlock(block, false);
		expect(row.kind).toBe('tool');
		expect(row.status).toBe('success');
		expect(row.title).toContain('Dosya okuma');
		expect(row.detail).toContain('tamamlandı');
		expect(row.developerDetail).toBeUndefined();
	});

	it('maps failed tool results into error rows', () => {
		const block: Extract<RenderBlock, { type: 'tool_result' }> = {
			created_at: createdAt,
			id: 'tool:error',
			payload: {
				call_id: 'call_error',
				error_message: 'Failure',
				status: 'error',
				summary: 'command failed',
				tool_name: 'shell.exec',
			},
			schema_version: 1,
			type: 'tool_result',
		};

		const row = adaptToolResultBlock(block, false);
		expect(row.kind).toBe('tool');
		expect(row.status).toBe('error');
		expect(row.title).toContain('tamamlanamadı');
	});

	it('maps pending approval into inline action row', () => {
		const block: Extract<RenderBlock, { type: 'approval_block' }> = {
			created_at: createdAt,
			id: 'approval:pending',
			payload: {
				action_kind: 'file_write',
				approval_id: 'approval_pending',
				status: 'pending',
				summary: 'Approve write',
				target_kind: 'file_path',
				target_label: 'apps/web/src/main.ts',
				title: 'Approval required',
				tool_name: 'file.write',
			},
			schema_version: 1,
			type: 'approval_block',
		};

		const row = adaptApprovalBlock(block, false, true);
		expect(row.kind).toBe('approval');
		if (row.kind !== 'approval') {
			throw new Error('Expected approval row.');
		}
		expect(row.status).toBe('pending');
		expect(row.canResolve).toBe(true);
		expect(row.title).toBe('İzin gerekiyor');
		expect(row.targetLabel).toContain('apps/web/src/main.ts');
	});

	it('maps resolved approval states into compact rows', () => {
		const approved: Extract<RenderBlock, { type: 'approval_block' }> = {
			created_at: createdAt,
			id: 'approval:approved',
			payload: {
				action_kind: 'tool_execution',
				approval_id: 'approval_ok',
				status: 'approved',
				summary: 'Approved',
				title: 'Approved',
			},
			schema_version: 1,
			type: 'approval_block',
		};

		const rejected: Extract<RenderBlock, { type: 'approval_block' }> = {
			...approved,
			id: 'approval:rejected',
			payload: { ...approved.payload, status: 'rejected' },
		};
		const expired: Extract<RenderBlock, { type: 'approval_block' }> = {
			...approved,
			id: 'approval:expired',
			payload: { ...approved.payload, status: 'expired' },
		};

		expect(adaptApprovalBlock(approved, false, false).title).toBe('İzin verildi');
		expect(adaptApprovalBlock(rejected, false, false).title).toBe('Reddedildi');
		expect(adaptApprovalBlock(expired, false, false).title).toBe('Süresi doldu');
	});

	it('keeps technical fields hidden when developer mode is disabled', () => {
		const timeline: Extract<RenderBlock, { type: 'run_timeline_block' }> = {
			created_at: createdAt,
			id: 'timeline:tech',
			payload: {
				items: [
					{
						call_id: 'call_123',
						kind: 'tool_completed',
						label: 'Dosya güncellendi',
						state: 'success',
						tool_name: 'file.write',
					},
				],
				summary: 'Done',
				title: 'Timeline',
			},
			schema_version: 1,
			type: 'run_timeline_block',
		};

		const row = adaptRunTimelineBlock(timeline, false)[0];
		if (!row) {
			throw new Error('Expected at least one timeline row.');
		}
		expect(row.kind).toBe('timeline');
		expect(row.developerDetail).toBeUndefined();
	});
});
