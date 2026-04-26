import type { ModelAttachment } from '@runa/types';

type TextSerializableAttachment = Exclude<ModelAttachment, { readonly kind: 'image' }>;

export function describeAttachmentForTextPart(attachment: TextSerializableAttachment): string {
	if (attachment.kind === 'text') {
		return `Attached text file (${attachment.filename ?? attachment.blob_id}, ${attachment.media_type}):\n${attachment.text_content}`;
	}

	return [
		`Attached document artifact (${attachment.filename}, ${attachment.media_type}, ${attachment.size_bytes} bytes).`,
		`Storage reference: ${attachment.storage_ref}.`,
		attachment.text_preview
			? `Document text preview:\n${attachment.text_preview}`
			: 'No document text preview is available in this phase; do not assume the document body was parsed.',
	].join('\n');
}
