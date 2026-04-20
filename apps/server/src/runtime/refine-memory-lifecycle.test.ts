import type { MemoryRecord, MemoryWriteCandidate } from '@runa/types';

import type { MemoryStore } from '../persistence/memory-store.js';

import { describe, expect, it, vi } from 'vitest';

import {
	MemoryStoreConfigurationError,
	MemoryStoreReadError,
} from '../persistence/memory-store.js';

import { refineMemoryLifecycle } from './refine-memory-lifecycle.js';

function createMemoryCandidate(
	overrides: Partial<MemoryWriteCandidate> = {},
): MemoryWriteCandidate {
	return {
		content: 'Use pnpm for package management in this workspace.',
		scope: 'workspace',
		scope_id: 'workspace_1',
		source_kind: 'tool_result',
		source_run_id: 'run_memory_lifecycle_1',
		source_trace_id: 'trace_memory_lifecycle_1',
		summary: 'Workspace package manager preference.',
		...overrides,
	};
}

function createMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
	return {
		content: 'Use npm for package management in this workspace.',
		created_at: '2026-04-11T20:00:00.000Z',
		memory_id: 'memory_lifecycle_existing_1',
		scope: 'workspace',
		scope_id: 'workspace_1',
		source_kind: 'tool_result',
		source_run_id: 'run_memory_lifecycle_existing_1',
		source_trace_id: 'trace_memory_lifecycle_existing_1',
		status: 'active',
		summary: 'Workspace package manager preference.',
		updated_at: '2026-04-11T20:00:00.000Z',
		...overrides,
	};
}

describe('refineMemoryLifecycle', () => {
	it('supersedes older user preferences within the same preference category', async () => {
		const candidate = createMemoryCandidate({
			content: 'Reply in English by default.',
			scope: 'user',
			scope_id: 'local_default_user',
			source_kind: 'user_preference',
			summary: 'Language preference',
		});

		const result = await refineMemoryLifecycle({
			candidate,
			existing_memories: [
				createMemoryRecord({
					content: 'Reply in Turkish by default.',
					memory_id: 'memory_lifecycle_preference_1',
					scope: 'user',
					scope_id: 'local_default_user',
					source_kind: 'user_preference',
					summary: 'Language preference',
				}),
			],
		});

		expect(result).toEqual({
			candidate,
			lifecycle_actions: [
				{
					action: 'supersede_previous',
					memory_id: 'memory_lifecycle_preference_1',
				},
			],
			matched_memory_id: 'memory_lifecycle_preference_1',
			status: 'write_and_supersede_previous',
		});
	});

	it('returns a supersede action when active memory shares summary and source but content changes', async () => {
		const candidate = createMemoryCandidate();

		const result = await refineMemoryLifecycle({
			candidate,
			existing_memories: [
				createMemoryRecord(),
				createMemoryRecord({
					content: 'Use bun for scripts in this workspace.',
					memory_id: 'memory_lifecycle_existing_2',
					source_kind: 'conversation',
				}),
			],
		});

		expect(result).toEqual({
			candidate,
			lifecycle_actions: [
				{
					action: 'supersede_previous',
					memory_id: 'memory_lifecycle_existing_1',
				},
			],
			matched_memory_id: 'memory_lifecycle_existing_1',
			status: 'write_and_supersede_previous',
		});
	});

	it('keeps lifecycle unchanged when source kind or summary does not match', async () => {
		const candidate = createMemoryCandidate();

		const result = await refineMemoryLifecycle({
			candidate,
			existing_memories: [
				createMemoryRecord({
					memory_id: 'memory_lifecycle_different_summary',
					summary: 'Workspace shell preference.',
				}),
				createMemoryRecord({
					memory_id: 'memory_lifecycle_different_source',
					source_kind: 'conversation',
				}),
			],
		});

		expect(result).toEqual({
			candidate,
			lifecycle_actions: [],
			status: 'write_without_lifecycle_change',
		});
	});

	it('chooses the most recent active match deterministically when multiple supersede candidates exist', async () => {
		const candidate = createMemoryCandidate();

		const result = await refineMemoryLifecycle({
			candidate,
			existing_memories: [
				createMemoryRecord({
					memory_id: 'memory_lifecycle_older',
					updated_at: '2026-04-11T19:59:00.000Z',
				}),
				createMemoryRecord({
					memory_id: 'memory_lifecycle_newer',
					updated_at: '2026-04-11T20:10:00.000Z',
				}),
			],
		});

		expect(result).toEqual({
			candidate,
			lifecycle_actions: [
				{
					action: 'supersede_previous',
					memory_id: 'memory_lifecycle_newer',
				},
			],
			matched_memory_id: 'memory_lifecycle_newer',
			status: 'write_and_supersede_previous',
		});
	});

	it('returns a typed failure for memory store configuration errors', async () => {
		const listActiveMemories: MemoryStore['listActiveMemories'] = vi
			.fn<MemoryStore['listActiveMemories']>()
			.mockRejectedValue(
				new MemoryStoreConfigurationError('DATABASE_URL is required for memory persistence.'),
			);

		const result = await refineMemoryLifecycle({
			candidate: createMemoryCandidate(),
			memory_store: {
				listActiveMemories,
			},
		});

		expect(result).toEqual({
			failure: {
				code: 'MEMORY_STORE_CONFIGURATION_FAILED',
				message: 'DATABASE_URL is required for memory persistence.',
			},
			status: 'failed',
		});
	});

	it('returns a typed failure for memory store read errors', async () => {
		const listActiveMemories: MemoryStore['listActiveMemories'] = vi
			.fn<MemoryStore['listActiveMemories']>()
			.mockRejectedValue(new MemoryStoreReadError('Failed to list active memories.'));

		const result = await refineMemoryLifecycle({
			candidate: createMemoryCandidate(),
			memory_store: {
				listActiveMemories,
			},
		});

		expect(result).toEqual({
			failure: {
				code: 'MEMORY_STORE_READ_FAILED',
				message: 'Failed to list active memories.',
			},
			status: 'failed',
		});
	});
});
