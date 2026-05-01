import { describe, expect, it } from 'vitest';
import type { RenderBlock, WebSocketServerBridgeMessage } from '../../ws-types';
import { applyRunaBridgeMessage, createRunaUiMessageState } from './runa-adapter';

const baseBlock = {
	created_at: '2026-05-01T00:00:00.000Z',
	schema_version: 1,
} as const;

function applyMessages(messages: readonly WebSocketServerBridgeMessage[]) {
	return messages.reduce(applyRunaBridgeMessage, createRunaUiMessageState()).message;
}

describe('runa-adapter', () => {
	it('appends text.delta chunks into one streaming text part', () => {
		const message = applyMessages([
			{
				payload: {
					provider: 'deepseek',
					run_id: 'run_1',
					trace_id: 'trace_1',
				},
				type: 'run.accepted',
			},
			{
				payload: {
					run_id: 'run_1',
					text_delta: 'Merhaba ',
					trace_id: 'trace_1',
				},
				type: 'text.delta',
			},
			{
				payload: {
					run_id: 'run_1',
					text_delta: 'Runa',
					trace_id: 'trace_1',
				},
				type: 'text.delta',
			},
		]);

		expect(message.parts).toEqual([
			{
				id: 'text:run_1:0',
				text: 'Merhaba Runa',
				type: 'text',
			},
		]);
	});

	it('maps presentation blocks into source and tool parts', () => {
		const blocks: readonly RenderBlock[] = [
			{
				...baseBlock,
				id: 'web_1',
				payload: {
					is_truncated: false,
					query: 'runa ui stack',
					results: [
						{
							snippet: 'A source snippet',
							source: 'TechCrunch',
							title: 'Runa source',
							trust_tier: 'reputable',
							url: 'https://techcrunch.com/runa',
						},
					],
					search_provider: 'mock',
					summary: '1 result',
					title: 'Sources',
				},
				type: 'web_search_result_block',
			},
			{
				...baseBlock,
				id: 'tool_1',
				payload: {
					call_id: 'call_1',
					status: 'success',
					summary: 'Tool completed',
					tool_name: 'web.search',
				},
				type: 'tool_result',
			},
		];
		const message = applyMessages([
			{
				payload: {
					blocks,
					run_id: 'run_1',
					trace_id: 'trace_1',
				},
				type: 'presentation.blocks',
			},
		]);

		expect(message.parts[0]?.type).toBe('source');
		expect(message.parts[1]).toMatchObject({
			state: 'output-available',
			toolName: 'web.search',
			type: 'tool',
		});
	});

	it('marks failed runs with an error part and completed runs with completion state', () => {
		const failed = applyMessages([
			{
				payload: {
					error_message: 'Boom',
					error_name: 'Error',
					run_id: 'run_1',
					trace_id: 'trace_1',
				},
				type: 'run.rejected',
			},
		]);
		const completed = applyRunaBridgeMessage(
			{ message: failed },
			{
				payload: {
					final_state: 'COMPLETED',
					run_id: 'run_1',
					status: 'completed',
					trace_id: 'trace_1',
				},
				type: 'run.finished',
			},
		).message;

		expect(failed.status).toBe('failed');
		expect(failed.parts.at(-1)).toMatchObject({ error: 'Boom', type: 'error' });
		expect(completed.status).toBe('completed');
		expect(completed.parts.at(-1)).toMatchObject({
			finalState: 'COMPLETED',
			type: 'completion',
		});
	});
});
