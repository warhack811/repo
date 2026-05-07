import type { ToolResult } from '@runa/types';

import { describe, expect, it } from 'vitest';

import { ingestToolResult } from './ingest-tool-result.js';

describe('ingestToolResult', () => {
	it('converts a successful tool result into a deterministic ingestion artifact', () => {
		const toolResult: ToolResult = {
			call_id: 'call_ingest_success',
			metadata: {
				source: 'tool',
			},
			output: {
				content: 'hello',
				path: 'README.md',
			},
			status: 'success',
			tool_name: 'file.read',
		};

		const result = ingestToolResult({
			call_id: 'call_ingest_success',
			current_state: 'TOOL_RESULT_INGESTING',
			run_id: 'run_ingest_success',
			tool_name: 'file.read',
			tool_result: toolResult,
			trace_id: 'trace_ingest_success',
		});

		expect(result.status).toBe('completed');

		if (result.status !== 'completed') {
			throw new Error('Expected successful ingestion result.');
		}

		expect(result.call_id).toBe('call_ingest_success');
		expect(result.tool_name).toBe('file.read');
		expect(result.tool_result).toBe(toolResult);
		expect(result.final_state).toBe('TOOL_RESULT_INGESTING');
		expect(result.suggested_next_state).toBe('MODEL_THINKING');
		expect(result.ingested_result).toEqual({
			call_id: 'call_ingest_success',
			kind: 'tool_result',
			metadata: {
				source: 'tool',
			},
			output: {
				content: 'hello',
				path: 'README.md',
			},
			result_status: 'success',
			tool_name: 'file.read',
		});
	});

	it('converts an error tool result into a deterministic ingestion artifact', () => {
		const toolResult: ToolResult = {
			call_id: 'call_ingest_error',
			details: {
				path: 'missing.txt',
			},
			error_code: 'NOT_FOUND',
			error_message: 'File not found',
			retryable: false,
			status: 'error',
			tool_name: 'file.read',
		};

		const result = ingestToolResult({
			call_id: 'call_ingest_error',
			current_state: 'TOOL_RESULT_INGESTING',
			run_id: 'run_ingest_error',
			tool_name: 'file.read',
			tool_result: toolResult,
			trace_id: 'trace_ingest_error',
		});

		expect(result.status).toBe('completed');

		if (result.status !== 'completed') {
			throw new Error('Expected completed ingestion result for tool error surface.');
		}

		expect(result.ingested_result).toEqual({
			call_id: 'call_ingest_error',
			details: {
				path: 'missing.txt',
			},
			error_code: 'NOT_FOUND',
			error_message: 'File not found',
			kind: 'tool_result',
			result_status: 'error',
			retryable: false,
			tool_name: 'file.read',
		});
		expect(result.tool_result).toBe(toolResult);
	});

	it('preserves shell session runtime feedback and lifecycle metadata for model continuation', () => {
		const toolResult: ToolResult = {
			call_id: 'call_ingest_shell_session',
			metadata: {
				shell_session: {
					kind: 'shell_session_lifecycle',
					next_action_hint: 'read_later_or_stop',
					session_id: 'session_ingest_shell',
					status: 'running',
					tool_name: 'shell.session.read',
				},
			},
			output: {
				has_output: false,
				next_action_hint: 'read_later_or_stop',
				runtime_feedback:
					'Shell session session_ingest_shell is still running. No buffered output is available for the selected stream yet.',
				session_id: 'session_ingest_shell',
				status: 'running',
			},
			status: 'success',
			tool_name: 'shell.session.read',
		};

		const result = ingestToolResult({
			call_id: 'call_ingest_shell_session',
			current_state: 'TOOL_RESULT_INGESTING',
			run_id: 'run_ingest_shell_session',
			tool_name: 'shell.session.read',
			tool_result: toolResult,
			trace_id: 'trace_ingest_shell_session',
		});

		expect(result.status).toBe('completed');

		if (result.status !== 'completed') {
			throw new Error('Expected completed shell session ingestion.');
		}

		expect(result.ingested_result).toMatchObject({
			metadata: {
				shell_session: {
					next_action_hint: 'read_later_or_stop',
					session_id: 'session_ingest_shell',
				},
			},
			output: {
				runtime_feedback: expect.stringContaining('No buffered output'),
			},
			result_status: 'success',
			tool_name: 'shell.session.read',
		});
	});

	it('returns an explicit failure for an invalid starting state', () => {
		const toolResult: ToolResult = {
			call_id: 'call_ingest_invalid_state',
			output: {},
			status: 'success',
			tool_name: 'file.list',
		};

		const result = ingestToolResult({
			call_id: 'call_ingest_invalid_state',
			current_state: 'MODEL_THINKING',
			run_id: 'run_ingest_invalid_state',
			tool_name: 'file.list',
			tool_result: toolResult,
			trace_id: 'trace_ingest_invalid_state',
		});

		expect(result.status).toBe('failed');

		if (result.status !== 'failed') {
			throw new Error('Expected invalid-state ingestion failure.');
		}

		expect(result.failure.code).toBe('INVALID_CURRENT_STATE');
		expect(result.final_state).toBe('FAILED');
	});

	it('returns an explicit failure when tool identity does not match the result surface', () => {
		const toolResult: ToolResult = {
			call_id: 'call_ingest_actual',
			output: {},
			status: 'success',
			tool_name: 'file.write',
		};

		const result = ingestToolResult({
			call_id: 'call_ingest_expected',
			current_state: 'TOOL_RESULT_INGESTING',
			run_id: 'run_ingest_mismatch',
			tool_name: 'file.read',
			tool_result: toolResult,
			trace_id: 'trace_ingest_mismatch',
		});

		expect(result.status).toBe('failed');

		if (result.status !== 'failed') {
			throw new Error('Expected mismatch ingestion failure.');
		}

		expect(result.failure.code).toBe('TOOL_RESULT_MISMATCH');
		expect(result.final_state).toBe('FAILED');
	});
});
