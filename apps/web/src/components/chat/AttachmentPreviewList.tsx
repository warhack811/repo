import type { ReactElement } from 'react';

import type { ModelAttachment } from '../../ws-types.js';
import { RunaButton } from '../ui/RunaButton.js';
import { RunaCard } from '../ui/RunaCard.js';
import styles from './AttachmentPreviewList.module.css';
import { deriveAttachmentDisplayModel } from './attachmentDisplay.js';

type AttachmentPreviewListProps = Readonly<{
	attachments: readonly ModelAttachment[];
	onRemoveAttachment: (blobId: string) => void;
}>;

function renderAttachmentPreview(
	attachment: ModelAttachment,
	displayModel: ReturnType<typeof deriveAttachmentDisplayModel>,
): ReactElement {
	if (attachment.kind === 'image' && attachment.data_url.trim().length > 0) {
		return (
			<img
				alt={displayModel.displayName}
				className={styles['imagePreview']}
				src={attachment.data_url}
			/>
		);
	}

	if (attachment.kind === 'text') {
		return (
			<div className={styles['textPreview']}>
				{attachment.text_content.trim().length > 0
					? attachment.text_content
					: displayModel.previewFallback}
			</div>
		);
	}

	if (attachment.kind === 'document') {
		return (
			<div className={styles['documentPreview']}>
				{attachment.text_preview?.trim().length
					? attachment.text_preview
					: displayModel.previewFallback}
			</div>
		);
	}

	return <div className={styles['documentPreview']}>{displayModel.previewFallback}</div>;
}

export function AttachmentPreviewList({
	attachments,
	onRemoveAttachment,
}: AttachmentPreviewListProps): ReactElement | null {
	if (attachments.length === 0) {
		return null;
	}

	return (
		<div className={styles['list']} data-testid="attachment-preview-list">
			{attachments.map((attachment) => {
				const model = deriveAttachmentDisplayModel(attachment);

				return (
					<RunaCard key={attachment.blob_id} className={styles['card']} tone="subtle">
						<div className={styles['header']}>
							<div className={styles['meta']}>
								<strong className={styles['name']}>{model.displayName}</strong>
								<div className={styles['summary']}>{model.summaryLabel}</div>
							</div>
							<RunaButton
								aria-label={model.removeLabel}
								className={`runa-button runa-button--secondary ${styles['removeButton']}`}
								onClick={() => onRemoveAttachment(attachment.blob_id)}
								variant="secondary"
							>
								Eki kaldır
							</RunaButton>
						</div>
						{renderAttachmentPreview(attachment, model)}
					</RunaCard>
				);
			})}
		</div>
	);
}
