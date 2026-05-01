import type { ReactElement } from 'react';
import { StreamdownMessage } from '../../lib/streamdown/StreamdownMessage.js';

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
		<div
			className="runa-streaming-message runa-migrated-components-chat-streamingmessagesurface-1"
			aria-live="polite"
		>
			<span className="runa-chat-visually-hidden">Canlı yanıt</span>
			<StreamdownMessage className="runa-streaming-response" mode="streaming">
				{currentStreamingText}
			</StreamdownMessage>
		</div>
	);
}
