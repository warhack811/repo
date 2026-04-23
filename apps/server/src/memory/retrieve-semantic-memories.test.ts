import type { MemoryRecord, MemoryScope } from '@runa/types';

import { describe, expect, it } from 'vitest';

import { retrieveSemanticMemories } from './retrieve-semantic-memories.js';

function createMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
	return {
		content: 'The project theme is blue and uses pnpm.',
		created_at: '2026-04-11T12:00:00.000Z',
		memory_id: 'memory_semantic_1',
		scope: 'workspace',
		scope_id: 'workspace_1',
		source_kind: 'tool_result',
		source_run_id: 'run_semantic_1',
		source_trace_id: 'trace_semantic_1',
		status: 'active',
		summary: 'Project theme and package manager',
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

describe('retrieveSemanticMemories', () => {
	it('prefers semantically matching memories over merely newer ones', async () => {
		const records = await retrieveSemanticMemories({
			memory_store: createMemoryStore([
				createMemoryRecord({
					content: 'The project theme is blue and the assistant should keep it consistent.',
					memory_id: 'memory_semantic_theme',
					summary: 'Project theme is blue',
					updated_at: '2026-04-11T12:01:00.000Z',
				}),
				createMemoryRecord({
					content: 'The repo exposes a websocket transport and approval flow.',
					memory_id: 'memory_semantic_ws',
					summary: 'Repo transport shape',
					updated_at: '2026-04-11T12:30:00.000Z',
				}),
			]),
			query: 'What is the project theme color?',
			scope: 'workspace',
			scope_id: 'workspace_1',
		});

		expect(records[0]).toMatchObject({
			matched_terms: expect.arrayContaining(['project', 'theme']),
			memory_id: 'memory_semantic_theme',
			retrieval_reason: 'semantic_overlap',
		});
	});

	it('falls back to deterministic recency when no semantic overlap exists', async () => {
		const records = await retrieveSemanticMemories({
			memory_store: createMemoryStore([
				createMemoryRecord({
					content: 'Older memory.',
					memory_id: 'memory_semantic_old',
					summary: 'Older note',
					updated_at: '2026-04-11T12:01:00.000Z',
				}),
				createMemoryRecord({
					content: 'Newest memory.',
					memory_id: 'memory_semantic_new',
					summary: 'Newest note',
					updated_at: '2026-04-11T12:30:00.000Z',
				}),
			]),
			query: 'totally unrelated query terms',
			scope: 'workspace',
			scope_id: 'workspace_1',
		});

		expect(records[0]).toMatchObject({
			memory_id: 'memory_semantic_new',
			retrieval_reason: 'recent_fallback',
		});
	});
});
