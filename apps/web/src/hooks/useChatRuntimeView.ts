import { useMemo } from 'react';

import { uiCopy } from '../localization/copy.js';
import type { ConnectionStatus } from '../ws-types.js';

type UseChatRuntimeViewOptions = Readonly<{
	connectionStatus: ConnectionStatus;
	currentRunFeedbackChipLabel?: string;
	isSubmitting: boolean;
}>;

type ChatRuntimeViewState = Readonly<{
	statusLabel: string;
	submitButtonLabel: string;
}>;

export function useChatRuntimeView(options: UseChatRuntimeViewOptions): ChatRuntimeViewState {
	const { connectionStatus, currentRunFeedbackChipLabel, isSubmitting } = options;

	return useMemo(() => {
		const statusLabel =
			connectionStatus === 'open'
				? uiCopy.chat.runConnectionOpen
				: connectionStatus === 'connecting'
					? uiCopy.chat.runConnectionConnecting
					: uiCopy.chat.runConnectionClosed;

		const submitButtonLabel =
			connectionStatus !== 'open'
				? connectionStatus === 'connecting'
					? uiCopy.chat.submitConnectionConnecting
					: uiCopy.chat.submitConnectionWaiting
				: !isSubmitting
					? uiCopy.chat.send
					: currentRunFeedbackChipLabel === 'sending'
						? uiCopy.chat.sending
						: uiCopy.chat.submitInProgress;

		return {
			statusLabel,
			submitButtonLabel,
		};
	}, [connectionStatus, currentRunFeedbackChipLabel, isSubmitting]);
}
