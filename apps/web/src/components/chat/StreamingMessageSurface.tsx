import type { CSSProperties, ReactElement } from 'react';

import { secondaryLabelStyle } from '../../lib/chat-styles.js';
import { designTokens } from '../../lib/design-tokens.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';

type StreamingMessageSurfaceProps = Readonly<{
	currentRunId?: string;
	currentStreamingRunId: string | null;
	currentStreamingText: string;
}>;

const streamingSurfaceStyle: CSSProperties = {
	background: 'linear-gradient(180deg, rgba(54, 32, 7, 0.28) 0%, rgba(15, 23, 42, 0.3) 100%)',
	border: `1px solid ${designTokens.color.border.accent}`,
	borderRadius: '20px',
	boxShadow: '0 18px 36px rgba(15, 23, 42, 0.22)',
	display: 'grid',
	gap: designTokens.spacing.sm,
	padding: '16px 18px',
};

export function StreamingMessageSurface({
	currentRunId,
	currentStreamingRunId,
	currentStreamingText,
}: StreamingMessageSurfaceProps): ReactElement | null {
	const shouldShowStreamingSurface =
		currentStreamingText.trim().length > 0 &&
		currentStreamingRunId !== null &&
		currentStreamingRunId === currentRunId;

	if (!shouldShowStreamingSurface) {
		return null;
	}

	return (
		<div style={streamingSurfaceStyle} aria-live="polite">
			<div style={secondaryLabelStyle}>Canli yanit</div>
			<MarkdownRenderer
				className="runa-streaming-response"
				content={currentStreamingText}
				isStreaming
			/>
		</div>
	);
}
