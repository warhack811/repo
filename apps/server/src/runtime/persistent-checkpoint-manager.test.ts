import { describe, expect, it } from 'vitest';

import type {
	CheckpointBlobObject,
	CheckpointBlobObjectStorageAdapter,
} from './checkpoint-blob-store.js';
import type { CheckpointMetadataEntry } from './checkpoint-manager.js';
import type { CheckpointMetadataPersistenceClient } from './checkpoint-metadata-store.js';

import { createCheckpointBlobStore } from './checkpoint-blob-store.js';
import { createCheckpointManager } from './checkpoint-manager.js';
import { createCheckpointMetadataStore } from './checkpoint-metadata-store.js';

function createInMemoryMetadataClient(): CheckpointMetadataPersistenceClient {
	const entries = new Map<string, CheckpointMetadataEntry>();

	return {
		async get_checkpoint_row(checkpoint_id) {
			const entry = entries.get(checkpoint_id);

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
		async list_checkpoint_rows() {
			return Promise.all(
				Array.from(entries.keys()).map(async (checkpointId) => {
					const storedRow = await this.get_checkpoint_row(checkpointId);

					if (storedRow === null) {
						throw new Error(`Expected checkpoint row "${checkpointId}" to exist.`);
					}

					return storedRow;
				}),
			);
		},
		async upsert_checkpoint_row(row) {
			entries.set(row.checkpoint_id, {
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

function createInMemoryObjectStorageAdapter(): CheckpointBlobObjectStorageAdapter {
	const objects = new Map<string, CheckpointBlobObject>();

	return {
		async get_object(path) {
			return objects.get(path) ?? null;
		},
		async put_object(object) {
			objects.set(object.path, object);
		},
	};
}

function createMetadataOnlyCheckpointEntry(checkpointId: string): CheckpointMetadataEntry {
	return {
		meta: {
			checkpoint_id: checkpointId,
			checkpoint_version: 1,
			checkpointed_at: '2026-04-17T18:45:00.000Z',
			created_at: '2026-04-17T18:45:00.000Z',
			loop_state: 'WAITING',
			metadata: {
				checkpoint_source: 'loop.boundary',
			},
			parent_checkpoint_id: undefined,
			persistence_mode: 'metadata_only',
			run_id: 'run_checkpoint_persistence_1',
			runtime_state: 'WAITING_APPROVAL',
			schema_version: 1,
			scope: {
				kind: 'run',
				run_id: 'run_checkpoint_persistence_1',
				subject_id: 'run_checkpoint_persistence_1',
				trace_id: 'trace_checkpoint_persistence_1',
			},
			status: 'ready',
			stop_reason: {
				action_kind: 'file_write',
				approval_id: 'approval_checkpoint_persistence_1',
				boundary: 'approval',
				disposition: 'paused',
				kind: 'waiting_for_human',
				loop_state: 'WAITING',
				turn_count: 2,
			},
			trace_id: 'trace_checkpoint_persistence_1',
			trigger: 'loop_boundary',
			turn_index: 2,
			updated_at: '2026-04-17T18:45:00.000Z',
		},
		resume: {
			cursor: {
				boundary: 'approval',
				checkpoint_id: checkpointId,
				checkpoint_version: 1,
				checkpointed_at: '2026-04-17T18:45:00.000Z',
				loop_state: 'WAITING',
				run_id: 'run_checkpoint_persistence_1',
				runtime_state: 'WAITING_APPROVAL',
				trace_id: 'trace_checkpoint_persistence_1',
				turn_index: 2,
			},
			disposition: 'resumable',
			loop_config: {
				max_turns: 8,
				stop_conditions: {},
			},
			stop_reason: {
				action_kind: 'file_write',
				approval_id: 'approval_checkpoint_persistence_1',
				boundary: 'approval',
				disposition: 'paused',
				kind: 'waiting_for_human',
				loop_state: 'WAITING',
				turn_count: 2,
			},
		},
	};
}

describe('persistent checkpoint manager integration', () => {
	it('keeps metadata-only checkpoints working without a blob store', async () => {
		const manager = createCheckpointManager({
			metadata_store: createCheckpointMetadataStore({
				client: createInMemoryMetadataClient(),
			}),
		});
		const entry = createMetadataOnlyCheckpointEntry('checkpoint_persistence_metadata_only_1');

		await expect(
			manager.saveCheckpoint({
				blob_refs: [],
				meta: {
					...entry.meta,
					persistence_mode: 'metadata_only',
				},
				resume: entry.resume,
			}),
		).resolves.toEqual({
			blob_refs: [],
			meta: {
				...entry.meta,
				persistence_mode: 'metadata_only',
			},
			resume: entry.resume,
		});
		await expect(manager.getCheckpoint(entry.meta.checkpoint_id)).resolves.toEqual({
			blob_refs: [],
			meta: {
				...entry.meta,
				persistence_mode: 'metadata_only',
			},
			resume: entry.resume,
		});
	});

	it('supports hybrid checkpoints with object-storage blob refs and restore reads', async () => {
		const metadataStore = createCheckpointMetadataStore({
			client: createInMemoryMetadataClient(),
		});
		const blobStore = createCheckpointBlobStore({
			adapter: createInMemoryObjectStorageAdapter(),
			generate_blob_id: () => 'blob_checkpoint_persistence_hybrid_1',
			now: () => '2026-04-17T18:46:00.000Z',
		});
		const manager = createCheckpointManager({
			blob_store: blobStore,
			metadata_store: metadataStore,
		});
		const baseEntry = createMetadataOnlyCheckpointEntry('checkpoint_persistence_hybrid_1');
		const blobRef = await blobStore.put_checkpoint_blob_payload({
			checkpoint_id: 'checkpoint_persistence_hybrid_1',
			content: Buffer.from('context snapshot payload'),
			content_type: 'application/json',
			kind: 'context_snapshot',
		});

		const record = {
			blob_refs: [blobRef],
			meta: {
				...baseEntry.meta,
				checkpoint_id: 'checkpoint_persistence_hybrid_1',
				persistence_mode: 'hybrid' as const,
				trigger: 'turn_boundary' as const,
			},
			resume: {
				...baseEntry.resume,
				required_blob_kinds: ['context_snapshot'] as const,
			},
		};

		await expect(manager.saveCheckpoint(record)).resolves.toEqual(record);
		await expect(manager.getCheckpoint('checkpoint_persistence_hybrid_1')).resolves.toEqual(record);
		await expect(
			manager.resolveResumeCheckpoint({
				checkpoint_id: 'checkpoint_persistence_hybrid_1',
			}),
		).resolves.toMatchObject({
			checkpoint: {
				meta: {
					checkpoint_id: 'checkpoint_persistence_hybrid_1',
					persistence_mode: 'hybrid',
				},
			},
			resume: {
				disposition: 'resumable',
			},
			status: 'resumable',
		});
	});
});
