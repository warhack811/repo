import type { MemoryRecord as DatabaseMemoryRecord } from '@runa/db';

import type { MemoryRecordWriter } from './memory-store.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	MemoryStoreConfigurationError,
	MemoryStoreReadError,
	MemoryStoreWriteError,
	archiveMemory,
	createMemory,
	getMemoryById,
	listActiveMemories,
	supersedeMemory,
} from './memory-store.js';

function clearDatabaseUrl(): void {
	const environment = process.env as NodeJS.ProcessEnv & {
		DATABASE_URL?: string;
		DATABASE_TARGET?: string;
		RUNA_DEBUG_PERSISTENCE?: string;
	};
	environment.DATABASE_URL = undefined;
	environment.DATABASE_TARGET = undefined;
	environment.RUNA_DEBUG_PERSISTENCE = undefined;
}

function getMutableEnvironment(): NodeJS.ProcessEnv & {
	DATABASE_TARGET?: string;
	DATABASE_URL?: string;
	RUNA_DEBUG_PERSISTENCE?: string;
} {
	return process.env as NodeJS.ProcessEnv & {
		DATABASE_TARGET?: string;
		DATABASE_URL?: string;
		RUNA_DEBUG_PERSISTENCE?: string;
	};
}

function createDatabaseMemoryRecord(
	overrides: Partial<DatabaseMemoryRecord> = {},
): DatabaseMemoryRecord {
	return {
		archived_at: null,
		content: 'User prefers concise code review summaries.',
		created_at: '2026-04-11T12:00:00.000Z',
		memory_id: 'memory_store_record_1',
		scope: 'user',
		scope_id: 'user_1',
		source_kind: 'user_explicit',
		source_run_id: 'run_memory_store_1',
		source_trace_id: 'trace_memory_store_1',
		status: 'active',
		summary: 'User prefers concise summaries.',
		tenant_id: null,
		updated_at: '2026-04-11T12:00:00.000Z',
		user_id: null,
		workspace_id: null,
		...overrides,
	};
}

afterEach(() => {
	clearDatabaseUrl();
	vi.restoreAllMocks();
});

