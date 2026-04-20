import type { ToolResult } from '@runa/types';
import { describe, expect, it } from 'vitest';

import type { IngestedToolResult } from '../runtime/ingest-tool-result.js';
import { mapCodeResultToBlock, mapToolResultToCodeBlock } from './map-code-result.js';

const createdAt = '2026-04-10T10:00:00.000Z';

describe('map-code-result', () => {
	it('maps a generic code preview into a code_block', () => {
		const block = mapCodeResultToBlock({
			content: 'export const value = 1;\n',
			created_at: createdAt,
			path: 'src/example.ts',
			summary: 'Preview of generated file.',
		});

		expect(block).toEqual({
			created_at: createdAt,
			id: 'code_block:src/example.ts:2026-04-10T10:00:00.000Z',
			payload: {
				content: 'export const value = 1;\n',
				diff_kind: undefined,
				language: 'typescript',
				path: 'src/example.ts',
				summary: 'Preview of generated file.',
				title: 'src/example.ts',
			},
			schema_version: 1,
			type: 'code_block',
		});
	});

	it('maps a file.read success result into a code_block preview', () => {
		const result: ToolResult<'file.read', { content: string; path: string }> = {
			call_id: 'call_code_block_read',
			output: {
				content: 'console.log("hello");\n',
				path: 'src/example.ts',
			},
			status: 'success',
			tool_name: 'file.read',
		};

		const block = mapToolResultToCodeBlock({
			call_id: 'call_code_block_read',
			created_at: createdAt,
			result,
			tool_name: 'file.read',
		});

		expect(block).toMatchObject({
			payload: {
				content: 'console.log("hello");\n',
				diff_kind: 'after',
				language: 'typescript',
				path: 'src/example.ts',
				summary: 'Code preview from src/example.ts',
				title: 'src/example.ts',
			},
			type: 'code_block',
		});
	});

	it('maps an ingested file.read result into the same code_block surface', () => {
		const result: IngestedToolResult = {
			call_id: 'call_code_block_ingested',
			kind: 'tool_result',
			output: {
				content: '# README\n',
				path: 'README.md',
			},
			result_status: 'success',
			tool_name: 'file.read',
		};

		const block = mapToolResultToCodeBlock({
			call_id: 'call_code_block_ingested',
			created_at: createdAt,
			result,
			tool_name: 'file.read',
		});

		expect(block?.payload).toMatchObject({
			content: '# README\n',
			diff_kind: 'after',
			language: 'markdown',
			path: 'README.md',
		});
	});

	it('returns undefined for non-code tool outputs', () => {
		const result: ToolResult<'file.write', { path: string }> = {
			call_id: 'call_code_block_write',
			output: {
				path: 'src/example.ts',
			},
			status: 'success',
			tool_name: 'file.write',
		};

		expect(
			mapToolResultToCodeBlock({
				call_id: 'call_code_block_write',
				created_at: createdAt,
				result,
				tool_name: 'file.write',
			}),
		).toBeUndefined();
	});

	it('truncates large content previews deterministically', () => {
		const block = mapCodeResultToBlock({
			content: `${'a'.repeat(820)}\nEND`,
			created_at: createdAt,
			path: 'src/large.txt',
		});

		expect(block.payload.content.endsWith('\n...')).toBe(true);
		expect(block.payload.content.length).toBe(800);
	});
});
