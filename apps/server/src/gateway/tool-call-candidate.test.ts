import { describe, expect, it } from 'vitest';

import { parseToolCallCandidatePartsDetailed } from './tool-call-candidate.js';

function parseToolInput(toolInput: unknown) {
	return parseToolCallCandidatePartsDetailed({
		call_id: 'call_parser_test',
		tool_input: toolInput,
		tool_name: 'file.read',
	});
}

describe('tool-call-candidate tolerant parser', () => {
	it('keeps strict JSON parsing as the first strategy', () => {
		expect(parseToolInput('{"path":"README.md"}')).toEqual({
			candidate: {
				call_id: 'call_parser_test',
				tool_input: {
					path: 'README.md',
				},
				tool_name: 'file.read',
			},
			repair_strategy: 'strict',
		});
	});

	it('accepts sanitized JSON with leading BOM and control characters', () => {
		expect(parseToolInput('\u0000\uFEFF{"path":"src/index.ts"}\u0007')).toEqual({
			candidate: {
				call_id: 'call_parser_test',
				tool_input: {
					path: 'src/index.ts',
				},
				tool_name: 'file.read',
			},
			repair_strategy: 'sanitized',
		});
	});

	it('accepts markdown fenced JSON arguments', () => {
		expect(parseToolInput('```json\n{"path":"apps/server/src/index.ts"}\n```')).toEqual({
			candidate: {
				call_id: 'call_parser_test',
				tool_input: {
					path: 'apps/server/src/index.ts',
				},
				tool_name: 'file.read',
			},
			repair_strategy: 'fence_stripped',
		});
	});

	it('accepts trailing commas without touching commas inside strings', () => {
		expect(parseToolInput('{"path":"docs/a,b.md","tags":["one,two",],}')).toEqual({
			candidate: {
				call_id: 'call_parser_test',
				tool_input: {
					path: 'docs/a,b.md',
					tags: ['one,two'],
				},
				tool_name: 'file.read',
			},
			repair_strategy: 'trailing_comma',
		});
	});

	it('accepts bare object members by wrapping them as a JSON object', () => {
		expect(parseToolInput('"path":"README.md","encoding":"utf8"')).toEqual({
			candidate: {
				call_id: 'call_parser_test',
				tool_input: {
					encoding: 'utf8',
					path: 'README.md',
				},
				tool_name: 'file.read',
			},
			repair_strategy: 'wrapped',
		});
	});

	it('keeps empty arguments as an empty object', () => {
		expect(parseToolInput(' \n\t ')).toEqual({
			candidate: {
				call_id: 'call_parser_test',
				tool_input: {},
				tool_name: 'file.read',
			},
			repair_strategy: 'empty_default',
		});
	});

	it('rejects arrays, primitives, and unrecoverable broken input', () => {
		expect(parseToolInput('["README.md"]')).toEqual({
			rejection_reason: 'unparseable_tool_input',
		});
		expect(parseToolInput('"README.md"')).toEqual({
			rejection_reason: 'unparseable_tool_input',
		});
		expect(parseToolInput('{"path"')).toEqual({
			rejection_reason: 'unparseable_tool_input',
		});
	});
});
