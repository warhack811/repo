import { ThreadPrimitive } from '@assistant-ui/react';
import type { ReactElement, ReactNode } from 'react';

import type { ConversationMessage } from '../../hooks/useConversations.js';
import { useStreamingMessage } from '../../hooks/useStreamingMessage.js';
import type { ChatStore } from '../../stores/chat-store.js';
import { RunaSkeleton } from '../ui/RunaSkeleton.js';
import styles from './CurrentRunSurface.module.css';
import { PersistedTranscript } from './PersistedTranscript.js';
import { StreamingMessageSurface } from './StreamingMessageSurface.js';

type CurrentRunSurfaceProps = Readonly<{
	activeConversationId: string | null;
	activeConversationMessages: readonly ConversationMessage[];
	currentPresentationContent: ReactNode;
	currentRunId: string | undefined;
	emptyStateContent: ReactNode;
	isHistoryLoading?: boolean;
	isRunning?: boolean;
	store: ChatStore;
	onPreparePrompt?: (input: {
		readonly prompt: string;
		readonly reason: 'edit' | 'retry';
		readonly sourceMessageId: string;
	}) => void;
}>;

export function CurrentRunSurface({
	activeConversationId,
	activeConversationMessages,
	currentPresentationContent,
	currentRunId,
	emptyStateContent,
	isHistoryLoading = false,
	isRunning = false,
	store,
	onPreparePrompt,
}: CurrentRunSurfaceProps): ReactElement | null {
	const { runId: currentStreamingRunId, text: currentStreamingText } = useStreamingMessage(store);
	const isBusy = currentStreamingText.trim().length > 0 || currentPresentationContent !== null;
	const hasTranscript = activeConversationMessages.length > 0;
	const shouldShowEmptyState =
		!isBusy && !hasTranscript && !isHistoryLoading && emptyStateContent !== null;

	if (!isBusy && !hasTranscript && !isHistoryLoading && emptyStateContent === null) {
		return null;
	}

	return (
		<ThreadPrimitive.Root
			className={`runa-current-run-surface runa-chat-transcript ${styles['root']}${
				shouldShowEmptyState ? ' runa-current-run-surface--empty' : ''
			}`}
			aria-labelledby="chat-conversation-surface-heading"
			aria-busy={isBusy}
		>
			<div className={`runa-chat-visually-hidden ${styles['visuallyHidden']}`}>
				<h2 id="chat-conversation-surface-heading" className={styles['title']}>
					Sohbet
				</h2>
			</div>
			<ThreadPrimitive.Viewport autoScroll className="runa-current-run-surface__viewport">
				{hasTranscript ? (
					<PersistedTranscript
						activeConversationId={activeConversationId}
						activeConversationMessages={activeConversationMessages}
						isRunning={isRunning}
						onPreparePrompt={onPreparePrompt}
					/>
				) : null}
				<StreamingMessageSurface
					currentRunId={currentRunId}
					currentStreamingRunId={currentStreamingRunId}
					currentStreamingText={currentStreamingText}
				/>
				{isHistoryLoading && !isBusy && !hasTranscript ? (
					<output aria-busy="true" className="runa-message-history-skeleton">
						<RunaSkeleton variant="text" />
						<RunaSkeleton variant="rect" />
						<RunaSkeleton variant="text" />
					</output>
				) : (
					(currentPresentationContent ?? (shouldShowEmptyState ? emptyStateContent : null))
				)}
			</ThreadPrimitive.Viewport>
		</ThreadPrimitive.Root>
	);
}
