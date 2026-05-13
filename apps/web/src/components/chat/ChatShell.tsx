import type { ReactElement, ReactNode } from 'react';
import { RunaSurface } from '../ui/RunaSurface.js';
import styles from './ChatShell.module.css';

type ChatShellProps = Readonly<{
	children: ReactNode;
	embedded?: boolean;
}>;

export function ChatShell({ children, embedded = false }: ChatShellProps): ReactElement {
	if (embedded) {
		return (
			<RunaSurface
				as="main"
				id="chat-workspace-content"
				className={`runa-shell-frame runa-shell-frame--chat ${styles['embedded']}`}
				tone="plain"
			>
				{children}
			</RunaSurface>
		);
	}

	return (
		<main id="chat-workspace-content" className={styles['standard']}>
			{children}
		</main>
	);
}
