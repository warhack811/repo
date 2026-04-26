import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const DEFAULT_DOWNLOAD_TTL_MS = 15 * 60 * 1000;
const DEFAULT_DOWNLOAD_SECRET = randomBytes(32).toString('hex');

export interface SignedStorageDownloadUrl {
	readonly expires_at: string;
	readonly url: string;
}

export interface StorageDownloadUrlSigner {
	create(input: {
		readonly blob_id: string;
		readonly filename?: string;
	}): SignedStorageDownloadUrl;
	verify(input: {
		readonly blob_id: string;
		readonly expires_at: string;
		readonly signature: string;
	}): boolean;
}

export interface CreateStorageDownloadUrlSignerInput {
	readonly base_path?: string;
	readonly now?: () => Date;
	readonly secret?: string;
	readonly ttl_ms?: number;
}

function createSignature(
	input: Readonly<{
		blob_id: string;
		expires_at: string;
		secret: string;
	}>,
): string {
	return createHmac('sha256', input.secret)
		.update(`${input.blob_id}.${input.expires_at}`)
		.digest('hex');
}

function signaturesMatch(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left, 'hex');
	const rightBuffer = Buffer.from(right, 'hex');

	return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createStorageDownloadUrlSigner(
	input: CreateStorageDownloadUrlSignerInput = {},
): StorageDownloadUrlSigner {
	const secret = input.secret ?? DEFAULT_DOWNLOAD_SECRET;
	const ttlMs = input.ttl_ms ?? DEFAULT_DOWNLOAD_TTL_MS;
	const now = input.now ?? (() => new Date());
	const basePath = input.base_path ?? '/storage/download';

	return {
		create(downloadInput) {
			const expiresAt = new Date(now().getTime() + ttlMs).toISOString();
			const signature = createSignature({
				blob_id: downloadInput.blob_id,
				expires_at: expiresAt,
				secret,
			});
			const searchParams = new URLSearchParams({
				expires_at: expiresAt,
				signature,
			});

			if (downloadInput.filename !== undefined) {
				searchParams.set('filename', downloadInput.filename);
			}

			return {
				expires_at: expiresAt,
				url: `${basePath}/${encodeURIComponent(downloadInput.blob_id)}?${searchParams.toString()}`,
			};
		},
		verify(verifyInput) {
			const expiresAtMs = Date.parse(verifyInput.expires_at);

			if (!Number.isFinite(expiresAtMs) || expiresAtMs < now().getTime()) {
				return false;
			}

			const expectedSignature = createSignature({
				blob_id: verifyInput.blob_id,
				expires_at: verifyInput.expires_at,
				secret,
			});

			return signaturesMatch(verifyInput.signature, expectedSignature);
		},
	};
}

export const defaultStorageDownloadUrlSigner = createStorageDownloadUrlSigner();
