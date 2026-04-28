import type { CSSProperties, ReactElement, ReactNode } from 'react';

import type { ConversationMessage } from '../../hooks/useConversations.js';
import { secondaryLabelStyle } from '../../lib/chat-styles.js';
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

const idleSurfaceStyle: CSSProperties = {
	borderRadius: '16px',
	border: '1px solid rgba(148, 163, 184, 0.1)',
	background: 'rgba(6, 11, 21, 0.48)',
	padding: 'clamp(16px, 3vw, 20px)',
	display: 'grid',
	gap: '14px',
	boxShadow: '0 8px 24px rgba(2, 6, 23, 0.18)',
	transition:
		'opacity 220ms ease, transform 220ms ease, border-color 220ms ease, background 220ms ease',
};

const activeSurfaceStyle: CSSProperties = {
	borderRadius: '20px',
	border: '1px solid rgba(148, 163, 184, 0.16)',
	background: 'linear-gradient(180deg, rgba(12, 18, 31, 0.88) 0%, rgba(7, 11, 20, 0.74) 100%)',
	padding: 'clamp(18px, 3vw, 24px)',
	display: 'grid',
	gap: '16px',
	boxShadow: '0 24px 60px rgba(2, 6, 23, 0.38)',
	transition:
		'opacity 220ms ease, transform 220ms ease, border-color 220ms ease, background 220ms ease',
};

const headingStackStyle: CSSProperties = {
	display: 'grid',
	gap: '4px',
};

const headingIdleStyle: CSSProperties = {
	...headingStackStyle,
	opacity: 0.7,
};

const headingActiveStyle: CSSProperties = {
	...headingStackStyle,
	opacity: 1,
};

const headingTitleIdleStyle: CSSProperties = {
	fontSize: '16px',
	fontWeight: 500,
	color: 'hsl(var(--color-text-soft))',
};

const headingTitleActiveStyle: CSSProperties = {
	fontSize: '18px',
	fontWeight: 600,
	color: 'hsl(var(--color-text))',
};

const subtitleIdleStyle: CSSProperties = {
	fontSize: '13px',
	color: 'hsl(var(--color-text-muted))',
	lineHeight: 1.4,
};

const subtitleActiveStyle: CSSProperties = {
	fontSize: '13px',
	color: 'hsl(var(--color-text-muted))',
	lineHeight: 1.4,
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
	const isBusy =
		currentStreamingText.trim().length > 0 ||
		currentRunProgressPanel !== null ||
		currentPresentationContent !== null;
	const hasTranscript = activeConversationMessages.length > 0;

	const surfaceStyle = isBusy ? activeSurfaceStyle : idleSurfaceStyle;
	const headingStyle = isBusy ? headingActiveStyle : headingIdleStyle;
	const headingTitleStyle = isBusy ? headingTitleActiveStyle : headingTitleIdleStyle;
	const subtitleStyle = isBusy ? subtitleActiveStyle : subtitleIdleStyle;
	const showSubtitle = isBusy;

	return (
		<section
			className="runa-card runa-card--chat runa-chat-surface"
			style={surfaceStyle}
			aria-labelledby="chat-conversation-surface-heading"
			aria-busy={isBusy}
		>
			<div style={headingStyle}>
				<div style={secondaryLabelStyle}>Sohbet</div>
				<h2 id="chat-conversation-surface-heading" style={headingTitleStyle}>
					Calisma akisi
				</h2>
				{showSubtitle ? (
					<div className="runa-subtle-copy" style={subtitleStyle}>
						yanitlar, onaylar ve sonuclar burada gorunur
					</div>
				) : null}
			</div>
			{currentRunProgressPanel}
			<StreamingMessageSurface
				currentRunId={currentRunId}
				currentStreamingRunId={currentStreamingRunId}
				currentStreamingText={currentStreamingText}
			/>
			{currentPresentationContent ?? (isBusy ? null : emptyStateContent)}
			{hasTranscript ? (
				<details className="runa-transcript-details">
					<summary>Kayitli sohbeti goster</summary>
					<PersistedTranscript
						activeConversationId={activeConversationId}
						activeConversationMessages={activeConversationMessages}
					/>
				</details>
			) : null}
		</section>
	);
}
