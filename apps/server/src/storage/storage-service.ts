import { randomUUID } from 'node:crypto';

import type { AuthContext } from '@runa/types';

export const storageBlobKinds = [
	'attachment_image',
	'attachment_text',
	'screenshot',
	'tool_output',
] as const;

export type StorageBlobKind = (typeof storageBlobKinds)[number];

export interface StorageObjectRecord {
	readonly blob_id: string;
	readonly content_type: string;
	readonly created_at: string;
	readonly filename?: string;
	readonly kind: StorageBlobKind;
	readonly owner_kind: 'authenticated' | 'service';
	readonly owner_subject: string;
	readonly run_id?: string;
	readonly size_bytes: number;
	readonly tenant_id?: string;
	readonly trace_id?: string;
	readonly user_id?: string;
	readonly workspace_id?: string;
}

export interface StorageObject extends StorageObjectRecord {
	readonly content: Uint8Array;
}

export interface UploadBlobInput {
	readonly auth: AuthContext;
	readonly content_base64: string;
	readonly content_type: string;
	readonly filename?: string;
	readonly kind: StorageBlobKind;
	readonly run_id?: string;
	readonly trace_id?: string;
}

export interface GetBlobInput {
	readonly auth: AuthContext;
	readonly blob_id: string;
}

export interface StorageProviderAdapter {
	get_object(blob_id: string): Promise<StorageObject | null>;
	upload_object(blob: StorageObject): Promise<StorageObjectRecord>;
}

export interface StorageService {
	get_blob(input: GetBlobInput): Promise<StorageObject>;
	upload_blob(input: UploadBlobInput): Promise<StorageObjectRecord>;
}

export interface CreateStorageServiceInput {
	readonly adapter: StorageProviderAdapter;
	readonly generate_blob_id?: () => string;
	readonly now?: () => Date;
}

type StorageServiceErrorCode =
	| 'STORAGE_ACCESS_DENIED'
	| 'STORAGE_BLOB_NOT_FOUND'
	| 'STORAGE_INVALID_BLOB_CONTENT'
	| 'STORAGE_NOT_CONFIGURED';

export class StorageServiceError extends Error {
	readonly code: StorageServiceErrorCode;
	readonly statusCode: 400 | 403 | 404 | 503;

	constructor(code: StorageServiceErrorCode, message: string) {
		super(message);
		this.code = code;
		this.name = 'StorageServiceError';
		this.statusCode = getStatusCode(code);
	}
}

function getStatusCode(code: StorageServiceErrorCode): 400 | 403 | 404 | 503 {
	switch (code) {
		case 'STORAGE_INVALID_BLOB_CONTENT':
			return 400;
		case 'STORAGE_ACCESS_DENIED':
			return 403;
		case 'STORAGE_BLOB_NOT_FOUND':
			return 404;
		case 'STORAGE_NOT_CONFIGURED':
			return 503;
	}
}

function decodeBase64Content(contentBase64: string): Uint8Array {
	if (contentBase64.trim() === '') {
		throw new StorageServiceError(
			'STORAGE_INVALID_BLOB_CONTENT',
			'Blob content must be a non-empty base64 string.',
		);
	}

	return Buffer.from(contentBase64, 'base64');
}

function resolveAuthenticatedOwner(auth: AuthContext): {
	readonly owner_kind: 'authenticated' | 'service';
	readonly owner_subject: string;
	readonly tenant_id?: string;
	readonly user_id?: string;
	readonly workspace_id?: string;
} {
	if (auth.principal.kind === 'anonymous') {
		throw new StorageServiceError(
			'STORAGE_ACCESS_DENIED',
			'Authenticated storage access required.',
		);
	}

	if (auth.principal.kind === 'service') {
		return {
			owner_kind: 'service',
			owner_subject: auth.principal.service_name,
			tenant_id: auth.principal.scope.tenant_id,
			workspace_id: auth.principal.scope.workspace_id,
		};
	}

	return {
		owner_kind: 'authenticated',
		owner_subject: auth.principal.user_id,
		tenant_id: auth.principal.scope.tenant_id,
		user_id: auth.principal.user_id,
		workspace_id: auth.principal.scope.workspace_id,
	};
}

function ensureBlobAccess(auth: AuthContext, blob: StorageObject): void {
	if (auth.principal.kind === 'anonymous') {
		throw new StorageServiceError(
			'STORAGE_ACCESS_DENIED',
			'Authenticated storage access required.',
		);
	}

	if (auth.principal.kind === 'service') {
		return;
	}

	if (blob.tenant_id !== undefined && auth.principal.scope.tenant_id !== blob.tenant_id) {
		throw new StorageServiceError('STORAGE_ACCESS_DENIED', 'Blob tenant scope mismatch.');
	}

	const workspaceIds = auth.principal.scope.workspace_ids ?? [];
	const workspaceMatches =
		blob.workspace_id === undefined ||
		auth.principal.scope.workspace_id === blob.workspace_id ||
		workspaceIds.includes(blob.workspace_id);

	if (!workspaceMatches) {
		throw new StorageServiceError('STORAGE_ACCESS_DENIED', 'Blob workspace scope mismatch.');
	}

	if (blob.user_id !== undefined && blob.user_id !== auth.principal.user_id) {
		throw new StorageServiceError('STORAGE_ACCESS_DENIED', 'Blob ownership mismatch.');
	}
}

export function createStorageService(input: CreateStorageServiceInput): StorageService {
	const generateBlobId = input.generate_blob_id ?? randomUUID;
	const now = input.now ?? (() => new Date());

	return {
		async upload_blob(uploadInput) {
			const content = decodeBase64Content(uploadInput.content_base64);
			const owner = resolveAuthenticatedOwner(uploadInput.auth);
			const blob: StorageObject = {
				blob_id: generateBlobId(),
				content,
				content_type: uploadInput.content_type,
				created_at: now().toISOString(),
				filename: uploadInput.filename,
				kind: uploadInput.kind,
				owner_kind: owner.owner_kind,
				owner_subject: owner.owner_subject,
				run_id: uploadInput.run_id,
				size_bytes: content.byteLength,
				tenant_id: owner.tenant_id,
				trace_id: uploadInput.trace_id,
				user_id: owner.user_id,
				workspace_id: owner.workspace_id,
			};

			return input.adapter.upload_object(blob);
		},
		async get_blob(getInput) {
			const blob = await input.adapter.get_object(getInput.blob_id);

			if (blob === null) {
				throw new StorageServiceError('STORAGE_BLOB_NOT_FOUND', 'Storage blob was not found.');
			}

			ensureBlobAccess(getInput.auth, blob);

			return blob;
		},
	};
}
