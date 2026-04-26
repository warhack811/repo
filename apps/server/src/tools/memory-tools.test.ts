import type { MemoryRecord, MemoryScope } from '@runa/types';

import { describe, expect, it } from 'vitest';

import { createMemoryDeleteTool } from './memory-delete.js';
import { createMemoryListTool } from './memory-list.js';
import { createMemorySaveTool } from './memory-save.js';
import { createMemorySearchTool } from './memory-search.js';

function createMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
	return {
		content: 'Runa should keep answers concise when the user asks for status.',
		created_at: '2026-04-25T10:00:00.000Z',
		memory_id: 'memory_1',
		scope: 'workspace',
		scope_id: 'D:/ai/Runa',
		source_kind: 'explicit',
		source_run_id: 'run_memory_1',
		source_trace_id: 'trace_memory_1',
		status: 'active',
		summary: 'Concise status preference.',
		updated_at: '2026-04-25T10:00:00.000Z',
		...overrides,
	};
}

function createMemoryStore(initialRecords: readonly MemoryRecord[] = []) {
	const records = new Map(initialRecords.map((record) => [record.memory_id, record]));

	return {
		async archiveMemory(input: { readonly memory_id: string }) {
			const record = records.get(input.memory_id);

			if (!record) {
				return null;
			}

			const archivedRecord: MemoryRecord = {
				...record,
				archived_at: '2026-04-25T12:00:00.000Z',
				status: 'archived',
				updated_at: '2026-04-25T12:00:00.000Z',
			};
			records.set(input.memory_id, archivedRecord);
			return archivedRecord;
		},
		async createMemory(input: {
			readonly content: string;
			readonly scope: MemoryScope;
			readonly scope_id: string;
			readonly source_kind: MemoryRecord['source_kind'];
			readonly source_run_id?: string;
			readonly source_trace_id?: string;
			readonly summary: string;
		}) {
			const memory_id = `memory_${records.size + 1}`;
			const record = createMemoryRecord({
				content: input.content,
				memory_id,
				scope: input.scope,
				scope_id: input.scope_id,
				source_kind: input.source_kind,
				source_run_id: input.source_run_id,
				source_trace_id: input.source_trace_id,
				summary: input.summary,
			});
			records.set(memory_id, record);
			return record;
		},
		async getMemoryById(memory_id: string) {
			return records.get(memory_id) ?? null;
		},
		async listActiveMemories(scope: MemoryScope, scope_id: string) {
			return Array.from(records.values()).filter(
				(record) =>
					record.scope === scope && record.scope_id === scope_id && record.status === 'active',
			);
		},
	};
}

const toolContext = {
	run_id: 'run_memory_tool',
	trace_id: 'trace_memory_tool',
	working_directory: 'D:/ai/Runa',
} as const;

