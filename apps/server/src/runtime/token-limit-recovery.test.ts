import type { ModelRequest, ModelResponse } from '@runa/types';

import { describe, expect, it, vi } from 'vitest';

import { createMicrocompactStrategy } from '../context/compaction-strategies.js';
import {
	TOKEN_LIMIT_RECOVERY_METADATA_KEY,
	type TokenLimitRecoveryEvent,
	createTokenLimitRecovery,
	isTokenLimitError,
} from './token-limit-recovery.js';

function createCompiledContextRequest(): ModelRequest {
	return {
		compiled_context: {
			layers: [
				{
					content: {
						principles: ['Use typed contracts.', 'Prefer deterministic behavior.'],
					},
					kind: 'instruction',
					name: 'core_rules',
				},
				{
					content: {
						current_state: 'MODEL_THINKING',
						run_id: 'run_token_limit_recovery',
						trace_id: 'trace_token_limit_recovery',
					},
					kind: 'runtime',
					name: 'run_layer',
				},
				{
					content: {
						items: [
							{
								content: Array.from({ length: 240 }, (_, index) => `memory-${index}`).join(' '),
								summary: 'Long memory layer',
							},
						],
						layer_type: 'memory_layer',
					},
					kind: 'memory',
					name: 'memory_layer',
				},
				{
					content: {
						summary: Array.from({ length: 240 }, (_, index) => `workspace-${index}`).join(' '),
						title: 'Workspace Overview',
					},
					kind: 'workspace',
					name: 'workspace_layer',
				},
			],
		},
		messages: [
			{
				content: 'Please continue the task.',
				role: 'user',
			},
		],
		run_id: 'run_token_limit_recovery',
		trace_id: 'trace_token_limit_recovery',
	};
}

function createTokenLimitError(): Error & { readonly code: string; readonly status: number } {
	const error = new Error('context window exceeded');

	return Object.assign(error, {
		code: 'CONTEXT_LENGTH_EXCEEDED',
		status: 413,
	});
}

describe('token-limit-recovery', () => {
	it('detects token limit failures from 413/token-limit style error surfaces', () => {
		expect(isTokenLimitError(createTokenLimitError())).toBe(true);
		expect(
			isTokenLimitError({
				message: 'payload too large for model context window',
				statusCode: 413,
			}),
		).toBe(true);
		expect(isTokenLimitError(new Error('gateway unavailable'))).toBe(false);
	});

	it('schedules a compacted retry when a token limit error has compactable context', async () => {
		const recovery = createTokenLimitRecovery({
			compaction_strategy: createMicrocompactStrategy(),
		});

		const decision = await recovery.evaluate({
			compaction_input: {
				target_token_range: {
					max: 320,
					min: 220,
				},
			},
			error: createTokenLimitError(),
			model_request: createCompiledContextRequest(),
		});

		expect(decision.status).toBe('compacted_retry_scheduled');

		if (decision.status !== 'compacted_retry_scheduled') {
			throw new Error('Expected compacted retry decision.');
		}

		expect(
			decision.compacted_model_request.compiled_context?.layers.map((layer) => layer.name),
		).toEqual(['core_rules', 'run_layer', 'microcompact_summary']);
		expect(decision.recovery_metadata).toMatchObject({
			retry_count: 1,
			strategy_name: 'microcompact',
			token_limit_error: {
				code: 'CONTEXT_LENGTH_EXCEEDED',
				status_code: 413,
			},
		});
		expect(
			(
				decision.compacted_model_request.metadata as Readonly<Record<string, unknown>> | undefined
			)?.[TOKEN_LIMIT_RECOVERY_METADATA_KEY],
		).toEqual(decision.recovery_metadata);
	});

	it('recovers successfully when compacted retry execution succeeds', async () => {
		const events: TokenLimitRecoveryEvent[] = [];
		const recovery = createTokenLimitRecovery({
			compaction_strategy: createMicrocompactStrategy(),
			on_event(event) {
				events.push(event);
			},
		});
		const retryExecutor = vi.fn(
			async (request: ModelRequest): Promise<ModelResponse> => ({
				finish_reason: 'stop',
				message: {
					content: `Recovered with ${request.compiled_context?.layers.length ?? 0} layers.`,
					role: 'assistant',
				},
				model: 'claude-recovered',
				provider: 'claude',
			}),
		);

		const result = await recovery.recover({
			compaction_input: {
				target_token_range: {
					max: 320,
					min: 220,
				},
			},
			error: createTokenLimitError(),
			model_request: createCompiledContextRequest(),
			retry_executor: retryExecutor,
		});

		expect(result.status).toBe('recovered');

		if (result.status !== 'recovered') {
			throw new Error('Expected recovered token limit result.');
		}

		expect(retryExecutor).toHaveBeenCalledTimes(1);
		expect(result.model_request.compiled_context?.layers.map((layer) => layer.name)).toEqual([
			'core_rules',
			'run_layer',
			'microcompact_summary',
		]);
		expect(result.model_response.message.content).toBe('Recovered with 3 layers.');
		expect(result.retry_count).toBe(1);
		expect(events.map((event) => event.type)).toEqual(['recovery.attempted', 'recovery.succeeded']);
		expect(events[0]).toMatchObject({
			recovery_type: 'token_limit',
			retry_count: 1,
			trigger_error: {
				code: 'CONTEXT_LENGTH_EXCEEDED',
				status_code: 413,
			},
		});
		expect(events[1]).toMatchObject({
			metadata: result.recovery_metadata,
			recovery_type: 'token_limit',
			retry_count: 1,
		});
	});

	it('returns controlled unrecoverable when the compacted retry still hits token limit', async () => {
		const events: TokenLimitRecoveryEvent[] = [];
		const recovery = createTokenLimitRecovery({
			compaction_strategy: createMicrocompactStrategy(),
			on_event(event) {
				events.push(event);
			},
		});

		const result = await recovery.recover({
			compaction_input: {
				target_token_range: {
					max: 320,
					min: 220,
				},
			},
			error: createTokenLimitError(),
			model_request: createCompiledContextRequest(),
			retry_executor: async () => {
				throw createTokenLimitError();
			},
		});

		expect(result).toMatchObject({
			reason: 'retry_still_token_limited',
			retry_count: 1,
			status: 'unrecoverable',
		});
		expect(events.map((event) => event.type)).toEqual(['recovery.attempted', 'recovery.failed']);
		expect(events[1]).toMatchObject({
			reason: 'retry_still_token_limited',
			recovery_type: 'token_limit',
			retry_count: 1,
		});
	});

	it('does not enter recovery for non-token-limit failures', async () => {
		const recovery = createTokenLimitRecovery({
			compaction_strategy: createMicrocompactStrategy(),
		});
		const retryExecutor = vi.fn();

		const result = await recovery.recover({
			error: new Error('gateway unavailable'),
			model_request: createCompiledContextRequest(),
			retry_executor: retryExecutor,
		});

		expect(result).toEqual({
			decision: {
				reason: 'not_token_limit',
				status: 'no_recovery',
			},
			status: 'no_recovery',
		});
		expect(retryExecutor).not.toHaveBeenCalled();
	});
});
