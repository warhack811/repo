import { randomUUID } from 'node:crypto';

import {
	type MemoryRecord as DatabaseMemoryRecord,
	type NewMemoryRecord as NewDatabaseMemoryRecord,
	createDatabaseConnection,
	ensureDatabaseSchema,
	memoriesTable,
} from '@runa/db';
import type { MemoryRecord, MemoryScope, MemoryWriteCandidate } from '@runa/types';

import {
	buildMemoryEmbeddingMetadata,
	buildMemoryRetrievalText,
} from '../memory/semantic-profile.js';

import {
	hasPersistenceDatabaseConfiguration,
	logPersistenceDebugFailure,
	resolvePersistenceDatabaseUrl,
} from './database-config.js';

export class MemoryStoreConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MemoryStoreConfigurationError';
	}
}

export class MemoryStoreReadError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'MemoryStoreReadError';
	}
}

export class MemoryStoreWriteError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'MemoryStoreWriteError';
	}
}

export interface CreateMemoryInput extends MemoryWriteCandidate {
	readonly created_at?: string;
	readonly memory_id?: string;
}

export interface ArchiveMemoryInput {
	readonly archived_at?: string;
	readonly memory_id: string;
}

export interface SupersedeMemoryInput {
	readonly memory_id: string;
	readonly superseded_at?: string;
}

export interface MemoryRecordWriter {
	getMemoryById(memory_id: string): Promise<DatabaseMemoryRecord | null>;
	listActiveMemories(scope: MemoryScope, scope_id: string): Promise<DatabaseMemoryRecord[]>;
	upsertMemory(record: NewDatabaseMemoryRecord): Promise<void>;
}

export interface MemoryStore {
	archiveMemory(input: ArchiveMemoryInput): Promise<MemoryRecord | null>;
	createMemory(input: CreateMemoryInput): Promise<MemoryRecord>;
	getMemoryById(memory_id: string): Promise<MemoryRecord | null>;
	listActiveMemories(scope: MemoryScope, scope_id: string): Promise<readonly MemoryRecord[]>;
	supersedeMemory(input: SupersedeMemoryInput): Promise<MemoryRecord | null>;
}

interface PersistOptions {
	readonly writer?: MemoryRecordWriter;
}

class DatabaseMemoryRecordWriter implements MemoryRecordWriter {
	#client: ReturnType<typeof createDatabaseConnection>['client'];
	#db: ReturnType<typeof createDatabaseConnection>['db'];
	#ready: Promise<void>;

	constructor(databaseUrl: string) {
		const connection = createDatabaseConnection(databaseUrl);
		this.#client = connection.client;
		this.#db = connection.db;
		this.#ready = ensureDatabaseSchema(connection);
	}

