import type { RenderBlock } from '@runa/types';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { WorkNarrationBlock } from './WorkNarrationBlock.js';

type WorkNarrationRenderBlock = Extract<RenderBlock, { type: 'work_narration' }>;

function createWorkNarrationBlock(
	payload: Partial<WorkNarrationRenderBlock['payload']> = {},
): WorkNarrationRenderBlock {
	return {
		created_at: '2026-05-05T10:00:00.000Z',
		id: 'narration_001',
		payload: {
			locale: 'tr',
			run_id: 'run_hidden',
			sequence_no: 1,
			status: 'completed',
			text: 'Checking package.json now.',
			turn_index: 1,
			...payload,
		},
		schema_version: 1,
		type: 'work_narration',
	};
}

describe('WorkNarrationBlock', () => {
	it('renders streaming narration as polite muted text', () => {
		const markup = renderToStaticMarkup(
			<WorkNarrationBlock
				block={createWorkNarrationBlock({
					status: 'streaming',
					text: 'Checking files now.',
				})}
			/>,
		);

		expect(markup).toContain('aria-live="polite"');
		expect(markup).toContain('Checking files now.');
		expect(markup).toContain('lucide-loader-circle');
		expect(markup).not.toContain('run_hidden');
		expect(markup).not.toContain('narration_001');
	});

	it('renders completed live narration without streaming aria churn', () => {
		const markup = renderToStaticMarkup(<WorkNarrationBlock block={createWorkNarrationBlock()} />);

		expect(markup).toContain('Checking package.json now.');
		expect(markup).toContain('lucide-circle-check');
		expect(markup).not.toContain('_replay_');
		expect(markup).not.toContain('aria-live');
	});

	it('marks replay narration with the replay visual state', () => {
		const markup = renderToStaticMarkup(
			<WorkNarrationBlock block={createWorkNarrationBlock()} replayMode />,
		);

		expect(markup).toContain('_replay_');
		expect(markup).toContain('Checking package.json now.');
	});

	it('renders the canonical payload-based persisted shape without exposing metadata', () => {
		const persistedBlock: WorkNarrationRenderBlock = {
			created_at: '2026-05-05T12:00:00.000Z',
			id: 'narration_payload_contract',
			payload: {
				linked_tool_call_id: 'call_payload_contract',
				locale: 'tr',
				run_id: 'run_payload_contract',
				sequence_no: 42,
				status: 'completed',
				text: 'package.json dosyasini kontrol ediyorum.',
				turn_index: 3,
			},
			schema_version: 1,
			type: 'work_narration',
		};
		const markup = renderToStaticMarkup(<WorkNarrationBlock block={persistedBlock} replayMode />);

		expect(markup).toContain('package.json dosyasini kontrol ediyorum.');
		expect(markup).toContain('_replay_');
		expect(markup).not.toContain('run_payload_contract');
		expect(markup).not.toContain('call_payload_contract');
		expect(markup).not.toContain('narration_payload_contract');
		expect(markup).not.toContain('42');
	});

	it('renders tool_failed as a muted warning without duplicating technical error text', () => {
		const markup = renderToStaticMarkup(
			<WorkNarrationBlock
				block={createWorkNarrationBlock({
					status: 'tool_failed',
					text: 'Running the command now.',
				})}
			/>,
		);

		expect(markup).toContain('_toolFailed_');
		expect(markup).toContain('lucide-triangle-alert');
		expect(markup).toContain('Running the command now.');
		expect(markup).not.toContain('ENOENT');
		expect(markup).not.toContain('call_');
	});

	it('hides superseded narration blocks', () => {
		const markup = renderToStaticMarkup(
			<WorkNarrationBlock
				block={createWorkNarrationBlock({
					status: 'superseded',
					text: 'This text should stay hidden.',
				})}
			/>,
		);

		expect(markup).toBe('');
	});

	it('escapes raw HTML instead of rendering it', () => {
		const markup = renderToStaticMarkup(
			<WorkNarrationBlock
				block={createWorkNarrationBlock({
					text: '<strong>file</strong> read.',
				})}
			/>,
		);

		expect(markup).toContain('&lt;strong&gt;file&lt;/strong&gt; read.');
		expect(markup).not.toContain('<strong>file</strong>');
	});
});
