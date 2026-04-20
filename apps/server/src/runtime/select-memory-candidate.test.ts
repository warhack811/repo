import type { MemoryRecord, MemoryWriteCandidate } from '@runa/types';

import type { MemoryStore } from '../persistence/memory-store.js';

import { describe, expect, it, vi } from 'vitest';

import {
	MemoryStoreConfigurationError,
	MemoryStoreReadError,
} from '../persistence/memory-store.js';

import { selectMemoryCandidate } from './select-memory-candidate.js';

function createMemoryCandidate(
	overrides: Partial<MemoryWriteCandidate> = {},
): MemoryWriteCandidate {
	return {
		content: 'Use pnpm for package management in this workspace.',
		scope: 'workspace',
		scope_id: 'workspace_1',
		source_kind: 'tool_result',
		source_run_id: 'run_memory_selection_1',
		source_trace_id: 'trace_memory_selection_1',
		summary: 'Workspace uses pnpm for package management.',
		...overrides,
	};
}

function createMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
	return {
		content: 'Use npm for package management in this workspace.',
		created_at: '2026-04-11T18:00:00.000Z',
		memory_id: 'memory_selection_existing_1',
		scope: 'workspace',
		scope_id: 'workspace_1',
		source_kind: 'tool_result',
		source_run_id: 'run_memory_selection_existing_1',
		source_trace_id: 'trace_memory_selection_existing_1',
		status: 'active',
		summary: 'Workspace uses npm for package management.',
		updated_at: '2026-04-11T18:00:00.000Z',
		...overrides,
	};
}

describe('selectMemoryCandidate', () => {
	it('selects meaningful candidates when no active duplicate exists', async () => {
		const listActiveMemories: MemoryStore['listActiveMemories'] = vi
			.fn<MemoryStore['listActiveMemories']>()
			.mockResolvedValue([]);

		const candidate = createMemoryCandidate();
		const result = await selectMemoryCandidate({
			candidate,
			memory_store: {
				listActiveMemories,
			},
		});

		expect(listActiveMemories).toHaveBeenCalledWith('workspace', 'workspace_1');
		expect(result).toEqual({
			candidate,
			reason: 'eligible',
			status: 'selected',
		});
	});

	it('discards empty or noisy candidates deterministically', async () => {
		await expect(
			selectMemoryCandidate({
				candidate: createMemoryCandidate({
					content: '   ',
					summary: '   ',
				}),
			}),
		).resolves.toEqual({
			reason: 'empty_content',
			status: 'discarded',
		});
	});

	it('discards trivially short candidates', async () => {
		await expect(
			selectMemoryCandidate({
				candidate: createMemoryCandidate({
					content: 'Use pnpm.',
					summary: 'Use pnpm.',
				}),
			}),
		).resolves.toEqual({
			reason: 'content_too_short',
			status: 'discarded',
		});
	});

	it('discards generic candidates before store reads', async () => {
		const listActiveMemories: MemoryStore['listActiveMemories'] = vi
			.fn<MemoryStore['listActiveMemories']>()
			.mockResolvedValue([]);

		const result = await selectMemoryCandidate({
			candidate: createMemoryCandidate({
				content: 'Important preference',
				summary: 'Important preference',
			}),
			memory_store: {
				listActiveMemories,
			},
		});

		expect(listActiveMemories).not.toHaveBeenCalled();
		expect(result).toEqual({
			reason: 'generic_content',
			status: 'discarded',
		});
	});

	it('discards exact active duplicates with a matched memory id', async () => {
		const candidate = createMemoryCandidate();
		const result = await selectMemoryCandidate({
			candidate,
			existing_memories: [
				createMemoryRecord({
					content: '  use pnpm for package management in this workspace.  ',
					memory_id: 'memory_selection_existing_duplicate',
					summary: 'Workspace uses pnpm for package management.',
				}),
				createMemoryRecord({
					content: 'Archived duplicate should not matter.',
					memory_id: 'memory_selection_archived_duplicate',
					status: 'archived',
				}),
			],
		});

		expect(result).toEqual({
			matched_memory_id: 'memory_selection_existing_duplicate',
			reason: 'duplicate_active_memory',
			status: 'discarded',
		});
	});

	it('keeps distinct candidates selected even when other memories exist', async () => {
		const result = await selectMemoryCandidate({
			candidate: createMemoryCandidate(),
			existing_memories: [
				createMemoryRecord(),
				createMemoryRecord({
					content: 'Use bun for small utility scripts in the tools workspace.',
					memory_id: 'memory_selection_existing_2',
				}),
			],
		});

		expect(result).toEqual({
			candidate: createMemoryCandidate(),
			reason: 'eligible',
			status: 'selected',
		});
	});

	it('returns a typed failure for memory store configuration errors', async () => {
		const listActiveMemories: MemoryStore['listActiveMemories'] = vi
			.fn<MemoryStore['listActiveMemories']>()
			.mockRejectedValue(
				new MemoryStoreConfigurationError('DATABASE_URL is required for memory persistence.'),
			);

		const result = await selectMemoryCandidate({
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

		const result = await selectMemoryCandidate({
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
