import { describe, expect, it } from 'vitest';

import type { ConversationMessage } from '../hooks/useConversations.js';
import { normalizePresentationSurface } from '../lib/chat-runtime/normalize-presentation-surface.js';
import type { PresentationRunSurface } from '../lib/chat-runtime/types.js';
import type { RenderBlock } from '../ws-types.js';

function createTextBlock(id: string, text: string): RenderBlock {
	return {
		created_at: '2026-05-02T12:00:00.000Z',
		id,
		payload: {
			text,
		},
		schema_version: 1,
		type: 'text',
	};
}

function createStatusBlock(id: string): RenderBlock {
	return {
		created_at: '2026-05-02T12:00:01.000Z',
		id,
		payload: {
			level: 'success',
			message: 'Çalışma tamamlandı.',
		},
		schema_version: 1,
		type: 'status',
	};
}

function createAssistantMessage(input: {
	readonly content: string;
	readonly runId: string;
}): ConversationMessage {
	return {
		content: input.content,
		conversation_id: 'conversation_1',
		created_at: '2026-05-02T12:00:02.000Z',
		message_id: 'message_1',
		role: 'assistant',
		run_id: input.runId,
		sequence_no: 2,
	};
}

describe('normalizePresentationSurface', () => {
	it('removes current-run text blocks that already exist in the persisted assistant transcript', () => {
		const surface: PresentationRunSurface = {
			blocks: [createTextBlock('text_1', 'Selam! Nasıl yardımcı olabilirim?')],
			run_id: 'run_1',
			trace_id: 'trace_1',
		};

		expect(
			normalizePresentationSurface(surface, [
				createAssistantMessage({
					content: 'Selam! Nasıl yardımcı olabilirim?',
					runId: 'run_1',
				}),
			]),
		).toBeNull();
	});

	it('keeps non-text support blocks even when the assistant text was persisted', () => {
		const surface: PresentationRunSurface = {
			blocks: [
				createTextBlock('text_1', 'Selam! Nasıl yardımcı olabilirim?'),
				createStatusBlock('status_1'),
			],
			run_id: 'run_1',
			trace_id: 'trace_1',
		};

		expect(
			normalizePresentationSurface(surface, [
				createAssistantMessage({
					content: 'Selam! Nasıl yardımcı olabilirim?',
					runId: 'run_1',
				}),
			])?.blocks,
		).toEqual([createStatusBlock('status_1')]);
	});
});
