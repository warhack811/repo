import type { ModelAttachment } from '../../ws-types.js';

export type AttachmentDisplayKind = 'document' | 'image' | 'text' | 'unknown';

export type AttachmentDisplayModel = Readonly<{
	displayName: string;
	kindLabel: string;
	sizeLabel: string;
	summaryLabel: string;
	removeLabel: string;
	previewFallback: string;
}>;

function normalizeDisplayName(filename: string | undefined): string {
	const trimmed = filename?.trim() ?? '';
	return trimmed.length > 0 ? trimmed : 'Adsız ek';
}

function normalizeAttachmentKind(kind: ModelAttachment['kind'] | string): AttachmentDisplayKind {
	if (kind === 'image' || kind === 'text' || kind === 'document') {
		return kind;
	}

	return 'unknown';
}

export function formatAttachmentSize(sizeBytes: number): string {
	if (!Number.isFinite(sizeBytes) || sizeBytes < 1024) {
		return '1 KB altı';
	}

	if (sizeBytes < 1024 * 1024) {
		const kb = Math.max(1, Math.round(sizeBytes / 1024));
		return `${kb} KB`;
	}

	const mb = sizeBytes / (1024 * 1024);
	const roundedMb = Math.round(mb * 10) / 10;
	const formattedMb = Number.isInteger(roundedMb) ? roundedMb.toFixed(0) : roundedMb.toFixed(1);
	return `${formattedMb} MB`;
}

export function getAttachmentKindLabel(kind: ModelAttachment['kind'] | string): string {
	switch (normalizeAttachmentKind(kind)) {
		case 'image':
			return 'Görsel';
		case 'text':
			return 'Metin';
		case 'document':
			return 'Doküman';
		default:
			return 'Ek dosya';
	}
}

export function deriveAttachmentDisplayModel(attachment: ModelAttachment): AttachmentDisplayModel {
	const displayName = normalizeDisplayName(attachment.filename);
	const kind = normalizeAttachmentKind(attachment.kind);
	const kindLabel = getAttachmentKindLabel(kind);
	const sizeLabel = formatAttachmentSize(attachment.size_bytes);
	const summaryLabel = `${kindLabel} · ${sizeLabel}`;

	return {
		displayName,
		kindLabel,
		sizeLabel,
		summaryLabel,
		removeLabel: `Eki kaldır: ${displayName}`,
		previewFallback: kind === 'document' ? 'Doküman önizlemesi hazır değil.' : 'Ek dosya eklendi.',
	};
}
