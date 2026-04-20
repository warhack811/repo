import type { ToolResult } from '@runa/types';
import { describe, expect, it } from 'vitest';

import type { IngestedToolResult } from '../runtime/ingest-tool-result.js';
import { mapDiffResultToBlock, mapToolResultToDiffBlock } from './map-diff-result.js';

const createdAt = '2026-04-11T10:00:00.000Z';

describe('map-diff-result', () => {
	it('maps a git.diff success result into a diff_block', () => {
		const result: ToolResult<
			'git.diff',
			{
				changed_paths: readonly string[];
				diff_text: string;
				is_truncated: boolean;
			}
		> = {
			call_id: 'call_diff_success',
			output: {
				changed_paths: ['src/example.ts'],
				diff_text: '@@ -1 +1 @@\n-old\n+new\n',
				is_truncated: false,
			},
			status: 'success',
			tool_name: 'git.diff',
		};

		const block = mapToolResultToDiffBlock({
			call_id: 'call_diff_success',
			created_at: createdAt,
			result,
			tool_name: 'git.diff',
		});

		expect(block).toEqual({
			created_at: createdAt,
			id: 'diff_block:src/example.ts:call_diff_success',
			payload: {
				changed_paths: ['src/example.ts'],
				diff_text: '@@ -1 +1 @@\n-old\n+new\n',
				is_truncated: undefined,
				path: 'src/example.ts',
				summary: 'Diff preview for 1 changed path.',
				title: 'src/example.ts',
			},
			schema_version: 1,
			type: 'diff_block',
		});
	});

	it('preserves truncation metadata in the shared diff surface', () => {
		const block = mapDiffResultToBlock({
			call_id: 'call_diff_direct',
			changed_paths: ['src/a.ts', 'src/b.ts'],
			created_at: createdAt,
			diff_text: 'diff --git a/src/a.ts b/src/a.ts\n... [truncated]',
			is_truncated: true,
		});

		expect(block.payload).toMatchObject({
			changed_paths: ['src/a.ts', 'src/b.ts'],
			diff_text: 'diff --git a/src/a.ts b/src/a.ts\n... [truncated]',
			is_truncated: true,
			path: undefined,
			summary: 'Diff preview for 2 changed paths.',
			title: 'Git Diff',
		});
	});

	it('maps an ingested git.diff result into the same diff_block surface', () => {
		const result: IngestedToolResult = {
			call_id: 'call_diff_ingested',
			kind: 'tool_result',
			output: {
				changed_paths: [],
				diff_text: '',
				is_truncated: false,
			},
			result_status: 'success',
			tool_name: 'git.diff',
		};

		const block = mapToolResultToDiffBlock({
			call_id: 'call_diff_ingested',
			created_at: createdAt,
			result,
			tool_name: 'git.diff',
		});

		expect(block?.payload).toMatchObject({
			changed_paths: undefined,
			diff_text: '',
			is_truncated: undefined,
			path: undefined,
			summary: 'Diff preview returned no changed paths.',
			title: 'Git Diff',
		});
	});

	it('returns undefined for non-git.diff results', () => {
		const result: ToolResult<'file.read', { content: string }> = {
			call_id: 'call_not_diff',
			output: {
				content: 'hello',
			},
			status: 'success',
			tool_name: 'file.read',
		};

		expect(
			mapToolResultToDiffBlock({
				call_id: 'call_not_diff',
				created_at: createdAt,
				result,
				tool_name: 'git.diff',
			}),
		).toBeUndefined();
	});
});
