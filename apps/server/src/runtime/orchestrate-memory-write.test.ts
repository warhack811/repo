import type { MemoryRecord } from '@runa/types';

import type { MemoryStore } from '../persistence/memory-store.js';

import { describe, expect, it, vi } from 'vitest';

import {
	MemoryStoreConfigurationError,
	MemoryStoreReadError,
	MemoryStoreWriteError,
} from '../persistence/memory-store.js';

import { orchestrateMemoryWrite } from './orchestrate-memory-write.js';

function createMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
	return {
		content: 'Use pnpm for package management in this workspace.',
		created_at: '2026-04-11T19:00:00.000Z',
		memory_id: 'memory_orchestrated_1',
		scope: 'workspace',
		scope_id: 'workspace_1',
		source_kind: 'tool_result',
		source_run_id: 'run_memory_orchestrated_1',
		source_trace_id: 'trace_memory_orchestrated_1',
		status: 'active',
		summary: 'Workspace uses pnpm for package management.',
		updated_at: '2026-04-11T19:00:00.000Z',
		...overrides,
	};
}

describe('orchestrateMemoryWrite', () => {
	it('writes explicit user preferences into the user scope with preference source kind', async () => {
		const listActiveMemories: MemoryStore['listActiveMemories'] = vi
			.fn<MemoryStore['listActiveMemories']>()
			.mockResolvedValue([]);
		const createMemory: MemoryStore['createMemory'] = vi
			.fn<MemoryStore['createMemory']>()
			.mockResolvedValue(
				createMemoryRecord({
					content: 'Reply in Turkish by default.',
					memory_id: 'memory_orchestrated_preference_1',
					scope: 'user',
					scope_id: 'local_default_user',
					source_kind: 'user_preference',
					summary: 'Language preference',
				}),
			);
		const supersedeMemory: MemoryStore['supersedeMemory'] = vi
			.fn<MemoryStore['supersedeMemory']>()
			.mockResolvedValue(null);

		const result = await orchestrateMemoryWrite({
			candidate_policy: 'user_preference',
			memory_store: {
				createMemory,
				listActiveMemories,
				supersedeMemory,
			},
			run_id: 'run_memory_preference_orchestrated_1',
			scope: 'user',
			scope_id: 'local_default_user',
			source: {
				kind: 'user_text',
				text: 'Yanitlari Turkce ver.',
			},
			trace_id: 'trace_memory_preference_orchestrated_1',
		});

		expect(result.status).toBe('memory_written');

		if (result.status !== 'memory_written') {
			throw new Error('Expected memory_written result.');
		}

		expect(createMemory).toHaveBeenCalledWith({
			content: 'Reply in Turkish by default.',
			scope: 'user',
			scope_id: 'local_default_user',
			source_kind: 'user_preference',
			source_run_id: 'run_memory_preference_orchestrated_1',
			source_trace_id: 'trace_memory_preference_orchestrated_1',
			summary: 'Language preference',
		});
		expect(result.memory_record).toMatchObject({
			content: 'Reply in Turkish by default.',
			scope: 'user',
			scope_id: 'local_default_user',
			source_kind: 'user_preference',
			summary: 'Language preference',
		});
	});

	it('writes selected candidates through the full build -> select -> write chain', async () => {
		const listActiveMemories: MemoryStore['listActiveMemories'] = vi
			.fn<MemoryStore['listActiveMemories']>()
			.mockResolvedValue([]);
		const createMemory: MemoryStore['createMemory'] = vi
			.fn<MemoryStore['createMemory']>()
			.mockResolvedValue(createMemoryRecord());
		const supersedeMemory: MemoryStore['supersedeMemory'] = vi
			.fn<MemoryStore['supersedeMemory']>()
			.mockResolvedValue(null);

		const result = await orchestrateMemoryWrite({
			memory_store: {
				createMemory,
				listActiveMemories,
				supersedeMemory,
			},
			run_id: 'run_memory_orchestrated_1',
			scope: 'workspace',
			scope_id: 'workspace_1',
			source: {
				content: 'Use pnpm for package management in this workspace.',
				kind: 'tool_result',
				summary: 'Workspace uses pnpm for package management.',
			},
			trace_id: 'trace_memory_orchestrated_1',
		});

		expect(result.status).toBe('memory_written');

		if (result.status !== 'memory_written') {
			throw new Error('Expected memory_written result.');
		}

		expect(listActiveMemories).toHaveBeenCalledWith('workspace', 'workspace_1');
		expect(supersedeMemory).not.toHaveBeenCalled();
		expect(createMemory).toHaveBeenCalledWith({
			content: 'Use pnpm for package management in this workspace.',
			scope: 'workspace',
			scope_id: 'workspace_1',
			source_kind: 'tool_result',
			source_run_id: 'run_memory_orchestrated_1',
			source_trace_id: 'trace_memory_orchestrated_1',
			summary: 'Workspace uses pnpm for package management.',
		});
		expect(result.selection_result).toEqual({
			candidate: {
				content: 'Use pnpm for package management in this workspace.',
				scope: 'workspace',
				scope_id: 'workspace_1',
				source_kind: 'tool_result',
				source_run_id: 'run_memory_orchestrated_1',
				source_trace_id: 'trace_memory_orchestrated_1',
				summary: 'Workspace uses pnpm for package management.',
			},
			reason: 'eligible',
			status: 'selected',
		});
		expect(result.lifecycle_result).toEqual({
			candidate: {
				content: 'Use pnpm for package management in this workspace.',
				scope: 'workspace',
				scope_id: 'workspace_1',
				source_kind: 'tool_result',
				source_run_id: 'run_memory_orchestrated_1',
				source_trace_id: 'trace_memory_orchestrated_1',
				summary: 'Workspace uses pnpm for package management.',
			},
			lifecycle_actions: [],
			status: 'write_without_lifecycle_change',
		});
		expect(result.memory_record).toEqual(createMemoryRecord());
	});

	it('returns no_candidate without reading or writing when the source has no explicit memory signal', async () => {
		const listActiveMemories: MemoryStore['listActiveMemories'] = vi
			.fn<MemoryStore['listActiveMemories']>()
			.mockResolvedValue([]);
		const createMemory: MemoryStore['createMemory'] = vi
			.fn<MemoryStore['createMemory']>()
			.mockResolvedValue(createMemoryRecord());

		const result = await orchestrateMemoryWrite({
			memory_store: {
				createMemory,
				listActiveMemories,
				async supersedeMemory() {
					return null;
				},
			},
			scope: 'user',
			scope_id: 'user_1',
			source: {
				kind: 'user_text',
				text: 'Bug var mi?',
			},
		});

		expect(listActiveMemories).not.toHaveBeenCalled();
		expect(createMemory).not.toHaveBeenCalled();
		expect(result).toEqual({
			candidate_result: {
				reason: 'insufficient_signal',
				status: 'no_candidate',
			},
			reason: 'insufficient_signal',
			status: 'no_candidate',
		});
	});

	it('returns discarded when selection policy rejects the candidate as a duplicate', async () => {
		const createMemory: MemoryStore['createMemory'] = vi
			.fn<MemoryStore['createMemory']>()
			.mockResolvedValue(createMemoryRecord());

		const result = await orchestrateMemoryWrite({
			existing_memories: [
				createMemoryRecord({
					content: 'Use pnpm for package management in this workspace.',
					memory_id: 'memory_duplicate_1',
				}),
			],
			memory_store: {
				createMemory,
				async listActiveMemories() {
					return [];
				},
				async supersedeMemory() {
					return null;
				},
			},
			run_id: 'run_memory_orchestrated_duplicate',
			scope: 'workspace',
			scope_id: 'workspace_1',
			source: {
				content: 'Use pnpm for package management in this workspace.',
				kind: 'tool_result',
				summary: 'Workspace uses pnpm for package management.',
			},
			trace_id: 'trace_memory_orchestrated_duplicate',
		});

		expect(createMemory).not.toHaveBeenCalled();
		expect(result).toEqual({
			candidate: {
				content: 'Use pnpm for package management in this workspace.',
				scope: 'workspace',
				scope_id: 'workspace_1',
				source_kind: 'tool_result',
				source_run_id: 'run_memory_orchestrated_duplicate',
				source_trace_id: 'trace_memory_orchestrated_duplicate',
				summary: 'Workspace uses pnpm for package management.',
			},
			candidate_result: {
				candidate: {
					content: 'Use pnpm for package management in this workspace.',
					scope: 'workspace',
					scope_id: 'workspace_1',
					source_kind: 'tool_result',
					source_run_id: 'run_memory_orchestrated_duplicate',
					source_trace_id: 'trace_memory_orchestrated_duplicate',
					summary: 'Workspace uses pnpm for package management.',
				},
				status: 'candidate_created',
			},
			matched_memory_id: 'memory_duplicate_1',
			reason: 'duplicate_active_memory',
			selection_result: {
				matched_memory_id: 'memory_duplicate_1',
				reason: 'duplicate_active_memory',
				status: 'discarded',
			},
			status: 'discarded',
		});
	});

	it('discards duplicate explicit preferences without writing a second memory', async () => {
		const createMemory: MemoryStore['createMemory'] = vi
			.fn<MemoryStore['createMemory']>()
			.mockResolvedValue(createMemoryRecord());

		const result = await orchestrateMemoryWrite({
			candidate_policy: 'user_preference',
			existing_memories: [
				createMemoryRecord({
					content: 'Reply in Turkish by default.',
					memory_id: 'memory_duplicate_preference_1',
					scope: 'user',
					scope_id: 'local_default_user',
					source_kind: 'user_preference',
					summary: 'Language preference',
				}),
			],
			memory_store: {
				createMemory,
				async listActiveMemories() {
					return [];
				},
				async supersedeMemory() {
					return null;
				},
			},
			run_id: 'run_memory_orchestrated_preference_duplicate',
			scope: 'user',
			scope_id: 'local_default_user',
			source: {
				kind: 'user_text',
				text: 'Reply in Turkish.',
			},
			trace_id: 'trace_memory_orchestrated_preference_duplicate',
		});

		expect(createMemory).not.toHaveBeenCalled();
		expect(result).toEqual({
			candidate: {
				content: 'Reply in Turkish by default.',
				scope: 'user',
				scope_id: 'local_default_user',
				source_kind: 'user_preference',
				source_run_id: 'run_memory_orchestrated_preference_duplicate',
				source_trace_id: 'trace_memory_orchestrated_preference_duplicate',
				summary: 'Language preference',
			},
			candidate_result: {
				candidate: {
					content: 'Reply in Turkish by default.',
					scope: 'user',
					scope_id: 'local_default_user',
					source_kind: 'user_preference',
					source_run_id: 'run_memory_orchestrated_preference_duplicate',
					source_trace_id: 'trace_memory_orchestrated_preference_duplicate',
					summary: 'Language preference',
				},
				status: 'candidate_created',
			},
			matched_memory_id: 'memory_duplicate_preference_1',
			reason: 'duplicate_active_memory',
			selection_result: {
				matched_memory_id: 'memory_duplicate_preference_1',
				reason: 'duplicate_active_memory',
				status: 'discarded',
			},
			status: 'discarded',
		});
	});

	it('surfaces selection-stage configuration failures clearly', async () => {
		const result = await orchestrateMemoryWrite({
			memory_store: {
				async createMemory() {
					return createMemoryRecord();
				},
				async listActiveMemories() {
					throw new MemoryStoreConfigurationError(
						'DATABASE_URL is required for memory persistence.',
					);
				},
				async supersedeMemory() {
					return null;
				},
			},
			scope: 'workspace',
			scope_id: 'workspace_1',
			source: {
				content: 'Use pnpm for package management in this workspace.',
				kind: 'tool_result',
				summary: 'Workspace uses pnpm for package management.',
			},
		});

		expect(result).toMatchObject({
			failure: {
				code: 'MEMORY_SELECTION_FAILED',
				message: 'DATABASE_URL is required for memory persistence.',
				source_failure_code: 'MEMORY_STORE_CONFIGURATION_FAILED',
			},
			stage: 'selection',
			status: 'failed',
		});
	});

	it('surfaces selection-stage read failures clearly', async () => {
		const result = await orchestrateMemoryWrite({
			memory_store: {
				async createMemory() {
					return createMemoryRecord();
				},
				async listActiveMemories() {
					throw new MemoryStoreReadError('Failed to list active memories.');
				},
				async supersedeMemory() {
					return null;
				},
			},
			scope: 'workspace',
			scope_id: 'workspace_1',
			source: {
				content: 'Use pnpm for package management in this workspace.',
				kind: 'tool_result',
				summary: 'Workspace uses pnpm for package management.',
			},
		});

		expect(result).toMatchObject({
			failure: {
				code: 'MEMORY_SELECTION_FAILED',
				message: 'Failed to list active memories.',
				source_failure_code: 'MEMORY_STORE_READ_FAILED',
			},
			stage: 'selection',
			status: 'failed',
		});
	});

	it('surfaces write-stage failures clearly', async () => {
		const result = await orchestrateMemoryWrite({
			memory_store: {
				async createMemory() {
					throw new MemoryStoreWriteError('Failed to create memory.');
				},
				async listActiveMemories() {
					return [];
				},
				async supersedeMemory() {
					return null;
				},
			},
			scope: 'workspace',
			scope_id: 'workspace_1',
			source: {
				content: 'Use pnpm for package management in this workspace.',
				kind: 'tool_result',
				summary: 'Workspace uses pnpm for package management.',
			},
		});

		expect(result).toMatchObject({
			failure: {
				code: 'MEMORY_WRITE_FAILED',
				message: 'Failed to create memory.',
				source_failure_code: 'MEMORY_STORE_WRITE_FAILED',
			},
			stage: 'write',
			status: 'failed',
		});
	});

	it('supersedes previous active memory when summary and source match but content changes', async () => {
		const listActiveMemories: MemoryStore['listActiveMemories'] = vi
			.fn<MemoryStore['listActiveMemories']>()
			.mockResolvedValue([
				createMemoryRecord({
					content: 'Use npm for package management in this workspace.',
					memory_id: 'memory_superseded_previous_1',
					summary: 'Workspace package manager preference.',
				}),
			]);
		const createMemoryMock = vi.fn<MemoryStore['createMemory']>().mockResolvedValue(
			createMemoryRecord({
				content: 'Use pnpm for package management in this workspace.',
				memory_id: 'memory_orchestrated_new_1',
				summary: 'Workspace package manager preference.',
			}),
		);
		const supersedeMemoryMock = vi.fn<MemoryStore['supersedeMemory']>().mockResolvedValue(
			createMemoryRecord({
				archived_at: '2026-04-11T20:30:00.000Z',
				content: 'Use npm for package management in this workspace.',
				memory_id: 'memory_superseded_previous_1',
				status: 'superseded',
				summary: 'Workspace package manager preference.',
				updated_at: '2026-04-11T20:30:00.000Z',
			}),
		);

		const result = await orchestrateMemoryWrite({
			memory_store: {
				createMemory: createMemoryMock,
				listActiveMemories,
				supersedeMemory: supersedeMemoryMock,
			},
			run_id: 'run_memory_orchestrated_supersede',
			scope: 'workspace',
			scope_id: 'workspace_1',
			source: {
				content: 'Use pnpm for package management in this workspace.',
				kind: 'tool_result',
				summary: 'Workspace package manager preference.',
			},
			trace_id: 'trace_memory_orchestrated_supersede',
		});

		expect(result.status).toBe('memory_written');

		if (result.status !== 'memory_written') {
			throw new Error('Expected memory_written result.');
		}

		expect(createMemoryMock).toHaveBeenCalledTimes(1);
		expect(supersedeMemoryMock).toHaveBeenCalledWith({
			memory_id: 'memory_superseded_previous_1',
		});
		const createCallOrder = createMemoryMock.mock.invocationCallOrder[0];
		const supersedeCallOrder = supersedeMemoryMock.mock.invocationCallOrder[0];

		expect(createCallOrder).toBeDefined();
		expect(supersedeCallOrder).toBeDefined();

		if (createCallOrder === undefined || supersedeCallOrder === undefined) {
			throw new Error('Expected both create and supersede memory calls to be recorded.');
		}

		expect(createCallOrder).toBeLessThan(supersedeCallOrder);
		expect(result.lifecycle_result).toEqual({
			candidate: {
				content: 'Use pnpm for package management in this workspace.',
				scope: 'workspace',
				scope_id: 'workspace_1',
				source_kind: 'tool_result',
				source_run_id: 'run_memory_orchestrated_supersede',
				source_trace_id: 'trace_memory_orchestrated_supersede',
				summary: 'Workspace package manager preference.',
			},
			lifecycle_actions: [
				{
					action: 'supersede_previous',
					memory_id: 'memory_superseded_previous_1',
				},
			],
			matched_memory_id: 'memory_superseded_previous_1',
			status: 'write_and_supersede_previous',
		});
		expect(result.superseded_memory).toEqual({
			archived_at: '2026-04-11T20:30:00.000Z',
			content: 'Use npm for package management in this workspace.',
			created_at: '2026-04-11T19:00:00.000Z',
			memory_id: 'memory_superseded_previous_1',
			scope: 'workspace',
			scope_id: 'workspace_1',
			source_kind: 'tool_result',
			source_run_id: 'run_memory_orchestrated_1',
			source_trace_id: 'trace_memory_orchestrated_1',
			status: 'superseded',
			summary: 'Workspace package manager preference.',
			updated_at: '2026-04-11T20:30:00.000Z',
		});
	});

	it('surfaces lifecycle mutation failures after a successful write', async () => {
		const createMemory: MemoryStore['createMemory'] = vi
			.fn<MemoryStore['createMemory']>()
			.mockResolvedValue(
				createMemoryRecord({
					content: 'Use pnpm for package management in this workspace.',
					memory_id: 'memory_orchestrated_new_2',
					summary: 'Workspace package manager preference.',
				}),
			);
		const supersedeMemory: MemoryStore['supersedeMemory'] = vi
			.fn<MemoryStore['supersedeMemory']>()
			.mockRejectedValue(new MemoryStoreWriteError('Failed to supersede memory.'));

		const result = await orchestrateMemoryWrite({
			memory_store: {
				createMemory,
				async listActiveMemories() {
					return [
						createMemoryRecord({
							content: 'Use npm for package management in this workspace.',
							memory_id: 'memory_supersede_error_target',
							summary: 'Workspace package manager preference.',
						}),
					];
				},
				supersedeMemory,
			},
			scope: 'workspace',
			scope_id: 'workspace_1',
			source: {
				content: 'Use pnpm for package management in this workspace.',
				kind: 'tool_result',
				summary: 'Workspace package manager preference.',
			},
		});

		expect(result).toMatchObject({
			failure: {
				code: 'MEMORY_LIFECYCLE_FAILED',
				message: 'Failed to supersede memory.',
				source_failure_code: 'MEMORY_STORE_WRITE_FAILED',
			},
			memory_record: {
				memory_id: 'memory_orchestrated_new_2',
			},
			stage: 'lifecycle',
			status: 'failed',
		});
	});
});