describe('memory-store', () => {
	it('throws a typed configuration error when DATABASE_URL is missing', async () => {
		await expect(
			createMemory({
				content: 'Remember this preference.',
				scope: 'user',
				scope_id: 'user_missing_db',
				source_kind: 'user_explicit',
				summary: 'Preference',
			}),
		).rejects.toThrowError(MemoryStoreConfigurationError);
	});

	it('maps memory creation writes to deterministic upsert records', async () => {
		const upsertMemory: MemoryRecordWriter['upsertMemory'] = vi.fn().mockResolvedValue(undefined);

		const createdRecord = await createMemory(
			{
				content: 'Use pnpm in this workspace.',
				created_at: '2026-04-11T12:10:00.000Z',
				memory_id: 'memory_store_created_1',
				scope: 'workspace',
				scope_id: 'workspace_1',
				source_kind: 'system_inferred',
				source_run_id: 'run_memory_store_created_1',
				source_trace_id: 'trace_memory_store_created_1',
				summary: 'Workspace uses pnpm.',
			},
			{
				writer: {
					async getMemoryById() {
						return null;
					},
					async listActiveMemories() {
						return [];
					},
					upsertMemory,
				},
			},
		);

		expect(upsertMemory).toHaveBeenCalledWith({
			archived_at: null,
			content: 'Use pnpm in this workspace.',
			created_at: '2026-04-11T12:10:00.000Z',
			memory_id: 'memory_store_created_1',
			scope: 'workspace',
			scope_id: 'workspace_1',
			source_kind: 'system_inferred',
			source_run_id: 'run_memory_store_created_1',
			source_trace_id: 'trace_memory_store_created_1',
			status: 'active',
			summary: 'Workspace uses pnpm.',
			tenant_id: null,
			updated_at: '2026-04-11T12:10:00.000Z',
			user_id: null,
			workspace_id: null,
		});

		expect(createdRecord).toEqual({
			content: 'Use pnpm in this workspace.',
			created_at: '2026-04-11T12:10:00.000Z',
			memory_id: 'memory_store_created_1',
			scope: 'workspace',
			scope_id: 'workspace_1',
			source_kind: 'system_inferred',
			source_run_id: 'run_memory_store_created_1',
			source_trace_id: 'trace_memory_store_created_1',
			status: 'active',
			summary: 'Workspace uses pnpm.',
			updated_at: '2026-04-11T12:10:00.000Z',
		});
	});

	it('hydrates memory records into shared memory surfaces', async () => {
		const record = await getMemoryById('memory_store_record_1', {
			writer: {
				async getMemoryById() {
					return createDatabaseMemoryRecord();
				},
				async listActiveMemories() {
					return [];
				},
				async upsertMemory() {},
			},
		});

		expect(record).toEqual({
			content: 'User prefers concise code review summaries.',
			created_at: '2026-04-11T12:00:00.000Z',
			memory_id: 'memory_store_record_1',
			scope: 'user',
			scope_id: 'user_1',
			source_kind: 'user_explicit',
			source_run_id: 'run_memory_store_1',
			source_trace_id: 'trace_memory_store_1',
			status: 'active',
			summary: 'User prefers concise summaries.',
			updated_at: '2026-04-11T12:00:00.000Z',
		});
	});

	it('lists active memories in deterministic shared format', async () => {
		const records = await listActiveMemories('user', 'user_1', {
			writer: {
				async getMemoryById() {
					return null;
				},
				async listActiveMemories() {
					return [
						createDatabaseMemoryRecord({
							created_at: '2026-04-11T12:20:00.000Z',
							memory_id: 'memory_store_record_2',
							summary: 'Most recent memory.',
							updated_at: '2026-04-11T12:30:00.000Z',
						}),
						createDatabaseMemoryRecord(),
					];
				},
				async upsertMemory() {},
			},
		});

		expect(records).toEqual([
			{
				content: 'User prefers concise code review summaries.',
				created_at: '2026-04-11T12:20:00.000Z',
				memory_id: 'memory_store_record_2',
				scope: 'user',
				scope_id: 'user_1',
				source_kind: 'user_explicit',
				source_run_id: 'run_memory_store_1',
				source_trace_id: 'trace_memory_store_1',
				status: 'active',
				summary: 'Most recent memory.',
				updated_at: '2026-04-11T12:30:00.000Z',
			},
			{
				content: 'User prefers concise code review summaries.',
				created_at: '2026-04-11T12:00:00.000Z',
				memory_id: 'memory_store_record_1',
				scope: 'user',
				scope_id: 'user_1',
				source_kind: 'user_explicit',
				source_run_id: 'run_memory_store_1',
				source_trace_id: 'trace_memory_store_1',
				status: 'active',
				summary: 'User prefers concise summaries.',
				updated_at: '2026-04-11T12:00:00.000Z',
			},
		]);
	});

	it('archives active memories and returns archived records', async () => {
		const upsertMemory: MemoryRecordWriter['upsertMemory'] = vi.fn().mockResolvedValue(undefined);

		const archivedRecord = await archiveMemory(
			{
				archived_at: '2026-04-11T12:40:00.000Z',
				memory_id: 'memory_store_record_1',
			},
			{
				writer: {
					async getMemoryById() {
						return createDatabaseMemoryRecord();
					},
					async listActiveMemories() {
						return [];
					},
					upsertMemory,
				},
			},
		);

		expect(upsertMemory).toHaveBeenCalledWith({
			archived_at: '2026-04-11T12:40:00.000Z',
			content: 'User prefers concise code review summaries.',
			created_at: '2026-04-11T12:00:00.000Z',
			memory_id: 'memory_store_record_1',
			scope: 'user',
			scope_id: 'user_1',
			source_kind: 'user_explicit',
			source_run_id: 'run_memory_store_1',
			source_trace_id: 'trace_memory_store_1',
			status: 'archived',
			summary: 'User prefers concise summaries.',
			tenant_id: null,
			updated_at: '2026-04-11T12:40:00.000Z',
			user_id: null,
			workspace_id: null,
		});

		expect(archivedRecord).toEqual({
			archived_at: '2026-04-11T12:40:00.000Z',
			content: 'User prefers concise code review summaries.',
			created_at: '2026-04-11T12:00:00.000Z',
			memory_id: 'memory_store_record_1',
			scope: 'user',
			scope_id: 'user_1',
			source_kind: 'user_explicit',
			source_run_id: 'run_memory_store_1',
			source_trace_id: 'trace_memory_store_1',
			status: 'archived',
			summary: 'User prefers concise summaries.',
			updated_at: '2026-04-11T12:40:00.000Z',
		});
	});

	it('does not rewrite memories that are already archived', async () => {
		const upsertMemory: MemoryRecordWriter['upsertMemory'] = vi.fn().mockResolvedValue(undefined);

		const archivedRecord = await archiveMemory(
			{
				memory_id: 'memory_store_archived_1',
			},
			{
				writer: {
					async getMemoryById() {
						return createDatabaseMemoryRecord({
							archived_at: '2026-04-11T12:45:00.000Z',
							memory_id: 'memory_store_archived_1',
							status: 'archived',
							updated_at: '2026-04-11T12:45:00.000Z',
						});
					},
					async listActiveMemories() {
						return [];
					},
					upsertMemory,
				},
			},
		);

		expect(upsertMemory).not.toHaveBeenCalled();
		expect(archivedRecord).toEqual({
			archived_at: '2026-04-11T12:45:00.000Z',
			content: 'User prefers concise code review summaries.',
			created_at: '2026-04-11T12:00:00.000Z',
			memory_id: 'memory_store_archived_1',
			scope: 'user',
			scope_id: 'user_1',
			source_kind: 'user_explicit',
			source_run_id: 'run_memory_store_1',
			source_trace_id: 'trace_memory_store_1',
			status: 'archived',
			summary: 'User prefers concise summaries.',
			updated_at: '2026-04-11T12:45:00.000Z',
		});
	});

	it('supersedes active memories and returns superseded records', async () => {
		const upsertMemory: MemoryRecordWriter['upsertMemory'] = vi.fn().mockResolvedValue(undefined);

		const supersededRecord = await supersedeMemory(
			{
				memory_id: 'memory_store_record_1',
				superseded_at: '2026-04-11T12:50:00.000Z',
			},
			{
				writer: {
					async getMemoryById() {
						return createDatabaseMemoryRecord();
					},
					async listActiveMemories() {
						return [];
					},
					upsertMemory,
				},
			},
		);

		expect(upsertMemory).toHaveBeenCalledWith({
			archived_at: '2026-04-11T12:50:00.000Z',
			content: 'User prefers concise code review summaries.',
			created_at: '2026-04-11T12:00:00.000Z',
			memory_id: 'memory_store_record_1',
			scope: 'user',
			scope_id: 'user_1',
			source_kind: 'user_explicit',
			source_run_id: 'run_memory_store_1',
			source_trace_id: 'trace_memory_store_1',
			status: 'superseded',
			summary: 'User prefers concise summaries.',
			tenant_id: null,
			updated_at: '2026-04-11T12:50:00.000Z',
			user_id: null,
			workspace_id: null,
		});

		expect(supersededRecord).toEqual({
			archived_at: '2026-04-11T12:50:00.000Z',
			content: 'User prefers concise code review summaries.',
			created_at: '2026-04-11T12:00:00.000Z',
			memory_id: 'memory_store_record_1',
			scope: 'user',
			scope_id: 'user_1',
			source_kind: 'user_explicit',
			source_run_id: 'run_memory_store_1',
			source_trace_id: 'trace_memory_store_1',
			status: 'superseded',
			summary: 'User prefers concise summaries.',
			updated_at: '2026-04-11T12:50:00.000Z',
		});
	});

	it('does not rewrite memories that are already superseded', async () => {
		const upsertMemory: MemoryRecordWriter['upsertMemory'] = vi.fn().mockResolvedValue(undefined);

		const supersededRecord = await supersedeMemory(
			{
				memory_id: 'memory_store_superseded_1',
			},
			{
				writer: {
					async getMemoryById() {
						return createDatabaseMemoryRecord({
							archived_at: '2026-04-11T12:55:00.000Z',
							memory_id: 'memory_store_superseded_1',
							status: 'superseded',
							updated_at: '2026-04-11T12:55:00.000Z',
						});
					},
					async listActiveMemories() {
						return [];
					},
					upsertMemory,
				},
			},
		);

		expect(upsertMemory).not.toHaveBeenCalled();
		expect(supersededRecord).toEqual({
			archived_at: '2026-04-11T12:55:00.000Z',
			content: 'User prefers concise code review summaries.',
			created_at: '2026-04-11T12:00:00.000Z',
			memory_id: 'memory_store_superseded_1',
			scope: 'user',
			scope_id: 'user_1',
			source_kind: 'user_explicit',
			source_run_id: 'run_memory_store_1',
			source_trace_id: 'trace_memory_store_1',
			status: 'superseded',
			summary: 'User prefers concise summaries.',
			updated_at: '2026-04-11T12:55:00.000Z',
		});
	});

	it('wraps read failures in a typed error', async () => {
		await expect(
			getMemoryById('memory_store_read_failure', {
				writer: {
					async getMemoryById() {
						throw new Error('read failed');
					},
					async listActiveMemories() {
						return [];
					},
					async upsertMemory() {},
				},
			}),
		).rejects.toThrowError(MemoryStoreReadError);
	});

	it('wraps write failures in a typed error', async () => {
		await expect(
			createMemory(
				{
					content: 'Persist this memory.',
					scope: 'user',
					scope_id: 'user_write_failure',
					source_kind: 'conversation',
					summary: 'Conversation memory.',
				},
				{
					writer: {
						async getMemoryById() {
							return null;
						},
						async listActiveMemories() {
							return [];
						},
						async upsertMemory() {
							throw new Error('write failed');
						},
					},
				},
			),
		).rejects.toThrowError(MemoryStoreWriteError);
	});

	it('logs active memory read failures only when persistence debug is enabled', async () => {
		const environment = getMutableEnvironment();
		environment.RUNA_DEBUG_PERSISTENCE = '1';
		environment.DATABASE_TARGET = 'local';
		environment.DATABASE_URL = 'postgres://local-debug/runtime';

		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(
			listActiveMemories('workspace', 'workspace_debug', {
				writer: {
					async getMemoryById() {
						return null;
					},
					async listActiveMemories() {
						throw new Error('read failed');
					},
					async upsertMemory() {},
				},
			}),
		).rejects.toThrowError(MemoryStoreReadError);

		expect(consoleErrorSpy).toHaveBeenCalledWith('[persistence.error.debug]', {
			database_url_source: 'DATABASE_URL',
			error_message: 'read failed',
			error_name: 'Error',
			operation: 'read_active_memories',
			run_id: undefined,
			stage: 'list_active_memories:workspace',
			store: 'memory-store',
			table: 'memories',
			target: 'local',
			target_source: 'DATABASE_TARGET',
			trace_id: undefined,
		});
	});

	it('keeps active memory read debug logging silent by default', async () => {
		const environment = getMutableEnvironment();
		environment.DATABASE_TARGET = 'local';
		environment.DATABASE_URL = 'postgres://local-debug/runtime';

		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(
			listActiveMemories('workspace', 'workspace_debug', {
				writer: {
					async getMemoryById() {
						return null;
					},
					async listActiveMemories() {
						throw new Error('read failed');
					},
					async upsertMemory() {},
				},
			}),
		).rejects.toThrowError(MemoryStoreReadError);

		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});
});
