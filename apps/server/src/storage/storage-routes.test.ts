import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthClaims, AuthSession, AuthUser } from '@runa/types';
import type { FastifyInstance } from 'fastify';

import { buildServer } from '../app.js';

import type { StorageObject } from './storage-service.js';

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

function createVerificationResult(userId: string): {
	readonly claims: AuthClaims;
	readonly provider: 'supabase';
	readonly session: AuthSession;
	readonly user: AuthUser;
} {
	return {
		claims: createClaims({
			session_id: `session_${userId}`,
			sub: userId,
		}),
		provider: 'supabase',
		session: createSession({
			session_id: `session_${userId}`,
			user_id: userId,
		}),
		user: createUser({
			user_id: userId,
		}),
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

describe('storage routes', () => {
	it('allows authenticated uploads and normalizes screenshot metadata', async () => {
		const verifyToken = vi.fn().mockResolvedValue(createVerificationResult('user_1'));
		const storage = createMemoryStorageAdapter();
		const server = await buildServer({
			auth: {
				verify_token: verifyToken,
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
				content_base64: Buffer.from('fake-image').toString('base64'),
				content_type: 'image/png',
				filename: 'capture.png',
				kind: 'screenshot',
				run_id: 'run_1',
				trace_id: 'trace_1',
			},
			url: '/storage/upload',
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			blob: {
				content_type: 'image/png',
				filename: 'capture.png',
				kind: 'screenshot',
				owner_kind: 'authenticated',
				run_id: 'run_1',
				tenant_id: 'tenant_1',
				trace_id: 'trace_1',
				user_id: 'user_1',
				workspace_id: 'workspace_1',
			},
		});
	});

	it('rejects anonymous uploads with a 401', async () => {
		const storage = createMemoryStorageAdapter();
		const server = await buildServer({
			storage: {
				adapter: storage.adapter,
			},
		});
		serversToClose.push(server);

		const response = await server.inject({
			headers: {
				'content-type': 'application/json',
			},
			method: 'POST',
			payload: {
				content_base64: Buffer.from('fake-image').toString('base64'),
				content_type: 'image/png',
				kind: 'screenshot',
			},
			url: '/storage/upload',
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toMatchObject({
			error: 'Unauthorized',
			message: 'Authenticated request required.',
			statusCode: 401,
		});
	});

	it('returns tool output blobs for matching scope owners', async () => {
		const storage = createMemoryStorageAdapter();
		const server = await buildServer({
			auth: {
				verify_token: async () => createVerificationResult('user_1'),
			},
			storage: {
				adapter: storage.adapter,
			},
		});
		serversToClose.push(server);

		const uploadResponse = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
				'content-type': 'application/json',
			},
			method: 'POST',
			payload: {
				content_base64: Buffer.from('tool-output').toString('base64'),
				content_type: 'application/json',
				kind: 'tool_output',
				run_id: 'run_2',
				trace_id: 'trace_2',
			},
			url: '/storage/upload',
		});
		const uploadedBlobId = uploadResponse.json().blob.blob_id as string;

		const getResponse = await server.inject({
			headers: {
				authorization: 'Bearer valid-token',
			},
			method: 'GET',
			url: `/storage/blob/${uploadedBlobId}`,
		});

		expect(getResponse.statusCode).toBe(200);
		expect(getResponse.json()).toMatchObject({
			blob: {
				blob_id: uploadedBlobId,
				content_base64: Buffer.from('tool-output').toString('base64'),
				kind: 'tool_output',
				user_id: 'user_1',
			},
		});
	});

	it('enforces ownership and scope on blob reads', async () => {
		const storage = createMemoryStorageAdapter();
		const uploaderServer = await buildServer({
			auth: {
				verify_token: async () => createVerificationResult('user_1'),
			},
			storage: {
				adapter: storage.adapter,
			},
		});
		serversToClose.push(uploaderServer);

		const uploadResponse = await uploaderServer.inject({
			headers: {
				authorization: 'Bearer valid-token',
				'content-type': 'application/json',
			},
			method: 'POST',
			payload: {
				content_base64: Buffer.from('private-output').toString('base64'),
				content_type: 'text/plain',
				kind: 'tool_output',
			},
			url: '/storage/upload',
		});
		const blobId = uploadResponse.json().blob.blob_id as string;

		const readerServer = await buildServer({
			auth: {
				verify_token: async () => createVerificationResult('user_2'),
			},
			storage: {
				adapter: storage.adapter,
			},
		});
		serversToClose.push(readerServer);

		const response = await readerServer.inject({
			headers: {
				authorization: 'Bearer other-user-token',
			},
			method: 'GET',
			url: `/storage/blob/${blobId}`,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			message: 'Blob ownership mismatch.',
			statusCode: 403,
		});
	});
});
