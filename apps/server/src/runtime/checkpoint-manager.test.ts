import { describe, expect, it } from 'vitest';

import type {
	CheckpointBlobRef,
	CheckpointMeta,
	HybridCheckpointRecord,
	MetadataOnlyCheckpointRecord,
	ResumeContext,
} from '@runa/types';

import {
	type CheckpointBlobStore,
	CheckpointManagerConfigurationError,
	CheckpointManagerReadError,
	CheckpointManagerWriteError,
	type CheckpointMetadataEntry,
	type CheckpointMetadataStore,
	createCheckpointManager,
} from './checkpoint-manager.js';

class InMemoryCheckpointMetadataStore implements CheckpointMetadataStore {
	readonly entries = new Map<string, CheckpointMetadataEntry>();

	async get_checkpoint_metadata(checkpoint_id: string): Promise<CheckpointMetadataEntry | null> {
		return this.entries.get(checkpoint_id) ?? null;
	}

	async list_checkpoint_metadata(): Promise<readonly CheckpointMetadataEntry[]> {
		return Array.from(this.entries.values());
	}

	async put_checkpoint_metadata(entry: CheckpointMetadataEntry): Promise<CheckpointMetadataEntry> {
		this.entries.set(entry.meta.checkpoint_id, entry);
		return entry;
	}
}

class InMemoryCheckpointBlobStore implements CheckpointBlobStore {
	readonly blobRefsByCheckpoint = new Map<string, readonly CheckpointBlobRef[]>();
	readonly replace_calls: Array<{
		readonly blob_refs: readonly CheckpointBlobRef[];
		readonly checkpoint_id: string;
	}> = [];

	async list_checkpoint_blob_refs(checkpoint_id: string): Promise<readonly CheckpointBlobRef[]> {
		return this.blobRefsByCheckpoint.get(checkpoint_id) ?? [];
	}

	async replace_checkpoint_blob_refs(
		checkpoint_id: string,
		blob_refs: readonly CheckpointBlobRef[],
	): Promise<readonly CheckpointBlobRef[]> {
		const persistedRefs = blob_refs.map((blobRef, index) => ({
			...blobRef,
			created_at: blobRef.created_at ?? `2026-04-17T12:00:0${index}.000Z`,
			locator: blobRef.locator ?? `blob://${checkpoint_id}/${blobRef.blob_id}`,
		}));
		this.replace_calls.push({
			blob_refs,
			checkpoint_id,
		});
		this.blobRefsByCheckpoint.set(checkpoint_id, persistedRefs);
		return persistedRefs;
	}
}

function createCheckpointMeta(overrides: Partial<CheckpointMeta> = {}): CheckpointMeta {
	return {
		checkpoint_id: 'checkpoint_runtime_1',
		checkpoint_version: 1,
		checkpointed_at: '2026-04-17T12:00:00.000Z',
		created_at: '2026-04-17T12:00:00.000Z',
		loop_state: 'WAITING',
		persistence_mode: 'metadata_only',
		run_id: 'run_checkpoint_runtime',
		runtime_state: 'WAITING_APPROVAL',
		schema_version: 1,
		scope: {
			kind: 'run',
			run_id: 'run_checkpoint_runtime',
			subject_id: 'run_checkpoint_runtime',
			trace_id: 'trace_checkpoint_runtime',
			user_id: 'user_1',
			workspace_id: 'workspace_1',
		},
		status: 'ready',
		trace_id: 'trace_checkpoint_runtime',
		trigger: 'loop_boundary',
		turn_index: 2,
		updated_at: '2026-04-17T12:00:00.000Z',
		...overrides,
	};
}

