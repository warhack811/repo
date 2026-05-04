import type { ReactElement } from 'react';
import { uiCopy } from '../../localization/copy.js';
import type { ConnectionStatus } from '../../ws-types.js';
import styles from './ChatWorkspaceHeader.module.css';

type ChatWorkspaceHeaderProps = Readonly<{
	connectionStatus: ConnectionStatus;
	statusLabel: string;
}>;

export function ChatWorkspaceHeader({ statusLabel }: ChatWorkspaceHeaderProps): ReactElement {
	return (
		<header
			className={`runa-card runa-card--hero runa-ambient-panel ${styles['root']}`}
			aria-labelledby="chat-workspace-heading"
			aria-describedby="chat-workspace-description"
		>
			<div className={styles['content']}>
				<div className={styles['titleGroup']}>
					<div className="runa-eyebrow">{uiCopy.appShell.chatEyebrow.toUpperCase()}</div>
					<h1
						id="chat-workspace-heading"
						className={styles['title']}
					>
						{uiCopy.chat.heroTitle}
					</h1>
					<p
						id="chat-workspace-description"
						className={`runa-subtle-copy ${styles['description']}`}
					>
						{uiCopy.chat.heroSubtitle}
					</p>
				</div>
				<div className={styles['status']}>{statusLabel}</div>
			</div>
		</header>
	);
}
