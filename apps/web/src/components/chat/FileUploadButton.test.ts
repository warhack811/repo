import { describe, expect, it } from 'vitest';

import {
	MAX_UPLOAD_DOCUMENT_BYTES,
	MAX_UPLOAD_IMAGE_BYTES,
	MAX_UPLOAD_TEXT_BYTES,
	validateAttachmentFileForUpload,
} from './FileUploadButton.js';

describe('validateAttachmentFileForUpload', () => {
	it('accepts supported image and text payloads within size limits', () => {
		expect(
			validateAttachmentFileForUpload({
				name: 'capture.png',
				size: MAX_UPLOAD_IMAGE_BYTES,
				type: 'image/png',
			}),
		).toBeNull();
		expect(
			validateAttachmentFileForUpload({
				name: 'notes.ts',
				size: MAX_UPLOAD_TEXT_BYTES,
				type: 'text/plain',
			}),
		).toBeNull();
		expect(
			validateAttachmentFileForUpload({
				name: 'payload.json',
				size: 1024,
				type: 'application/json',
			}),
		).toBeNull();
		expect(
			validateAttachmentFileForUpload({
				name: 'brief.pdf',
				size: MAX_UPLOAD_DOCUMENT_BYTES,
				type: 'application/pdf',
			}),
		).toBeNull();
		expect(
			validateAttachmentFileForUpload({
				name: 'sheet.xlsx',
				size: 1024,
				type: 'application/octet-stream',
			}),
		).toBeNull();
	});

	it('rejects unsupported and risky files before reading the file body', () => {
		expect(
			validateAttachmentFileForUpload({
				name: 'archive.zip',
				size: 1024,
				type: 'application/zip',
			}),
		).toBe('Yalniz image/*, text/*, application/json ve desteklenen dokumanlar yuklenebilir.');
		expect(
			validateAttachmentFileForUpload({
				name: 'installer.PS1',
				size: 64,
				type: 'text/plain',
			}),
		).toBe('Bu dosya turu guvenlik nedeniyle yuklenemez.');
	});

	it('rejects oversized supported payloads', () => {
		expect(
			validateAttachmentFileForUpload({
				name: 'large.png',
				size: MAX_UPLOAD_IMAGE_BYTES + 1,
				type: 'image/png',
			}),
		).toBe('Gorsel ekleri 1.5 MB ile sinirlidir.');
		expect(
			validateAttachmentFileForUpload({
				name: 'large.txt',
				size: MAX_UPLOAD_TEXT_BYTES + 1,
				type: 'text/plain',
			}),
		).toBe('Metin ekleri 200 KB ile sinirlidir.');
		expect(
			validateAttachmentFileForUpload({
				name: 'large.pdf',
				size: MAX_UPLOAD_DOCUMENT_BYTES + 1,
				type: 'application/pdf',
			}),
		).toBe('Dokuman ekleri 5 MB ile sinirlidir.');
	});
});
