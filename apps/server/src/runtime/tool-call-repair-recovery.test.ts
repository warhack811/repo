import type { ModelRequest, ModelResponse } from '@runa/types';

import { describe, expect, it, vi } from 'vitest';

import {
	TOOL_CALL_REPAIR_RECOVERY_METADATA_KEY,
	createToolCallRepairRecovery,
	isToolCallRepairableError,
} from './tool-call-repair-recovery.js';

function createModelRequest(overrides: Partial<ModelRequest> = {}): ModelRequest {
	return {
		messages: [
			{
				content: 'Call file.read.',
				role: 'user',
			},
		],
		run_id: 'run_tool_call_repair_recovery',
		trace_id: 'trace_tool_call_repair_recovery',
		...overrides,
	};
}

function createModelResponse(): ModelResponse {
	return {
		finish_reason: 'stop',
		message: {
			content: 'Recovered.',
			role: 'assistant',
		},
		model: 'deepseek-chat',
		provider: 'deepseek',
	};
}

function createGatewayResponseErrorShape(
	reason: 'invalid_tool_name' | 'missing_call_id' | 'unparseable_tool_input',
): Error & {
	readonly details: Readonly<Record<string, unknown>>;
	readonly name: 'GatewayResponseError';
} {
	const error = new Error(`DeepSeek rejected tool call: ${reason}`);

	return Object.assign(error, {
		details: {
			arguments_length: 17,
			call_id_present: true,
			reason,
			tool_name_raw: 'file.read',
			tool_name_resolved: 'file.read',
		},
		name: 'GatewayResponseError' as const,
	});
}

describe('tool-call-repair-recovery', () => {
	describe('isToolCallRepairableError', () => {
		it('detects DeepSeek-style unparseable tool input GatewayResponseError shapes', () => {
			expect(
				isToolCallRepairableError(createGatewayResponseErrorShape('unparseable_tool_input')),
			).toBe(true);
		});

		it('does not recover missing call id or invalid tool name rejections', () => {
			expect(isToolCallRepairableError(createGatewayResponseErrorShape('missing_call_id'))).toBe(
				false,
			);
			expect(isToolCallRepairableError(createGatewayResponseErrorShape('invalid_tool_name'))).toBe(
				false,
			);
		});

		it('does not recover plain errors or GatewayResponseError shapes without details', () => {
			expect(isToolCallRepairableError(new Error('gateway unavailable'))).toBe(false);
			expect(
				isToolCallRepairableError(
					Object.assign(new Error('missing details'), {
						details: undefined,
						name: 'GatewayResponseError',
					}),
				),
			).toBe(false);
		});
	});

	describe('evaluate', () => {
		it('returns no_recovery for non-repairable errors', async () => {
			const recovery = createToolCallRepairRecovery();

			const decision = await recovery.evaluate({
				error: new Error('gateway unavailable'),
				model_request: createModelRequest(),
			});

			expect(decision).toEqual({
				reason: 'not_repairable_error',
				status: 'no_recovery',
			});
		});

		it('returns unrecoverable when retry budget is exhausted', async () => {
			const recovery = createToolCallRepairRecovery();

			const decision = await recovery.evaluate({
				error: createGatewayResponseErrorShape('unparseable_tool_input'),
				model_request: createModelRequest(),
				retry_count: 1,
			});

			expect(decision).toEqual({
				reason: 'retry_budget_exhausted',
				status: 'unrecoverable',
			});
		});

		it('schedules a repair retry with a trailing system message and metadata stamp', async () => {
			const recovery = createToolCallRepairRecovery();
			const modelRequest = createModelRequest({
				metadata: {
					source: 'test',
				},
			});

			const decision = await recovery.evaluate({
				error: createGatewayResponseErrorShape('unparseable_tool_input'),
				model_request: modelRequest,
			});

			expect(decision.status).toBe('repair_retry_scheduled');

			if (decision.status !== 'repair_retry_scheduled') {
				throw new Error('Expected repair retry decision.');
			}

			expect(decision.repaired_model_request.messages).toHaveLength(2);
			expect(decision.repaired_model_request.messages.at(-1)).toEqual({
				content: expect.stringContaining('strictly JSON-parseable arguments object'),
				role: 'system',
			});
			expect(decision.recovery_metadata).toEqual({
				retry_count: 1,
				tool_call_repair_error: {
					arguments_length: 17,
					reason: 'unparseable_tool_input',
					tool_name_raw: 'file.read',
					tool_name_resolved: 'file.read',
				},
			});
			expect(decision.repaired_model_request.metadata).toEqual({
				source: 'test',
				[TOOL_CALL_REPAIR_RECOVERY_METADATA_KEY]: decision.recovery_metadata,
			});
		});
	});

	describe('recover', () => {
		it('recovers successfully when the repaired retry returns a clean response', async () => {
			const recovery = createToolCallRepairRecovery();
			const retryExecutor = vi.fn(async (): Promise<ModelResponse> => createModelResponse());

			const result = await recovery.recover({
				error: createGatewayResponseErrorShape('unparseable_tool_input'),
				model_request: createModelRequest(),
				retry_executor: retryExecutor,
			});

			expect(result.status).toBe('recovered');

			if (result.status !== 'recovered') {
				throw new Error('Expected recovered tool call repair result.');
			}

			expect(retryExecutor).toHaveBeenCalledTimes(1);
			expect(result.model_response.message.content).toBe('Recovered.');
			expect(result.retry_count).toBe(1);
			expect(result.model_request.messages.at(-1)).toMatchObject({
				role: 'system',
			});
		});

		it('returns retry_still_unparseable when the repaired retry hits the same rejection', async () => {
			const recovery = createToolCallRepairRecovery();

			const result = await recovery.recover({
				error: createGatewayResponseErrorShape('unparseable_tool_input'),
				model_request: createModelRequest(),
				retry_executor: async () => {
					throw createGatewayResponseErrorShape('unparseable_tool_input');
				},
			});

			expect(result).toMatchObject({
				reason: 'retry_still_unparseable',
				retry_count: 1,
				status: 'unrecoverable',
			});
		});

		it('returns retry_failed when the repaired retry fails differently', async () => {
			const recovery = createToolCallRepairRecovery();

			const result = await recovery.recover({
				error: createGatewayResponseErrorShape('unparseable_tool_input'),
				model_request: createModelRequest(),
				retry_executor: async () => {
					throw new Error('gateway unavailable');
				},
			});

			expect(result).toMatchObject({
				reason: 'retry_failed',
				retry_count: 1,
				status: 'unrecoverable',
			});
		});
	});
});
