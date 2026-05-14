import type { ReactElement } from 'react';

import type { ModelAttachment } from '../../ws-types.js';
import { RunaSheet } from '../ui/RunaSheet.js';
import styles from './ContextSheet.module.css';

type ContextSheetProps = Readonly<{
	attachments: readonly ModelAttachment[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	workingDirectory: string;
}>;

function getAttachmentLabel(attachment: ModelAttachment): string {
	const baseLabel = attachment.filename?.trim() || attachment.blob_id;
	return `${baseLabel} (${attachment.kind})`;
}

export function ContextSheet({
	attachments,
	open,
	onOpenChange,
	workingDirectory,
}: ContextSheetProps): ReactElement | null {
	const normalizedWorkingDirectory = workingDirectory.trim();

	return (
		<RunaSheet
			className={styles['sheet']}
			isOpen={open}
			onClose={() => onOpenChange(false)}
			side="right"
			title="Baglam"
		>
			<section
				aria-labelledby="context-sheet-title"
				className={styles['content']}
				id="context-sheet"
			>
				<header className={styles['header']}>
					<h2 id="context-sheet-title" className={styles['title']}>
						Baglam
					</h2>
					<button
						type="button"
						className="runa-chat-icon-button"
						onClick={() => onOpenChange(false)}
						aria-label="Baglam panelini kapat"
					>
						×
					</button>
				</header>

				<section className={styles['section']}>
					<h3 className={styles['sectionTitle']}>Çalışma klasörü</h3>
					<p className={styles['mono']} title={normalizedWorkingDirectory}>
						{normalizedWorkingDirectory || 'Çalışma klasörü secilmedi'}
					</p>
				</section>

				<section className={styles['section']}>
					<h3 className={styles['sectionTitle']}>Ekler</h3>
					{attachments.length > 0 ? (
						<ul className={styles['list']}>
							{attachments.map((attachment) => (
								<li key={attachment.blob_id}>{getAttachmentLabel(attachment)}</li>
							))}
						</ul>
					) : (
						<p className="runa-subtle-copy">Su an ek dosya yok.</p>
					)}
				</section>

				<section className={styles['section']}>
					<h3 className={styles['sectionTitle']}>Acik working files</h3>
					<p className="runa-subtle-copy">Bu liste PR-7 kapsaminda baglanacak.</p>
				</section>

				<button type="button" className="runa-button runa-button--secondary" disabled>
					Baglami duzenle (PR-7)
				</button>
			</section>
		</RunaSheet>
	);
}
