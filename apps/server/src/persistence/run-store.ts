import {
	type NewRunRecord,
	type NewToolCallRecord,
	createDatabaseConnection,
	ensureDatabaseSchema,
	runsTable,
	toolCallsTable,
} from '@runa/db';
import type { RuntimeState, ToolCallInput, ToolName, ToolResult } from '@runa/types';

import {
	hasPersistenceDatabaseConfiguration,
	logPersistenceDebugFailure,
	resolvePersistenceDatabaseUrl,
} from './database-config.js';

export class RunStoreConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RunStoreConfigurationError';
	}
}

export class RunStoreWriteError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'RunStoreWriteError';
	}
}

export interface RunRecordWriter {
	upsertRun(record: NewRunRecord): Promise<void>;
	upsertToolCall(record: NewToolCallRecord): Promise<void>;
}

export interface PersistRunStateInput {
	readonly current_state: RuntimeState;
	readonly last_error_code?: string;
	readonly recorded_at?: string;
	readonly run_id: string;
	readonly trace_id: string;
}

export interface PersistToolCallInput {
	readonly call_id: string;
	readonly completed_at?: string;
	readonly created_at?: string;
	readonly error_code?: string;
	readonly recorded_at?: string;
	readonly result_summary?: string;
	readonly run_id: string;
	readonly state_after?: RuntimeState;
	readonly state_before?: RuntimeState;
	readonly status: 'completed' | 'failed' | 'started';
	readonly tool_input?: ToolCallInput['arguments'];
	readonly tool_name: ToolName;
	readonly tool_result?: ToolResult;
	readonly trace_id: string;
}

interface PersistOptions {
	readonly writer?: RunRecordWriter;
}

class DatabaseRunRecordWriter implements RunRecordWriter {
	#db: ReturnType<typeof createDatabaseConnection>['db'];
	#ready: Promise<void>;

	constructor(databaseUrl: string) {
		const connection = createDatabaseConnection(databaseUrl);
		this.#db = connection.db;
		this.#ready = ensureDatabaseSchema(connection);
	}

	async upsertRun(record: NewRunRecord): Promise<void> {
		await this.#ready;
		await this.#db
			.insert(runsTable)
			.values(record)
			.onConflictDoUpdate({
				set: {
					current_state: record.current_state,
					last_error_code: record.last_error_code,
					last_state_at: record.last_state_at,
					trace_id: record.trace_id,
					updated_at: record.updated_at,
				},
				target: runsTable.run_id,
			});
	}

	async upsertToolCall(record: NewToolCallRecord): Promise<void> {
		await this.#ready;
		await this.#db
			.insert(toolCallsTable)
			.values(record)
			.onConflictDoUpdate({
				set: {
					completed_at: record.completed_at,
					error_code: record.error_code,
					input_summary: record.input_summary,
					result_summary: record.result_summary,
					state_after: record.state_after,
					state_before: record.state_before,
					status: record.status,
					trace_id: record.trace_id,
					updated_at: record.updated_at,
				},
				target: toolCallsTable.id,
			});
	}
}

let defaultWriterPromise: Promise<RunRecordWriter> | null = null;

function getDatabaseUrl(): string {
	return resolvePersistenceDatabaseUrl(
		(message) => new RunStoreConfigurationError(message),
		'DATABASE_URL is required for run persistence.',
	);
}

