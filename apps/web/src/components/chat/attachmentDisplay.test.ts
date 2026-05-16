import { describe, expect, it } from 'vitest';
import type { ModelAttachment } from '../../ws-types.js';

import {
	deriveAttachmentDisplayModel,
	formatAttachmentSize,
	getAttachmentKindLabel,
} from './attachmentDisplay.js';

function createImageAttachment(overrides: Partial<ModelAttachment> = {}): ModelAttachment {
	return {
		blob_id: 'blob-image-1',
		data_url: 'data:image/png;base64,ZmFrZQ==',
		filename: 'ornek.png',
		kind: 'image',
		media_type: 'image/png',
		size_bytes: 1_572_864,
		...overrides,
	} as ModelAttachment;
}

describe('attachmentDisplay', () => {
	it('maps kind labels to Turkish user-facing copy', () => {
		expect(getAttachmentKindLabel('image')).toBe('Görsel');
		expect(getAttachmentKindLabel('text')).toBe('Metin');
		expect(getAttachmentKindLabel('document')).toBe('Doküman');
		expect(getAttachmentKindLabel('archive')).toBe('Ek dosya');
	});

	it('uses trimmed filename when provided', () => {
		const model = deriveAttachmentDisplayModel(
			createImageAttachment({ filename: '  rapor.png  ' }),
		);
		expect(model.displayName).toBe('rapor.png');
	});

	it('falls back to Adsız ek when filename is missing or blank', () => {
		const modelWithoutFilename = deriveAttachmentDisplayModel(
			createImageAttachment({ filename: undefined }),
		);
		const modelWithWhitespace = deriveAttachmentDisplayModel(
			createImageAttachment({ filename: '   ' }),
		);
		expect(modelWithoutFilename.displayName).toBe('Adsız ek');
		expect(modelWithWhitespace.displayName).toBe('Adsız ek');
		expect(modelWithoutFilename.displayName).not.toContain('blob-image-1');
	});

	it('formats file sizes for user readability', () => {
		expect(formatAttachmentSize(0)).toBe('1 KB altı');
		expect(formatAttachmentSize(512)).toBe('1 KB altı');
		expect(formatAttachmentSize(131_072)).toBe('128 KB');
		expect(formatAttachmentSize(1_572_864)).toBe('1.5 MB');
	});

	it('builds summary and remove labels', () => {
		const model = deriveAttachmentDisplayModel(createImageAttachment({ size_bytes: 1_572_864 }));
		expect(model.summaryLabel).toBe('Görsel · 1.5 MB');
		expect(model.removeLabel).toBe('Eki kaldır: ornek.png');
	});

	it('does not leak technical backend field names into display labels', () => {
		const unknownAttachment = {
			blob_id: 'secret-blob-id',
			kind: 'unknown-kind',
			media_type: 'application/octet-stream',
			size_bytes: 1_024,
		} as unknown as ModelAttachment;
		const model = deriveAttachmentDisplayModel(unknownAttachment);
		const labels = [
			model.displayName,
			model.kindLabel,
			model.sizeLabel,
			model.summaryLabel,
			model.removeLabel,
			model.previewFallback,
		].join(' ');

		const forbidden = [
			'blob_id',
			'media_type',
			'size_bytes',
			'bytes',
			'backend',
			'protocol',
			'metadata',
		];
		for (const value of forbidden) {
			expect(labels).not.toContain(value);
		}
	});

	it('does not contain mojibake copy', () => {
		const model = deriveAttachmentDisplayModel(createImageAttachment());
		const labels = [
			model.displayName,
			model.kindLabel,
			model.sizeLabel,
			model.summaryLabel,
			model.removeLabel,
			model.previewFallback,
		].join(' ');
		for (const mojibake of ['Ã', 'Ä', 'Å', 'â€¢', '�']) {
			expect(labels).not.toContain(mojibake);
		}
	});
});
