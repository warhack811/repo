import type { ModelRequest, ModelResponse } from '@runa/types';
import { describe, expect, it } from 'vitest';

import { adaptContextToModelRequest } from '../context/adapt-context-to-model-request.js';
import { composeContext } from '../context/compose-context.js';
import {
	buildModelUsageEventMetadata,
	createModelUsageSummary,
	readModelUsageEventMetadata,
} from './model-usage-accounting.js';

function createModelRequest(overrides: Partial<ModelRequest> = {}): ModelRequest {
	const composedContext = composeContext({
		current_state: 'MODEL_THINKING',
		run_id: 'run_usage_summary',
		trace_id: 'trace_usage_summary',
		working_directory: 'D:/ai/Runa',
	});

	return {
		...adaptContextToModelRequest({
			composed_context: composedContext,
			messages: [
				{
					content: 'Prior assistant summary.',
					role: 'assistant',
				},
			],
			run_id: 'run_usage_summary',
			trace_id: 'trace_usage_summary',
			user_turn: 'Inspect the current usage summary.',
		}),
		available_tools: [
			{
				description: 'Read a file.',
				name: 'file.read',
				parameters: {
					path: {
						required: true,
						type: 'string',
					},
				},
			},
		],
		...overrides,
	};
}

describe('model-usage-accounting', () => {
	it('prefers provider response usage while keeping request accounting approximate', () => {
		const modelRequest = createModelRequest();
		const modelResponse: ModelResponse = {
			finish_reason: 'stop',
			message: {
				content: 'Provider-backed response.',
				role: 'assistant',
			},
			model: 'groq/test-model',
			provider: 'groq',
			usage: {
				input_tokens: 42,
				output_tokens: 18,
				total_tokens: 60,
			},
		};

		const summary = createModelUsageSummary({
			model_request: modelRequest,
			model_response: modelResponse,
		});

		expect(summary.request.measurement).toBe('approximate');
		expect(summary.request.messages.message_count).toBe(2);
		expect(summary.request.available_tools?.tool_count).toBe(1);
		expect(summary.request.compiled_context?.layer_count).toBe(2);
		expect(summary.request.total.token_count).toBeGreaterThan(summary.request.messages.token_count);
		expect(summary.response).toEqual({
			char_count: summary.response.char_count,
			input_tokens: 42,
			measurement: 'provider',
			output_tokens: 18,
			token_count: 60,
		});
		expect(
			readModelUsageEventMetadata(
				buildModelUsageEventMetadata({
					model_request: modelRequest,
					model_response: modelResponse,
				}),
			),
		).toEqual(summary);
	});

	it('falls back to deterministic approximate response usage when provider usage is absent', () => {
		const modelRequest = createModelRequest();
		const modelResponse: ModelResponse = {
			finish_reason: 'stop',
			message: {
				content: '',
				role: 'assistant',
			},
			model: 'claude/test-model',
			provider: 'claude',
			tool_call_candidate: {
				call_id: 'call_usage_tool',
				tool_input: {
					path: 'src/example.ts',
				},
				tool_name: 'file.read',
			},
		};

		const summary = createModelUsageSummary({
			model_request: modelRequest,
			model_response: modelResponse,
		});

		expect(summary.response.measurement).toBe('approximate');
		expect(summary.response.input_tokens).toBeUndefined();
		expect(summary.response.output_tokens).toBeUndefined();
		expect(summary.response.token_count).toBeGreaterThan(0);
	});
});
