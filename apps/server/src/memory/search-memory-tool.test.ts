import type { MemoryRecord, MemoryScope } from '@runa/types';

import { describe, expect, it } from 'vitest';

import { createSearchMemoryTool } from './search-memory-tool.js';

function createMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
	return {
		content: 'The project theme is blue.',
		created_at: '2026-04-11T12:00:00.000Z',
		memory_id: 'memory_tool_1',
		scope: 'workspace',
		scope_id: 'D:/ai/Runa',
		source_kind: 'tool_result',
		source_run_id: 'run_tool_1',
		source_trace_id: 'trace_tool_1',
		status: 'active',
		summary: 'Project theme is blue',
		updated_at: '2026-04-11T12:10:00.000Z',
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

describe('search.memory tool', () => {
	it('returns relevant workspace matches for a query', async () => {
		const tool = createSearchMemoryTool({
			memory_store: createMemoryStore([
				createMemoryRecord(),
				createMemoryRecord({
					content: 'User prefers concise answers.',
					memory_id: 'memory_tool_2',
					scope: 'user',
					scope_id: 'local_default_user',
					source_kind: 'user_preference',
					summary: 'Response style preference',
				}),
			]),
		});

		const result = await tool.execute(
			{
				arguments: {
					query: 'theme color',
					scope: 'workspace',
				},
				call_id: 'call_search_memory_1',
				tool_name: 'search.memory',
			},
			{
				run_id: 'run_search_memory_1',
				trace_id: 'trace_search_memory_1',
				working_directory: 'D:/ai/Runa',
			},
		);

		expect(result.status).toBe('success');

		if (result.status !== 'success') {
			throw new Error('Expected search.memory success result.');
		}

		expect(result.output.matches).toEqual([
			expect.objectContaining({
				content: 'The project theme is blue.',
				scope: 'workspace',
				summary: 'Project theme is blue',
			}),
		]);
	});

	it('validates blank queries with a typed error', async () => {
		const tool = createSearchMemoryTool({
			memory_store: createMemoryStore([]),
		});

		const result = await tool.execute(
			{
				arguments: {
					query: '   ',
				},
				call_id: 'call_search_memory_invalid',
				tool_name: 'search.memory',
			},
			{
				run_id: 'run_search_memory_invalid',
				trace_id: 'trace_search_memory_invalid',
				working_directory: 'D:/ai/Runa',
			},
		);

		expect(result).toMatchObject({
			error_code: 'INVALID_INPUT',
			status: 'error',
			tool_name: 'search.memory',
		});
	});
});
