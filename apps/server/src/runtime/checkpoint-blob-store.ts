import { randomUUID } from 'node:crypto';

import type {
	CheckpointBlobKind,
	CheckpointBlobRef,
	CheckpointContentEncoding,
	CheckpointMetadata,
} from '@runa/types';

import type {
	SupabaseStorageEnvironment,
	SupabaseStorageFetch,
} from '../storage/supabase-storage-adapter.js';

import type { CheckpointBlobStore } from './checkpoint-manager.js';

const DEFAULT_CHECKPOINT_STORAGE_PREFIX = 'runa/checkpoints';
const CHECKPOINT_STORAGE_PATH_VERSION = 'v1';
const CHECKPOINT_BLOB_MANIFEST_CONTENT_TYPE = 'application/json';

export interface CheckpointBlobObject {
	readonly content: Uint8Array;
	readonly content_type: string;
	readonly path: string;
}

export interface CheckpointBlobObjectStorageAdapter {
	get_object(path: string): Promise<CheckpointBlobObject | null>;
	put_object(object: CheckpointBlobObject): Promise<void>;
}

export interface CheckpointBlobPayload {
	readonly content: Uint8Array;
	readonly ref: CheckpointBlobRef;
}

export interface PutCheckpointBlobPayloadInput {
	readonly blob_id?: string;
	readonly checkpoint_id: string;
	readonly content: Uint8Array;
	readonly content_encoding?: CheckpointContentEncoding;
	readonly content_type: string;
	readonly created_at?: string;
	readonly checksum?: string;
	readonly kind: CheckpointBlobKind;
	readonly metadata?: CheckpointMetadata;
}

export interface PersistentCheckpointBlobStore extends CheckpointBlobStore {
	get_checkpoint_blob_payload(ref: CheckpointBlobRef): Promise<CheckpointBlobPayload | null>;
	put_checkpoint_blob_payload(input: PutCheckpointBlobPayloadInput): Promise<CheckpointBlobRef>;
}

export interface CreateCheckpointBlobStoreInput {
	readonly adapter: CheckpointBlobObjectStorageAdapter;
	readonly generate_blob_id?: () => string;
	readonly now?: () => string;
	readonly path_prefix?: string;
}

export interface CreateSupabaseCheckpointBlobObjectStorageAdapterInput {
	readonly bucket: string;
	readonly fetch?: SupabaseStorageFetch;
	readonly service_role_key: string;
	readonly supabase_url: string;
}

export interface CreateSupabaseCheckpointBlobStoreFromEnvironmentInput {
	readonly bucket?: string;
	readonly environment: SupabaseStorageEnvironment;
	readonly fetch?: SupabaseStorageFetch;
	readonly generate_blob_id?: () => string;
	readonly now?: () => string;
	readonly path_prefix?: string;
}

interface CheckpointBlobManifest {
	readonly blob_refs: readonly CheckpointBlobRef[];
	readonly checkpoint_id: string;
	readonly version: 1;
}

interface CheckpointBlobManifestCandidate {
	readonly blob_refs?: unknown;
	readonly checkpoint_id?: unknown;
	readonly version?: unknown;
}

interface CheckpointBlobRefCandidate {
	readonly blob_id?: unknown;
	readonly checkpoint_id?: unknown;
	readonly content_type?: unknown;
	readonly kind?: unknown;
	readonly storage_kind?: unknown;
}

interface ErrorMessageResponseCandidate {
	readonly message?: unknown;
}

type CheckpointBlobStoreOperation = 'read' | 'write';

export class CheckpointBlobStoreConfigurationError extends Error {
	readonly code = 'CHECKPOINT_BLOB_STORE_CONFIGURATION_ERROR';

	constructor(message: string) {
		super(message);
		this.name = 'CheckpointBlobStoreConfigurationError';
	}
}

export class CheckpointBlobStoreError extends Error {
	override readonly cause?: unknown;
	readonly code = 'CHECKPOINT_BLOB_STORE_ERROR';
	readonly operation: CheckpointBlobStoreOperation;

