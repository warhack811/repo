import type { ModelRequest } from '@runa/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GatewayConfigurationError } from '../gateway/errors.js';
import { runWithProvider } from './run-with-provider.js';

const groqRequest: ModelRequest = {
	max_output_tokens: 64,
	messages: [
		{ content: 'You are helpful.', role: 'system' },
		{ content: 'Hello from runtime', role: 'user' },
	],
	model: 'llama-3.3-70b-versatile',
	run_id: 'run_groq_runtime',
	trace_id: 'trace_groq_runtime',
};

const claudeRequest: ModelRequest = {
	max_output_tokens: 128,
	messages: [
		{ content: 'You are helpful.', role: 'system' },
		{ content: 'Hello Claude runtime', role: 'user' },
	],
	model: 'claude-sonnet-4-5',
	run_id: 'run_claude_runtime',
	trace_id: 'trace_claude_runtime',
};

function mockJsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		headers: {
			'content-type': 'application/json',
		},
		status,
	});
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('run-with-provider', () => {
	it('completes successfully with a Groq gateway instance from the factory', async () => {
		const fetchMock = vi.fn(async () =>
			mockJsonResponse(200, {
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Groq runtime response',
							role: 'assistant',
						},
					},
				],
				id: 'chatcmpl_runtime_groq',
				model: 'llama-3.3-70b-versatile',
				usage: {
					completion_tokens: 12,
					prompt_tokens: 8,
					total_tokens: 20,
				},
			}),
		);

		vi.stubGlobal('fetch', fetchMock);

		const result = await runWithProvider({
			initial_state: 'INIT',
			provider: 'groq',
			provider_config: {
				apiKey: 'groq-key',
			},
			request: groqRequest,
			run_id: 'run_groq_runtime',
			trace_id: 'trace_groq_runtime',
		});

		expect(result.status).toBe('completed');
		expect(result.final_state).toBe('COMPLETED');

		if (result.status === 'completed') {
			expect(result.response.provider).toBe('groq');
			expect(result.response.message.content).toBe('Groq runtime response');
			expect(result.events.map((event) => event.event_type)).toEqual([
				'run.started',
				'state.entered',
				'model.completed',
				'state.entered',
				'run.completed',
			]);
		}
	});

	it('completes successfully with a Claude gateway instance from the factory', async () => {
		const fetchMock = vi.fn(async () =>
			mockJsonResponse(200, {
				content: [{ text: 'Claude runtime response', type: 'text' }],
				id: 'msg_runtime_claude',
				model: 'claude-sonnet-4-5',
				role: 'assistant',
				stop_reason: 'end_turn',
				usage: {
					input_tokens: 10,
					output_tokens: 14,
				},
			}),
		);

		vi.stubGlobal('fetch', fetchMock);

		const result = await runWithProvider({
			initial_state: 'INIT',
			provider: 'claude',
			provider_config: {
				apiKey: 'claude-key',
			},
			request: claudeRequest,
			run_id: 'run_claude_runtime',
			trace_id: 'trace_claude_runtime',
		});

		expect(result.status).toBe('completed');
		expect(result.final_state).toBe('COMPLETED');

		if (result.status === 'completed') {
			expect(result.response.provider).toBe('claude');
			expect(result.response.message.content).toBe('Claude runtime response');
			expect(result.events.map((event) => event.event_type)).toEqual([
				'run.started',
				'state.entered',
				'model.completed',
				'state.entered',
				'run.completed',
			]);
		}
	});

	it('throws a typed configuration error when provider config is missing an API key', async () => {
		await expect(() =>
			runWithProvider({
				initial_state: 'INIT',
				provider: 'groq',
				provider_config: {
					apiKey: '   ',
				},
				request: groqRequest,
				run_id: 'run_invalid_config',
				trace_id: 'trace_invalid_config',
			}),
		).rejects.toThrowError(GatewayConfigurationError);
	});

	it('returns FAILED when the provider request fails at fetch time', async () => {
		const fetchMock = vi.fn(async () => {
			throw new Error('network unavailable');
		});

		vi.stubGlobal('fetch', fetchMock);

		const result = await runWithProvider({
			initial_state: 'INIT',
			provider: 'groq',
			provider_config: {
				apiKey: 'groq-key',
			},
			request: groqRequest,
			run_id: 'run_fetch_failure',
			trace_id: 'trace_fetch_failure',
		});

		expect(result.status).toBe('failed');
		expect(result.final_state).toBe('FAILED');

		if (result.status === 'failed') {
			expect(result.failure.name).toBe('GatewayRequestError');
			expect(result.failure.message).toContain('network unavailable');
			expect(result.events.map((event) => event.event_type)).toEqual([
				'run.started',
				'state.entered',
				'state.entered',
				'run.failed',
			]);
		}
	});
});