function createResumableResumeContext(
	overrides: Partial<Extract<ResumeContext, { readonly disposition: 'resumable' }>> = {},
): Extract<ResumeContext, { readonly disposition: 'resumable' }> {
	return {
		cursor: {
			boundary: 'approval',
			checkpoint_id: 'checkpoint_runtime_1',
			checkpoint_version: 1,
			checkpointed_at: '2026-04-17T12:00:00.000Z',
			event_sequence_no: 12,
			loop_state: 'WAITING',
			run_id: 'run_checkpoint_runtime',
			runtime_state: 'WAITING_APPROVAL',
			trace_id: 'trace_checkpoint_runtime',
			turn_index: 2,
		},
		disposition: 'resumable',
		required_blob_kinds: [],
		stop_reason: {
			approval_id: 'approval_checkpoint_runtime_1',
			boundary: 'approval',
			disposition: 'paused',
			kind: 'waiting_for_human',
			loop_state: 'WAITING',
			turn_count: 2,
		},
		...overrides,
	};
}

function createTerminalResumeContext(
	overrides: Partial<Extract<ResumeContext, { readonly disposition: 'terminal' }>> = {},
): Extract<ResumeContext, { readonly disposition: 'terminal' }> {
	return {
		disposition: 'terminal',
		final_loop_state: 'COMPLETED',
		final_runtime_state: 'COMPLETED',
		stop_reason: {
			disposition: 'terminal',
			finish_reason: 'stop',
			kind: 'model_stop',
			loop_state: 'COMPLETED',
			turn_count: 2,
		},
		...overrides,
	};
}

function createBlobRef(
	kind: CheckpointBlobRef['kind'],
	overrides: Partial<CheckpointBlobRef> = {},
): CheckpointBlobRef {
	return {
		blob_id: `blob_${kind}`,
		checkpoint_id: 'checkpoint_runtime_hybrid_1',
		content_type: 'application/json',
		kind,
		storage_kind: 'object_storage',
		...overrides,
	};
}

function createMetadataOnlyCheckpointRecord(): MetadataOnlyCheckpointRecord {
	return {
		blob_refs: [],
		meta: {
			...createCheckpointMeta(),
			persistence_mode: 'metadata_only',
		},
		resume: createResumableResumeContext(),
	};
}

function createHybridCheckpointMeta(): HybridCheckpointRecord['meta'] {
	return {
		...createCheckpointMeta({
			checkpoint_id: 'checkpoint_runtime_hybrid_1',
			persistence_mode: 'hybrid',
		}),
		persistence_mode: 'hybrid',
	};
}

function createHybridCheckpointRecord(): HybridCheckpointRecord {
	return {
		blob_refs: [createBlobRef('loop_snapshot'), createBlobRef('context_snapshot')],
		meta: createHybridCheckpointMeta(),
		resume: createResumableResumeContext({
			cursor: {
				...createResumableResumeContext().cursor,
				checkpoint_id: 'checkpoint_runtime_hybrid_1',
			},
			required_blob_kinds: ['loop_snapshot', 'context_snapshot'],
		}),
	};
}

