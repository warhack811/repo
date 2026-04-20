import { describe, expect, it } from 'vitest';

import type { AuthContext } from '@runa/types';

import {
	type StorageObject,
	type StorageObjectRecord,
	type StorageServiceError,
	createStorageService,
} from './storage-service.js';

function createAuthenticatedAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
	return {
		bearer_token_present: true,
		principal: {
			kind: 'authenticated',
			provider: 'supabase',
			role: 'authenticated',
			scope: {
				tenant_id: 'tenant_1',
				workspace_id: 'workspace_1',
				workspace_ids: ['workspace_1'],
			},
			session_id: 'session_1',
			user_id: 'user_1',
		},
		request_id: 'req_1',
		transport: 'http',
		...overrides,
	};
}

describe('createStorageService', () => {
	it('normalizes authenticated screenshot uploads into storage metadata', async () => {
		let capturedBlob: StorageObject | undefined;
		const service = createStorageService({
			adapter: {
				async get_object() {
					return null;
				},
				async upload_object(blob) {
					capturedBlob = blob;

					return {
						blob_id: blob.blob_id,
						content_type: blob.content_type,
						created_at: blob.created_at,
						filename: blob.filename,
						kind: blob.kind,
						owner_kind: blob.owner_kind,
						owner_subject: blob.owner_subject,
						run_id: blob.run_id,
						size_bytes: blob.size_bytes,
						tenant_id: blob.tenant_id,
						trace_id: blob.trace_id,
						user_id: blob.user_id,
						workspace_id: blob.workspace_id,
					} satisfies StorageObjectRecord;
				},
			},
			generate_blob_id: () => 'blob_screenshot_1',
			now: () => new Date('2026-04-16T12:00:00.000Z'),
		});

		const result = await service.upload_blob({
			auth: createAuthenticatedAuthContext(),
			content_base64: Buffer.from('fake-image').toString('base64'),
			content_type: 'image/png',
			filename: 'capture.png',
			kind: 'screenshot',
			run_id: 'run_1',
			trace_id: 'trace_1',
		});

		expect(capturedBlob).toMatchObject({
			blob_id: 'blob_screenshot_1',
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
		});
		expect(result.kind).toBe('screenshot');
	});

	it('supports tool output blobs and enforces scope-aware reads', async () => {
		const storedBlob: StorageObject = {
			blob_id: 'blob_tool_output_1',
			content: Buffer.from('tool-output'),
			content_type: 'application/json',
			created_at: '2026-04-16T12:05:00.000Z',
			kind: 'tool_output',
			owner_kind: 'authenticated',
			owner_subject: 'user_1',
			size_bytes: 11,
			tenant_id: 'tenant_1',
			trace_id: 'trace_2',
			user_id: 'user_1',
			workspace_id: 'workspace_1',
		};
		const service = createStorageService({
			adapter: {
				async get_object() {
					return storedBlob;
				},
				async upload_object(blob) {
					return blob;
				},
			},
		});

		const result = await service.get_blob({
			auth: createAuthenticatedAuthContext(),
			blob_id: 'blob_tool_output_1',
		});

		expect(result.kind).toBe('tool_output');
		expect(Buffer.from(result.content).toString()).toBe('tool-output');
	});

	it('rejects blob reads when ownership scope does not match', async () => {
		const service = createStorageService({
			adapter: {
				async get_object() {
					return {
						blob_id: 'blob_private_1',
						content: Buffer.from('secret'),
						content_type: 'text/plain',
						created_at: '2026-04-16T12:10:00.000Z',
						kind: 'tool_output',
						owner_kind: 'authenticated',
						owner_subject: 'other_user',
						size_bytes: 6,
						tenant_id: 'tenant_1',
						trace_id: 'trace_3',
						user_id: 'other_user',
						workspace_id: 'workspace_1',
					};
				},
				async upload_object(blob) {
					return blob;
				},
			},
		});

		await expect(
			service.get_blob({
				auth: createAuthenticatedAuthContext(),
				blob_id: 'blob_private_1',
			}),
		).rejects.toMatchObject({
			code: 'STORAGE_ACCESS_DENIED',
			statusCode: 403,
		} satisfies Partial<StorageServiceError>);
	});
});
