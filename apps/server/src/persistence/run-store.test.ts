import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	type RunRecordWriter,
	RunStoreConfigurationError,
	RunStoreWriteError,
	persistRunState,
	persistToolCall,
} from './run-store.js';

function clearDatabaseUrl(): void {
	const environment = process.env as NodeJS.ProcessEnv & {
		DATABASE_URL?: string;
		DATABASE_TARGET?: string;
		RUNA_DEBUG_PERSISTENCE?: string;
	};
	environment.DATABASE_URL = undefined;
	environment.DATABASE_TARGET = undefined;
	environment.RUNA_DEBUG_PERSISTENCE = undefined;
}

function getMutableEnvironment(): NodeJS.ProcessEnv & {
	DATABASE_TARGET?: string;
	DATABASE_URL?: string;
	RUNA_DEBUG_PERSISTENCE?: string;
} {
	return process.env as NodeJS.ProcessEnv & {
		DATABASE_TARGET?: string;
		DATABASE_URL?: string;
		RUNA_DEBUG_PERSISTENCE?: string;
	};
}

afterEach(() => {
	clearDatabaseUrl();
	vi.restoreAllMocks();
});

describe('run-store', () => {
	it('throws a typed configuration error when DATABASE_URL is missing', async () => {
		await expect(
			persistRunState({
				current_state: 'MODEL_THINKING',
				run_id: 'run_store_missing_db',
				trace_id: 'trace_run_store_missing_db',
			}),
		).rejects.toThrowError(RunStoreConfigurationError);
	});

	it('maps run state writes to deterministic upsert records', async () => {
		const upsertRun: RunRecordWriter['upsertRun'] = vi.fn().mockResolvedValue(undefined);

		await persistRunState(
			{
				current_state: 'COMPLETED',
				last_error_code: 'IGNORED',
				recorded_at: '2026-04-10T10:00:00.000Z',
				run_id: 'run_store_run_mapping',
				trace_id: 'trace_run_store_run_mapping',
			},
			{
				writer: {
					async upsertToolCall() {},
					upsertRun,
				},
			},
		);

		expect(upsertRun).toHaveBeenCalledWith({
			conversation_id: null,
			created_at: '2026-04-10T10:00:00.000Z',
			current_state: 'COMPLETED',
			last_error_code: 'IGNORED',
			last_state_at: '2026-04-10T10:00:00.000Z',
			run_id: 'run_store_run_mapping',
			trace_id: 'trace_run_store_run_mapping',
			updated_at: '2026-04-10T10:00:00.000Z',
		});
	});

	it('maps tool call writes to deterministic upsert records', async () => {
		const upsertToolCall: RunRecordWriter['upsertToolCall'] = vi.fn().mockResolvedValue(undefined);

		await persistToolCall(
			{
				call_id: 'call_run_store_mapping',
				completed_at: '2026-04-10T10:05:00.000Z',
				created_at: '2026-04-10T10:00:00.000Z',
				run_id: 'run_store_mapping',
				state_after: 'TOOL_RESULT_INGESTING',
				state_before: 'TOOL_EXECUTING',
				status: 'completed',
				tool_input: {
					path: 'src/example.ts',
				},
				tool_name: 'file.read',
				tool_result: {
					call_id: 'call_run_store_mapping',
					output: {
						content: 'hello',
						path: 'src/example.ts',
					},
					status: 'success',
					tool_name: 'file.read',
				},
				trace_id: 'trace_run_store_mapping',
			},
			{
				writer: {
					async upsertRun() {},
					upsertToolCall,
				},
			},
		);

		expect(upsertToolCall).toHaveBeenCalledWith({
			call_id: 'call_run_store_mapping',
			completed_at: '2026-04-10T10:05:00.000Z',
			created_at: '2026-04-10T10:00:00.000Z',
			error_code: null,
			id: 'run_store_mapping:call_run_store_mapping',
			input_summary: '{path:src/example.ts}',
			result_summary: 'Object{content, path}',
			run_id: 'run_store_mapping',
			state_after: 'TOOL_RESULT_INGESTING',
			state_before: 'TOOL_EXECUTING',
			status: 'completed',
			tool_name: 'file.read',
			trace_id: 'trace_run_store_mapping',
			updated_at: '2026-04-10T10:05:00.000Z',
		});
	});

	it('wraps writer failures in a typed persistence error', async () => {
		const upsertRun: RunRecordWriter['upsertRun'] = vi
			.fn()
			.mockRejectedValue(new Error('upsert failed'));

		await expect(
			persistRunState(
				{
					current_state: 'FAILED',
					run_id: 'run_store_write_failure',
					trace_id: 'trace_run_store_write_failure',
				},
				{
					writer: {
						async upsertToolCall() {},
						upsertRun,
					},
				},
			),
		).rejects.toThrowError(RunStoreWriteError);
	});

	it('logs tool call persistence failures only when persistence debug is enabled', async () => {
		const environment = getMutableEnvironment();
		environment.RUNA_DEBUG_PERSISTENCE = '1';
		environment.DATABASE_TARGET = 'local';
		environment.DATABASE_URL = 'postgres://local-debug/runtime';

		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const upsertToolCall: RunRecordWriter['upsertToolCall'] = vi
			.fn()
			.mockRejectedValue(new Error('upsert failed'));

		await expect(
			persistToolCall(
				{
					call_id: 'call_run_store_debug',
					run_id: 'run_store_debug',
					status: 'started',
					tool_name: 'file.read',
					trace_id: 'trace_run_store_debug',
				},
				{
					writer: {
						async upsertRun() {},
						upsertToolCall,
					},
				},
			),
		).rejects.toThrowError(RunStoreWriteError);

		expect(consoleErrorSpy).toHaveBeenCalledWith('[persistence.error.debug]', {
			database_url_source: 'DATABASE_URL',
			error_message: 'upsert failed',
			error_name: 'Error',
			operation: 'persist_tool_call',
			run_id: 'run_store_debug',
			stage: 'upsert_tool_call',
			store: 'run-store',
			table: 'tool_calls',
			target: 'local',
			target_source: 'DATABASE_TARGET',
			trace_id: 'trace_run_store_debug',
		});
	});

	it('keeps tool call persistence debug logging silent by default', async () => {
		const environment = getMutableEnvironment();
		environment.DATABASE_TARGET = 'local';
		environment.DATABASE_URL = 'postgres://local-debug/runtime';

		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const upsertToolCall: RunRecordWriter['upsertToolCall'] = vi
			.fn()
			.mockRejectedValue(new Error('upsert failed'));

		await expect(
			persistToolCall(
				{
					call_id: 'call_run_store_debug',
					run_id: 'run_store_debug',
					status: 'started',
					tool_name: 'file.read',
					trace_id: 'trace_run_store_debug',
				},
				{
					writer: {
						async upsertRun() {},
						upsertToolCall,
					},
				},
			),
		).rejects.toThrowError(RunStoreWriteError);

		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});
});
