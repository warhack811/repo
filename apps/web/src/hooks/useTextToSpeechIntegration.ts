import { useEffect, useRef } from 'react';

import type { ConversationMessage } from './useConversations.js';
import { useTextToSpeech } from './useTextToSpeech.js';
import { useVoiceInput } from './useVoiceInput.js';

export type UseTextToSpeechIntegrationInput = Readonly<{
	latestAssistantMessage: ConversationMessage | null;
	latestReadableResponse: string;
	onPromptChange: (prompt: string) => void;
	prompt: string;
}>;

export type UseTextToSpeechIntegrationResult = Readonly<{
	autoReadEnabled: boolean;
	cancelTextToSpeech: () => void;
	isSpeaking: boolean;
	isTextToSpeechSupported: boolean;
	speakLatestResponse: () => void;
	voiceInput: ReturnType<typeof useVoiceInput>;
	voiceStatusMessage: string | null;
}>;

export function useTextToSpeechIntegration({
	latestAssistantMessage,
	latestReadableResponse,
	onPromptChange,
	prompt,
}: UseTextToSpeechIntegrationInput): UseTextToSpeechIntegrationResult {
	const promptRef = useRef(prompt);
	const lastSeenAssistantMessageIdRef = useRef<string | null>(null);
	const {
		autoReadEnabled,
		cancel: cancelTextToSpeech,
		errorMessage: textToSpeechErrorMessage,
		isSpeaking,
		isSupported: isTextToSpeechSupported,
		speak,
	} = useTextToSpeech();
	const voiceInput = useVoiceInput({
		onFinalTranscript: (transcript) => {
			const existingPrompt = promptRef.current.trim();
			const nextPrompt =
				existingPrompt.length > 0 ? `${promptRef.current.trimEnd()}\n${transcript}` : transcript;

			onPromptChange(nextPrompt);
		},
	});

	useEffect(() => {
		promptRef.current = prompt;
	}, [prompt]);

	useEffect(() => {
		lastSeenAssistantMessageIdRef.current = latestAssistantMessage?.message_id ?? null;
	}, [latestAssistantMessage?.message_id]);

	useEffect(() => {
		const latestAssistantMessageId = latestAssistantMessage?.message_id ?? null;

		if (latestAssistantMessageId === null) {
			return;
		}

		if (lastSeenAssistantMessageIdRef.current === null) {
			lastSeenAssistantMessageIdRef.current = latestAssistantMessageId;
			return;
		}

		if (lastSeenAssistantMessageIdRef.current === latestAssistantMessageId) {
			return;
		}

		lastSeenAssistantMessageIdRef.current = latestAssistantMessageId;

		if (autoReadEnabled && latestReadableResponse.length > 0) {
			speak(latestReadableResponse);
		}
	}, [autoReadEnabled, latestAssistantMessage?.message_id, latestReadableResponse, speak]);

	return {
		autoReadEnabled,
		cancelTextToSpeech,
		isSpeaking,
		isTextToSpeechSupported,
		speakLatestResponse: () => speak(latestReadableResponse),
		voiceInput,
		voiceStatusMessage: voiceInput.errorMessage ?? textToSpeechErrorMessage ?? null,
	};
}
