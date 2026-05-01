import { describe, expect, it } from 'vitest';

import { DEFAULT_CHAT_MAX_OUTPUT_TOKENS, createRunRequestPayload } from './request-payload.js';

describe('createRunRequestPayload', () => {
	it('uses a chat-sized default output budget', () => {
		const payload = createRunRequestPayload({
			apiKey: 'test-key',
			includePresentationBlocks: true,
			model: 'deepseek-chat',
			prompt: 'Write current news.',
			provider: 'deepseek',
			runId: 'run_default_budget',
			traceId: 'trace_default_budget',
		});

		expect(payload.request.max_output_tokens).toBe(DEFAULT_CHAT_MAX_OUTPUT_TOKENS);
		expect(payload.request.max_output_tokens).toBeGreaterThanOrEqual(2048);
	});
});
