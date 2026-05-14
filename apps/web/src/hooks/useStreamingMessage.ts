import { useMemo } from 'react';

import type { ChatStore } from '../stores/chat-store.js';
import { useChatStoreSlice } from './useChatStoreSlice.js';

export function useStreamingMessage(store: ChatStore): {
	readonly runId: string | null;
	readonly text: string;
} {
	const text = useChatStoreSlice(store, (state) => state.presentation.currentStreamingText);
	const runId = useChatStoreSlice(store, (state) => state.presentation.currentStreamingRunId);

	return useMemo(
		() => ({
			runId,
			text,
		}),
		[runId, text],
	);
}
