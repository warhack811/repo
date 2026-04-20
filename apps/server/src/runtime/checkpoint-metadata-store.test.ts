import { describe, expect, it } from 'vitest';

import type { CheckpointMetadataEntry, ListCheckpointMetadataInput } from './checkpoint-manager.js';
import type { CheckpointMetadataPersistenceClient } from './checkpoint-metadata-store.js';

import {
	CheckpointMetadataStoreError,
	createCheckpointMetadataStore,
} from './checkpoint-metadata-store.js';

function createCheckpointMetadataEntry(
	checkpointId: string,
	overrides: Partial<CheckpointMetadataEntry> = {},
): CheckpointMetadataEntry {
	const baseEntry: CheckpointMetadataEntry = {
		meta: {
			checkpoint_id: checkpointId,
			checkpoint_version: 1,
			checkpointed_at: '2026-04-17T18:00:00.000Z',
			created_at: '2026-04-17T18:00:00.000Z',
			loop_state: 'WAITING',
			metadata: {
				checkpoint_source: 'loop.boundary',
			},
			parent_checkpoint_id: 'checkpoint_parent_1',
			persistence_mode: 'metadata_only',
			run_id: 'run_checkpoint_db_1',
			runtime_state: 'WAITING_APPROVAL',
			schema_version: 1,
			scope: {
				kind: 'run',
				run_id: 'run_checkpoint_db_1',
				session_id: 'session_checkpoint_db_1',
				subject_id: 'run_checkpoint_db_1',
				tenant_id: 'tenant_checkpoint_db_1',
				trace_id: 'trace_checkpoint_db_1',
				user_id: 'user_checkpoint_db_1',
				workspace_id: 'workspace_checkpoint_db_1',
			},
			session_id: 'session_checkpoint_db_1',
			status: 'ready',
			stop_reason: {
				action_kind: 'file_write',
				approval_id: 'approval_checkpoint_db_1',
				boundary: 'approval',
				disposition: 'paused',
				kind: 'waiting_for_human',
				loop_state: 'WAITING',
				turn_count: 3,
			},
			trace_id: 'trace_checkpoint_db_1',
			trigger: 'loop_boundary',
			turn_index: 3,
			updated_at: '2026-04-17T18:00:00.000Z',
		},
		resume: {
			cursor: {
				boundary: 'approval',
				checkpoint_id: checkpointId,
				checkpoint_version: 1,
				checkpointed_at: '2026-04-17T18:00:00.000Z',
				loop_state: 'WAITING',
				run_id: 'run_checkpoint_db_1',
				runtime_state: 'WAITING_APPROVAL',
				trace_id: 'trace_checkpoint_db_1',
				turn_index: 3,
			},
			disposition: 'resumable',
			loop_config: {
				max_turns: 8,
				stop_conditions: {},
			},
			stop_reason: {
				action_kind: 'file_write',
				approval_id: 'approval_checkpoint_db_1',
				boundary: 'approval',
				disposition: 'paused',
				kind: 'waiting_for_human',
				loop_state: 'WAITING',
				turn_count: 3,
			},
		},
	};

	return {
		meta: {
			...baseEntry.meta,
			...overrides.meta,
		},
		resume: overrides.resume ?? baseEntry.resume,
	};
}

function createInMemoryPersistenceClient(): CheckpointMetadataPersistenceClient {
	const rows = new Map<string, CheckpointMetadataEntry>();

	return {
		async get_checkpoint_row(checkpoint_id) {
			const entry = rows.get(checkpoint_id);

			if (entry === undefined) {
				return null;
			}

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
				session_id: entry.meta.session_id ?? null,
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
		},
		async list_checkpoint_rows(input: ListCheckpointMetadataInput) {
			return Array.from(rows.values())
				.filter((entry) => input.run_id === undefined || entry.meta.run_id === input.run_id)
				.filter(
					(entry) => input.session_id === undefined || entry.meta.session_id === input.session_id,
				)
				.filter((entry) => input.trace_id === undefined || entry.meta.trace_id === input.trace_id)
				.filter(
					(entry) => input.statuses === undefined || input.statuses.includes(entry.meta.status),
				)
				.map((entry) => ({
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
					session_id: entry.meta.session_id ?? null,
					status: entry.meta.status,
					stop_reason: entry.meta.stop_reason ?? null,
					tenant_id: entry.meta.scope.tenant_id ?? null,
					trace_id: entry.meta.trace_id,
					trigger: entry.meta.trigger,
					turn_index: entry.meta.turn_index,
					updated_at: entry.meta.updated_at,
					user_id: entry.meta.scope.user_id ?? null,
					workspace_id: entry.meta.scope.workspace_id ?? null,
				}));
		},
		async upsert_checkpoint_row(row) {
			rows.set(row.checkpoint_id, {
				meta: row.meta,
				resume: row.resume,
			});

			const storedRow = await this.get_checkpoint_row(row.checkpoint_id);

			if (storedRow === null) {
				throw new Error(`Expected checkpoint row "${row.checkpoint_id}" to be persisted.`);
			}

			return storedRow;
		},
	};
}

describe('checkpoint-metadata-store', () => {
	it('persists checkpoint meta and resume data through the metadata store surface', async () => {
		const store = createCheckpointMetadataStore({
			client: createInMemoryPersistenceClient(),
		});
		const entry = createCheckpointMetadataEntry('checkpoint_metadata_store_1');

		await expect(store.put_checkpoint_metadata(entry)).resolves.toEqual(entry);
		await expect(store.get_checkpoint_metadata('checkpoint_metadata_store_1')).resolves.toEqual(
			entry,
		);
	});

	it('filters listed checkpoint metadata by run, session, trace, and status', async () => {
		const store = createCheckpointMetadataStore({
			client: createInMemoryPersistenceClient(),
		});
		const matchingEntry = createCheckpointMetadataEntry('checkpoint_metadata_store_2');
		const nonMatchingEntry = createCheckpointMetadataEntry('checkpoint_metadata_store_3', {
			meta: {
				...matchingEntry.meta,
				checkpoint_id: 'checkpoint_metadata_store_3',
				run_id: 'run_checkpoint_db_other',
				session_id: 'session_checkpoint_db_other',
				status: 'failed',
				trace_id: 'trace_checkpoint_db_other',
			},
		});

		await store.put_checkpoint_metadata(matchingEntry);
		await store.put_checkpoint_metadata(nonMatchingEntry);

		await expect(
			store.list_checkpoint_metadata({
				run_id: 'run_checkpoint_db_1',
				session_id: 'session_checkpoint_db_1',
				statuses: ['ready'],
				trace_id: 'trace_checkpoint_db_1',
			}),
		).resolves.toEqual([matchingEntry]);
	});

	it('wraps low-level persistence failures in a controlled typed store error', async () => {
		const store = createCheckpointMetadataStore({
			client: {
				async get_checkpoint_row() {
					throw new Error('db unavailable');
				},
				async list_checkpoint_rows() {
					throw new Error('db unavailable');
				},
				async upsert_checkpoint_row() {
					throw new Error('db unavailable');
				},
			},
		});

		await expect(
			store.put_checkpoint_metadata(createCheckpointMetadataEntry('checkpoint_metadata_store_4')),
		).rejects.toBeInstanceOf(CheckpointMetadataStoreError);
		await expect(
			store.get_checkpoint_metadata('checkpoint_metadata_store_4'),
		).rejects.toMatchObject({
			code: 'CHECKPOINT_METADATA_STORE_ERROR',
			operation: 'read',
		});
	});
});
