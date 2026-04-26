import { describe, expect, it } from 'vitest';

import { parseOutputToStructuredNodes } from './output-parser.js';

describe('parseOutputToStructuredNodes', () => {
	it('falls back to raw text when no structured output is recognized', () => {
		const result = parseOutputToStructuredNodes('This is a normal assistant response.');

		expect(result).toEqual({
			confidence: 'low',
			kind: 'raw_text',
			nodes: [],
			raw_text: 'This is a normal assistant response.',
		});
	});

	it('recognizes fenced code blocks and keeps the raw text intact', () => {
		const rawOutput = [
			'Use this helper:',
			'```ts apps/server/src/example.ts',
			'export const value = 1;',
			'```',
		].join('\n');

		const result = parseOutputToStructuredNodes(rawOutput);

		expect(result.kind).toBe('structured');
		expect(result.confidence).toBe('high');
		expect(result.raw_text).toBe(rawOutput);
		expect(result.nodes).toMatchObject([
			{
				kind: 'text',
				text: 'Use this helper:',
			},
			{
				content: 'export const value = 1;',
				filename: 'apps/server/src/example.ts',
				is_truncated: false,
				kind: 'code',
				language: 'ts',
				line_count: 1,
			},
		]);
	});

	it('truncates large fenced code content deterministically', () => {
		const result = parseOutputToStructuredNodes(['```txt', 'a'.repeat(80), '```'].join('\n'), {
			inline_content_limit: 24,
		});

		const codeNode = result.nodes.find((node) => node.kind === 'code');

		expect(codeNode).toMatchObject({
			content: `${'a'.repeat(20)}\n...`,
			is_truncated: true,
			kind: 'code',
		});
	});

	it('recognizes markdown tables', () => {
		const result = parseOutputToStructuredNodes(
			['| File | Status |', '| --- | --- |', '| a.ts | done |', '| b.ts | pending |'].join('\n'),
		);

		expect(result.kind).toBe('structured');
		expect(result.nodes).toEqual([
			{
				headers: ['File', 'Status'],
				kind: 'table',
				rows: [
					['a.ts', 'done'],
					['b.ts', 'pending'],
				],
			},
		]);
	});

	it('recognizes checklist and numbered plans', () => {
		const checklist = parseOutputToStructuredNodes(
			['- [x] Read current renderer', '- [ ] Add parser tests', '- [-] Skip redesign'].join('\n'),
		);
		const numbered = parseOutputToStructuredNodes(
			['1. Parse text', '2. Verify fallback'].join('\n'),
		);

		expect(checklist.nodes).toEqual([
			{
				is_ordered: false,
				kind: 'plan',
				steps: [
					{ status: 'done', text: 'Read current renderer' },
					{ status: 'pending', text: 'Add parser tests' },
					{ status: 'skipped', text: 'Skip redesign' },
				],
			},
		]);
		expect(numbered.nodes).toEqual([
			{
				is_ordered: true,
				kind: 'plan',
				steps: [
					{ status: 'pending', text: 'Parse text' },
					{ status: 'pending', text: 'Verify fallback' },
				],
			},
		]);
	});

	it('recognizes conservative file references with line metadata', () => {
		const result = parseOutputToStructuredNodes(
			'Check `apps/server/src/ws/presentation.ts:10-12` and packages/types/src/blocks.ts.',
		);

		expect(result.kind).toBe('structured');
		expect(result.confidence).toBe('medium');
		expect(result.nodes).toEqual([
			{
				kind: 'file_reference',
				line_end: 12,
				line_start: 10,
				path: 'apps/server/src/ws/presentation.ts',
			},
			{
				kind: 'file_reference',
				line_end: undefined,
				line_start: undefined,
				path: 'packages/types/src/blocks.ts',
			},
			{
				kind: 'text',
				text: 'Check `apps/server/src/ws/presentation.ts:10-12` and packages/types/src/blocks.ts.',
			},
		]);
	});

	it('ignores unterminated code fences instead of dropping output', () => {
		const rawOutput = ['Before', '```ts', 'const value = 1;'].join('\n');
		const result = parseOutputToStructuredNodes(rawOutput);

		expect(result).toEqual({
			confidence: 'low',
			kind: 'raw_text',
			nodes: [],
			raw_text: rawOutput,
		});
	});
});
