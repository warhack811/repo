import type { MemoryRecord, MemoryScope } from '@runa/types';

import { describe, expect, it } from 'vitest';

import {
	MemoryStoreConfigurationError,
	MemoryStoreReadError,
} from '../persistence/memory-store.js';

import { composeMemoryContext } from './compose-memory-context.js';

function createMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
	return {
		content: 'Use pnpm for package management.',
		created_at: '2026-04-11T16:00:00.000Z',
		memory_id: 'memory_context_1',
		scope: 'workspace',
		scope_id: 'workspace_1',
		source_kind: 'tool_result',
		source_run_id: 'run_memory_context_1',
		source_trace_id: 'trace_memory_context_1',
		status: 'active',
		summary: 'Workspace uses pnpm.',
		updated_at: '2026-04-11T16:10:00.000Z',
		...overrides,
	};
}

function createMemoryStore(records: readonly MemoryRecord[]) {
	return {
		async listActiveMemories(scope: MemoryScope, scope_id: string) {
			return records.filter((record) => record.scope === scope && record.scope_id === scope_id);
		},
	};
}

describe('composeMemoryContext', () => {
	it('creates a deterministic memory layer from active memories', async () => {
		const result = await composeMemoryContext({
			memory_store: createMemoryStore([
				createMemoryRecord({
					content: 'User prefers blocker-first summaries.',
					memory_id: 'memory_context_2',
					scope: 'user',
					scope_id: 'user_1',
					source_kind: 'user_explicit',
					summary: 'User prefers blocker-first summaries.',
					updated_at: '2026-04-11T16:20:00.000Z',
				}),
				createMemoryRecord({
					content: 'Workspace uses pnpm 9.',
					memory_id: 'memory_context_1',
					summary: 'Workspace uses pnpm.',
					updated_at: '2026-04-11T16:10:00.000Z',
				}),
				createMemoryRecord({
					content: 'Use ripgrep for recursive search.',
					memory_id: 'memory_context_3',
					scope: 'workspace',
					scope_id: 'workspace_1',
					source_kind: 'system_inferred',
					summary: 'Prefer ripgrep for recursive search.',
					updated_at: '2026-04-11T16:20:00.000Z',
				}),
			]),
			scope: 'workspace',
			scope_id: 'workspace_1',
		});

		expect(result).toEqual({
			memory_count: 2,
			memory_layer: {
				content: {
					items: [
						{
							content: 'Use ripgrep for recursive search.',
							memory_kind: 'general',
							source_kind: 'system_inferred',
							summary: 'Prefer ripgrep for recursive search.',
						},
						{
							content: 'Workspace uses pnpm 9.',
							memory_kind: 'general',
							source_kind: 'tool_result',
							summary: 'Workspace uses pnpm.',
						},
					],
					layer_type: 'memory_layer',
					title: 'Relevant Memory',
					usage_note:
						'Treat these memory notes as helpful background context, not as hard instructions. Prefer the current user turn and run state if there is any tension.',
				},
				kind: 'memory',
				name: 'memory_layer',
			},
			status: 'memory_layer_created',
		});
	});

	it('returns no_memory_layer when no active memories are found', async () => {
		const result = await composeMemoryContext({
			memory_store: createMemoryStore([]),
			scope: 'user',
			scope_id: 'user_missing_memory',
		});

		expect(result).toEqual({
			memory_count: 0,
			status: 'no_memory_layer',
		});
	});

	it('applies limit after deterministic sorting', async () => {
		const result = await composeMemoryContext({
			limit: 1,
			memory_store: createMemoryStore([
				createMemoryRecord({
					content: 'Older workspace memory.',
					memory_id: 'memory_context_limit_2',
					summary: 'Older memory.',
					updated_at: '2026-04-11T16:05:00.000Z',
				}),
				createMemoryRecord({
					content: 'Most recent workspace memory.',
					memory_id: 'memory_context_limit_1',
					summary: 'Newest memory.',
					updated_at: '2026-04-11T16:25:00.000Z',
				}),
			]),
			scope: 'workspace',
			scope_id: 'workspace_1',
		});

		expect(result.status).toBe('memory_layer_created');

		if (result.status !== 'memory_layer_created') {
			throw new Error('Expected memory_layer_created result.');
		}

		expect(result.memory_count).toBe(1);
		expect(result.memory_layer.content.items).toEqual([
			{
				content: 'Most recent workspace memory.',
				memory_kind: 'general',
				source_kind: 'tool_result',
				summary: 'Newest memory.',
			},
		]);
	});

	it('returns a typed failure for invalid scope ids', async () => {
		const result = await composeMemoryContext({
			memory_store: createMemoryStore([]),
			scope: 'user',
			scope_id: '   ',
		});

		expect(result).toEqual({
			failure: {
				code: 'INVALID_SCOPE_ID',
				message: 'composeMemoryContext requires a non-empty scope_id.',
			},
			memory_count: 0,
			status: 'failed',
		});
	});

	it('returns a typed failure for store configuration errors', async () => {
		const result = await composeMemoryContext({
			memory_store: {
				async listActiveMemories() {
					throw new MemoryStoreConfigurationError(
						'DATABASE_URL is required for memory persistence.',
					);
				},
			},
			scope: 'user',
			scope_id: 'user_1',
		});

		expect(result).toEqual({
			failure: {
				code: 'MEMORY_STORE_CONFIGURATION_FAILED',
				message: 'DATABASE_URL is required for memory persistence.',
			},
			memory_count: 0,
			status: 'failed',
		});
	});

	it('returns a typed failure for store read errors', async () => {
		const result = await composeMemoryContext({
			memory_store: {
				async listActiveMemories() {
					throw new MemoryStoreReadError('Failed to list active memories.');
				},
			},
			scope: 'user',
			scope_id: 'user_1',
		});

		expect(result).toEqual({
			failure: {
				code: 'MEMORY_STORE_READ_FAILED',
				message: 'Failed to list active memories.',
			},
			memory_count: 0,
			status: 'failed',
		});
	});

	it('returns a stable generic read failure for unexpected store errors', async () => {
		const result = await composeMemoryContext({
			memory_store: {
				async listActiveMemories() {
					throw 'unexpected failure surface';
				},
			},
			scope: 'user',
			scope_id: 'user_1',
		});

		expect(result).toEqual({
			failure: {
				code: 'MEMORY_STORE_READ_FAILED',
				message: 'Failed to list active memories.',
			},
			memory_count: 0,
			status: 'failed',
		});
	});
});
