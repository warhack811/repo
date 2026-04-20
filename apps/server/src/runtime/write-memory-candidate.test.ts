import type { MemoryRecord, MemoryWriteCandidate } from '@runa/types';

import type { MemoryStore } from '../persistence/memory-store.js';

import { describe, expect, it, vi } from 'vitest';

import {
	MemoryStoreConfigurationError,
	MemoryStoreWriteError,
} from '../persistence/memory-store.js';

import { writeMemoryCandidate } from './write-memory-candidate.js';

function createMemoryCandidate(
	overrides: Partial<MemoryWriteCandidate> = {},
): MemoryWriteCandidate {
	return {
		content: 'Use pnpm for package management in this workspace.',
		scope: 'workspace',
		scope_id: 'workspace_1',
		source_kind: 'tool_result',
		source_run_id: 'run_memory_write_candidate_1',
		source_trace_id: 'trace_memory_write_candidate_1',
		summary: 'Workspace uses pnpm.',
		...overrides,
	};
}

function createMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
	return {
		content: 'Use pnpm for package management in this workspace.',
		created_at: '2026-04-11T15:00:00.000Z',
		memory_id: 'memory_written_1',
		scope: 'workspace',
		scope_id: 'workspace_1',
		source_kind: 'tool_result',
		source_run_id: 'run_memory_write_candidate_1',
		source_trace_id: 'trace_memory_write_candidate_1',
		status: 'active',
		summary: 'Workspace uses pnpm.',
		updated_at: '2026-04-11T15:00:00.000Z',
		...overrides,
	};
}

describe('writeMemoryCandidate', () => {
	it('writes candidate_created results to the memory store', async () => {
		const createMemory: MemoryStore['createMemory'] = vi
			.fn<MemoryStore['createMemory']>()
			.mockResolvedValue(createMemoryRecord());

		const candidate = createMemoryCandidate();
		const result = await writeMemoryCandidate({
			candidate: {
				candidate,
				status: 'candidate_created',
			},
			memory_store: {
				createMemory,
			},
		});

		expect(createMemory).toHaveBeenCalledWith(candidate);
		expect(result).toEqual({
			memory_record: createMemoryRecord(),
			status: 'memory_written',
		});
	});

	it('writes direct candidates without requiring a candidate result wrapper', async () => {
		const createMemory: MemoryStore['createMemory'] = vi
			.fn<MemoryStore['createMemory']>()
			.mockResolvedValue(
				createMemoryRecord({
					memory_id: 'memory_written_direct_1',
				}),
			);

		const result = await writeMemoryCandidate({
			candidate: createMemoryCandidate({
				scope: 'user',
				scope_id: 'user_1',
				source_kind: 'user_explicit',
			}),
			memory_store: {
				createMemory,
			},
		});

		expect(createMemory).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			memory_record: createMemoryRecord({
				memory_id: 'memory_written_direct_1',
			}),
			status: 'memory_written',
		});
	});

	it('returns no_memory_written for no_candidate results and skips writes', async () => {
		const createMemory: MemoryStore['createMemory'] = vi
			.fn<MemoryStore['createMemory']>()
			.mockResolvedValue(createMemoryRecord());

		const result = await writeMemoryCandidate({
			candidate: {
				reason: 'insufficient_signal',
				status: 'no_candidate',
			},
			memory_store: {
				createMemory,
			},
		});

		expect(createMemory).not.toHaveBeenCalled();
		expect(result).toEqual({
			reason: 'insufficient_signal',
			status: 'no_memory_written',
		});
	});

	it('returns a typed failure when candidate building already failed', async () => {
		const createMemory: MemoryStore['createMemory'] = vi
			.fn<MemoryStore['createMemory']>()
			.mockResolvedValue(createMemoryRecord());

		const result = await writeMemoryCandidate({
			candidate: {
				failure: {
					code: 'INVALID_SCOPE_ID',
					message: 'buildMemoryWriteCandidate requires a non-empty scope_id.',
				},
				status: 'failed',
			},
			memory_store: {
				createMemory,
			},
		});

		expect(createMemory).not.toHaveBeenCalled();
		expect(result).toEqual({
			failure: {
				code: 'CANDIDATE_BUILD_FAILED',
				message: 'buildMemoryWriteCandidate requires a non-empty scope_id.',
				source_failure_code: 'INVALID_SCOPE_ID',
			},
			status: 'failed',
		});
	});

	it('returns a typed failure for memory store configuration errors', async () => {
		const createMemory: MemoryStore['createMemory'] = vi
			.fn<MemoryStore['createMemory']>()
			.mockRejectedValue(
				new MemoryStoreConfigurationError('DATABASE_URL is required for memory persistence.'),
			);

		const result = await writeMemoryCandidate({
			candidate: createMemoryCandidate(),
			memory_store: {
				createMemory,
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

	it('returns a typed failure for memory store write errors', async () => {
		const createMemory: MemoryStore['createMemory'] = vi
			.fn<MemoryStore['createMemory']>()
			.mockRejectedValue(new MemoryStoreWriteError('Failed to create memory.'));

		const result = await writeMemoryCandidate({
			candidate: createMemoryCandidate(),
			memory_store: {
				createMemory,
			},
		});

		expect(result).toEqual({
			failure: {
				code: 'MEMORY_STORE_WRITE_FAILED',
				message: 'Failed to create memory.',
			},
			status: 'failed',
		});
	});
});
