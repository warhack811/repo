import type { ModelAttachment, UploadAttachmentResponse } from '@runa/types';
import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedRequest } from '../auth/supabase-auth.js';
import type { StorageService } from '../storage/storage-service.js';

const MAX_IMAGE_BYTES = 1_500_000;
const MAX_TEXT_BYTES = 200_000;
const MAX_TEXT_CHARACTERS = 12_000;
const MAX_DOCUMENT_BYTES = 5_000_000;
const UNSUPPORTED_ATTACHMENT_MESSAGE =
	'Only image/*, text/*, application/json, and supported document attachments are supported in this minimum seam.';
const DANGEROUS_ATTACHMENT_MESSAGE = 'This file type is not supported for upload.';
const DOCUMENT_ATTACHMENT_MEDIA_TYPES = new Set([
	'application/pdf',
	'application/msword',
	'application/vnd.ms-excel',
	'application/vnd.ms-powerpoint',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const DOCUMENT_ATTACHMENT_EXTENSIONS = new Set([
	'.doc',
	'.docx',
	'.pdf',
	'.ppt',
	'.pptx',
	'.xls',
	'.xlsx',
]);
const DANGEROUS_ATTACHMENT_EXTENSIONS = new Set([
	'.bat',
	'.cmd',
	'.docm',
	'.exe',
	'.msi',
	'.ps1',
	'.pptm',
	'.scr',
	'.vbs',
	'.xlsm',
]);

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
		content_base64: contentBase64.trim(),
		content_type: normalizeContentType(contentType),
		filename: normalizeFilename(filename),
	};
}

function decodeBase64(contentBase64: string): Buffer {
	if (contentBase64.trim().length === 0) {
		throw new UploadRouteError(400, 'Upload content must be a non-empty base64 string.');
	}

	if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contentBase64)) {
		throw new UploadRouteError(400, 'Upload content must be valid base64.');
	}

	return Buffer.from(contentBase64, 'base64');
}

function normalizeContentType(contentType: string): string {
	const normalizedContentType = contentType.trim().toLowerCase();

	if (normalizedContentType.length === 0) {
		throw new UploadRouteError(400, 'Upload content_type is required.');
	}

	return normalizedContentType;
}

function normalizeFilename(filename: string | undefined): string | undefined {
	const normalizedFilename = filename?.trim();

	return normalizedFilename ? normalizedFilename : undefined;
}

function getFilenameExtension(filename: string | undefined): string | undefined {
	const lastSegment = filename?.split(/[\\/]/).at(-1);

	if (lastSegment === undefined) {
		return undefined;
	}

	const extensionStart = lastSegment?.lastIndexOf('.');

	if (extensionStart === undefined || extensionStart <= 0) {
		return undefined;
	}

	return lastSegment.slice(extensionStart).toLowerCase();
}

function assertSafeFilename(filename: string | undefined): void {
	if (DANGEROUS_ATTACHMENT_EXTENSIONS.has(getFilenameExtension(filename) ?? '')) {
		throw new UploadRouteError(415, DANGEROUS_ATTACHMENT_MESSAGE);
	}
}

function isSupportedTextMediaType(mediaType: string): boolean {
	return mediaType.startsWith('text/') || mediaType === 'application/json';
}

function isSupportedDocumentAttachment(contentType: string, filename: string | undefined): boolean {
	return (
		DOCUMENT_ATTACHMENT_MEDIA_TYPES.has(contentType) ||
		DOCUMENT_ATTACHMENT_EXTENSIONS.has(getFilenameExtension(filename) ?? '')
	);
}

function resolveAttachmentKind(
	contentType: string,
	filename: string | undefined,
): 'attachment_document' | 'attachment_image' | 'attachment_text' {
	if (contentType.startsWith('image/')) {
		return 'attachment_image';
	}

	if (isSupportedTextMediaType(contentType)) {
		return 'attachment_text';
	}

	if (isSupportedDocumentAttachment(contentType, filename)) {
		return 'attachment_document';
	}

	throw new UploadRouteError(415, UNSUPPORTED_ATTACHMENT_MESSAGE);
}

function validateAttachmentBeforeStorage(
	input: Readonly<{
		content: Buffer;
		content_type: string;
		filename?: string;
	}>,
): void {
	assertSafeFilename(input.filename);

	if (input.content_type.startsWith('image/')) {
		if (input.content.byteLength > MAX_IMAGE_BYTES) {
			throw new UploadRouteError(413, 'Image attachments are limited to 1.5 MB.');
		}

		return;
	}

	if (isSupportedDocumentAttachment(input.content_type, input.filename)) {
		if (input.filename === undefined) {
			throw new UploadRouteError(400, 'Document attachments require a filename.');
		}

		if (input.content.byteLength > MAX_DOCUMENT_BYTES) {
			throw new UploadRouteError(413, 'Document attachments are limited to 5 MB.');
		}

		return;
	}

	if (!isSupportedTextMediaType(input.content_type)) {
		throw new UploadRouteError(415, UNSUPPORTED_ATTACHMENT_MESSAGE);
	}

	if (input.content.byteLength > MAX_TEXT_BYTES) {
		throw new UploadRouteError(413, 'Text attachments are limited to 200 KB.');
	}
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

function buildDocumentAttachment(
	input: Readonly<{
		content_type: string;
		filename?: string;
		size_bytes: number;
		blob_id: string;
	}>,
): ModelAttachment {
	return {
		blob_id: input.blob_id,
		filename: input.filename ?? input.blob_id,
		kind: 'document',
		media_type: input.content_type,
		size_bytes: input.size_bytes,
		storage_ref: input.blob_id,
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
		if (isSupportedDocumentAttachment(input.content_type, input.filename)) {
			if (input.filename === undefined) {
				throw new UploadRouteError(400, 'Document attachments require a filename.');
			}

			if (input.content.byteLength > MAX_DOCUMENT_BYTES) {
				throw new UploadRouteError(413, 'Document attachments are limited to 5 MB.');
			}

			return buildDocumentAttachment({
				blob_id: input.blob_id,
				content_type: input.content_type,
				filename: input.filename,
				size_bytes: input.content.byteLength,
			});
		}

		throw new UploadRouteError(415, UNSUPPORTED_ATTACHMENT_MESSAGE);
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
			validateAttachmentBeforeStorage({
				content,
				content_type: body.content_type,
				filename: body.filename,
			});
			const attachmentKind = resolveAttachmentKind(body.content_type, body.filename);
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
					error:
						error.statusCode === 413
							? 'Payload Too Large'
							: error.statusCode === 415
								? 'Unsupported Media Type'
								: 'Bad Request',
					message: error.message,
					statusCode: error.statusCode,
				});
			}

			throw error;
		}
	});
}
