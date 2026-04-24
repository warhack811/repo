import type { CSSProperties, ReactElement, ReactNode } from 'react';

import type { ConversationMessage } from '../../hooks/useConversations.js';
import { secondaryLabelStyle } from '../../lib/chat-styles.js';
import { uiCopy } from '../../localization/copy.js';
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
}>;

const conversationSurfaceStyle: CSSProperties = {
	borderRadius: '24px',
	border: '1px solid rgba(148, 163, 184, 0.16)',
	background: 'linear-gradient(180deg, rgba(12, 18, 31, 0.88) 0%, rgba(7, 11, 20, 0.74) 100%)',
	padding: 'clamp(18px, 3vw, 24px)',
	display: 'grid',
	gap: '16px',
	boxShadow: '0 24px 60px rgba(2, 6, 23, 0.38)',
	transition: 'opacity 220ms ease, transform 220ms ease, border-color 220ms ease',
};

const headingStackStyle: CSSProperties = {
	display: 'grid',
	gap: '8px',
};

export function CurrentRunSurface({
	activeConversationId,
	activeConversationMessages,
	currentPresentationContent,
	currentRunId,
	currentRunProgressPanel,
	currentStreamingRunId,
	currentStreamingText,
	emptyStateContent,
}: CurrentRunSurfaceProps): ReactElement {
	return (
		<div
			className="runa-card runa-card--chat runa-chat-surface"
			style={conversationSurfaceStyle}
			aria-labelledby="chat-conversation-surface-heading"
		>
			<div style={headingStackStyle}>
				<div style={secondaryLabelStyle}>{uiCopy.run.currentRunProgress}</div>
				<h2 id="chat-conversation-surface-heading" style={{ fontSize: '20px' }}>
					Aktif sohbet akışı
				</h2>
				<div className="runa-subtle-copy">
					Guncel calisma, kalici mesajlar ve yardimci kartlar burada sakin bir akista kalir.
				</div>
			</div>
			<PersistedTranscript
				activeConversationId={activeConversationId}
				activeConversationMessages={activeConversationMessages}
			/>
			{currentRunProgressPanel}
			<StreamingMessageSurface
				currentRunId={currentRunId}
				currentStreamingRunId={currentStreamingRunId}
				currentStreamingText={currentStreamingText}
			/>
			{currentPresentationContent ?? emptyStateContent}
		</div>
	);
}