describe('checkpoint-manager', () => {
	it('persists metadata-only checkpoints without requiring a blob store', async () => {
		const metadataStore = new InMemoryCheckpointMetadataStore();
		const manager = createCheckpointManager({
			metadata_store: metadataStore,
		});
		const record = createMetadataOnlyCheckpointRecord();

		const persisted = await manager.saveCheckpoint(record);

		expect(persisted).toEqual(record);
		await expect(manager.getCheckpointMeta(record.meta.checkpoint_id)).resolves.toEqual(
			record.meta,
		);
	});

	it('persists hybrid checkpoints together with blob refs', async () => {
		const metadataStore = new InMemoryCheckpointMetadataStore();
		const blobStore = new InMemoryCheckpointBlobStore();
		const manager = createCheckpointManager({
			blob_store: blobStore,
			metadata_store: metadataStore,
		});
		const record = createHybridCheckpointRecord();

		const persisted = await manager.saveCheckpoint(record);

		expect(blobStore.replace_calls).toEqual([
			{
				blob_refs: record.blob_refs,
				checkpoint_id: record.meta.checkpoint_id,
			},
		]);
		expect(persisted.meta).toEqual(record.meta);
		expect(persisted.blob_refs).toHaveLength(2);
		expect(persisted.blob_refs[0]?.locator).toBe(
			`blob://${record.meta.checkpoint_id}/${record.blob_refs[0]?.blob_id}`,
		);
	});

	it('reads checkpoint metadata and rehydrates hybrid checkpoints', async () => {
		const metadataStore = new InMemoryCheckpointMetadataStore();
		const blobStore = new InMemoryCheckpointBlobStore();
		const manager = createCheckpointManager({
			blob_store: blobStore,
			metadata_store: metadataStore,
		});
		const record = createHybridCheckpointRecord();

		await manager.saveCheckpoint(record);

		await expect(manager.getCheckpointMeta(record.meta.checkpoint_id)).resolves.toEqual(
			record.meta,
		);
		await expect(manager.getCheckpoint(record.meta.checkpoint_id)).resolves.toMatchObject({
			meta: record.meta,
			resume: record.resume,
		});
	});

	it('resolves resumable checkpoints through the resume surface', async () => {
		const manager = createCheckpointManager({
			blob_store: new InMemoryCheckpointBlobStore(),
			metadata_store: new InMemoryCheckpointMetadataStore(),
		});
		const record = createHybridCheckpointRecord();

		await manager.saveCheckpoint(record);

		await expect(
			manager.resolveResumeCheckpoint({
				checkpoint_id: record.meta.checkpoint_id,
			}),
		).resolves.toMatchObject({
			checkpoint: {
				meta: record.meta,
			},
			resume: {
				disposition: 'resumable',
			},
			status: 'resumable',
		});
	});

	it('resolves terminal checkpoints but does not treat them as resumable', async () => {
		const metadataStore = new InMemoryCheckpointMetadataStore();
		const manager = createCheckpointManager({
			metadata_store: metadataStore,
		});
		const terminalRecord: MetadataOnlyCheckpointRecord = {
			blob_refs: [],
			meta: {
				...createCheckpointMeta({
					checkpoint_id: 'checkpoint_runtime_terminal_1',
					loop_state: 'COMPLETED',
					runtime_state: 'COMPLETED',
				}),
				persistence_mode: 'metadata_only',
			},
			resume: createTerminalResumeContext(),
		};

		await manager.saveCheckpoint(terminalRecord);

		await expect(
			manager.resolveResumeCheckpoint({
				checkpoint_id: terminalRecord.meta.checkpoint_id,
			}),
		).resolves.toEqual({
			checkpoint: terminalRecord,
			resume: terminalRecord.resume,
			status: 'terminal',
		});
	});

	it('fails with a controlled configuration error when hybrid persistence has no blob store', async () => {
		const manager = createCheckpointManager({
			metadata_store: new InMemoryCheckpointMetadataStore(),
		});

		await expect(manager.saveCheckpoint(createHybridCheckpointRecord())).rejects.toBeInstanceOf(
			CheckpointManagerConfigurationError,
		);
	});

	it('wraps store failures in controlled typed read/write errors', async () => {
		const manager = createCheckpointManager({
			blob_store: new InMemoryCheckpointBlobStore(),
			metadata_store: {
				async get_checkpoint_metadata(): Promise<CheckpointMetadataEntry | null> {
					throw new Error('read failure');
				},
				async list_checkpoint_metadata(): Promise<readonly CheckpointMetadataEntry[]> {
					return [];
				},
				async put_checkpoint_metadata(): Promise<CheckpointMetadataEntry> {
					throw new Error('write failure');
				},
			},
		});

		await expect(
			manager.saveCheckpoint(createMetadataOnlyCheckpointRecord()),
		).rejects.toBeInstanceOf(CheckpointManagerWriteError);
		await expect(manager.getCheckpoint('checkpoint_runtime_1')).rejects.toBeInstanceOf(
			CheckpointManagerReadError,
		);
	});
});
