import { ThreadPrimitive } from '@assistant-ui/react';
import type { ReactElement, ReactNode } from 'react';

import type { ConversationMessage } from '../../hooks/useConversations.js';
import { RunaSkeleton } from '../ui/RunaSkeleton.js';
import { PersistedTranscript } from './PersistedTranscript.js';
import { StreamingMessageSurface } from './StreamingMessageSurface.js';

type CurrentRunSurfaceProps = Readonly<{
	activeConversationId: string | null;
	activeConversationMessages: readonly ConversationMessage[];
	currentPresentationContent: ReactNode;
	currentRunId: string | undefined;
	currentRunProgressPanel: ReactNode;
	currentStreamingRunId: string | null;
	currentStreamingText: string;
	emptyStateContent: ReactNode;
	isHistoryLoading?: boolean;
}>;

export function CurrentRunSurface({
	activeConversationId,
	activeConversationMessages,
	currentPresentationContent,
	currentRunId,
	currentRunProgressPanel,
	currentStreamingRunId,
	currentStreamingText,
	emptyStateContent,
	isHistoryLoading = false,
}: CurrentRunSurfaceProps): ReactElement | null {
	const isBusy =
		currentStreamingText.trim().length > 0 ||
		currentRunProgressPanel !== null ||
		currentPresentationContent !== null;
	const hasTranscript = activeConversationMessages.length > 0;
	const shouldShowEmptyState =
		!isBusy && !hasTranscript && !isHistoryLoading && emptyStateContent !== null;

	if (!isBusy && !hasTranscript && !isHistoryLoading && emptyStateContent === null) {
		return null;
	}

	return (
		<ThreadPrimitive.Root
			className={`runa-current-run-surface runa-chat-transcript runa-migrated-components-chat-currentrunsurface-1${
				shouldShowEmptyState ? ' runa-current-run-surface--empty' : ''
			}`}
			aria-labelledby="chat-conversation-surface-heading"
			aria-busy={isBusy}
		>
			<div className="runa-chat-visually-hidden runa-migrated-components-chat-currentrunsurface-2">
				<h2
					id="chat-conversation-surface-heading"
					className="runa-migrated-components-chat-currentrunsurface-4"
				>
					Sohbet
				</h2>
			</div>
			<ThreadPrimitive.Viewport autoScroll className="runa-current-run-surface__viewport">
				{hasTranscript ? (
					<PersistedTranscript
						activeConversationId={activeConversationId}
						activeConversationMessages={activeConversationMessages}
					/>
				) : null}
				{currentRunProgressPanel}
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
