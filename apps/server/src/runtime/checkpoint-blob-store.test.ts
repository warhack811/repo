import { describe, expect, it, vi } from 'vitest';

import type {
	CheckpointBlobObject,
	CheckpointBlobObjectStorageAdapter,
} from './checkpoint-blob-store.js';

import {
	CheckpointBlobStoreConfigurationError,
	CheckpointBlobStoreError,
	createCheckpointBlobStore,
	createSupabaseCheckpointBlobObjectStorageAdapter,
	createSupabaseCheckpointBlobStoreFromEnvironment,
} from './checkpoint-blob-store.js';

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

describe('checkpoint-blob-store', () => {
	it('supports a real checkpoint blob payload path and returns a typed blob ref', async () => {
		const store = createCheckpointBlobStore({
			adapter: createInMemoryObjectStorageAdapter(),
			generate_blob_id: () => 'blob_checkpoint_payload_1',
			now: () => '2026-04-17T18:30:00.000Z',
			path_prefix: 'runa/checkpoints',
		});

		const ref = await store.put_checkpoint_blob_payload({
			checkpoint_id: 'checkpoint_blob_store_1',
			content: Buffer.from('loop snapshot payload'),
			content_type: 'application/json',
			kind: 'loop_snapshot',
		});

		expect(ref).toEqual({
			blob_id: 'blob_checkpoint_payload_1',
			byte_length: 21,
			checkpoint_id: 'checkpoint_blob_store_1',
			content_encoding: undefined,
			content_type: 'application/json',
			created_at: '2026-04-17T18:30:00.000Z',
			checksum: undefined,
			kind: 'loop_snapshot',
			locator:
				'runa/checkpoints/v1/checkpoint/checkpoint_blob_store_1/blob/loop_snapshot/blob_checkpoint_payload_1/payload',
			metadata: undefined,
			storage_kind: 'object_storage',
		});

		await expect(store.get_checkpoint_blob_payload(ref)).resolves.toEqual({
			content: Buffer.from('loop snapshot payload'),
			ref,
		});
	});

	it('persists and rehydrates checkpoint blob refs through the object storage manifest', async () => {
		const store = createCheckpointBlobStore({
			adapter: createInMemoryObjectStorageAdapter(),
		});
		const blobRefs = [
			{
				blob_id: 'blob_checkpoint_payload_2',
				byte_length: 13,
				checkpoint_id: 'checkpoint_blob_store_2',
				content_type: 'application/json',
				created_at: '2026-04-17T18:31:00.000Z',
				kind: 'context_snapshot',
				locator:
					'runa/checkpoints/v1/checkpoint/checkpoint_blob_store_2/blob/context_snapshot/blob_checkpoint_payload_2/payload',
				storage_kind: 'object_storage',
			},
		] as const;

		await expect(
			store.replace_checkpoint_blob_refs('checkpoint_blob_store_2', blobRefs),
		).resolves.toEqual(blobRefs);
		await expect(store.list_checkpoint_blob_refs('checkpoint_blob_store_2')).resolves.toEqual(
			blobRefs,
		);
	});

	it('creates a Supabase-backed object storage adapter and maps put/get requests to storage endpoints', async () => {
		const fetchImplementation = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(new Response(JSON.stringify({ Key: 'ignored' }), { status: 200 }))
			.mockResolvedValueOnce(
				new Response(Buffer.from('checkpoint-payload'), {
					headers: {
						'content-type': 'application/json',
					},
					status: 200,
				}),
			);
		const adapter = createSupabaseCheckpointBlobObjectStorageAdapter({
			bucket: 'runa-artifacts',
			fetch: fetchImplementation,
			service_role_key: 'service-role-key',
			supabase_url: 'https://project-ref.supabase.co',
		});

		await adapter.put_object({
			content: Buffer.from('checkpoint-payload'),
			content_type: 'application/json',
			path: 'runa/checkpoints/v1/checkpoint/checkpoint_blob_store_3/blob-refs.json',
		});
		const result = await adapter.get_object(
			'runa/checkpoints/v1/checkpoint/checkpoint_blob_store_3/blob-refs.json',
		);

		expect(result).not.toBeNull();
		expect(result?.content_type).toBe('application/json');
		expect(result?.path).toBe(
			'runa/checkpoints/v1/checkpoint/checkpoint_blob_store_3/blob-refs.json',
		);
		expect(result ? Buffer.from(result.content).toString('utf8') : undefined).toBe(
			'checkpoint-payload',
		);
		expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
			'https://project-ref.supabase.co/storage/v1/object/runa-artifacts/runa/checkpoints/v1/checkpoint/checkpoint_blob_store_3/blob-refs.json',
		);
		expect(fetchImplementation.mock.calls[1]?.[0]).toBe(
			'https://project-ref.supabase.co/storage/v1/object/authenticated/runa-artifacts/runa/checkpoints/v1/checkpoint/checkpoint_blob_store_3/blob-refs.json',
		);
	});

	it('returns null when no Supabase checkpoint blob storage environment is configured', () => {
		expect(
			createSupabaseCheckpointBlobStoreFromEnvironment({
				environment: {},
			}),
		).toBeNull();
	});

	it('wraps malformed manifests and partial environment config in controlled errors', async () => {
		const store = createCheckpointBlobStore({
			adapter: {
				async get_object() {
					return {
						content: Buffer.from('{"invalid":true}'),
						content_type: 'application/json',
						path: 'ignored',
					};
				},
				async put_object() {},
			},
		});

		await expect(
			store.list_checkpoint_blob_refs('checkpoint_blob_store_invalid'),
		).rejects.toBeInstanceOf(CheckpointBlobStoreError);
		expect(() =>
			createSupabaseCheckpointBlobStoreFromEnvironment({
				environment: {
					SUPABASE_URL: 'https://project-ref.supabase.co',
				},
			}),
		).toThrowError(CheckpointBlobStoreConfigurationError);
	});
});
