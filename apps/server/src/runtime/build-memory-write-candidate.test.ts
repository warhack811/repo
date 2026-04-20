import { describe, expect, it } from 'vitest';

import { buildMemoryWriteCandidate } from './build-memory-write-candidate.js';

describe('buildMemoryWriteCandidate', () => {
	it('creates a preference candidate for explicit low-risk user preference text', () => {
		const result = buildMemoryWriteCandidate({
			candidate_policy: 'user_preference',
			run_id: 'run_memory_preference_candidate_1',
			scope: 'user',
			scope_id: 'local_default_user',
			source: {
				kind: 'user_text',
				text: 'Yanitlari Turkce ver.',
			},
			trace_id: 'trace_memory_preference_candidate_1',
		});

		expect(result).toEqual({
			candidate: {
				content: 'Reply in Turkish by default.',
				scope: 'user',
				scope_id: 'local_default_user',
				source_kind: 'user_preference',
				source_run_id: 'run_memory_preference_candidate_1',
				source_trace_id: 'trace_memory_preference_candidate_1',
				summary: 'Language preference',
			},
			status: 'candidate_created',
		});
	});

	it('rejects non-matching or sensitive user text in preference mode', () => {
		expect(
			buildMemoryWriteCandidate({
				candidate_policy: 'user_preference',
				scope: 'user',
				scope_id: 'local_default_user',
				source: {
					kind: 'user_text',
					text: 'Bug var mi?',
				},
			}),
		).toEqual({
			reason: 'insufficient_signal',
			status: 'no_candidate',
		});

		expect(
			buildMemoryWriteCandidate({
				candidate_policy: 'user_preference',
				scope: 'user',
				scope_id: 'local_default_user',
				source: {
					kind: 'user_text',
					text: 'My political preference is private.',
				},
			}),
		).toEqual({
			reason: 'insufficient_signal',
			status: 'no_candidate',
		});
	});

	it('creates a candidate for explicit user memory intent', () => {
		const result = buildMemoryWriteCandidate({
			run_id: 'run_memory_candidate_1',
			scope: 'user',
			scope_id: 'user_1',
			source: {
				kind: 'user_text',
				text: 'Bunu hatirla:   bu workspace icin paket kurulumu yaparken pnpm kullan.  ',
			},
			trace_id: 'trace_memory_candidate_1',
		});

		expect(result).toEqual({
			candidate: {
				content: 'bu workspace icin paket kurulumu yaparken pnpm kullan.',
				scope: 'user',
				scope_id: 'user_1',
				source_kind: 'user_explicit',
				source_run_id: 'run_memory_candidate_1',
				source_trace_id: 'trace_memory_candidate_1',
				summary: 'bu workspace icin paket kurulumu yaparken pnpm kullan.',
			},
			status: 'candidate_created',
		});
	});

	it('returns no_candidate for non-explicit or noisy user text', () => {
		expect(
			buildMemoryWriteCandidate({
				scope: 'user',
				scope_id: 'user_2',
				source: {
					kind: 'user_text',
					text: 'Bug var mi?',
				},
			}),
		).toEqual({
			reason: 'insufficient_signal',
			status: 'no_candidate',
		});

		expect(
			buildMemoryWriteCandidate({
				scope: 'user',
				scope_id: 'user_2',
				source: {
					kind: 'user_text',
					text: '   ',
				},
			}),
		).toEqual({
			reason: 'empty_content',
			status: 'no_candidate',
		});
	});

	it('creates a candidate from tool summaries and carries run and trace ids', () => {
		const result = buildMemoryWriteCandidate({
			run_id: 'run_memory_candidate_tool',
			scope: 'workspace',
			scope_id: 'workspace_1',
			source: {
				content: 'Workspace package manager is pnpm@9.',
				kind: 'tool_result',
				summary: 'Workspace package manager is pnpm.',
			},
			trace_id: 'trace_memory_candidate_tool',
		});

		expect(result).toEqual({
			candidate: {
				content: 'Workspace package manager is pnpm@9.',
				scope: 'workspace',
				scope_id: 'workspace_1',
				source_kind: 'tool_result',
				source_run_id: 'run_memory_candidate_tool',
				source_trace_id: 'trace_memory_candidate_tool',
				summary: 'Workspace package manager is pnpm.',
			},
			status: 'candidate_created',
		});
	});

	it('creates a candidate from assistant summaries using system_inferred source kind', () => {
		const result = buildMemoryWriteCandidate({
			scope: 'user',
			scope_id: 'user_3',
			source: {
				content: 'Prefer concise code review summaries with blocker-first ordering.',
				kind: 'assistant_text',
				summary: 'User prefers concise blocker-first code review summaries.',
			},
		});

		expect(result).toEqual({
			candidate: {
				content: 'Prefer concise code review summaries with blocker-first ordering.',
				scope: 'user',
				scope_id: 'user_3',
				source_kind: 'system_inferred',
				source_run_id: undefined,
				source_trace_id: undefined,
				summary: 'User prefers concise blocker-first code review summaries.',
			},
			status: 'candidate_created',
		});
	});

	it('truncates overly long candidate content and summaries deterministically', () => {
		const repeatedContent = `Remember this: ${'x'.repeat(400)}`;
		const result = buildMemoryWriteCandidate({
			scope: 'user',
			scope_id: 'user_4',
			source: {
				kind: 'user_text',
				text: repeatedContent,
			},
		});

		expect(result.status).toBe('candidate_created');

		if (result.status !== 'candidate_created') {
			throw new Error('Expected candidate_created result.');
		}

		expect(result.candidate.content.length).toBeLessThanOrEqual(280);
		expect(result.candidate.summary.length).toBeLessThanOrEqual(120);
		expect(result.candidate.content.endsWith('...')).toBe(true);
		expect(result.candidate.summary.endsWith('...')).toBe(true);
	});

	it('fails clearly when scope_id is empty', () => {
		const result = buildMemoryWriteCandidate({
			scope: 'workspace',
			scope_id: '   ',
			source: {
				kind: 'tool_result',
				summary: 'Workspace package manager is pnpm.',
			},
		});

		expect(result).toEqual({
			failure: {
				code: 'INVALID_SCOPE_ID',
				message: 'buildMemoryWriteCandidate requires a non-empty scope_id.',
			},
			status: 'failed',
		});
	});
});
