import type { UploadAttachmentResponse } from '@runa/types';
import type { ChangeEvent, ReactElement } from 'react';
import { useId, useRef, useState } from 'react';

import type { ModelAttachment } from '../../ws-types.js';

export const UPLOAD_ACCEPT =
	'image/*,text/*,application/json,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
export const MAX_UPLOAD_IMAGE_BYTES = 1_500_000;
export const MAX_UPLOAD_TEXT_BYTES = 200_000;
export const MAX_UPLOAD_DOCUMENT_BYTES = 5_000_000;

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

type UploadPreflightFile = Readonly<{
	name: string;
	size: number;
	type: string;
}>;

function getFilenameExtension(filename: string): string | null {
	const lastSegment = filename.split(/[\\/]/).at(-1) ?? filename;
	const extensionStart = lastSegment.lastIndexOf('.');

	if (extensionStart <= 0) {
		return null;
	}

	return lastSegment.slice(extensionStart).toLowerCase();
}

function isDocumentAttachmentFile(contentType: string, extension: string | null): boolean {
	return (
		DOCUMENT_ATTACHMENT_MEDIA_TYPES.has(contentType) ||
		(extension !== null && DOCUMENT_ATTACHMENT_EXTENSIONS.has(extension))
	);
}

export function validateAttachmentFileForUpload(file: UploadPreflightFile): string | null {
	const extension = getFilenameExtension(file.name);
	const contentType = file.type.trim().toLowerCase();

	if (extension !== null && DANGEROUS_ATTACHMENT_EXTENSIONS.has(extension)) {
		return 'Bu dosya turu guvenlik nedeniyle yuklenemez.';
	}

	if (contentType.startsWith('image/')) {
		return file.size > MAX_UPLOAD_IMAGE_BYTES ? 'Gorsel ekleri 1.5 MB ile sinirlidir.' : null;
	}

	if (contentType.startsWith('text/') || contentType === 'application/json') {
		return file.size > MAX_UPLOAD_TEXT_BYTES ? 'Metin ekleri 200 KB ile sinirlidir.' : null;
	}

	if (isDocumentAttachmentFile(contentType, extension)) {
		return file.size > MAX_UPLOAD_DOCUMENT_BYTES ? 'Dokuman ekleri 5 MB ile sinirlidir.' : null;
	}

	return 'Yalniz image/*, text/*, application/json ve desteklenen dokumanlar yuklenebilir.';
}

function createRequestHeaders(accessToken?: string | null): Headers {
	const headers = new Headers({
		'content-type': 'application/json',
	});
	const normalizedToken = accessToken?.trim();

	if (normalizedToken) {
		headers.set('authorization', `Bearer ${normalizedToken}`);
	}

	return headers;
}

function isAttachmentResponse(value: unknown): value is UploadAttachmentResponse {
	if (typeof value !== 'object' || value === null || !('attachment' in value)) {
		return false;
	}

	const attachment = (value as { readonly attachment?: unknown }).attachment;

	if (typeof attachment !== 'object' || attachment === null) {
		return false;
	}

	return (
		'blob_id' in attachment &&
		'kind' in attachment &&
		'media_type' in attachment &&
		'size_bytes' in attachment
	);
}

function toBase64(buffer: ArrayBuffer): string {
	let binary = '';
	const bytes = new Uint8Array(buffer);

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return window.btoa(binary);
}

type FileUploadButtonProps = Readonly<{
	accessToken?: string | null;
	disabled?: boolean;
	onAttachmentUploaded: (attachment: ModelAttachment) => void;
	onUploadStateChange?: (input: {
		readonly error: string | null;
		readonly isUploading: boolean;
	}) => void;
}>;

export function FileUploadButton({
	accessToken,
	disabled = false,
	onAttachmentUploaded,
	onUploadStateChange,
}: FileUploadButtonProps): ReactElement {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [isUploading, setIsUploading] = useState(false);

	async function handleFileSelection(event: ChangeEvent<HTMLInputElement>): Promise<void> {
		const file = event.target.files?.[0];

		if (!file) {
			return;
		}

		const preflightError = validateAttachmentFileForUpload(file);

		if (preflightError !== null) {
			onUploadStateChange?.({
				error: preflightError,
				isUploading: false,
			});
			event.target.value = '';

			return;
		}

		setIsUploading(true);
		onUploadStateChange?.({
			error: null,
			isUploading: true,
		});

		try {
			const response = await fetch('/upload', {
				body: JSON.stringify({
					content_base64: toBase64(await file.arrayBuffer()),
					content_type: file.type || 'application/octet-stream',
					filename: file.name,
				}),
				credentials: 'same-origin',
				headers: createRequestHeaders(accessToken),
				method: 'POST',
			});

			const payload = (await response.json()) as unknown;

			if (!response.ok) {
				throw new Error(
					typeof payload === 'object' &&
						payload !== null &&
						'message' in payload &&
						typeof payload.message === 'string'
						? payload.message
						: 'Upload basarisiz oldu.',
				);
			}

			if (!isAttachmentResponse(payload)) {
				throw new Error('Desteklenmeyen upload yaniti.');
			}

			onAttachmentUploaded(payload.attachment);
			onUploadStateChange?.({
				error: null,
				isUploading: false,
			});
		} catch (error: unknown) {
			onUploadStateChange?.({
				error:
					error instanceof Error ? error.message : 'Upload sirasinda beklenmeyen bir hata olustu.',
				isUploading: false,
			});
		} finally {
			setIsUploading(false);

			if (inputRef.current) {
				inputRef.current.value = '';
			}
		}
	}

	return (
		<>
			<input
				ref={inputRef}
				accept={UPLOAD_ACCEPT}
				disabled={disabled || isUploading}
				id={inputId}
				onChange={(event) => {
					void handleFileSelection(event);
				}}
				className="runa-migrated-components-chat-fileuploadbutton-1"
				type="file"
			/>
			<label htmlFor={inputId} className="runa-migrated-components-chat-fileuploadbutton-2">
				{isUploading ? 'Yukleniyor...' : 'Dosya ekle'}
			</label>
		</>
	);
}
