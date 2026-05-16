import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ModelAttachment } from '../../ws-types.js';

import { AttachmentPreviewList } from './AttachmentPreviewList.js';

function createImageAttachment(overrides: Partial<ModelAttachment> = {}): ModelAttachment {
	return {
		blob_id: 'blob-image-1',
		data_url: 'data:image/png;base64,ZmFrZQ==',
		filename: 'ekran.png',
		kind: 'image',
		media_type: 'image/png',
		size_bytes: 1_572_864,
		...overrides,
	} as ModelAttachment;
}

function createTextAttachment(overrides: Partial<ModelAttachment> = {}): ModelAttachment {
	return {
		blob_id: 'blob-text-1',
		filename: 'notlar.txt',
		kind: 'text',
		media_type: 'text/plain',
		size_bytes: 4_096,
		text_content: 'Toplantı notları burada.',
		...overrides,
	} as ModelAttachment;
}

function createDocumentAttachment(overrides: Partial<ModelAttachment> = {}): ModelAttachment {
	return {
		blob_id: 'blob-doc-1',
		filename: 'rapor.pdf',
		kind: 'document',
		media_type: 'application/pdf',
		size_bytes: 1_048_576,
		storage_ref: 'storage-ref',
		text_preview: 'Doküman özeti.',
		...overrides,
	} as ModelAttachment;
}

describe('AttachmentPreviewList', () => {
	it('renders null when attachment list is empty', () => {
		const { container } = render(
			<AttachmentPreviewList attachments={[]} onRemoveAttachment={() => {}} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it('renders image attachment details and image alt text', () => {
		render(
			<AttachmentPreviewList
				attachments={[createImageAttachment()]}
				onRemoveAttachment={() => {}}
			/>,
		);
		expect(screen.getByText('ekran.png')).toBeTruthy();
		expect(screen.getByText('Görsel · 1.5 MB')).toBeTruthy();
		expect(screen.getByAltText('ekran.png')).toBeTruthy();
	});

	it('renders text attachment preview', () => {
		render(
			<AttachmentPreviewList
				attachments={[createTextAttachment()]}
				onRemoveAttachment={() => {}}
			/>,
		);
		expect(screen.getByText('Toplantı notları burada.')).toBeTruthy();
		expect(screen.getByText('Metin · 4 KB')).toBeTruthy();
	});

	it('renders document attachment with preview and fallback', () => {
		const { rerender } = render(
			<AttachmentPreviewList
				attachments={[createDocumentAttachment({ text_preview: 'Önizleme metni.' })]}
				onRemoveAttachment={() => {}}
			/>,
		);
		expect(screen.getByText('Doküman · 1 MB')).toBeTruthy();
		expect(screen.getByText('Önizleme metni.')).toBeTruthy();

		rerender(
			<AttachmentPreviewList
				attachments={[createDocumentAttachment({ text_preview: undefined })]}
				onRemoveAttachment={() => {}}
			/>,
		);
		expect(screen.getByText('Doküman önizlemesi hazır değil.')).toBeTruthy();
	});

	it('uses Adsız ek when filename is missing and does not show blob id', () => {
		render(
			<AttachmentPreviewList
				attachments={[createTextAttachment({ blob_id: 'secret-blob-9', filename: undefined })]}
				onRemoveAttachment={() => {}}
			/>,
		);
		expect(screen.getByText('Adsız ek')).toBeTruthy();
		expect(screen.queryByText('secret-blob-9')).toBeNull();
	});

	it('calls remove callback with blob id while keeping blob id hidden', () => {
		const onRemoveAttachment = vi.fn();
		render(
			<AttachmentPreviewList
				attachments={[createImageAttachment({ blob_id: 'blob-remove-1' })]}
				onRemoveAttachment={onRemoveAttachment}
			/>,
		);
		const removeButton = screen.getByRole('button', { name: 'Eki kaldır: ekran.png' });
		fireEvent.click(removeButton);
		expect(onRemoveAttachment).toHaveBeenCalledWith('blob-remove-1');
		expect(screen.queryByText('blob-remove-1')).toBeNull();
	});

	it('does not render forbidden technical strings', () => {
		const { container } = render(
			<AttachmentPreviewList
				attachments={[createDocumentAttachment()]}
				onRemoveAttachment={() => {}}
			/>,
		);
		const text = container.textContent ?? '';
		for (const forbidden of ['kind', 'size_bytes', 'bytes', 'media_type', 'blob_id']) {
			expect(text).not.toContain(forbidden);
		}
	});

	it('does not render mojibake text', () => {
		const { container } = render(
			<AttachmentPreviewList
				attachments={[createDocumentAttachment()]}
				onRemoveAttachment={() => {}}
			/>,
		);
		const text = container.textContent ?? '';
		for (const mojibake of ['Ã', 'Ä', 'Å', 'â€¢', '�']) {
			expect(text).not.toContain(mojibake);
		}
	});
});
