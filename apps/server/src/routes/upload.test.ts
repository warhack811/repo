import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthClaims, AuthSession, AuthUser } from '@runa/types';
import type { FastifyInstance } from 'fastify';

import { buildServer } from '../app.js';
import type { StorageObject } from '../storage/storage-service.js';

function createClaims(overrides: Partial<AuthClaims> = {}): AuthClaims {
	return {
		aud: 'authenticated',
		email: 'dev@runa.ai',
		email_verified: true,
		exp: 1_900_000_000,
		iat: 1_800_000_000,
		iss: 'https://project-ref.supabase.co/auth/v1',
		role: 'authenticated',
		scope: {
			tenant_id: 'tenant_1',
			workspace_id: 'workspace_1',
			workspace_ids: ['workspace_1'],
		},
		session_id: 'session_1',
		sub: 'user_1',
		...overrides,
	};
}

function createUser(overrides: Partial<AuthUser> = {}): AuthUser {
	return {
		email: 'dev@runa.ai',
		email_verified: true,
		identities: [],
		primary_provider: 'supabase',
		scope: {
			tenant_id: 'tenant_1',
			workspace_id: 'workspace_1',
			workspace_ids: ['workspace_1'],
		},
		status: 'active',
		user_id: 'user_1',
		...overrides,
	};
}

function createSession(overrides: Partial<AuthSession> = {}): AuthSession {
	return {
		identity_provider: 'magic_link',
		provider: 'supabase',
		scope: {
			tenant_id: 'tenant_1',
			workspace_id: 'workspace_1',
			workspace_ids: ['workspace_1'],
		},
		session_id: 'session_1',
		user_id: 'user_1',
		...overrides,
	};
}

function createMemoryStorageAdapter() {
	const blobs = new Map<string, StorageObject>();

	return {
		adapter: {
			async get_object(blobId: string) {
				return blobs.get(blobId) ?? null;
			},
			async upload_object(blob: StorageObject) {
				blobs.set(blob.blob_id, blob);

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
				};
			},
		},
		blobs,
	};
}

const serversToClose: FastifyInstance[] = [];

afterEach(async () => {
	while (serversToClose.length > 0) {
		const server = serversToClose.pop();

		if (server !== undefined) {
			await server.close();
		}
	}
});

describe('upload routes', () => {
	it('returns a typed text attachment contract for authenticated uploads', async () => {
		const storage = createMemoryStorageAdapter();
		const server = await buildServer({
			auth: {
				verify_token: vi.fn().mockResolvedValue({
					claims: createClaims(),
					provider: 'supabase' as const,
					session: createSession(),
					user: createUser(),
				}),
			},
			storage: {
				adapter: storage.adapter,
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
				'content-type': 'application/json',
			},
			method: 'POST',
			payload: {
				content_base64: Buffer.from('Merhaba Runa').toString('base64'),
				content_type: 'text/plain',
				filename: 'notes.txt',
			},
			url: '/upload',
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			attachment: {
				blob_id: expect.any(String),
				filename: 'notes.txt',
				kind: 'text',
				media_type: 'text/plain',
				size_bytes: Buffer.byteLength('Merhaba Runa'),
				text_content: 'Merhaba Runa',
			},
		});
	});

	it('returns a typed image attachment contract for authenticated uploads', async () => {
		const storage = createMemoryStorageAdapter();
		const server = await buildServer({
			auth: {
				verify_token: async () => ({
					claims: createClaims(),
					provider: 'supabase',
					session: createSession(),
					user: createUser(),
				}),
			},
			storage: {
				adapter: storage.adapter,
			},
		});
		serversToClose.push(server);

		const pngBase64 = Buffer.from('fake-image').toString('base64');
		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
				'content-type': 'application/json',
			},
			method: 'POST',
			payload: {
				content_base64: pngBase64,
				content_type: 'image/png',
				filename: 'capture.png',
			},
			url: '/upload',
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			attachment: {
				blob_id: expect.any(String),
				data_url: `data:image/png;base64,${pngBase64}`,
				filename: 'capture.png',
				kind: 'image',
				media_type: 'image/png',
				size_bytes: Buffer.byteLength('fake-image'),
			},
		});
	});

	it('rejects unsupported media types instead of pretending document parsing exists', async () => {
		const storage = createMemoryStorageAdapter();
		const server = await buildServer({
			auth: {
				verify_token: async () => ({
					claims: createClaims(),
					provider: 'supabase',
					session: createSession(),
					user: createUser(),
				}),
			},
			storage: {
				adapter: storage.adapter,
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
				'content-type': 'application/json',
			},
			method: 'POST',
			payload: {
				content_base64: Buffer.from('%PDF').toString('base64'),
				content_type: 'application/pdf',
				filename: 'brief.pdf',
			},
			url: '/upload',
		});

		expect(response.statusCode).toBe(415);
		expect(response.json()).toMatchObject({
			message:
				'Only image/*, text/*, and application/json attachments are supported in this minimum seam.',
			statusCode: 415,
		});
	});
});
