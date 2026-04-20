import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedRequest } from '../auth/supabase-auth.js';

import {
	type StorageBlobKind,
	type StorageObjectRecord,
	type StorageService,
	StorageServiceError,
	storageBlobKinds,
} from './storage-service.js';

interface StorageUploadBody {
	readonly content_base64: string;
	readonly content_type: string;
	readonly filename?: string;
	readonly kind: StorageBlobKind;
	readonly run_id?: string;
	readonly trace_id?: string;
}

interface StorageUploadResponse {
	readonly blob: StorageObjectRecord;
}

interface StorageBlobResponse extends StorageObjectRecord {
	readonly content_base64: string;
}

interface StorageGetResponse {
	readonly blob: StorageBlobResponse;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isStorageBlobKind(value: unknown): value is StorageBlobKind {
	return typeof value === 'string' && storageBlobKinds.includes(value as StorageBlobKind);
}

function isOptionalString(value: unknown): value is string | undefined {
	return value === undefined || typeof value === 'string';
}

function parseUploadBody(body: unknown): StorageUploadBody {
	if (!isRecord(body)) {
		throw new StorageServiceError(
			'STORAGE_INVALID_BLOB_CONTENT',
			'Storage upload body must be a JSON object.',
		);
	}

	const recordBody = body as Partial<Record<keyof StorageUploadBody, unknown>>;
	const candidate = {
		content_base64: recordBody.content_base64,
		content_type: recordBody.content_type,
		filename: recordBody.filename,
		kind: recordBody.kind,
		run_id: recordBody.run_id,
		trace_id: recordBody.trace_id,
	};

	if (
		typeof candidate.content_base64 !== 'string' ||
		typeof candidate.content_type !== 'string' ||
		!isStorageBlobKind(candidate.kind) ||
		!isOptionalString(candidate.filename) ||
		!isOptionalString(candidate.run_id) ||
		!isOptionalString(candidate.trace_id)
	) {
		throw new StorageServiceError(
			'STORAGE_INVALID_BLOB_CONTENT',
			'Storage upload body is invalid.',
		);
	}

	return {
		content_base64: candidate.content_base64,
		content_type: candidate.content_type,
		filename: candidate.filename,
		kind: candidate.kind,
		run_id: candidate.run_id,
		trace_id: candidate.trace_id,
	};
}

function parseBlobId(value: unknown): string {
	if (typeof value !== 'string' || value.trim() === '') {
		throw new StorageServiceError(
			'STORAGE_INVALID_BLOB_CONTENT',
			'Storage blob id must be a non-empty string.',
		);
	}

	return value;
}

export async function registerStorageRoutes(
	server: FastifyInstance,
	service: StorageService,
): Promise<void> {
	server.post<{ Body: StorageUploadBody; Reply: StorageUploadResponse }>(
		'/storage/upload',
		async (request) => {
			requireAuthenticatedRequest(request);
			const body = parseUploadBody(request.body);
			const blob = await service.upload_blob({
				auth: request.auth,
				content_base64: body.content_base64,
				content_type: body.content_type,
				filename: body.filename,
				kind: body.kind,
				run_id: body.run_id,
				trace_id: body.trace_id,
			});

			return {
				blob,
			};
		},
	);

	server.get<{ Params: { id: string }; Reply: StorageGetResponse }>(
		'/storage/blob/:id',
		async (request) => {
			requireAuthenticatedRequest(request);
			const blob = await service.get_blob({
				auth: request.auth,
				blob_id: parseBlobId(request.params.id),
			});

			return {
				blob: {
					...blob,
					content_base64: Buffer.from(blob.content).toString('base64'),
				},
			};
		},
	);
}
