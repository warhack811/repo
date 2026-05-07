import type { ReactElement } from 'react';

import type { ConversationMessage } from '../../hooks/useConversations.js';
import { StreamdownMessage } from '../../lib/streamdown/StreamdownMessage.js';
import styles from './PersistedTranscript.module.css';

type PersistedTranscriptProps = Readonly<{
	activeConversationId: string | null;
	activeConversationMessages: readonly ConversationMessage[];
}>;

function getRoleLabel(role: ConversationMessage['role']): string {
	if (role === 'user') {
		return 'Sen';
	}

	if (role === 'assistant') {
		return 'Runa';
	}

	return 'Sistem';
}

export function PersistedTranscript({
	activeConversationId,
	activeConversationMessages,
}: PersistedTranscriptProps): ReactElement {
	if (activeConversationMessages.length === 0) {
		return activeConversationId ? (
			<div className="runa-subtle-copy">Bu sohbet için henüz kayıtlı mesaj yok.</div>
		) : (
			<div className="runa-subtle-copy">Yeni bir sohbet hazır.</div>
		);
	}

	return (
		<div className={styles['root']} aria-live="polite">
			{activeConversationMessages.map((message) => (
				<div
					key={message.message_id}
					className={`${styles['message']} runa-transcript-message runa-transcript-message--${message.role}`}
					data-role={message.role}
				>
					<div className={styles['bubble']}>
						<StreamdownMessage>{message.content}</StreamdownMessage>
					</div>
					<div className={styles['metaRow']}>
						<span className={styles['roleLabel']}>{getRoleLabel(message.role)}</span>
						<span className={styles['time']}>
							{new Date(message.created_at).toLocaleString('tr-TR')}
						</span>
					</div>
				</div>
			))}
		</div>
	);
}
