import type {
	StorageObject,
	StorageObjectRecord,
	StorageProviderAdapter,
} from './storage-service.js';

import { StorageServiceError } from './storage-service.js';

const DEFAULT_SUPABASE_STORAGE_PREFIX = 'runa';
const PATH_VERSION_SEGMENT = 'v1';
const NULL_SEGMENT_VALUE = '__none__';

export interface SupabaseStorageEnvironment {
	readonly SUPABASE_SERVICE_ROLE_KEY?: string;
	readonly SUPABASE_STORAGE_BUCKET?: string;
	readonly SUPABASE_STORAGE_PREFIX?: string;
	readonly SUPABASE_URL?: string;
}

export type SupabaseStorageFetch = (
	input: string | URL | globalThis.Request,
	init?: RequestInit,
) => Promise<Response>;

export interface CreateSupabaseStorageAdapterInput {
	readonly bucket: string;
	readonly fetch?: SupabaseStorageFetch;
	readonly path_prefix?: string;
	readonly supabase_url: string;
	readonly service_role_key: string;
}

export interface CreateSupabaseStorageAdapterFromEnvironmentInput {
	readonly bucket?: string;
	readonly environment: SupabaseStorageEnvironment;
	readonly fetch?: SupabaseStorageFetch;
	readonly path_prefix?: string;
}

interface SupabaseStorageListItem {
	readonly created_at?: string;
	readonly metadata?: Readonly<Record<string, unknown>>;
	readonly name: string;
}

interface SupabaseStorageMetadataCandidate {
	readonly size?: unknown;
}

interface ParsedStoragePath {
	readonly blob_id: string;
	readonly created_at: string;
	readonly filename?: string;
	readonly kind: StorageObjectRecord['kind'];
	readonly owner_kind: StorageObjectRecord['owner_kind'];
	readonly owner_subject: string;
	readonly run_id?: string;
	readonly tenant_id?: string;
	readonly trace_id?: string;
	readonly user_id?: string;
	readonly workspace_id?: string;
}

type StorageHeaders = Record<string, string>;

function normalizeRequiredValue(value: string, label: string): string {
	const normalizedValue = value.trim();

	if (normalizedValue === '') {
		throw new StorageServiceError('STORAGE_NOT_CONFIGURED', `${label} must be a non-empty string.`);
	}

	return normalizedValue;
}

