import type { ReactElement, ReactNode } from 'react';

import { RunaSheet } from '../ui/RunaSheet.js';
import styles from './HistorySheet.module.css';

type HistorySheetProps = Readonly<{
	children: ReactNode;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}>;

export function HistorySheet({
	children,
	open,
	onOpenChange,
}: HistorySheetProps): ReactElement | null {
	return (
		<RunaSheet
			className={styles['sheet']}
			isOpen={open}
			onClose={() => onOpenChange(false)}
			side="bottom"
			title="Sohbet gecmisi"
		>
			<section
				aria-labelledby="history-sheet-title"
				className={styles['content']}
				id="history-sheet"
			>
				<header className={styles['header']}>
					<h2 id="history-sheet-title" className={styles['title']}>
						Gecmis
					</h2>
					<button
						type="button"
						className="runa-chat-icon-button"
						onClick={() => onOpenChange(false)}
						aria-label="Sohbet gecmisini kapat"
					>
						×
					</button>
				</header>
				<div className={styles['body']}>{children}</div>
			</section>
		</RunaSheet>
	);
}
