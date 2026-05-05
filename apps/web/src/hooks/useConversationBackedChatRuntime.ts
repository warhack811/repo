import { useCallback, useEffect } from 'react';

import { useChatRuntime } from './useChatRuntime.js';
import { useConversations } from './useConversations.js';

export function useConversationBackedChatRuntime(
	accessToken: string | null,
	options: Readonly<{ startInDraft?: boolean }> = {},
) {
	const conversations = useConversations({
		accessToken,
		startInDraft: options.startInDraft,
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
	const onRunFinishing = useCallback(
		(input: { conversationId: string; runId: string; streamingText: string }) => {
			conversations.handleRunFinishing(input);
		},
		[conversations.handleRunFinishing],
	);
	const runtime = useChatRuntime({
		activeConversationId: conversations.activeConversationId,
		accessToken,
		buildRequestMessages: conversations.buildRequestMessages,
		onRunAccepted,
		onRunFinished,
		onRunFinishing,
	});

	const { activeConversationRunSurfaces } = conversations;
	const { store } = runtime;

	useEffect(() => {
		if (
			conversations.activeConversationId !== null ||
			activeConversationRunSurfaces.length > 0 ||
			runtime.isSubmitting ||
			runtime.currentStreamingRunId !== null
		) {
			return;
		}

		runtime.resetRunState();
	}, [
		activeConversationRunSurfaces.length,
		conversations.activeConversationId,
		runtime.currentStreamingRunId,
		runtime.isSubmitting,
		runtime.resetRunState,
	]);

	useEffect(() => {
		if (activeConversationRunSurfaces.length === 0) {
			return;
		}

		store.setPresentationState((current) => {
			if (current.presentationRunId !== null) {
				return current;
			}

			const firstLoadedRunId = activeConversationRunSurfaces[0]?.run_id;
			const alreadyLoaded = current.presentationRunSurfaces.some(
				(surface) => surface.run_id === firstLoadedRunId,
			);

			if (alreadyLoaded) {
				return current;
			}

			return {
				...current,
				presentationRunSurfaces: activeConversationRunSurfaces.map((surface) => ({
					...surface,
					replayMode: true,
				})),
			};
		});
	}, [activeConversationRunSurfaces, store]);

	return {
		conversations,
		runtime,
	} as const;
}