	constructor(operation: CheckpointBlobStoreOperation, message: string, cause?: unknown) {
		super(message);
		this.cause = cause;
		this.name = 'CheckpointBlobStoreError';
		this.operation = operation;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRequiredValue(value: string, label: string): string {
	const normalizedValue = value.trim();

	if (normalizedValue === '') {
		throw new CheckpointBlobStoreConfigurationError(`${label} must be a non-empty string.`);
	}

	return normalizedValue;
}

function normalizePathPrefix(prefix: string | undefined): string {
	const normalizedPrefix = (prefix ?? DEFAULT_CHECKPOINT_STORAGE_PREFIX)
		.trim()
		.replace(/^\/+|\/+$/g, '');

	if (normalizedPrefix === '') {
		throw new CheckpointBlobStoreConfigurationError(
			'Checkpoint blob store path prefix must be a non-empty string.',
		);
	}

	return normalizedPrefix
		.split('/')
		.filter((segment) => segment !== '')
		.map((segment) => encodeURIComponent(segment))
		.join('/');
}

function encodePathValue(value: string): string {
	return encodeURIComponent(value);
}

function buildManifestPath(checkpointId: string, pathPrefix: string): string {
	return [
		pathPrefix,
		CHECKPOINT_STORAGE_PATH_VERSION,
		'checkpoint',
		encodePathValue(checkpointId),
		'blob-refs.json',
	].join('/');
}

function buildPayloadPath(
	checkpointId: string,
	kind: CheckpointBlobKind,
	blobId: string,
	pathPrefix: string,
): string {
	return [
		pathPrefix,
		CHECKPOINT_STORAGE_PATH_VERSION,
		'checkpoint',
		encodePathValue(checkpointId),
		'blob',
		encodePathValue(kind),
		encodePathValue(blobId),
		'payload',
	].join('/');
}

function createBlobManifest(
	checkpointId: string,
	blobRefs: readonly CheckpointBlobRef[],
): CheckpointBlobManifest {
	return {
		blob_refs: blobRefs,
		checkpoint_id: checkpointId,
		version: 1,
	};
}

function isCheckpointBlobRef(value: unknown): value is CheckpointBlobRef {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as CheckpointBlobRefCandidate;

	return (
		typeof candidate.blob_id === 'string' &&
		typeof candidate.checkpoint_id === 'string' &&
		typeof candidate.content_type === 'string' &&
		typeof candidate.kind === 'string' &&
		typeof candidate.storage_kind === 'string'
	);
}

function parseBlobManifest(
	checkpointId: string,
	content: Uint8Array,
): readonly CheckpointBlobRef[] {
	const parsedValue = JSON.parse(Buffer.from(content).toString('utf8')) as unknown;

	if (!isRecord(parsedValue)) {
		throw new CheckpointBlobStoreError(
			'read',
			`Checkpoint blob manifest for "${checkpointId}" is invalid.`,
		);
	}

	const candidate = parsedValue as CheckpointBlobManifestCandidate;

	if (
		candidate.version !== 1 ||
		candidate.checkpoint_id !== checkpointId ||
		!Array.isArray(candidate.blob_refs) ||
		!candidate.blob_refs.every((blobRef) => isCheckpointBlobRef(blobRef))
	) {
		throw new CheckpointBlobStoreError(
			'read',
			`Checkpoint blob manifest for "${checkpointId}" is invalid.`,
		);
	}

	return candidate.blob_refs;
}

function serializeBlobManifest(
	checkpointId: string,
	blobRefs: readonly CheckpointBlobRef[],
): Uint8Array {
	return Buffer.from(JSON.stringify(createBlobManifest(checkpointId, blobRefs)), 'utf8');
}

function buildCheckpointBlobRef(input: {
	readonly blob_id: string;
	readonly checkpoint_id: string;
	readonly content: Uint8Array;
	readonly content_encoding?: CheckpointContentEncoding;
	readonly content_type: string;
	readonly created_at: string;
	readonly checksum?: string;
	readonly kind: CheckpointBlobKind;
	readonly locator: string;
	readonly metadata?: CheckpointMetadata;
}): CheckpointBlobRef {
	return {
		blob_id: input.blob_id,
		byte_length: input.content.byteLength,
		checkpoint_id: input.checkpoint_id,
		content_encoding: input.content_encoding,
		content_type: input.content_type,
		created_at: input.created_at,
		checksum: input.checksum,
		kind: input.kind,
		locator: input.locator,
		metadata: input.metadata,
		storage_kind: 'object_storage',
	};
}

async function runBlobStoreOperation<TResult>(
	operation: CheckpointBlobStoreOperation,
	action: () => Promise<TResult>,
	message: string,
): Promise<TResult> {
	try {
		return await action();
	} catch (error: unknown) {
		if (
			error instanceof CheckpointBlobStoreConfigurationError ||
			error instanceof CheckpointBlobStoreError
		) {
			throw error;
		}

		throw new CheckpointBlobStoreError(operation, message, error);
	}
}

async function readStorageErrorMessage(response: Response): Promise<string> {
	const responseText = await response.text();

	if (responseText.trim() === '') {
		return `Supabase Storage request failed with status ${response.status}.`;
	}

	try {
		const parsedBody = JSON.parse(responseText) as unknown;

		if (isRecord(parsedBody)) {
			const candidate = parsedBody as ErrorMessageResponseCandidate;

			if (typeof candidate.message === 'string') {
				return candidate.message;
			}
		}
	} catch {}

	return responseText;
}

function createBaseHeaders(serviceRoleKey: string): Readonly<Record<string, string>> {
	return {
		apikey: serviceRoleKey,
		authorization: `Bearer ${serviceRoleKey}`,
	};
}

export function createSupabaseCheckpointBlobObjectStorageAdapter(
	input: CreateSupabaseCheckpointBlobObjectStorageAdapterInput,
): CheckpointBlobObjectStorageAdapter {
	const fetchImplementation = input.fetch ?? globalThis.fetch;
	const bucket = normalizeRequiredValue(input.bucket, 'Supabase storage bucket');
	const baseUrl = `${normalizeRequiredValue(input.supabase_url, 'Supabase URL').replace(/\/+$/g, '')}/storage/v1`;
	const serviceRoleKey = normalizeRequiredValue(
		input.service_role_key,
		'Supabase service role key',
	);

	return {
		async get_object(path) {
			const response = await fetchImplementation(
				`${baseUrl}/object/authenticated/${encodeURIComponent(bucket)}/${path}`,
				{
					headers: createBaseHeaders(serviceRoleKey),
					method: 'GET',
				},
			);

			if (response.status === 404) {
				return null;
			}

			if (!response.ok) {
				throw new Error(await readStorageErrorMessage(response));
			}

			return {
				content: new Uint8Array(await response.arrayBuffer()),
				content_type: response.headers.get('content-type') ?? 'application/octet-stream',
				path,
			};
		},
		async put_object(object) {
			const response = await fetchImplementation(
				`${baseUrl}/object/${encodeURIComponent(bucket)}/${object.path}`,
				{
					body: Buffer.from(object.content),
					headers: {
						...createBaseHeaders(serviceRoleKey),
						'content-type': object.content_type,
						'x-upsert': 'true',
					},
					method: 'POST',
				},
			);

			if (!response.ok) {
				throw new Error(await readStorageErrorMessage(response));
			}
		},
	};
}

export function createCheckpointBlobStore(
	input: CreateCheckpointBlobStoreInput,
): PersistentCheckpointBlobStore {
	const pathPrefix = normalizePathPrefix(input.path_prefix);
	const generateBlobId = input.generate_blob_id ?? randomUUID;
	const now = input.now ?? (() => new Date().toISOString());

	return {
		get_checkpoint_blob_payload(ref) {
			return runBlobStoreOperation(
				'read',
				async () => {
					const payloadPath =
						ref.locator ?? buildPayloadPath(ref.checkpoint_id, ref.kind, ref.blob_id, pathPrefix);
					const object = await input.adapter.get_object(payloadPath);

					if (object === null) {
						return null;
					}

					return {
						content: object.content,
						ref: {
							...ref,
							byte_length: ref.byte_length ?? object.content.byteLength,
							content_type: ref.content_type || object.content_type,
							locator: payloadPath,
						},
					};
				},
				`Failed to read checkpoint blob payload for "${ref.blob_id}".`,
			);
		},
		list_checkpoint_blob_refs(checkpoint_id) {
			return runBlobStoreOperation(
				'read',
				async () => {
					const manifestObject = await input.adapter.get_object(
						buildManifestPath(checkpoint_id, pathPrefix),
					);

					if (manifestObject === null) {
						return [];
					}

					return parseBlobManifest(checkpoint_id, manifestObject.content);
				},
				`Failed to read checkpoint blob refs for "${checkpoint_id}".`,
			);
		},
		put_checkpoint_blob_payload(payloadInput) {
			return runBlobStoreOperation(
				'write',
				async () => {
					const blobId = payloadInput.blob_id ?? generateBlobId();
					const createdAt = payloadInput.created_at ?? now();
					const locator = buildPayloadPath(
						payloadInput.checkpoint_id,
						payloadInput.kind,
						blobId,
						pathPrefix,
					);

					await input.adapter.put_object({
						content: payloadInput.content,
						content_type: payloadInput.content_type,
						path: locator,
					});

					return buildCheckpointBlobRef({
						blob_id: blobId,
						checkpoint_id: payloadInput.checkpoint_id,
						content: payloadInput.content,
						content_encoding: payloadInput.content_encoding,
						content_type: payloadInput.content_type,
						created_at: createdAt,
						checksum: payloadInput.checksum,
						kind: payloadInput.kind,
						locator,
						metadata: payloadInput.metadata,
					});
				},
				`Failed to persist checkpoint blob payload for "${payloadInput.checkpoint_id}".`,
			);
		},
		replace_checkpoint_blob_refs(checkpoint_id, blob_refs) {
			return runBlobStoreOperation(
				'write',
				async () => {
					await input.adapter.put_object({
						content: serializeBlobManifest(checkpoint_id, blob_refs),
						content_type: CHECKPOINT_BLOB_MANIFEST_CONTENT_TYPE,
						path: buildManifestPath(checkpoint_id, pathPrefix),
					});

					return blob_refs;
				},
				`Failed to persist checkpoint blob refs for "${checkpoint_id}".`,
			);
		},
	};
}

export function createSupabaseCheckpointBlobStoreFromEnvironment(
	input: CreateSupabaseCheckpointBlobStoreFromEnvironmentInput,
): PersistentCheckpointBlobStore | null {
	const resolvedBucket = input.bucket ?? input.environment.SUPABASE_STORAGE_BUCKET;
	const resolvedSupabaseUrl = input.environment.SUPABASE_URL;
	const resolvedServiceRoleKey = input.environment.SUPABASE_SERVICE_ROLE_KEY;
	const providedValues = [resolvedBucket, resolvedSupabaseUrl, resolvedServiceRoleKey].filter(
		(value) => value !== undefined,
	);

	if (providedValues.length === 0) {
		return null;
	}

	if (
		resolvedBucket === undefined ||
		resolvedSupabaseUrl === undefined ||
		resolvedServiceRoleKey === undefined
	) {
		throw new CheckpointBlobStoreConfigurationError(
			'Checkpoint blob store requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET.',
		);
	}

	return createCheckpointBlobStore({
		adapter: createSupabaseCheckpointBlobObjectStorageAdapter({
			bucket: resolvedBucket,
			fetch: input.fetch,
			service_role_key: resolvedServiceRoleKey,
			supabase_url: resolvedSupabaseUrl,
		}),
		generate_blob_id: input.generate_blob_id,
		now: input.now,
		path_prefix: input.path_prefix,
	});
}
