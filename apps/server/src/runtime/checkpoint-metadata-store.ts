import {
	type CheckpointRecord as CheckpointMetadataRow,
	type CheckpointPersistenceDatabaseClient,
	type NewCheckpointRecord as NewCheckpointMetadataRow,
	type RunaDatabase,
	createCheckpointPersistenceDatabaseClient,
} from '@runa/db';

import type { CheckpointMetadataEntry, CheckpointMetadataStore } from './checkpoint-manager.js';

export interface CheckpointMetadataPersistenceClient extends CheckpointPersistenceDatabaseClient {}

export interface CreateCheckpointMetadataStoreInput {
	readonly client: CheckpointMetadataPersistenceClient;
}

export interface CreatePostgresCheckpointMetadataStoreInput {
	readonly db: RunaDatabase;
}

type CheckpointMetadataStoreOperation = 'read' | 'write';

export class CheckpointMetadataStoreError extends Error {
	override readonly cause?: unknown;
	readonly code = 'CHECKPOINT_METADATA_STORE_ERROR';
	readonly operation: CheckpointMetadataStoreOperation;

	constructor(operation: CheckpointMetadataStoreOperation, message: string, cause?: unknown) {
		super(message);
		this.cause = cause;
		this.name = 'CheckpointMetadataStoreError';
		this.operation = operation;
	}
}

function toCheckpointMetadataRow(entry: CheckpointMetadataEntry): NewCheckpointMetadataRow {
	const sessionId = entry.meta.session_id ?? entry.meta.scope.session_id;

	return {
		checkpoint_id: entry.meta.checkpoint_id,
		checkpoint_version: entry.meta.checkpoint_version,
		checkpointed_at: entry.meta.checkpointed_at,
		created_at: entry.meta.created_at,
		event_sequence_no: entry.meta.event_sequence_no ?? null,
		loop_state: entry.meta.loop_state,
		meta: entry.meta,
		metadata: entry.meta.metadata ?? null,
		parent_checkpoint_id: entry.meta.parent_checkpoint_id ?? null,
		persistence_mode: entry.meta.persistence_mode,
		resume: entry.resume,
		run_id: entry.meta.run_id,
		runtime_state: entry.meta.runtime_state ?? null,
		schema_version: entry.meta.schema_version,
		scope_kind: entry.meta.scope.kind,
		scope_subject_id: entry.meta.scope.subject_id,
		session_id: sessionId ?? null,
		status: entry.meta.status,
		stop_reason: entry.meta.stop_reason ?? null,
		tenant_id: entry.meta.scope.tenant_id ?? null,
		trace_id: entry.meta.trace_id,
		trigger: entry.meta.trigger,
		turn_index: entry.meta.turn_index,
		updated_at: entry.meta.updated_at,
		user_id: entry.meta.scope.user_id ?? null,
		workspace_id: entry.meta.scope.workspace_id ?? null,
	};
}

function toCheckpointMetadataEntry(row: CheckpointMetadataRow): CheckpointMetadataEntry {
	return {
		meta: row.meta,
		resume: row.resume,
	};
}

export function createDrizzleCheckpointMetadataPersistenceClient(
	input: CreatePostgresCheckpointMetadataStoreInput,
): CheckpointMetadataPersistenceClient {
	return createCheckpointPersistenceDatabaseClient(input.db);
}

async function runMetadataStoreOperation<TResult>(
	operation: CheckpointMetadataStoreOperation,
	action: () => Promise<TResult>,
	message: string,
): Promise<TResult> {
	try {
		return await action();
	} catch (error: unknown) {
		if (error instanceof CheckpointMetadataStoreError) {
			throw error;
		}

		throw new CheckpointMetadataStoreError(operation, message, error);
	}
}

export function createCheckpointMetadataStore(
	input: CreateCheckpointMetadataStoreInput,
): CheckpointMetadataStore {
	return {
		get_checkpoint_metadata(checkpoint_id) {
			return runMetadataStoreOperation(
				'read',
				async () => {
					const row = await input.client.get_checkpoint_row(checkpoint_id);
					return row === null ? null : toCheckpointMetadataEntry(row);
				},
				`Failed to read checkpoint metadata for "${checkpoint_id}".`,
			);
		},
		list_checkpoint_metadata(listInput) {
			return runMetadataStoreOperation(
				'read',
				async () => {
					const rows = await input.client.list_checkpoint_rows(listInput);
					return rows.map((row) => toCheckpointMetadataEntry(row));
				},
				'Failed to list checkpoint metadata.',
			);
		},
		put_checkpoint_metadata(entry) {
			return runMetadataStoreOperation(
				'write',
				async () => {
					const row = await input.client.upsert_checkpoint_row(toCheckpointMetadataRow(entry));
					return toCheckpointMetadataEntry(row);
				},
				`Failed to persist checkpoint metadata for "${entry.meta.checkpoint_id}".`,
			);
		},
	};
}

export function createPostgresCheckpointMetadataStore(
	input: CreatePostgresCheckpointMetadataStoreInput,
): CheckpointMetadataStore {
	return createCheckpointMetadataStore({
		client: createDrizzleCheckpointMetadataPersistenceClient(input),
	});
}
