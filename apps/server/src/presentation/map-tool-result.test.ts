import type { ToolResult } from '@runa/types';
import { describe, expect, it } from 'vitest';

import type { IngestedToolResult } from '../runtime/ingest-tool-result.js';
import { mapToolResultToBlock } from './map-tool-result.js';

const createdAt = '2026-04-10T10:00:00.000Z';

describe('map-tool-result', () => {
	it('maps a success ToolResult to a tool_result block', () => {
		const result: ToolResult<'file.read', string> = {
			call_id: 'call_success_tool',
			output: 'README contents',
			status: 'success',
			tool_name: 'file.read',
		};

		const block = mapToolResultToBlock({
			call_id: 'call_success_tool',
			created_at: createdAt,
			result,
			tool_name: 'file.read',
		});

		expect(block).toMatchObject({
			created_at: createdAt,
			id: 'tool_result:file.read:call_success_tool',
			payload: {
				call_id: 'call_success_tool',
				result_preview: {
					kind: 'string',
					summary_text: 'README contents',
				},
				status: 'success',
				summary: 'file.read completed successfully.',
				tool_name: 'file.read',
			},
			schema_version: 1,
			type: 'tool_result',
		});
	});

	it('maps an error ToolResult to a tool_result block with error_code', () => {
		const result: ToolResult<'shell.exec'> = {
			call_id: 'call_error_tool',
			error_code: 'TIMEOUT',
			error_message: 'Command exceeded timeout window',
			status: 'error',
			tool_name: 'shell.exec',
		};

		const block = mapToolResultToBlock({
			call_id: 'call_error_tool',
			created_at: createdAt,
			result,
			tool_name: 'shell.exec',
		});

		expect(block).toMatchObject({
			payload: {
				call_id: 'call_error_tool',
				error_code: 'TIMEOUT',
				result_preview: undefined,
				status: 'error',
				summary: 'shell.exec failed: Command exceeded timeout window',
				tool_name: 'shell.exec',
			},
			type: 'tool_result',
		});
	});

	it('uses product language for agent delegation role validation errors', () => {
		const result: ToolResult<'agent.delegate'> = {
			call_id: 'call_delegate_role',
			details: {
				allowed_values: ['researcher', 'reviewer', 'coder'],
				argument: 'sub_agent_role',
				reason: 'invalid_role',
			},
			error_code: 'INVALID_INPUT',
			error_message: 'Runa could not safely choose a sub-agent role for this delegated step.',
			status: 'error',
			tool_name: 'agent.delegate',
		};

		const block = mapToolResultToBlock({
			call_id: 'call_delegate_role',
			created_at: createdAt,
			result,
			tool_name: 'agent.delegate',
		});

		expect(block.payload).toMatchObject({
			call_id: 'call_delegate_role',
			error_code: 'INVALID_INPUT',
			status: 'error',
			summary:
				'Runa could not safely start that delegated step, so it stopped before taking action.',
			tool_name: 'agent.delegate',
		});
	});

	it('maps an ingested tool result using the same shared block surface', () => {
		const result: IngestedToolResult = {
			call_id: 'call_ingested_tool',
			kind: 'tool_result',
			output: {
				beta: true,
				alpha: 'first',
				gamma: 3,
				delta: 'extra',
			},
			result_status: 'success',
			tool_name: 'file.list',
		};

		const block = mapToolResultToBlock({
			call_id: 'call_ingested_tool',
			created_at: createdAt,
			result,
			tool_name: 'file.list',
		});

		expect(block.payload).toMatchObject({
			call_id: 'call_ingested_tool',
			result_preview: {
				kind: 'object',
				summary_text: 'Object{alpha, beta, delta}, +1 more',
			},
			status: 'success',
			summary: 'file.list completed successfully.',
			tool_name: 'file.list',
		});
	});

	it('truncates large string previews deterministically', () => {
		const result: ToolResult<'file.read', string> = {
			call_id: 'call_long_preview',
			output: 'a'.repeat(140),
			status: 'success',
			tool_name: 'file.read',
		};

		const block = mapToolResultToBlock({
			call_id: 'call_long_preview',
			created_at: createdAt,
			result,
			tool_name: 'file.read',
		});

		expect(block.payload.result_preview).toMatchObject({
			kind: 'string',
			summary_text: `${'a'.repeat(117)}...`,
		});
	});

	it('makes already_applied idempotent successes distinguishable without changing block type', () => {
		const result: ToolResult<
			'file.write',
			{
				bytes_written: number;
				created: boolean;
				effect: 'already_applied';
				encoding: 'utf8';
				idempotency_key: string;
				overwritten: boolean;
				path: string;
			}
		> = {
			call_id: 'call_idempotent_tool',
			output: {
				bytes_written: 0,
				created: false,
				effect: 'already_applied',
				encoding: 'utf8',
				idempotency_key: 'file.write:abc123',
				overwritten: false,
				path: '/workspace/file.txt',
			},
			status: 'success',
			tool_name: 'file.write',
		};

		const block = mapToolResultToBlock({
			call_id: 'call_idempotent_tool',
			created_at: createdAt,
			result,
			tool_name: 'file.write',
		});

		expect(block.payload).toMatchObject({
			call_id: 'call_idempotent_tool',
			status: 'success',
			summary: 'file.write already applied; skipped duplicate execution.',
			tool_name: 'file.write',
		});
	});

	it('returns the same block for the same input', () => {
		const result: ToolResult<'search.grep', readonly string[]> = {
			call_id: 'call_repeat_tool',
			output: ['match one', 'match two'],
			status: 'success',
			tool_name: 'search.grep',
		};

		const input = {
			call_id: 'call_repeat_tool',
			created_at: createdAt,
			result,
			tool_name: 'search.grep' as const,
		};

		const first = mapToolResultToBlock(input);
		const second = mapToolResultToBlock(input);

		expect(first).toEqual(second);
	});

	it('includes server-side user-facing tool copy for built-in tools', () => {
		const result: ToolResult<'shell.exec', string> = {
			call_id: 'call_user_copy',
			output: 'ok',
			status: 'success',
			tool_name: 'shell.exec',
		};

		const block = mapToolResultToBlock({
			call_id: 'call_user_copy',
			created_at: createdAt,
			result,
			tool_name: 'shell.exec',
		});

		expect(block.payload.user_label_tr).toBe('Terminal komutu');
		expect(block.payload.user_summary_tr).toBe(
			'Bagli oturumda komut calistirilir, ciktisi sohbete eklenir.',
		);
	});
});
