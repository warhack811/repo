import { describe, expect, it } from 'vitest';

import type { RunRequestPayload } from './messages.js';

import { buildLiveModelRequest } from './live-request.js';

function createRunRequestPayload(): RunRequestPayload {
	return {
		include_presentation_blocks: true,
		provider: 'groq',
		provider_config: {
			apiKey: 'groq-key',
		},
		request: {
			messages: [
				{
					content:
						'You must use the file.read tool to read D:\\ai\\Runa\\README.md before answering. After reading it, answer with exactly Runa.',
					role: 'user',
				},
			],
			model: 'llama-3.3-70b-versatile',
		},
		run_id: 'run_live_request_test',
		trace_id: 'trace_live_request_test',
	};
}

describe('buildLiveModelRequest', () => {
	it('rewrites tool-result follow-up turns so the model continues from the ingested result', async () => {
		const request = await buildLiveModelRequest(createRunRequestPayload(), 'D:/ai/Runa', {
			current_state: 'TOOL_RESULT_INGESTING',
			latest_tool_result: {
				call_id: 'call_live_request_follow_up',
				output: {
					content: '# Runa\n\nREADME body',
					path: 'D:/ai/Runa/README.md',
				},
				status: 'success',
				tool_name: 'file.read',
			},
		});

		expect(request.messages).toEqual([
			{
				content: expect.stringContaining(
					'Continue the same user request using the latest ingested tool result from the runtime context.',
				),
				role: 'user',
			},
		]);
		expect(request.messages[0]?.content).toContain(
			'Original user request: You must use the file.read tool to read D:\\ai\\Runa\\README.md before answering. After reading it, answer with exactly Runa.',
		);
		expect(request.messages[0]?.content).toContain(
			'Do not repeat that same completed tool call just to satisfy the original instruction.',
		);
		expect(request.compiled_context?.layers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'run_layer',
				}),
			]),
		);
	});

	it('keeps the original user turn for initial non-continuation live requests', async () => {
		const request = await buildLiveModelRequest(createRunRequestPayload(), 'D:/ai/Runa');

		expect(request.messages).toEqual([
			{
				content:
					'You must use the file.read tool to read D:\\ai\\Runa\\README.md before answering. After reading it, answer with exactly Runa.',
				role: 'user',
			},
		]);
	});
});
