import type { ModelResponse } from '@runa/types';

import { describe, expect, it } from 'vitest';

import { adaptModelResponseToTurnOutcome } from './adapt-model-response-to-turn-outcome.js';

describe('adaptModelResponseToTurnOutcome', () => {
	it('maps a normal assistant response into assistant_response outcome', () => {
		const modelResponse: ModelResponse = {
			finish_reason: 'stop',
			message: {
				content: 'Assistant says hello.',
				role: 'assistant',
			},
			model: 'claude-3-7-sonnet',
			provider: 'claude',
		};

		const result = adaptModelResponseToTurnOutcome({
			model_response: modelResponse,
		});

		expect(result).toEqual({
			outcome: {
				kind: 'assistant_response',
				text: 'Assistant says hello.',
			},
			status: 'completed',
		});
	});

	it('maps a tool call candidate into tool_call outcome', () => {
		const modelResponse: ModelResponse = {
			finish_reason: 'stop',
			message: {
				content: 'Calling file.read',
				role: 'assistant',
			},
			model: 'claude-3-7-sonnet',
			provider: 'claude',
			tool_call_candidate: {
				call_id: 'call_adapter_1',
				tool_input: {
					path: 'src/example.ts',
				},
				tool_name: 'file.read',
			},
		};

		const result = adaptModelResponseToTurnOutcome({
			model_response: modelResponse,
		});

		expect(result).toEqual({
			outcome: {
				call_id: 'call_adapter_1',
				kind: 'tool_call',
				tool_input: {
					path: 'src/example.ts',
				},
				tool_name: 'file.read',
			},
			status: 'completed',
		});
	});

	it('maps tool call candidates into a batched tool_calls outcome', () => {
		const modelResponse: ModelResponse = {
			finish_reason: 'stop',
			message: {
				content: 'Calling multiple tools',
				role: 'assistant',
			},
			model: 'llama-3.3-70b-versatile',
			provider: 'groq',
			tool_call_candidates: [
				{
					call_id: 'call_adapter_batch_1',
					tool_input: {
						path: 'src/example.ts',
					},
					tool_name: 'file.read',
				},
				{
					call_id: 'call_adapter_batch_2',
					tool_input: {
						query: 'Runa',
					},
					tool_name: 'web.search',
				},
			],
		};

		const result = adaptModelResponseToTurnOutcome({
			model_response: modelResponse,
		});

		expect(result).toEqual({
			outcome: {
				kind: 'tool_calls',
				tool_calls: [
					{
						call_id: 'call_adapter_batch_1',
						kind: 'tool_call',
						tool_input: {
							path: 'src/example.ts',
						},
						tool_name: 'file.read',
					},
					{
						call_id: 'call_adapter_batch_2',
						kind: 'tool_call',
						tool_input: {
							query: 'Runa',
						},
						tool_name: 'web.search',
					},
				],
			},
			status: 'completed',
		});
	});

	it('preserves assistant text when no tool call candidate exists', () => {
		const result = adaptModelResponseToTurnOutcome({
			model_response: {
				finish_reason: 'max_tokens',
				message: {
					content: 'A partial assistant answer.',
					role: 'assistant',
				},
				model: 'llama-3.3-70b-versatile',
				provider: 'groq',
			} satisfies ModelResponse,
		});

		expect(result.status).toBe('completed');

		if (result.status !== 'completed') {
			throw new Error('Expected assistant response adaptation to succeed.');
		}

		expect(result.outcome).toEqual({
			kind: 'assistant_response',
			text: 'A partial assistant answer.',
		});
	});

	it('fails clearly for invalid model response shapes', () => {
		const result = adaptModelResponseToTurnOutcome({
			model_response: {
				message: {
					content: 'Missing provider/model',
					role: 'assistant',
				},
			},
		});

		expect(result).toEqual({
			failure: {
				cause: undefined,
				code: 'INVALID_MODEL_RESPONSE',
				message:
					'Model response must include provider, model, finish_reason, and an assistant message.',
			},
			status: 'failed',
		});
	});

	it('fails clearly for invalid tool call candidate shapes', () => {
		const result = adaptModelResponseToTurnOutcome({
			model_response: {
				finish_reason: 'stop',
				message: {
					content: 'Broken tool call candidate',
					role: 'assistant',
				},
				model: 'claude-3-7-sonnet',
				provider: 'claude',
				tool_call_candidate: {
					tool_name: 'file.read',
				},
			},
		});

		expect(result).toEqual({
			failure: {
				cause: undefined,
				code: 'INVALID_TOOL_CALL_CANDIDATE',
				message:
					'Model response tool_call_candidate must include non-empty call_id, tool_name, and tool_input fields.',
			},
			status: 'failed',
		});
	});

	it('fails clearly for invalid tool call candidates array shapes', () => {
		const result = adaptModelResponseToTurnOutcome({
			model_response: {
				finish_reason: 'stop',
				message: {
					content: 'Broken tool call candidates',
					role: 'assistant',
				},
				model: 'llama-3.3-70b-versatile',
				provider: 'groq',
				tool_call_candidates: [
					{
						tool_name: 'file.read',
					},
				],
			},
		});

		expect(result).toEqual({
			failure: {
				cause: undefined,
				code: 'INVALID_TOOL_CALL_CANDIDATE',
				message:
					'Model response tool_call_candidates must include valid non-empty call_id, tool_name, and tool_input fields.',
			},
			status: 'failed',
		});
	});
});