	async getMemoryById(memory_id: string): Promise<DatabaseMemoryRecord | null> {
		await this.#ready;

		const records = await this.#client<DatabaseMemoryRecord[]>`
			SELECT
				memory_id,
				scope,
				scope_id,
				status,
				source_kind,
				summary,
				content,
				retrieval_text,
				embedding_metadata,
				source_run_id,
				source_trace_id,
				tenant_id,
				workspace_id,
				user_id,
				archived_at,
				created_at,
				updated_at
			FROM memories
			WHERE memory_id = ${memory_id}
			LIMIT 1
		`;

		return records[0] ?? null;
	}

	async listActiveMemories(scope: MemoryScope, scope_id: string): Promise<DatabaseMemoryRecord[]> {
		await this.#ready;

		return this.#client<DatabaseMemoryRecord[]>`
			SELECT
				memory_id,
				scope,
				scope_id,
				status,
				source_kind,
				summary,
				content,
				retrieval_text,
				embedding_metadata,
				source_run_id,
				source_trace_id,
				tenant_id,
				workspace_id,
				user_id,
				archived_at,
				created_at,
				updated_at
			FROM memories
			WHERE scope = ${scope}
				AND scope_id = ${scope_id}
				AND status = 'active'
			ORDER BY updated_at DESC, memory_id ASC
		`;
	}

	async upsertMemory(record: NewDatabaseMemoryRecord): Promise<void> {
		await this.#ready;
		await this.#db
			.insert(memoriesTable)
			.values(record)
			.onConflictDoUpdate({
				set: {
					archived_at: record.archived_at,
					content: record.content,
					embedding_metadata: record.embedding_metadata,
					retrieval_text: record.retrieval_text,
					scope: record.scope,
					scope_id: record.scope_id,
					source_kind: record.source_kind,
					source_run_id: record.source_run_id,
					source_trace_id: record.source_trace_id,
					status: record.status,
					summary: record.summary,
					updated_at: record.updated_at,
				},
				target: memoriesTable.memory_id,
			});
	}
}

let defaultWriterPromise: Promise<MemoryRecordWriter> | null = null;

function getDatabaseUrl(): string {
	return resolvePersistenceDatabaseUrl(
		(message) => new MemoryStoreConfigurationError(message),
		'DATABASE_URL is required for memory persistence.',
	);
}

export function hasMemoryStoreConfiguration(): boolean {
	return hasPersistenceDatabaseConfiguration();
}

async function getDefaultWriter(): Promise<MemoryRecordWriter> {
	if (!defaultWriterPromise) {
		defaultWriterPromise = Promise.resolve(new DatabaseMemoryRecordWriter(getDatabaseUrl()));
	}

	try {
		return await defaultWriterPromise;
	} catch (error) {
		defaultWriterPromise = null;
		throw error;
	}
}

function toSharedMemoryRecord(
	record: DatabaseMemoryRecord | NewDatabaseMemoryRecord,
): MemoryRecord {
	return {
		archived_at: record.archived_at ?? undefined,
		content: record.content,
		created_at: record.created_at,
		embedding_metadata: record.embedding_metadata ?? undefined,
		memory_id: record.memory_id,
		retrieval_text: record.retrieval_text ?? undefined,
		scope: record.scope,
		scope_id: record.scope_id,
		source_kind: record.source_kind,
		source_run_id: record.source_run_id ?? undefined,
		source_trace_id: record.source_trace_id ?? undefined,
		status: record.status,
		summary: record.summary,
		updated_at: record.updated_at,
	};
}

function toNewMemoryRecord(input: CreateMemoryInput): NewDatabaseMemoryRecord {
	const createdAt = input.created_at ?? new Date().toISOString();
	const retrievalText = buildMemoryRetrievalText(input);
	const embeddingMetadata = buildMemoryEmbeddingMetadata(input);

	return {
		archived_at: null,
		content: input.content,
		created_at: createdAt,
		embedding_metadata: embeddingMetadata,
		memory_id: input.memory_id ?? randomUUID(),
		retrieval_text: retrievalText,
		scope: input.scope,
		scope_id: input.scope_id,
		source_kind: input.source_kind,
		source_run_id: input.source_run_id ?? null,
		source_trace_id: input.source_trace_id ?? null,
		status: 'active',
		summary: input.summary,
		tenant_id: null,
		updated_at: createdAt,
		user_id: null,
		workspace_id: null,
	};
}

function toArchivedMemoryRecord(
	record: DatabaseMemoryRecord,
	archivedAt: string,
): NewDatabaseMemoryRecord {
	return {
		archived_at: record.archived_at ?? archivedAt,
		content: record.content,
		created_at: record.created_at,
		embedding_metadata: record.embedding_metadata,
		memory_id: record.memory_id,
		retrieval_text: record.retrieval_text,
		scope: record.scope,
		scope_id: record.scope_id,
		source_kind: record.source_kind,
		source_run_id: record.source_run_id,
		source_trace_id: record.source_trace_id,
		status: 'archived',
		summary: record.summary,
		tenant_id: record.tenant_id,
		updated_at: archivedAt,
		user_id: record.user_id,
		workspace_id: record.workspace_id,
	};
}

function toSupersededMemoryRecord(
	record: DatabaseMemoryRecord,
	supersededAt: string,
): NewDatabaseMemoryRecord {
	return {
		archived_at: record.archived_at ?? supersededAt,
		content: record.content,
		created_at: record.created_at,
		embedding_metadata: record.embedding_metadata,
		memory_id: record.memory_id,
		retrieval_text: record.retrieval_text,
		scope: record.scope,
		scope_id: record.scope_id,
		source_kind: record.source_kind,
		source_run_id: record.source_run_id,
		source_trace_id: record.source_trace_id,
		status: 'superseded',
		summary: record.summary,
		tenant_id: record.tenant_id,
		updated_at: supersededAt,
		user_id: record.user_id,
		workspace_id: record.workspace_id,
	};
}

export async function createMemory(
	input: CreateMemoryInput,
	options: PersistOptions = {},
): Promise<MemoryRecord> {
	const record = toNewMemoryRecord(input);

	try {
		const writer = options.writer ?? (await getDefaultWriter());
		await writer.upsertMemory(record);
		return toSharedMemoryRecord(record);
	} catch (error) {
		logPersistenceDebugFailure({
			error,
			operation: 'create_memory',
			run_id: input.source_run_id,
			stage: 'upsert_memory',
			store: 'memory-store',
			table: 'memories',
			trace_id: input.source_trace_id,
		});

		if (error instanceof MemoryStoreConfigurationError || error instanceof MemoryStoreWriteError) {
			throw error;
		}

		throw new MemoryStoreWriteError('Failed to create memory.', {
			cause: error,
		});
	}
}

export async function getMemoryById(
	memory_id: string,
	options: PersistOptions = {},
): Promise<MemoryRecord | null> {
	try {
		const writer = options.writer ?? (await getDefaultWriter());
		const record = await writer.getMemoryById(memory_id);
		return record ? toSharedMemoryRecord(record) : null;
	} catch (error) {
		logPersistenceDebugFailure({
			error,
			operation: 'read_memory_by_id',
			stage: 'get_memory_by_id',
			store: 'memory-store',
			table: 'memories',
		});

		if (error instanceof MemoryStoreConfigurationError || error instanceof MemoryStoreReadError) {
			throw error;
		}

		throw new MemoryStoreReadError('Failed to read memory by id.', {
			cause: error,
		});
	}
}

export async function listActiveMemories(
	scope: MemoryScope,
	scope_id: string,
	options: PersistOptions = {},
): Promise<readonly MemoryRecord[]> {
	try {
		const writer = options.writer ?? (await getDefaultWriter());
		const records = await writer.listActiveMemories(scope, scope_id);
		return records.map((record) => toSharedMemoryRecord(record));
	} catch (error) {
		logPersistenceDebugFailure({
			error,
			operation: 'read_active_memories',
			stage: `list_active_memories:${scope}`,
			store: 'memory-store',
			table: 'memories',
		});

		if (error instanceof MemoryStoreConfigurationError || error instanceof MemoryStoreReadError) {
			throw error;
		}

		throw new MemoryStoreReadError('Failed to list active memories.', {
			cause: error,
		});
	}
}

export async function archiveMemory(
	input: ArchiveMemoryInput,
	options: PersistOptions = {},
): Promise<MemoryRecord | null> {
	let existingRecord: DatabaseMemoryRecord | null;

	try {
		const writer = options.writer ?? (await getDefaultWriter());
		existingRecord = await writer.getMemoryById(input.memory_id);
	} catch (error) {
		logPersistenceDebugFailure({
			error,
			operation: 'archive_memory',
			stage: 'read_memory_for_archive',
			store: 'memory-store',
			table: 'memories',
		});

		if (error instanceof MemoryStoreConfigurationError || error instanceof MemoryStoreReadError) {
			throw error;
		}

		throw new MemoryStoreReadError('Failed to read memory for archiving.', {
			cause: error,
		});
	}

	if (!existingRecord) {
		return null;
	}

	if (existingRecord.status === 'archived') {
		return toSharedMemoryRecord(existingRecord);
	}

	const archivedAt = input.archived_at ?? new Date().toISOString();
	const archivedRecord = toArchivedMemoryRecord(existingRecord, archivedAt);

	try {
		const writer = options.writer ?? (await getDefaultWriter());
		await writer.upsertMemory(archivedRecord);
		return toSharedMemoryRecord(archivedRecord);
	} catch (error) {
		logPersistenceDebugFailure({
			error,
			operation: 'archive_memory',
			stage: 'upsert_archived_memory',
			store: 'memory-store',
			table: 'memories',
		});

		if (error instanceof MemoryStoreConfigurationError || error instanceof MemoryStoreWriteError) {
			throw error;
		}

		throw new MemoryStoreWriteError('Failed to archive memory.', {
			cause: error,
		});
	}
}

export async function supersedeMemory(
	input: SupersedeMemoryInput,
	options: PersistOptions = {},
): Promise<MemoryRecord | null> {
	let existingRecord: DatabaseMemoryRecord | null;

	try {
		const writer = options.writer ?? (await getDefaultWriter());
		existingRecord = await writer.getMemoryById(input.memory_id);
	} catch (error) {
		logPersistenceDebugFailure({
			error,
			operation: 'supersede_memory',
			stage: 'read_memory_for_supersede',
			store: 'memory-store',
			table: 'memories',
		});

		if (error instanceof MemoryStoreConfigurationError || error instanceof MemoryStoreReadError) {
			throw error;
		}

		throw new MemoryStoreReadError('Failed to read memory for superseding.', {
			cause: error,
		});
	}

	if (!existingRecord) {
		return null;
	}

	if (existingRecord.status === 'superseded' || existingRecord.status === 'archived') {
		return toSharedMemoryRecord(existingRecord);
	}

	const supersededAt = input.superseded_at ?? new Date().toISOString();
	const supersededRecord = toSupersededMemoryRecord(existingRecord, supersededAt);

	try {
		const writer = options.writer ?? (await getDefaultWriter());
		await writer.upsertMemory(supersededRecord);
		return toSharedMemoryRecord(supersededRecord);
	} catch (error) {
		logPersistenceDebugFailure({
			error,
			operation: 'supersede_memory',
			stage: 'upsert_superseded_memory',
			store: 'memory-store',
			table: 'memories',
		});

		if (error instanceof MemoryStoreConfigurationError || error instanceof MemoryStoreWriteError) {
			throw error;
		}

		throw new MemoryStoreWriteError('Failed to supersede memory.', {
			cause: error,
		});
	}
}

export const defaultMemoryStore: MemoryStore = {
	archiveMemory(input) {
		return archiveMemory(input);
	},
	createMemory(input) {
		return createMemory(input);
	},
	getMemoryById(memory_id) {
		return getMemoryById(memory_id);
	},
	listActiveMemories(scope, scope_id) {
		return listActiveMemories(scope, scope_id);
	},
	supersedeMemory(input) {
		return supersedeMemory(input);
	},
};
