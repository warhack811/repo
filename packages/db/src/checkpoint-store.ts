import type { CheckpointStatus } from '@runa/types';
import { and, desc, eq, inArray } from 'drizzle-orm';

import type { CheckpointRecord, NewCheckpointRecord } from './checkpoints.js';
import type { RunaDatabase } from './client.js';

import { checkpointsTable } from './schema.js';

export interface ListCheckpointRowsInput {
	readonly limit?: number;
	readonly run_id?: string;
	readonly session_id?: string;
	readonly statuses?: readonly CheckpointStatus[];
	readonly trace_id?: string;
}

export interface CheckpointPersistenceDatabaseClient {
	get_checkpoint_row(checkpoint_id: string): Promise<CheckpointRecord | null>;
	list_checkpoint_rows(input: ListCheckpointRowsInput): Promise<readonly CheckpointRecord[]>;
	upsert_checkpoint_row(row: NewCheckpointRecord): Promise<CheckpointRecord>;
}

function normalizeLimit(limit: number | undefined): number | undefined {
	if (limit === undefined) {
		return undefined;
	}

	if (!Number.isFinite(limit) || limit < 1) {
		return undefined;
	}

	return Math.trunc(limit);
}

function toCheckpointUpsertSet(
	row: NewCheckpointRecord,
): Omit<NewCheckpointRecord, 'checkpoint_id'> {
	return {
		checkpoint_version: row.checkpoint_version,
		checkpointed_at: row.checkpointed_at,
		created_at: row.created_at,
		event_sequence_no: row.event_sequence_no,
		loop_state: row.loop_state,
		meta: row.meta,
		metadata: row.metadata,
		parent_checkpoint_id: row.parent_checkpoint_id,
		persistence_mode: row.persistence_mode,
		resume: row.resume,
		run_id: row.run_id,
		runtime_state: row.runtime_state,
		schema_version: row.schema_version,
		scope_kind: row.scope_kind,
		scope_subject_id: row.scope_subject_id,
		session_id: row.session_id,
		status: row.status,
		stop_reason: row.stop_reason,
		tenant_id: row.tenant_id,
		trace_id: row.trace_id,
		trigger: row.trigger,
		turn_index: row.turn_index,
		updated_at: row.updated_at,
		user_id: row.user_id,
		workspace_id: row.workspace_id,
	};
}

export function createCheckpointPersistenceDatabaseClient(
	db: RunaDatabase,
): CheckpointPersistenceDatabaseClient {
	return {
		async get_checkpoint_row(checkpoint_id) {
			const rows = await db
				.select()
				.from(checkpointsTable)
				.where(eq(checkpointsTable.checkpoint_id, checkpoint_id))
				.limit(1);

			return rows[0] ?? null;
		},
		async list_checkpoint_rows(input) {
			const conditions = [];

			if (input.run_id !== undefined) {
				conditions.push(eq(checkpointsTable.run_id, input.run_id));
			}

			if (input.session_id !== undefined) {
				conditions.push(eq(checkpointsTable.session_id, input.session_id));
			}

			if (input.trace_id !== undefined) {
				conditions.push(eq(checkpointsTable.trace_id, input.trace_id));
			}

			if (input.statuses !== undefined && input.statuses.length > 0) {
				conditions.push(inArray(checkpointsTable.status, [...input.statuses]));
			}

			let query = db
				.select()
				.from(checkpointsTable)
				.orderBy(desc(checkpointsTable.checkpointed_at), desc(checkpointsTable.created_at))
				.$dynamic();

			if (conditions.length > 0) {
				query = query.where(and(...conditions));
			}

			const limit = normalizeLimit(input.limit);

			if (limit !== undefined) {
				query = query.limit(limit);
			}

			return query;
		},
		async upsert_checkpoint_row(row) {
			const rows = await db
				.insert(checkpointsTable)
				.values(row)
				.onConflictDoUpdate({
					set: toCheckpointUpsertSet(row),
					target: checkpointsTable.checkpoint_id,
				})
				.returning();

			const persistedRow = rows[0];

			if (persistedRow === undefined) {
				throw new Error(`Checkpoint row "${row.checkpoint_id}" was not returned after upsert.`);
			}

			return persistedRow;
		},
	};
}
