import type { UploadAttachmentResponse } from '@runa/types';
import type { ChangeEvent, CSSProperties, ReactElement } from 'react';
import { useId, useRef, useState } from 'react';

import type { ModelAttachment } from '../../ws-types.js';

const buttonStyle: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	gap: '8px',
	padding: '10px 14px',
	borderRadius: '14px',
	border: '1px solid rgba(148, 163, 184, 0.22)',
	background: 'rgba(10, 15, 27, 0.86)',
	color: '#e5e7eb',
	fontWeight: 600,
	cursor: 'pointer',
	transition: 'transform 180ms ease, border-color 180ms ease, background 180ms ease',
};

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
	onUploadStateChange?: (input: { readonly error: string | null; readonly isUploading: boolean }) => void;
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
				error: error instanceof Error ? error.message : 'Upload sirasinda beklenmeyen bir hata olustu.',
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
				accept="image/*,text/*,application/json"
				disabled={disabled || isUploading}
				id={inputId}
				onChange={(event) => {
					void handleFileSelection(event);
				}}
				style={{ display: 'none' }}
				type="file"
			/>
			<label
				htmlFor={inputId}
				style={{
					...buttonStyle,
					cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
					opacity: disabled || isUploading ? 0.6 : 1,
				}}
			>
				{isUploading ? 'Yukleniyor...' : 'Dosya ekle'}
			</label>
		</>
	);
}
