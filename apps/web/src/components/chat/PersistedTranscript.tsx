import type { ReactElement } from 'react';
import { Fragment } from 'react';

import type { ConversationMessage } from '../../hooks/useConversations.js';
import { StreamdownMessage } from '../../lib/streamdown/StreamdownMessage.js';
import { HafizaMark } from '../ui/HafizaMark.js';
import { DayDivider } from './DayDivider.js';
import styles from './PersistedTranscript.module.css';
import { groupMessagesByDay } from './transcriptGroup.js';

type PersistedTranscriptProps = Readonly<{
	activeConversationId: string | null;
	activeConversationMessages: readonly ConversationMessage[];
}>;

export function PersistedTranscript({
	activeConversationId,
	activeConversationMessages,
}: PersistedTranscriptProps): ReactElement {
	if (activeConversationMessages.length === 0) {
		return activeConversationId ? (
			<div className="runa-subtle-copy">Bu sohbet icin henuz kayitli mesaj yok.</div>
		) : (
			<div className="runa-subtle-copy">Yeni bir sohbet hazir.</div>
		);
	}

	return (
		<div className={styles['root']} aria-live="polite">
			{groupMessagesByDay(activeConversationMessages).map((group) => (
				<Fragment key={group.key}>
					{group.dayDivider ? <DayDivider label={group.dayDivider} /> : null}
					{group.messages.map((message, messageIndex) => {
						const previousMessage = group.messages[messageIndex - 1] ?? null;
						const shouldShowAssistantMark =
							message.role === 'assistant' && previousMessage?.role !== 'assistant';

						return (
							<div
								key={message.message_id}
								className={`${styles['message']} runa-transcript-message runa-transcript-message--${message.role}`}
								data-role={message.role}
							>
								{shouldShowAssistantMark ? (
									<HafizaMark
										weight="micro"
										variant="brand"
										aria-hidden
										className={styles['assistantMark']}
									/>
								) : (
									<span className={styles['assistantMarkSpacer']} aria-hidden />
								)}
								<div className={styles['messageBody']}>
									<div className={styles['bubble']}>
										<StreamdownMessage>{message.content}</StreamdownMessage>
									</div>
								</div>
							</div>
						);
					})}
				</Fragment>
			))}
		</div>
	);
}
