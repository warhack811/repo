import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	FileUploadButton,
	MAX_UPLOAD_DOCUMENT_BYTES,
	MAX_UPLOAD_IMAGE_BYTES,
	MAX_UPLOAD_TEXT_BYTES,
	getUploadFailureMessage,
	validateAttachmentFileForUpload,
} from './FileUploadButton.js';

type FileUploadButtonProps = ComponentProps<typeof FileUploadButton>;

function createFile(options: { name: string; type: string; size?: number }): File {
	const file = new File(['deneme'], options.name, { type: options.type });
	const size = options.size ?? file.size;
	Object.defineProperty(file, 'size', {
		configurable: true,
		value: size,
	});
	Object.defineProperty(file, 'arrayBuffer', {
		configurable: true,
		value: vi.fn(async () => new Uint8Array([104, 101, 108, 108, 111]).buffer),
	});
	return file;
}

function renderUploadButton(overrides: Partial<FileUploadButtonProps> = {}) {
	const props: FileUploadButtonProps = {
		accessToken: 'access-token',
		disabled: false,
		onAttachmentUploaded: vi.fn(),
		onUploadStateChange: vi.fn(),
		...overrides,
	};
	const utils = render(<FileUploadButton {...props} />);
	const input = utils.container.querySelector('input[type="file"]');
	if (!(input instanceof HTMLInputElement)) {
		throw new Error('File input not found.');
	}
	return { ...utils, input, props };
}

beforeEach(() => {
	vi.restoreAllMocks();
});

