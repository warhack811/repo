import type { RenderBlock } from '@runa/types';
import { describe, expect, it } from 'vitest';

import { deriveCurrentRunProgressSurface } from './current-run-progress.js';
import type { PresentationRunSurface, RunFeedbackState } from './types.js';

const createdAt = '2026-05-05T00:00:00.000Z';

function createSurface(blocks: readonly RenderBlock[]): PresentationRunSurface {
	return {
		blocks,
		run_id: 'run_progress',
		trace_id: 'trace_progress',
	};
}

const infoFeedback: RunFeedbackState = {
	chip_label: 'sürüyor',
	detail: 'Mevcut çalışma burada birinci planda kalır.',
	pending_detail_count: 0,
	run_id: 'run_progress',
	title: 'Çalışma durumu',
	tone: 'info',
	trace_id: 'trace_progress',
};

describe('deriveCurrentRunProgressSurface', () => {
	it('treats restored surfaces with assistant completion as finished', () => {
		const progress = deriveCurrentRunProgressSurface({
			current_presentation_surface: createSurface([
				{
					created_at: createdAt,
					id: 'approval:block',
					payload: {
						action_kind: 'tool_execution',
						approval_id: 'approval_progress',
						status: 'approved',
						summary: 'Approved screenshot.',
						title: 'Approval required',
						tool_name: 'desktop.screenshot',
					},
					schema_version: 1,
					type: 'approval_block',
				},
				{
					created_at: createdAt,
					id: 'timeline:block',
					payload: {
						items: [
							{
								kind: 'assistant_completed',
								label: 'Yanıt tamamlandı',
								state: 'success',
							},
							{
								detail: 'desktop.screenshot completed successfully.',
								kind: 'tool_completed',
								label: 'Ekran görüntüsü alındı',
								state: 'success',
								tool_name: 'desktop.screenshot',
							},
						],
						summary: 'Runa completed the screenshot step.',
						title: 'Çalışma akışı',
					},
					schema_version: 1,
					type: 'run_timeline_block',
				},
			]),
			current_run_feedback: infoFeedback,
			run_summary: undefined,
		});

		expect(progress?.status_tone).toBe('success');
		expect(progress?.phase_items.at(-1)).toEqual({
			label: 'Outcome',
			tone: 'success',
			value: 'Completed',
		});
	});

	it('keeps pending restored approvals in a warning state', () => {
		const progress = deriveCurrentRunProgressSurface({
			current_presentation_surface: createSurface([
				{
					created_at: createdAt,
					id: 'approval:block',
					payload: {
						action_kind: 'tool_execution',
						approval_id: 'approval_progress',
						status: 'pending',
						summary: 'Approve screenshot.',
						title: 'Approval required',
						tool_name: 'desktop.screenshot',
					},
					schema_version: 1,
					type: 'approval_block',
				},
			]),
			current_run_feedback: infoFeedback,
			run_summary: undefined,
		});

		expect(progress?.status_tone).toBe('warning');
	});

	it('treats user approval rejection as a controlled stop instead of a failure', () => {
		const progress = deriveCurrentRunProgressSurface({
			current_presentation_surface: createSurface([
				{
					created_at: createdAt,
					id: 'approval:rejected',
					payload: {
						action_kind: 'tool_execution',
						approval_id: 'approval_rejected',
						status: 'rejected',
						summary: 'Rejected clipboard write.',
						title: 'Approval required',
						tool_name: 'desktop.clipboard.write',
					},
					schema_version: 1,
					type: 'approval_block',
				},
				{
					created_at: createdAt,
					id: 'timeline:rejected',
					payload: {
						items: [
							{
								detail: 'Approval rejected for desktop.clipboard.write.',
								kind: 'approval_resolved',
								label: 'Onay kararı işlendi',
								state: 'rejected',
								tool_name: 'desktop.clipboard.write',
							},
							{
								detail: 'Approval rejected for desktop.clipboard.write.',
								kind: 'run_failed',
								label: 'Run failed',
								state: 'failed',
							},
						],
						summary: 'Runa stopped after approval rejection.',
						title: 'Çalışma akışı',
					},
					schema_version: 1,
					type: 'run_timeline_block',
				},
			]),
			current_run_feedback: {
				...infoFeedback,
				detail: 'Mevcut çalışma başarısız oldu.',
				title: 'Çalışma hata ile bitti',
				tone: 'error',
			},
			run_summary: {
				final_state: 'FAILED',
				has_accepted: true,
				has_presentation_blocks: true,
				has_runtime_event: true,
				latest_runtime_state: 'FAILED',
				provider: 'deepseek',
				run_id: 'run_progress',
				trace_id: 'trace_progress',
			},
		});

		expect(progress?.headline).toBe('Onay reddedildi');
		expect(progress?.detail).toContain('güven kararınla durduruldu');
		expect(progress?.status_tone).toBe('warning');
		expect(progress?.phase_items.at(-1)).toEqual({
			label: 'Outcome',
			tone: 'warning',
			value: 'Stopped',
		});
	});
});
