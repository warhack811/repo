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
});