describe('FileUploadButton', () => {
	it('renders default compact button with accessible name', () => {
		renderUploadButton();
		expect(screen.getByRole('button', { name: 'Dosya ekle' })).toBeTruthy();
	});

	it('renders visible label when showLabel is true', () => {
		renderUploadButton({ label: 'Tekrar seç', showLabel: true });
		expect(screen.getByText('Tekrar seç')).toBeTruthy();
	});

	it('uses loading aria/title copy while uploading', async () => {
		const pendingFetch = new Promise<Response>(() => undefined);
		const fetchMock = vi.fn(async () => pendingFetch);
		vi.stubGlobal('fetch', fetchMock);

		const { input } = renderUploadButton();
		fireEvent.change(input, {
			target: { files: [createFile({ name: 'notlar.txt', type: 'text/plain' })] },
		});

		await waitFor(() => {
			const button = screen.getByRole('button', { name: 'Dosya yükleniyor...' });
			expect(button.getAttribute('title')).toBe('Dosya yükleniyor...');
			expect(button.getAttribute('aria-busy')).toBe('true');
		});
	});

	it('returns dangerous extension preflight error', () => {
		expect(
			validateAttachmentFileForUpload({
				name: 'zararli.ps1',
				size: 42,
				type: 'text/plain',
			}),
		).toBe('Bu dosya türü güvenlik nedeniyle yüklenemez.');
	});

	it('returns too-large validation messages for image/text/document files', () => {
		expect(
			validateAttachmentFileForUpload({
				name: 'gorsel.png',
				size: MAX_UPLOAD_IMAGE_BYTES + 1,
				type: 'image/png',
			}),
		).toBe('Görsel ekleri 1.5 MB ile sınırlıdır.');
		expect(
			validateAttachmentFileForUpload({
				name: 'metin.txt',
				size: MAX_UPLOAD_TEXT_BYTES + 1,
				type: 'text/plain',
			}),
		).toBe('Metin ekleri 200 KB ile sınırlıdır.');
		expect(
			validateAttachmentFileForUpload({
				name: 'dokuman.pdf',
				size: MAX_UPLOAD_DOCUMENT_BYTES + 1,
				type: 'application/pdf',
			}),
		).toBe('Doküman ekleri 5 MB ile sınırlıdır.');
	});

	it('returns unsupported file type validation error', () => {
		expect(
			validateAttachmentFileForUpload({
				name: 'arsiv.zip',
				size: 1024,
				type: 'application/zip',
			}),
		).toBe('Yalnız görsel, metin, JSON ve desteklenen dokümanlar yüklenebilir.');
	});

	it('uploads successfully and emits expected callbacks', async () => {
		const onAttachmentUploaded = vi.fn();
		const onUploadStateChange = vi.fn();
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			expect(_input).toBe('/upload');
			expect(init?.method).toBe('POST');
			expect(init?.credentials).toBe('same-origin');

			const body = JSON.parse(String(init?.body ?? '{}')) as {
				content_base64: string;
				content_type: string;
				filename: string;
			};
			expect(body.filename).toBe('notlar.txt');
			expect(body.content_type).toBe('text/plain');
			expect(typeof body.content_base64).toBe('string');

			return new Response(
				JSON.stringify({
					attachment: {
						blob_id: 'blob-ok-1',
						filename: 'notlar.txt',
						kind: 'text',
						media_type: 'text/plain',
						size_bytes: 1234,
						text_content: 'not',
					},
				}),
				{
					headers: { 'content-type': 'application/json' },
					status: 200,
				},
			);
		});
		vi.stubGlobal('fetch', fetchMock);

		const { input } = renderUploadButton({ onAttachmentUploaded, onUploadStateChange });
		fireEvent.change(input, {
			target: { files: [createFile({ name: 'notlar.txt', type: 'text/plain' })] },
		});

		await waitFor(() => {
			expect(onAttachmentUploaded).toHaveBeenCalledTimes(1);
		});
		expect(onUploadStateChange).toHaveBeenCalledWith({ error: null, isUploading: true });
		expect(onUploadStateChange).toHaveBeenLastCalledWith({ error: null, isUploading: false });
		expect(input.value).toBe('');
	});

	it('does not leak raw server message on non-ok response', async () => {
		const onUploadStateChange = vi.fn();
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(JSON.stringify({ message: 'internal backend payload detail' }), {
						headers: { 'content-type': 'application/json' },
						status: 500,
					}),
			),
		);
		const { input } = renderUploadButton({ onUploadStateChange });
		fireEvent.change(input, {
			target: { files: [createFile({ name: 'notlar.txt', type: 'text/plain' })] },
		});

		await waitFor(() => {
			expect(onUploadStateChange).toHaveBeenCalled();
		});
		expect(onUploadStateChange).toHaveBeenLastCalledWith({
			error: 'Dosya yükleme tamamlanamadı. Yeniden deneyebilirsin.',
			isUploading: false,
		});
		expect(onUploadStateChange).not.toHaveBeenCalledWith({
			error: 'internal backend payload detail',
			isUploading: false,
		});
	});

	it('returns user-friendly fallback for invalid response payload', async () => {
		const onUploadStateChange = vi.fn();
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(JSON.stringify({ ok: true }), {
						headers: { 'content-type': 'application/json' },
						status: 200,
					}),
			),
		);
		const { input } = renderUploadButton({ onUploadStateChange });
		fireEvent.change(input, {
			target: { files: [createFile({ name: 'notlar.txt', type: 'text/plain' })] },
		});

		await waitFor(() => {
			expect(onUploadStateChange).toHaveBeenLastCalledWith({
				error: 'Dosya yüklenemedi. Yeniden seçip tekrar deneyebilirsin.',
				isUploading: false,
			});
		});
	});

	it('does not leak thrown network message', async () => {
		const onUploadStateChange = vi.fn();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Promise.reject(new TypeError('socket exploded'))),
		);

		const { input } = renderUploadButton({ onUploadStateChange });
		fireEvent.change(input, {
			target: { files: [createFile({ name: 'notlar.txt', type: 'text/plain' })] },
		});

		await waitFor(() => {
			expect(onUploadStateChange).toHaveBeenLastCalledWith({
				error: 'Dosya yüklenemedi. Yeniden seçip tekrar deneyebilirsin.',
				isUploading: false,
			});
		});
	});

	it('exposes sanitized failure messages via helper', () => {
		expect(getUploadFailureMessage({ reason: 'network' })).toBe(
			'Dosya yüklenemedi. Yeniden seçip tekrar deneyebilirsin.',
		);
		expect(getUploadFailureMessage({ reason: 'server' })).toBe(
			'Dosya yükleme tamamlanamadı. Yeniden deneyebilirsin.',
		);
	});

	it('does not render forbidden technical or mojibake strings', () => {
		const { container } = renderUploadButton();
		const text = container.textContent ?? '';
		for (const forbidden of [
			'blob_id',
			'media_type',
			'size_bytes',
			'payload',
			'backend',
			'protocol',
			'metadata',
		]) {
			expect(text).not.toContain(forbidden);
		}
		for (const mojibake of ['Ã', 'Ä', 'Å', 'â€¢', '�']) {
			expect(text).not.toContain(mojibake);
		}
	});
});
