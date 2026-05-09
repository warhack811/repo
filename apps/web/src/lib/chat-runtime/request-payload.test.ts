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
		expect(payload.approval_policy).toEqual({
			mode: 'standard',
		});
	});

	it('sends the selected approval mode in the run payload', () => {
		const payload = createRunRequestPayload({
			apiKey: 'test-key',
			approvalMode: 'trusted-session',
			includePresentationBlocks: true,
			model: 'deepseek-chat',
			prompt: 'Read the workspace summary.',
			provider: 'deepseek',
			runId: 'run_approval_mode',
			traceId: 'trace_approval_mode',
		});

		expect(payload.approval_policy).toEqual({
			mode: 'trusted-session',
		});
	});

	it('infers English locale from the outgoing user prompt', () => {
		const payload = createRunRequestPayload({
			apiKey: 'test-key',
			includePresentationBlocks: true,
			model: 'deepseek-chat',
			prompt: 'Please check package.json and find the dev command.',
			provider: 'deepseek',
			runId: 'run_locale_en',
			traceId: 'trace_locale_en',
		});

		expect(payload.locale).toBe('en');
	});

	it('infers Turkish locale from the outgoing user prompt', () => {
		const payload = createRunRequestPayload({
			apiKey: 'test-key',
			includePresentationBlocks: true,
			model: 'deepseek-chat',
			prompt: 'Lütfen package.json dosyasını kontrol et.',
			provider: 'deepseek',
			runId: 'run_locale_tr',
			traceId: 'trace_locale_tr',
		});

		expect(payload.locale).toBe('tr');
	});

	it('lets an explicit locale override prompt inference', () => {
		const payload = createRunRequestPayload({
			apiKey: 'test-key',
			includePresentationBlocks: true,
			locale: 'en',
			model: 'deepseek-chat',
			prompt: 'Lütfen package.json dosyasını kontrol et.',
			provider: 'deepseek',
			runId: 'run_locale_override',
			traceId: 'trace_locale_override',
		});

		expect(payload.locale).toBe('en');
	});

	it('includes the selected working directory when provided', () => {
		const payload = createRunRequestPayload({
			apiKey: 'test-key',
			includePresentationBlocks: true,
			model: 'deepseek-chat',
			prompt: 'Read project files.',
			provider: 'deepseek',
			runId: 'run_working_directory',
			traceId: 'trace_working_directory',
			workingDirectory: 'apps/web',
		});

		expect(payload.working_directory).toBe('apps/web');
	});
});
