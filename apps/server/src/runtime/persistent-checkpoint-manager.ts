import type { RunaDatabase } from '@runa/db';

import type {
	SupabaseStorageEnvironment,
	SupabaseStorageFetch,
} from '../storage/supabase-storage-adapter.js';

import type { PersistentCheckpointBlobStore } from './checkpoint-blob-store.js';
import type { CheckpointManager } from './checkpoint-manager.js';

import { createSupabaseCheckpointBlobStoreFromEnvironment } from './checkpoint-blob-store.js';
import { createCheckpointManager } from './checkpoint-manager.js';
import { createPostgresCheckpointMetadataStore } from './checkpoint-metadata-store.js';

export interface CreatePersistentCheckpointManagerInput {
	readonly blob_store?: PersistentCheckpointBlobStore;
	readonly db: RunaDatabase;
}

export interface CreatePersistentCheckpointManagerFromEnvironmentInput {
	readonly bucket?: string;
	readonly db: RunaDatabase;
	readonly environment: SupabaseStorageEnvironment;
	readonly fetch?: SupabaseStorageFetch;
	readonly path_prefix?: string;
}

export function createPersistentCheckpointManager(
	input: CreatePersistentCheckpointManagerInput,
): CheckpointManager {
	return createCheckpointManager({
		blob_store: input.blob_store,
		metadata_store: createPostgresCheckpointMetadataStore({
			db: input.db,
		}),
	});
}

export function createPersistentCheckpointManagerFromEnvironment(
	input: CreatePersistentCheckpointManagerFromEnvironmentInput,
): CheckpointManager {
	return createPersistentCheckpointManager({
		blob_store:
			createSupabaseCheckpointBlobStoreFromEnvironment({
				bucket: input.bucket,
				environment: input.environment,
				fetch: input.fetch,
				path_prefix: input.path_prefix,
			}) ?? undefined,
		db: input.db,
	});
}
