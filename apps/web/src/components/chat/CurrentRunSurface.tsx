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
	const showSubtitle = isBusy;
	const shouldShowEmptyState =
		!isBusy && !hasTranscript && !isHistoryLoading && emptyStateContent !== null;

	if (!isBusy && !hasTranscript && !isHistoryLoading && emptyStateContent === null) {
		return null;
	}

	return (
		<section
			className={`runa-card runa-card--chat runa-chat-surface runa-migrated-components-chat-currentrunsurface-1${
				shouldShowEmptyState ? ' runa-current-run-surface--empty' : ''
			}`}
			aria-labelledby="chat-conversation-surface-heading"
			aria-busy={isBusy}
		>
			<div className="runa-migrated-components-chat-currentrunsurface-2">
				<div className="runa-migrated-components-chat-currentrunsurface-3">Sohbet</div>
				<h2
					id="chat-conversation-surface-heading"
					className="runa-migrated-components-chat-currentrunsurface-4"
				>
					Sohbet akışı
				</h2>
				{showSubtitle ? (
					<div className="runa-subtle-copy runa-migrated-components-chat-currentrunsurface-5">
						Runa cevabı ve onay isteyen adımlar sırayla ilerler.
					</div>
				) : null}
			</div>
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
			{hasTranscript ? (
				<details className="runa-transcript-details">
					<summary>Kayıtlı sohbeti göster</summary>
					<PersistedTranscript
						activeConversationId={activeConversationId}
						activeConversationMessages={activeConversationMessages}
					/>
				</details>
			) : null}
		</section>
	);
}
