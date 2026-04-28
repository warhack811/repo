import type { ReactElement } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer.js';

type StreamingMessageSurfaceProps = Readonly<{
	currentRunId?: string;
	currentStreamingRunId: string | null;
	currentStreamingText: string;
}>;

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
		<div className="runa-migrated-components-chat-streamingmessagesurface-1" aria-live="polite">
			<div className="runa-migrated-components-chat-streamingmessagesurface-2">Canli yanit</div>
			<MarkdownRenderer
				className="runa-streaming-response"
				content={currentStreamingText}
				isStreaming
			/>
		</div>
	);
}
