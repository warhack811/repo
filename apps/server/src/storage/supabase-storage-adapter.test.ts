import { describe, expect, it, vi } from 'vitest';

import type { StorageObject } from './storage-service.js';

import {
	createSupabaseStorageAdapter,
	createSupabaseStorageAdapterFromEnvironment,
} from './supabase-storage-adapter.js';

function createStorageObject(overrides: Partial<StorageObject> = {}): StorageObject {
	return {
		blob_id: 'blob_storage_1',
		content: Buffer.from('fake-image'),
		content_type: 'image/png',
		created_at: '2026-04-16T12:00:00.000Z',
		filename: 'capture.png',
		kind: 'screenshot',
		owner_kind: 'authenticated',
		owner_subject: 'user_1',
		run_id: 'run_1',
		size_bytes: 10,
		tenant_id: 'tenant_1',
		trace_id: 'trace_1',
		user_id: 'user_1',
		workspace_id: 'workspace_1',
		...overrides,
	};
}

describe('createSupabaseStorageAdapter', () => {
	it('maps upload_object into the expected Supabase bucket, path, and request headers', async () => {
		const fetchImplementation = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(JSON.stringify({ Key: 'ignored' }), { status: 200 }));
		const adapter = createSupabaseStorageAdapter({
			bucket: 'runa-artifacts',
			fetch: fetchImplementation,
			path_prefix: 'workspace-artifacts',
			service_role_key: 'service-role-key',
			supabase_url: 'https://project-ref.supabase.co',
		});

		const result = await adapter.upload_object(createStorageObject());

		expect(result).toMatchObject({
			blob_id: 'blob_storage_1',
			content_type: 'image/png',
			filename: 'capture.png',
			kind: 'screenshot',
			owner_kind: 'authenticated',
			owner_subject: 'user_1',
			run_id: 'run_1',
			tenant_id: 'tenant_1',
			trace_id: 'trace_1',
			user_id: 'user_1',
			workspace_id: 'workspace_1',
		});
		expect(fetchImplementation).toHaveBeenCalledTimes(1);
		expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
			'https://project-ref.supabase.co/storage/v1/object/runa-artifacts/workspace-artifacts/v1/blob/blob_storage_1/kind/screenshot/owner-kind/authenticated/owner-subject/user_1/tenant/tenant_1/workspace/workspace_1/user/user_1/run/run_1/trace/trace_1/created/2026-04-16T12%3A00%3A00.000Z/filename/capture.png/content',
		);
		expect(fetchImplementation.mock.calls[0]?.[1]).toMatchObject({
			headers: {
				apikey: 'service-role-key',
				authorization: 'Bearer service-role-key',
				'content-type': 'image/png',
				'x-upsert': 'false',
			},
			method: 'POST',
		});
	});

	it('maps get_object back into StorageObject and preserves ownership/scope metadata', async () => {
		const fetchImplementation = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify([
						{
							created_at: '2026-04-16T12:00:01.000Z',
							metadata: {
								size: 10,
							},
							name: 'workspace-artifacts/v1/blob/blob_storage_1/kind/screenshot/owner-kind/authenticated/owner-subject/user_1/tenant/tenant_1/workspace/workspace_1/user/user_1/run/run_1/trace/trace_1/created/2026-04-16T12%3A00%3A00.000Z/filename/capture.png/content',
						},
					]),
					{
						headers: {
							'content-type': 'application/json',
						},
						status: 200,
					},
				),
			)
			.mockResolvedValueOnce(
				new Response(Buffer.from('fake-image'), {
					headers: {
						'content-type': 'image/png',
					},
					status: 200,
				}),
			);
		const adapter = createSupabaseStorageAdapter({
			bucket: 'runa-artifacts',
			fetch: fetchImplementation,
			path_prefix: 'workspace-artifacts',
			service_role_key: 'service-role-key',
			supabase_url: 'https://project-ref.supabase.co',
		});

		const result = await adapter.get_object('blob_storage_1');

		expect(result).toMatchObject({
			blob_id: 'blob_storage_1',
			content_type: 'image/png',
			created_at: '2026-04-16T12:00:01.000Z',
			filename: 'capture.png',
			kind: 'screenshot',
			owner_kind: 'authenticated',
			owner_subject: 'user_1',
			run_id: 'run_1',
			size_bytes: 10,
			tenant_id: 'tenant_1',
			trace_id: 'trace_1',
			user_id: 'user_1',
			workspace_id: 'workspace_1',
		});
		expect(result ? Buffer.from(result.content).toString() : undefined).toBe('fake-image');
		expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
			'https://project-ref.supabase.co/storage/v1/object/list/runa-artifacts',
		);
		expect(fetchImplementation.mock.calls[0]?.[1]).toMatchObject({
			method: 'POST',
		});
		expect(fetchImplementation.mock.calls[1]?.[0]).toBe(
			'https://project-ref.supabase.co/storage/v1/object/authenticated/runa-artifacts/workspace-artifacts/v1/blob/blob_storage_1/kind/screenshot/owner-kind/authenticated/owner-subject/user_1/tenant/tenant_1/workspace/workspace_1/user/user_1/run/run_1/trace/trace_1/created/2026-04-16T12%3A00%3A00.000Z/filename/capture.png/content',
		);
	});

	it('returns null when no object exists for the blob id prefix', async () => {
		const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify([]), {
				headers: {
					'content-type': 'application/json',
				},
				status: 200,
			}),
		);
		const adapter = createSupabaseStorageAdapter({
			bucket: 'runa-artifacts',
			fetch: fetchImplementation,
			service_role_key: 'service-role-key',
			supabase_url: 'https://project-ref.supabase.co',
		});

		await expect(adapter.get_object('missing_blob')).resolves.toBeNull();
		expect(fetchImplementation).toHaveBeenCalledTimes(1);
	});
});

describe('createSupabaseStorageAdapterFromEnvironment', () => {
	it('returns null when no Supabase storage environment is present', () => {
		expect(
			createSupabaseStorageAdapterFromEnvironment({
				environment: {},
			}),
		).toBeNull();
	});

	it('creates an adapter from environment values with an injected fetch seam', async () => {
		const fetchImplementation = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(JSON.stringify({ Key: 'ignored' }), { status: 200 }));
		const adapter = createSupabaseStorageAdapterFromEnvironment({
			environment: {
				SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
				SUPABASE_STORAGE_BUCKET: 'runa-artifacts',
				SUPABASE_STORAGE_PREFIX: 'workspace-artifacts',
				SUPABASE_URL: 'https://project-ref.supabase.co',
			},
			fetch: fetchImplementation,
		});

		expect(adapter).not.toBeNull();
		await adapter?.upload_object(createStorageObject());
		expect(fetchImplementation).toHaveBeenCalledTimes(1);
	});
});
