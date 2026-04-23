import type { ModelAttachment, UploadAttachmentResponse } from '@runa/types';
import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedRequest } from '../auth/supabase-auth.js';
import type { StorageService } from '../storage/storage-service.js';

const MAX_IMAGE_BYTES = 1_500_000;
const MAX_TEXT_BYTES = 200_000;
const MAX_TEXT_CHARACTERS = 12_000;

interface UploadRequestBody {
	readonly content_base64: string;
	readonly content_type: string;
	readonly filename?: string;
}

class UploadRouteError extends Error {
	readonly statusCode: 400 | 413 | 415;

	constructor(statusCode: 400 | 413 | 415, message: string) {
		super(message);
		this.name = 'UploadRouteError';
		this.statusCode = statusCode;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseUploadRequestBody(body: unknown): UploadRequestBody {
	if (!isRecord(body)) {
		throw new UploadRouteError(400, 'Upload body must be a JSON object.');
	}

	const candidate = body as Partial<UploadRequestBody>;
	const { content_base64: contentBase64, content_type: contentType, filename } = candidate;

	if (
		typeof contentBase64 !== 'string' ||
		typeof contentType !== 'string' ||
		(filename !== undefined && typeof filename !== 'string')
	) {
		throw new UploadRouteError(400, 'Upload body is invalid.');
	}

	return {
		content_base64: contentBase64,
		content_type: contentType,
		filename,
	};
}

function decodeBase64(contentBase64: string): Buffer {
	if (contentBase64.trim().length === 0) {
		throw new UploadRouteError(400, 'Upload content must be a non-empty base64 string.');
	}

	try {
		return Buffer.from(contentBase64, 'base64');
	} catch {
		throw new UploadRouteError(400, 'Upload content must be valid base64.');
	}
}

function isSupportedTextMediaType(mediaType: string): boolean {
	return mediaType.startsWith('text/') || mediaType === 'application/json';
}

function buildImageAttachment(
	input: Readonly<{
		content_base64: string;
		content_type: string;
		filename?: string;
		size_bytes: number;
		blob_id: string;
	}>,
): ModelAttachment {
	return {
		blob_id: input.blob_id,
		data_url: `data:${input.content_type};base64,${input.content_base64}`,
		filename: input.filename,
		kind: 'image',
		media_type: input.content_type,
		size_bytes: input.size_bytes,
	};
}

function buildTextAttachment(
	input: Readonly<{
		content: Buffer;
		content_type: string;
		filename?: string;
		size_bytes: number;
		blob_id: string;
	}>,
): ModelAttachment {
	return {
		blob_id: input.blob_id,
		filename: input.filename,
		kind: 'text',
		media_type: input.content_type,
		size_bytes: input.size_bytes,
		text_content: input.content.toString('utf8').slice(0, MAX_TEXT_CHARACTERS),
	};
}

function buildAttachmentContract(
	input: Readonly<{
		blob_id: string;
		content: Buffer;
		content_base64: string;
		content_type: string;
		filename?: string;
	}>,
): ModelAttachment {
	if (input.content_type.startsWith('image/')) {
		if (input.content.byteLength > MAX_IMAGE_BYTES) {
			throw new UploadRouteError(413, 'Image attachments are limited to 1.5 MB.');
		}

		return buildImageAttachment({
			blob_id: input.blob_id,
			content_base64: input.content_base64,
			content_type: input.content_type,
			filename: input.filename,
			size_bytes: input.content.byteLength,
		});
	}

	if (!isSupportedTextMediaType(input.content_type)) {
		throw new UploadRouteError(
			415,
			'Only image/*, text/*, and application/json attachments are supported in this minimum seam.',
		);
	}

	if (input.content.byteLength > MAX_TEXT_BYTES) {
		throw new UploadRouteError(413, 'Text attachments are limited to 200 KB.');
	}

	return buildTextAttachment({
		blob_id: input.blob_id,
		content: input.content,
		content_type: input.content_type,
		filename: input.filename,
		size_bytes: input.content.byteLength,
	});
}

export async function registerUploadRoutes(
	server: FastifyInstance,
	storageService: StorageService,
): Promise<void> {
	server.post<{ Body: UploadRequestBody }>('/upload', async (request, reply) => {
		requireAuthenticatedRequest(request);

		try {
			const body = parseUploadRequestBody(request.body);
			const content = decodeBase64(body.content_base64);
			const attachmentKind = body.content_type.startsWith('image/')
				? 'attachment_image'
				: 'attachment_text';
			const storedBlob = await storageService.upload_blob({
				auth: request.auth,
				content_base64: body.content_base64,
				content_type: body.content_type,
				filename: body.filename,
				kind: attachmentKind,
			});

			return {
				attachment: buildAttachmentContract({
					blob_id: storedBlob.blob_id,
					content,
					content_base64: body.content_base64,
					content_type: body.content_type,
					filename: body.filename,
				}),
			};
		} catch (error) {
			if (error instanceof UploadRouteError) {
				return reply.code(error.statusCode).send({
					error: error.statusCode === 413 ? 'Payload Too Large' : 'Bad Request',
					message: error.message,
					statusCode: error.statusCode,
				});
			}

			throw error;
		}
	});
}