async function getDefaultWriter(): Promise<RunRecordWriter> {
	if (!defaultWriterPromise) {
		defaultWriterPromise = Promise.resolve(new DatabaseRunRecordWriter(getDatabaseUrl()));
	}

	try {
		return await defaultWriterPromise;
	} catch (error) {
		defaultWriterPromise = null;
		throw error;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableSerialize(value: unknown): string {
	if (value === null || typeof value === 'number' || typeof value === 'boolean') {
		return JSON.stringify(value);
	}

	if (typeof value === 'string') {
		return value;
	}

	if (Array.isArray(value)) {
		return `[${value.map((entry) => stableSerialize(entry)).join(', ')}]`;
	}

	if (isRecord(value)) {
		return `{${Object.keys(value)
			.sort((left, right) => left.localeCompare(right))
			.map((key) => `${key}:${stableSerialize(value[key])}`)
			.join(', ')}}`;
	}

	return String(value);
}

function truncateSummary(value: string, maxLength: number): string {
	return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

function summarizeToolInput(toolInput: ToolCallInput['arguments'] | undefined): string | null {
	if (toolInput === undefined) {
		return null;
	}

	return truncateSummary(stableSerialize(toolInput), 240);
}

function summarizeSuccessOutput(output: unknown): string {
	if (typeof output === 'string') {
		return truncateSummary(output, 240);
	}

	if (Array.isArray(output)) {
		return `Array(${output.length})`;
	}

	if (isRecord(output)) {
		const keys = Object.keys(output).sort();
		const previewKeys = keys.slice(0, 4).join(', ');
		const suffix = keys.length > 4 ? ', ...' : '';
		return `Object{${previewKeys}${suffix}}`;
	}

	if (output === null) {
		return 'null';
	}

	return String(output);
}

function summarizeToolResult(result: ToolResult | undefined): string | null {
	if (!result) {
		return null;
	}

	if (result.status === 'error') {
		return truncateSummary(result.error_message, 240);
	}

	return summarizeSuccessOutput(result.output);
}

function toToolCallRecordId(input: PersistToolCallInput): string {
	return `${input.run_id}:${input.call_id}`;
}

function toRunRecord(input: PersistRunStateInput): NewRunRecord {
	const recordedAt = input.recorded_at ?? new Date().toISOString();

	return {
		created_at: recordedAt,
		current_state: input.current_state,
		last_error_code: input.last_error_code ?? null,
		last_state_at: recordedAt,
		run_id: input.run_id,
		trace_id: input.trace_id,
		updated_at: recordedAt,
	};
}

function toToolCallRecord(input: PersistToolCallInput): NewToolCallRecord {
	const createdAt = input.created_at ?? input.recorded_at ?? new Date().toISOString();
	const updatedAt = input.recorded_at ?? input.completed_at ?? createdAt;

	return {
		call_id: input.call_id,
		completed_at: input.completed_at ?? null,
		created_at: createdAt,
		error_code:
			input.error_code ??
			(input.tool_result?.status === 'error' ? input.tool_result.error_code : null),
		id: toToolCallRecordId(input),
		input_summary: summarizeToolInput(input.tool_input),
		result_summary: input.result_summary ?? summarizeToolResult(input.tool_result),
		run_id: input.run_id,
		state_after: input.state_after ?? null,
		state_before: input.state_before ?? null,
		status: input.status,
		tool_name: input.tool_name,
		trace_id: input.trace_id,
		updated_at: updatedAt,
	};
}

export function hasRunStoreConfiguration(): boolean {
	return hasPersistenceDatabaseConfiguration();
}

export async function persistRunState(
	input: PersistRunStateInput,
	options: PersistOptions = {},
): Promise<void> {
	try {
		const writer = options.writer ?? (await getDefaultWriter());
		await writer.upsertRun(toRunRecord(input));
	} catch (error) {
		logPersistenceDebugFailure({
			error,
			operation: 'persist_run_state',
			run_id: input.run_id,
			stage: 'upsert_run',
			store: 'run-store',
			table: 'runs',
			trace_id: input.trace_id,
		});

		if (error instanceof RunStoreConfigurationError || error instanceof RunStoreWriteError) {
			throw error;
		}

		throw new RunStoreWriteError('Failed to persist run state.', {
			cause: error,
		});
	}
}

export async function persistToolCall(
	input: PersistToolCallInput,
	options: PersistOptions = {},
): Promise<void> {
	try {
		const writer = options.writer ?? (await getDefaultWriter());
		await writer.upsertToolCall(toToolCallRecord(input));
	} catch (error) {
		logPersistenceDebugFailure({
			error,
			operation: 'persist_tool_call',
			run_id: input.run_id,
			stage: 'upsert_tool_call',
			store: 'run-store',
			table: 'tool_calls',
			trace_id: input.trace_id,
		});

		if (error instanceof RunStoreConfigurationError || error instanceof RunStoreWriteError) {
			throw error;
		}

		throw new RunStoreWriteError('Failed to persist tool call.', {
			cause: error,
		});
	}
}
