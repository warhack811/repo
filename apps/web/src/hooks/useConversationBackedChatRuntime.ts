import { useCallback } from 'react';

import { useChatRuntime } from './useChatRuntime.js';
import { useConversations } from './useConversations.js';

export function useConversationBackedChatRuntime(accessToken: string | null) {
	const conversations = useConversations({
		accessToken,
	});
	const onRunAccepted = useCallback(
		({ conversationId, prompt }: { conversationId?: string; prompt: string }) => {
			conversations.handleRunAccepted({ conversationId, prompt });
		},
		[conversations.handleRunAccepted],
	);
	const onRunFinished = useCallback(
		({ conversationId }: { conversationId?: string }) => {
			conversations.handleRunFinished({ conversationId });
		},
		[conversations.handleRunFinished],
	);
	const runtime = useChatRuntime({
		activeConversationId: conversations.activeConversationId,
		accessToken,
		buildRequestMessages: conversations.buildRequestMessages,
		onRunAccepted,
		onRunFinished,
	});

	return {
		conversations,
		runtime,
	} as const;
}
