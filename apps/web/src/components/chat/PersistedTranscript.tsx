import type { CSSProperties, ReactElement } from 'react';

import type { ConversationMessage } from '../../hooks/useConversations.js';
import { secondaryLabelStyle } from '../../lib/chat-styles.js';
import { designTokens } from '../../lib/design-tokens.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';

type PersistedTranscriptProps = Readonly<{
	activeConversationId: string | null;
	activeConversationMessages: readonly ConversationMessage[];
}>;

const persistedMessagesStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.sm,
};

const messageCardStyle: CSSProperties = {
	borderRadius: designTokens.radius.soft,
	display: 'grid',
	gap: designTokens.spacing.xs,
	padding: '14px 16px',
};

const messageMetaStyle: CSSProperties = {
	color: '#94a3b8',
	display: 'flex',
	flexWrap: 'wrap',
	fontSize: '12px',
	gap: designTokens.spacing.md,
	justifyContent: 'space-between',
};

function getRoleLabel(role: ConversationMessage['role']): string {
	if (role === 'user') {
		return 'Sen';
	}

	if (role === 'assistant') {
		return 'Runa';
	}

	return 'Sistem';
}

function createMessageCardStyle(role: ConversationMessage['role']): CSSProperties {
	return {
		...messageCardStyle,
		background: role === 'user' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(7, 11, 20, 0.46)',
		border:
			role === 'user'
				? '1px solid rgba(245, 158, 11, 0.24)'
				: '1px solid rgba(148, 163, 184, 0.14)',
	};
}

export function PersistedTranscript({
	activeConversationId,
	activeConversationMessages,
}: PersistedTranscriptProps): ReactElement {
	if (activeConversationMessages.length === 0) {
		return activeConversationId ? (
			<div className="runa-subtle-copy">
				Bu sohbet icin henuz kayitli mesaj yok. Ilk yanit tamamlandiginda burada gorunecek.
			</div>
		) : (
			<div className="runa-subtle-copy">
				Yeni bir sohbet hazir. Ilk mesajini gonderdiginde Runa bu akisi senin icin kaydeder.
			</div>
		);
	}

	return (
		<div style={persistedMessagesStyle} aria-live="polite">
			<div style={secondaryLabelStyle}>Kayitli mesajlar</div>
			{activeConversationMessages.map((message) => (
				<div key={message.message_id} style={createMessageCardStyle(message.role)}>
					<div style={messageMetaStyle}>
						<strong style={{ color: '#e5e7eb' }}>{getRoleLabel(message.role)}</strong>
						<span>{new Date(message.created_at).toLocaleString()}</span>
					</div>
					<MarkdownRenderer content={message.content} />
				</div>
			))}
		</div>
	);
}
