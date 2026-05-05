import { describe, expect, it, vi } from 'vitest';

import {
	type ReasoningTraceRecordWriter,
	cleanupExpiredReasoningTraces,
	persistReasoningTrace,
} from './reasoning-store.js';

function createMockWriter(cleanupResult = 2): {
	readonly cleanupExpired: ReturnType<typeof vi.fn<ReasoningTraceRecordWriter['cleanupExpired']>>;
	readonly insert: ReturnType<typeof vi.fn<ReasoningTraceRecordWriter['insert']>>;
	readonly records: Array<Parameters<ReasoningTraceRecordWriter['insert']>[0]>;
	readonly writer: ReasoningTraceRecordWriter;
} {
	const records: Array<Parameters<ReasoningTraceRecordWriter['insert']>[0]> = [];
	const insert = vi.fn<ReasoningTraceRecordWriter['insert']>(async (record) => {
		records.push(record);
	});
	const cleanupExpired = vi.fn<ReasoningTraceRecordWriter['cleanupExpired']>(
		async () => cleanupResult,
	);

	return {
		cleanupExpired,
		insert,
		records,
		writer: {
			cleanupExpired,
			insert,
		},
	};
}

describe('reasoning-store', () => {
	const baseInput = {
		created_at: '2026-05-05T10:00:00.000Z',
		model: 'deepseek-v4-pro',
		provider: 'deepseek',
		reasoning_content: 'internal reasoning',
		run_id: 'run_reasoning',
		trace_id: 'trace_reasoning',
		trace_record_id: 'trace_record_reasoning',
		turn_index: 3,
	} as const;

	it('does not persist reasoning traces unless RUNA_PERSIST_REASONING is enabled', async () => {
		const { insert, writer } = createMockWriter();

		await persistReasoningTrace(baseInput, {
			environment: {},
			writer,
		});

		expect(insert).not.toHaveBeenCalled();
	});

	it('persists reasoning traces with debug_30d retention when enabled', async () => {
		const { records, writer } = createMockWriter();

		await persistReasoningTrace(baseInput, {
			environment: { RUNA_PERSIST_REASONING: '1' },
			writer,
		});

		expect(records).toEqual([
			{
				created_at: '2026-05-05T10:00:00.000Z',
				expires_at: '2026-06-04T10:00:00.000Z',
				model: 'deepseek-v4-pro',
				provider: 'deepseek',
				reasoning_content: 'internal reasoning',
				retention_policy: 'debug_30d',
				run_id: 'run_reasoning',
				trace_id: 'trace_reasoning',
				trace_record_id: 'trace_record_reasoning',
				turn_index: 3,
			},
		]);
	});

	it('supports permanent audit retention without exposing it by default', async () => {
		const { records, writer } = createMockWriter();

		await persistReasoningTrace(
			{
				...baseInput,
				retention_policy: 'permanent_audit',
				trace_record_id: 'trace_record_audit',
			},
			{
				environment: { RUNA_PERSIST_REASONING: '1' },
				writer,
			},
		);

		expect(records[0]).toMatchObject({
			expires_at: '9999-12-31T23:59:59.999Z',
			retention_policy: 'permanent_audit',
			trace_record_id: 'trace_record_audit',
		});
	});

	it('skips blank reasoning content', async () => {
		const { insert, writer } = createMockWriter();

		await persistReasoningTrace(
			{
				...baseInput,
				reasoning_content: '   ',
			},
			{
				environment: { RUNA_PERSIST_REASONING: '1' },
				writer,
			},
		);

		expect(insert).not.toHaveBeenCalled();
	});

	it('cleans up expired traces only when persistence is enabled', async () => {
		const { cleanupExpired, writer } = createMockWriter(4);

		await expect(
			cleanupExpiredReasoningTraces({
				environment: {},
				writer,
			}),
		).resolves.toBe(0);
		expect(cleanupExpired).not.toHaveBeenCalled();

		await expect(
			cleanupExpiredReasoningTraces({
				environment: { RUNA_PERSIST_REASONING: '1' },
				writer,
			}),
		).resolves.toBe(4);
		expect(cleanupExpired).toHaveBeenCalledWith(expect.any(String));
	});
});