function normalizePathPrefix(prefix: string | undefined): string {
	const normalizedPrefix = (prefix ?? DEFAULT_SUPABASE_STORAGE_PREFIX)
		.trim()
		.replace(/^\/+|\/+$/g, '');

	if (normalizedPrefix === '') {
		throw new StorageServiceError(
			'STORAGE_NOT_CONFIGURED',
			'Supabase storage path prefix must be a non-empty string.',
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

function encodeOptionalPathValue(value: string | undefined): string {
	return value === undefined ? NULL_SEGMENT_VALUE : encodePathValue(value);
}

function decodeRequiredPathValue(value: string): string {
	return decodeURIComponent(value);
}

function decodeOptionalPathValue(value: string): string | undefined {
	return value === NULL_SEGMENT_VALUE ? undefined : decodeRequiredPathValue(value);
}

function getRequiredPathSegment(segments: readonly string[], index: number, path: string): string {
	const value = segments[index];

	if (value === undefined) {
		throw new Error(`Unexpected Supabase storage object path: ${path}`);
	}

	return value;
}

function buildStorageObjectPath(blob: StorageObject, pathPrefix: string): string {
	return [
		pathPrefix,
		PATH_VERSION_SEGMENT,
		'blob',
		encodePathValue(blob.blob_id),
		'kind',
		encodePathValue(blob.kind),
		'owner-kind',
		encodePathValue(blob.owner_kind),
		'owner-subject',
		encodePathValue(blob.owner_subject),
		'tenant',
		encodeOptionalPathValue(blob.tenant_id),
		'workspace',
		encodeOptionalPathValue(blob.workspace_id),
		'user',
		encodeOptionalPathValue(blob.user_id),
		'run',
		encodeOptionalPathValue(blob.run_id),
		'trace',
		encodeOptionalPathValue(blob.trace_id),
		'created',
		encodePathValue(blob.created_at),
		'filename',
		encodeOptionalPathValue(blob.filename),
		'content',
	].join('/');
}

function buildStorageSearchPrefix(blobId: string, pathPrefix: string): string {
	return [pathPrefix, PATH_VERSION_SEGMENT, 'blob', encodePathValue(blobId), ''].join('/');
}

function parseStorageObjectPath(path: string, pathPrefix: string): ParsedStoragePath {
	const pathSegments = path.split('/');
	const prefixSegments = pathPrefix.split('/');
	const relativeSegments = pathSegments.slice(prefixSegments.length);

	if (
		relativeSegments.length !== 24 ||
		relativeSegments[0] !== PATH_VERSION_SEGMENT ||
		relativeSegments[1] !== 'blob' ||
		relativeSegments[3] !== 'kind' ||
		relativeSegments[5] !== 'owner-kind' ||
		relativeSegments[7] !== 'owner-subject' ||
		relativeSegments[9] !== 'tenant' ||
		relativeSegments[11] !== 'workspace' ||
		relativeSegments[13] !== 'user' ||
		relativeSegments[15] !== 'run' ||
		relativeSegments[17] !== 'trace' ||
		relativeSegments[19] !== 'created' ||
		relativeSegments[21] !== 'filename' ||
		relativeSegments[23] !== 'content'
	) {
		throw new Error(`Unexpected Supabase storage object path: ${path}`);
	}

	const kind = decodeRequiredPathValue(getRequiredPathSegment(relativeSegments, 4, path));
	const ownerKind = decodeRequiredPathValue(getRequiredPathSegment(relativeSegments, 6, path));

	if (
		kind !== 'attachment_document' &&
		kind !== 'attachment_image' &&
		kind !== 'attachment_text' &&
		kind !== 'screenshot' &&
		kind !== 'tool_output'
	) {
		throw new Error(`Unsupported Supabase storage blob kind: ${kind}`);
	}

	if (ownerKind !== 'authenticated' && ownerKind !== 'service') {
		throw new Error(`Unsupported Supabase storage owner kind: ${ownerKind}`);
	}

	return {
		blob_id: decodeRequiredPathValue(getRequiredPathSegment(relativeSegments, 2, path)),
		created_at: decodeRequiredPathValue(getRequiredPathSegment(relativeSegments, 20, path)),
		filename: decodeOptionalPathValue(getRequiredPathSegment(relativeSegments, 22, path)),
		kind,
		owner_kind: ownerKind,
		owner_subject: decodeRequiredPathValue(getRequiredPathSegment(relativeSegments, 8, path)),
		run_id: decodeOptionalPathValue(getRequiredPathSegment(relativeSegments, 16, path)),
		tenant_id: decodeOptionalPathValue(getRequiredPathSegment(relativeSegments, 10, path)),
		trace_id: decodeOptionalPathValue(getRequiredPathSegment(relativeSegments, 18, path)),
		user_id: decodeOptionalPathValue(getRequiredPathSegment(relativeSegments, 14, path)),
		workspace_id: decodeOptionalPathValue(getRequiredPathSegment(relativeSegments, 12, path)),
	};
}

function createBaseHeaders(serviceRoleKey: string): StorageHeaders {
	return {
		apikey: serviceRoleKey,
		authorization: `Bearer ${serviceRoleKey}`,
	};
}

async function readStorageErrorMessage(response: Response): Promise<string> {
	const responseText = await response.text();

	if (responseText.trim() === '') {
		return `Supabase Storage request failed with status ${response.status}.`;
	}

	try {
		const parsedBody = JSON.parse(responseText) as unknown;

		if (
			typeof parsedBody === 'object' &&
			parsedBody !== null &&
			'message' in parsedBody &&
			typeof parsedBody.message === 'string'
		) {
			return parsedBody.message;
		}
	} catch {}

	return responseText;
}

function isSupabaseStorageListResponse(
	value: unknown,
): value is readonly SupabaseStorageListItem[] {
	return (
		Array.isArray(value) &&
		value.every(
			(item) =>
				typeof item === 'object' &&
				item !== null &&
				'name' in item &&
				typeof item.name === 'string',
		)
	);
}

async function listStorageObjects(
	fetchImplementation: SupabaseStorageFetch,
	baseUrl: string,
	bucket: string,
	serviceRoleKey: string,
	prefix: string,
): Promise<readonly SupabaseStorageListItem[]> {
	const response = await fetchImplementation(
		`${baseUrl}/object/list/${encodeURIComponent(bucket)}`,
		{
			body: JSON.stringify({
				limit: 1,
				prefix,
			}),
			headers: {
				...createBaseHeaders(serviceRoleKey),
				'content-type': 'application/json',
			},
			method: 'POST',
		},
	);

	if (response.status === 404) {
		return [];
	}

	if (!response.ok) {
		throw new Error(await readStorageErrorMessage(response));
	}

	const parsedBody = (await response.json()) as unknown;

	if (!isSupabaseStorageListResponse(parsedBody)) {
		throw new Error('Supabase Storage list response is invalid.');
	}

	return parsedBody;
}

function getObjectSize(listItem: SupabaseStorageListItem, content: Uint8Array): number {
	const metadata = listItem.metadata as SupabaseStorageMetadataCandidate | undefined;
	const sizeValue = metadata?.size;

	return typeof sizeValue === 'number' ? sizeValue : content.byteLength;
}

function toStorageObjectRecord(blob: StorageObject): StorageObjectRecord {
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
}

export function createSupabaseStorageAdapter(
	input: CreateSupabaseStorageAdapterInput,
): StorageProviderAdapter {
	const fetchImplementation = input.fetch ?? globalThis.fetch;
	const bucket = normalizeRequiredValue(input.bucket, 'Supabase storage bucket');
	const baseUrl = `${normalizeRequiredValue(input.supabase_url, 'Supabase URL').replace(/\/+$/g, '')}/storage/v1`;
	const serviceRoleKey = normalizeRequiredValue(
		input.service_role_key,
		'Supabase service role key',
	);
	const pathPrefix = normalizePathPrefix(input.path_prefix);

	return {
		async upload_object(blob) {
			const objectPath = buildStorageObjectPath(blob, pathPrefix);
			const response = await fetchImplementation(
				`${baseUrl}/object/${encodeURIComponent(bucket)}/${objectPath}`,
				{
					body: Buffer.from(blob.content),
					headers: {
						...createBaseHeaders(serviceRoleKey),
						'content-type': blob.content_type,
						'x-upsert': 'false',
					},
					method: 'POST',
				},
			);

			if (!response.ok) {
				throw new Error(await readStorageErrorMessage(response));
			}

			return toStorageObjectRecord(blob);
		},
		async get_object(blobId) {
			const objects = await listStorageObjects(
				fetchImplementation,
				baseUrl,
				bucket,
				serviceRoleKey,
				buildStorageSearchPrefix(blobId, pathPrefix),
			);
			const storedObject = objects[0];

			if (storedObject === undefined) {
				return null;
			}

			const parsedPath = parseStorageObjectPath(storedObject.name, pathPrefix);
			const response = await fetchImplementation(
				`${baseUrl}/object/authenticated/${encodeURIComponent(bucket)}/${storedObject.name}`,
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

			const content = new Uint8Array(await response.arrayBuffer());

			return {
				blob_id: parsedPath.blob_id,
				content,
				content_type: response.headers.get('content-type') ?? 'application/octet-stream',
				created_at: storedObject.created_at ?? parsedPath.created_at,
				filename: parsedPath.filename,
				kind: parsedPath.kind,
				owner_kind: parsedPath.owner_kind,
				owner_subject: parsedPath.owner_subject,
				run_id: parsedPath.run_id,
				size_bytes: getObjectSize(storedObject, content),
				tenant_id: parsedPath.tenant_id,
				trace_id: parsedPath.trace_id,
				user_id: parsedPath.user_id,
				workspace_id: parsedPath.workspace_id,
			};
		},
	};
}

export function createSupabaseStorageAdapterFromEnvironment(
	input: CreateSupabaseStorageAdapterFromEnvironmentInput,
): StorageProviderAdapter | null {
	const resolvedBucket = input.bucket ?? input.environment.SUPABASE_STORAGE_BUCKET;
	const resolvedPrefix = input.path_prefix ?? input.environment.SUPABASE_STORAGE_PREFIX;
	const resolvedSupabaseUrl = input.environment.SUPABASE_URL;
	const resolvedServiceRoleKey = input.environment.SUPABASE_SERVICE_ROLE_KEY;
	const providedValues = [
		resolvedBucket,
		resolvedPrefix,
		resolvedSupabaseUrl,
		resolvedServiceRoleKey,
	].filter((value) => value !== undefined);

	if (providedValues.length === 0) {
		return null;
	}

	if (
		resolvedBucket === undefined ||
		resolvedSupabaseUrl === undefined ||
		resolvedServiceRoleKey === undefined
	) {
		throw new StorageServiceError(
			'STORAGE_NOT_CONFIGURED',
			'Supabase storage adapter requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET.',
		);
	}

	return createSupabaseStorageAdapter({
		bucket: resolvedBucket,
		fetch: input.fetch,
		path_prefix: resolvedPrefix,
		service_role_key: resolvedServiceRoleKey,
		supabase_url: resolvedSupabaseUrl,
	});
}
