import type { ModelRequest } from '@runa/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	GatewayConfigurationError,
	GatewayRequestError,
	GatewayResponseError,
	GatewayUnsupportedOperationError,
} from './errors.js';
import { createModelGateway } from './factory.js';
import { buildProviderFallbackChain, shouldAttemptProviderFallback } from './fallback-chain.js';
import {
	applyModelRouteToRequest,
	classifyModelRouteIntent,
	resolveModelRoute,
} from './model-router.js';

function createModelRequest(overrides: Partial<ModelRequest> = {}): ModelRequest {
	return {
		messages: [
			{
				content: 'Listeyi incele ve gerekli sonucu ver.',
				role: 'user',
			},
		],
		run_id: 'run_router_test',
		trace_id: 'trace_router_test',
		...overrides,
	};
}

function setEnvVariable(
	name: 'ANTHROPIC_API_KEY' | 'GEMINI_API_KEY' | 'OPENAI_API_KEY',
	value: string | undefined,
): void {
	process.env[name] = value;
}

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
	setEnvVariable('ANTHROPIC_API_KEY', undefined);
	setEnvVariable('GEMINI_API_KEY', undefined);
	setEnvVariable('OPENAI_API_KEY', undefined);
});

describe('model-router helpers', () => {
	it('preserves the requested provider when router metadata is absent', () => {
		const route = resolveModelRoute({
			request: createModelRequest({
				model: 'llama-3.3-70b-versatile',
			}),
			requested_provider: 'groq',
		});

		expect(route).toEqual({
			allow_provider_fallback: false,
			intent: 'balanced',
			reason: 'requested_provider',
			routed_model: 'llama-3.3-70b-versatile',
			routed_provider: 'groq',
		});
	});

	it('classifies explicit tool-heavy metadata without rewriting adapters', () => {
		const request = createModelRequest({
			metadata: {
				model_router: {
					enabled: true,
					intent: 'tool_heavy',
				},
			},
		});

		expect(classifyModelRouteIntent(request)).toBe('tool_heavy');
		expect(
			resolveModelRoute({
				request,
				requested_provider: 'groq',
			}),
		).toMatchObject({
			allow_provider_fallback: true,
			intent: 'tool_heavy',
			reason: 'heuristic_tool_heavy',
			routed_model: 'claude-sonnet-4-5',
			routed_provider: 'claude',
		});
	});

	it('derives a cheap route for short prompt-only requests', () => {
		const route = resolveModelRoute({
			request: createModelRequest({
				metadata: {
					model_router: {
						enabled: true,
					},
				},
				messages: [{ content: 'Merhaba', role: 'user' }],
			}),
			requested_provider: 'openai',
		});

		expect(route).toMatchObject({
			intent: 'cheap',
			reason: 'heuristic_cheap',
			routed_provider: 'groq',
		});
	});

	it('honors an explicit preferred provider when router metadata enables it', () => {
		const route = resolveModelRoute({
			request: createModelRequest({
				metadata: {
					model_router: {
						enabled: true,
						preferred_provider: 'claude',
					},
				},
			}),
			requested_provider: 'groq',
		});

		expect(route).toMatchObject({
			reason: 'explicit_preferred_provider',
			routed_model: 'claude-sonnet-4-5',
			routed_provider: 'claude',
		});
	});

	it('applies the routed model onto the request payload', () => {
		const updatedRequest = applyModelRouteToRequest(
			createModelRequest({
				model: 'llama-3.3-70b-versatile',
			}),
			{
				allow_provider_fallback: true,
				intent: 'deep_reasoning',
				reason: 'heuristic_deep_reasoning',
				routed_model: 'claude-sonnet-4-5',
				routed_provider: 'claude',
			},
		);

		expect(updatedRequest.model).toBe('claude-sonnet-4-5');
	});
});

describe('fallback-chain helpers', () => {
	it('keeps the requested provider near the front when routing away from it', () => {
		expect(
			buildProviderFallbackChain({
				allow_provider_fallback: true,
				intent: 'tool_heavy',
				requested_provider: 'groq',
				routed_provider: 'claude',
			}),
		).toEqual(['groq', 'openai', 'gemini']);
	});

	it('attempts fallback only for provider/configuration failures', () => {
		expect(shouldAttemptProviderFallback(new GatewayConfigurationError('missing'))).toBe(true);
		expect(shouldAttemptProviderFallback(new GatewayRequestError('groq', 'network'))).toBe(true);
		expect(shouldAttemptProviderFallback(new GatewayResponseError('groq', 'bad response'))).toBe(
			true,
		);
		expect(
			shouldAttemptProviderFallback(
				new GatewayUnsupportedOperationError('groq', 'stream', 'unsupported'),
			),
		).toBe(false);
	});
});

describe('router-aware gateway factory', () => {
	it('falls back to the requested provider when the routed provider is unavailable', async () => {
		const calls: string[] = [];

		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				calls.push(url);

				return mockJsonResponse(200, {
					choices: [
						{
							finish_reason: 'stop',
							message: {
								content: 'Hello from Groq',
								role: 'assistant',
							},
						},
					],
					id: 'chatcmpl_router_groq',
					model: 'llama-3.3-70b-versatile',
				});
			}),
		);

		const gateway = createModelGateway({
			config: {
				apiKey: 'groq-key',
			},
			provider: 'groq',
		});
		const response = await gateway.generate(
			createModelRequest({
				available_tools: [
					{
						description: 'List files.',
						name: 'file.list',
						parameters: {
							path: {
								required: true,
								type: 'string',
							},
						},
					},
					{
						description: 'Read files.',
						name: 'file.read',
						parameters: {
							path: {
								required: true,
								type: 'string',
							},
						},
					},
				],
				metadata: {
					model_router: {
						enabled: true,
					},
				},
			}),
		);

		expect(calls).toEqual(['https://api.groq.com/openai/v1/chat/completions']);
		expect(response.provider).toBe('groq');
	});
});
