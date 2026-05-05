import { randomUUID } from 'node:crypto';

import {
	type NewAgentReasoningTraceRecord,
	agentReasoningTracesTable,
	createDatabaseConnection,
	ensureDatabaseSchema,
} from '@runa/db';

import { logPersistenceDebugFailure, resolvePersistenceDatabaseUrl } from './database-config.js';

export type ReasoningRetentionPolicy = 'debug_30d' | 'permanent_audit';

export interface PersistReasoningTraceInput {
	readonly created_at?: string;
	readonly expires_at?: string;
	readonly model: string;
	readonly provider: string;
	readonly reasoning_content: string;
	readonly retention_policy?: ReasoningRetentionPolicy;
	readonly run_id: string;
	readonly trace_id: string;
	readonly trace_record_id?: string;
	readonly turn_index: number;
}

export interface ReasoningTraceRecordWriter {
	cleanupExpired(now: string): Promise<number>;
	insert(record: NewAgentReasoningTraceRecord): Promise<void>;
}

export class ReasoningStoreConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ReasoningStoreConfigurationError';
	}
}

export class ReasoningStoreWriteError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'ReasoningStoreWriteError';
	}
}

class DatabaseReasoningTraceRecordWriter implements ReasoningTraceRecordWriter {
	#client: ReturnType<typeof createDatabaseConnection>['client'];
	#ready: Promise<void>;
	#db: ReturnType<typeof createDatabaseConnection>['db'];

	constructor(databaseUrl: string) {
		const connection = createDatabaseConnection(databaseUrl);
		this.#client = connection.client;
		this.#db = connection.db;
		this.#ready = ensureDatabaseSchema(connection);
	}

	async insert(record: NewAgentReasoningTraceRecord): Promise<void> {
		await this.#ready;
		await this.#db.insert(agentReasoningTracesTable).values(record);
	}

	async cleanupExpired(now: string): Promise<number> {
		await this.#ready;
		const rows = await this.#client`
			DELETE FROM agent_reasoning_traces
			WHERE expires_at < ${now}
			RETURNING trace_record_id
		`;

		return rows.length;
	}
}

interface PersistenceOptions {
	readonly environment?: NodeJS.ProcessEnv;
	readonly writer?: ReasoningTraceRecordWriter;
}

let defaultWriterPromise: Promise<ReasoningTraceRecordWriter> | null = null;

function isReasoningPersistenceEnabled(environment: NodeJS.ProcessEnv): boolean {
	return environment['RUNA_PERSIST_REASONING'] === '1';
}

function getDatabaseUrl(): string {
	return resolvePersistenceDatabaseUrl(
		(message) => new ReasoningStoreConfigurationError(message),
		'DATABASE_URL is required for reasoning trace persistence.',
	);
}

async function getDefaultWriter(): Promise<ReasoningTraceRecordWriter> {
	if (!defaultWriterPromise) {
		defaultWriterPromise = Promise.resolve(
			new DatabaseReasoningTraceRecordWriter(getDatabaseUrl()),
		);
	}

	try {
		return await defaultWriterPromise;
	} catch (error) {
		defaultWriterPromise = null;
		throw error;
	}
}

function addDays(date: Date, days: number): Date {
	const nextDate = new Date(date);
	nextDate.setUTCDate(nextDate.getUTCDate() + days);
	return nextDate;
}

function toReasoningTraceRecord(input: PersistReasoningTraceInput): NewAgentReasoningTraceRecord {
	const createdAt = input.created_at ?? new Date().toISOString();
	const retentionPolicy = input.retention_policy ?? 'debug_30d';

	return {
		created_at: createdAt,
		expires_at:
			input.expires_at ??
			(retentionPolicy === 'permanent_audit'
				? '9999-12-31T23:59:59.999Z'
				: addDays(new Date(createdAt), 30).toISOString()),
		model: input.model,
		provider: input.provider,
		reasoning_content: input.reasoning_content,
		retention_policy: retentionPolicy,
		run_id: input.run_id,
		trace_id: input.trace_id,
		trace_record_id: input.trace_record_id ?? randomUUID(),
		turn_index: input.turn_index,
	};
}

export async function persistReasoningTrace(
	input: PersistReasoningTraceInput,
	options: PersistenceOptions = {},
): Promise<void> {
	if (!isReasoningPersistenceEnabled(options.environment ?? process.env)) {
		return;
	}

	if (input.reasoning_content.trim().length === 0) {
		return;
	}

	const record = toReasoningTraceRecord(input);

	try {
		const writer = options.writer ?? (await getDefaultWriter());
		await writer.insert(record);
	} catch (error) {
		logPersistenceDebugFailure({
			error,
			operation: 'persist_reasoning_trace',
			run_id: input.run_id,
			stage: 'insert_reasoning_trace',
			store: 'reasoning-store',
			table: 'agent_reasoning_traces',
			trace_id: input.trace_id,
		});

		if (
			error instanceof ReasoningStoreConfigurationError ||
			error instanceof ReasoningStoreWriteError
		) {
			throw error;
		}

		throw new ReasoningStoreWriteError('Failed to persist reasoning trace.', {
			cause: error,
		});
	}
}

export async function cleanupExpiredReasoningTraces(
	options: PersistenceOptions = {},
): Promise<number> {
	if (!isReasoningPersistenceEnabled(options.environment ?? process.env)) {
		return 0;
	}

	const now = new Date().toISOString();

	try {
		const writer = options.writer ?? (await getDefaultWriter());
		return await writer.cleanupExpired(now);
	} catch (error) {
		logPersistenceDebugFailure({
			error,
			operation: 'cleanup_expired_reasoning_traces',
			stage: 'delete_expired_reasoning_traces',
			store: 'reasoning-store',
			table: 'agent_reasoning_traces',
		});

		if (
			error instanceof ReasoningStoreConfigurationError ||
			error instanceof ReasoningStoreWriteError
		) {
			throw error;
		}

		throw new ReasoningStoreWriteError('Failed to cleanup expired reasoning traces.', {
			cause: error,
		});
	}
}
