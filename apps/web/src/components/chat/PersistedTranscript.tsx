import type { ReactElement } from 'react';

import type { ConversationMessage } from '../../hooks/useConversations.js';
import { StreamdownMessage } from '../../lib/streamdown/StreamdownMessage.js';

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
		<div className="runa-migrated-components-chat-persistedtranscript-1" aria-live="polite">
			{activeConversationMessages.map((message) => (
				<div
					key={message.message_id}
					className={`runa-transcript-message runa-transcript-message--${message.role} runa-migrated-components-chat-persistedtranscript-3`}
				>
					<div className="runa-migrated-components-chat-persistedtranscript-4">
						<strong className="runa-migrated-components-chat-persistedtranscript-5">
							{getRoleLabel(message.role)}
						</strong>
						<span>{new Date(message.created_at).toLocaleString('tr-TR')}</span>
					</div>
					<StreamdownMessage>{message.content}</StreamdownMessage>
				</div>
			))}
		</div>
	);
}