describe('memory.* tools', () => {
	it('saves explicit memory and rejects sensitive content', async () => {
		const memoryStore = createMemoryStore();
		const tool = createMemorySaveTool({ memory_store: memoryStore });

		const saved = await tool.execute(
			{
				arguments: {
					content: 'The user prefers concise implementation status updates.',
					source: 'explicit',
					summary: 'Concise status updates.',
				},
				call_id: 'call_memory_save_1',
				tool_name: 'memory.save',
			},
			toolContext,
		);

		expect(saved).toMatchObject({
			output: {
				scope: 'workspace',
				scope_id: 'D:/ai/Runa',
				source: 'explicit',
				status: 'saved',
			},
			status: 'success',
			tool_name: 'memory.save',
		});

		const rejected = await tool.execute(
			{
				arguments: {
					content: 'api_key = sk-secretvalue-that-should-not-persist',
					source: 'explicit',
				},
				call_id: 'call_memory_save_sensitive',
				tool_name: 'memory.save',
			},
			toolContext,
		);

		expect(rejected).toMatchObject({
			details: {
				matched_categories: expect.arrayContaining(['api_key', 'provider_secret']),
				reason: 'sensitive_content_rejected',
			},
			error_code: 'INVALID_INPUT',
			status: 'error',
			tool_name: 'memory.save',
		});
	});

	it('requires consent for inferred memory and keeps conversation memory feature-gated', async () => {
		const tool = createMemorySaveTool({ memory_store: createMemoryStore() });

		await expect(
			tool.execute(
				{
					arguments: {
						content: 'The user likely prefers short answers.',
						source: 'inferred',
					},
					call_id: 'call_memory_inferred_without_consent',
					tool_name: 'memory.save',
				},
				toolContext,
			),
		).resolves.toMatchObject({
			details: { reason: 'consent_required' },
			status: 'error',
		});

		await expect(
			tool.execute(
				{
					arguments: {
						consent_confirmed: true,
						content: 'Conversation summary candidate.',
						source: 'conversation',
					},
					call_id: 'call_memory_conversation_disabled',
					tool_name: 'memory.save',
				},
				toolContext,
			),
		).resolves.toMatchObject({
			details: { reason: 'conversation_memory_disabled' },
			status: 'error',
		});
	});

	it('searches and lists memories with provenance fields', async () => {
		const memoryStore = createMemoryStore([
			createMemoryRecord({
				content: 'Use pnpm.cmd for Windows package commands.',
				memory_id: 'memory_windows_pnpm',
				summary: 'Use pnpm.cmd on Windows.',
			}),
		]);
		const searchTool = createMemorySearchTool({ memory_store: memoryStore });
		const listTool = createMemoryListTool({ memory_store: memoryStore });

		const searchResult = await searchTool.execute(
			{
				arguments: {
					query: 'Windows package command',
				},
				call_id: 'call_memory_search_1',
				tool_name: 'memory.search',
			},
			toolContext,
		);

		expect(searchResult.status).toBe('success');

		if (searchResult.status !== 'success') {
			throw new Error('Expected memory.search success result.');
		}

		expect(searchResult.output.matches[0]).toEqual(
			expect.objectContaining({
				created_at: '2026-04-25T10:00:00.000Z',
				memory_id: 'memory_windows_pnpm',
				retrieval_reason: 'semantic_overlap',
				scope: 'workspace',
				source_kind: 'explicit',
			}),
		);

		const listResult = await listTool.execute(
			{
				arguments: {},
				call_id: 'call_memory_list_1',
				tool_name: 'memory.list',
			},
			toolContext,
		);

		expect(listResult).toMatchObject({
			output: {
				memories: [
					{
						memory_id: 'memory_windows_pnpm',
						scope: 'workspace',
						source_kind: 'explicit',
						summary: 'Use pnpm.cmd on Windows.',
					},
				],
				scope: 'workspace',
				scope_id: 'D:/ai/Runa',
			},
			status: 'success',
			tool_name: 'memory.list',
		});
	});

	it('soft-deletes only memories inside the requested scope', async () => {
		const memoryStore = createMemoryStore([
			createMemoryRecord({ memory_id: 'memory_delete_me' }),
			createMemoryRecord({
				memory_id: 'memory_other_scope',
				scope_id: 'D:/ai/Other',
			}),
		]);
		const tool = createMemoryDeleteTool({ memory_store: memoryStore });

		await expect(
			tool.execute(
				{
					arguments: {
						memory_id: 'memory_other_scope',
					},
					call_id: 'call_memory_delete_wrong_scope',
					tool_name: 'memory.delete',
				},
				toolContext,
			),
		).resolves.toMatchObject({
			error_code: 'PERMISSION_DENIED',
			status: 'error',
		});

		await expect(
			tool.execute(
				{
					arguments: {
						memory_id: 'memory_delete_me',
					},
					call_id: 'call_memory_delete_1',
					tool_name: 'memory.delete',
				},
				toolContext,
			),
		).resolves.toMatchObject({
			output: {
				memory_id: 'memory_delete_me',
				status: 'deleted',
			},
			status: 'success',
		});

		await expect(memoryStore.getMemoryById('memory_delete_me')).resolves.toMatchObject({
			status: 'archived',
		});
	});
});
