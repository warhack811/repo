import type { ConversationMessage } from '../../hooks/useConversations.js';

export type MessageActionKind = 'copy' | 'edit' | 'retry';

export type MessageActionModel = Readonly<{
	canCopy: boolean;
	canEdit: boolean;
	canRetry: boolean;
	copyText: string | null;
	editPrompt: string | null;
	retryPrompt: string | null;
}>;

export function getPreviousUserPrompt(
	messages: readonly ConversationMessage[],
	messageId: string,
): string | null {
	const messageIndex = messages.findIndex((m) => m.message_id === messageId);

	if (messageIndex < 0) {
		return null;
	}

	for (let i = messageIndex - 1; i >= 0; i--) {
		if (messages[i]?.role === 'user') {
			const content = messages[i]?.content?.trim();
			if (content && content.length > 0) {
				return content;
			}
		}
	}

	return null;
}

export function getLatestAssistantMessageId(
	messages: readonly ConversationMessage[],
): string | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i]?.role === 'assistant') {
			const content = messages[i]?.content?.trim();
			if (content && content.length > 0) {
				return messages[i]?.message_id ?? null;
			}
		}
	}

	return null;
}

export function getLatestUserMessageId(messages: readonly ConversationMessage[]): string | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i]?.role === 'user') {
			const content = messages[i]?.content?.trim();
			if (content && content.length > 0) {
				return messages[i]?.message_id ?? null;
			}
		}
	}

	return null;
}

export function deriveMessageActionModel(input: {
	readonly message: ConversationMessage;
	readonly messages: readonly ConversationMessage[];
	readonly isRunning?: boolean;
}): MessageActionModel {
	const { message, messages, isRunning = false } = input;
	const content = message.content?.trim() ?? '';
	const hasContent = content.length > 0;

	if (message.role === 'system') {
		return {
			canCopy: false,
			canEdit: false,
			canRetry: false,
			copyText: null,
			editPrompt: null,
			retryPrompt: null,
		};
	}

	if (!hasContent) {
		return {
			canCopy: false,
			canEdit: false,
			canRetry: false,
			copyText: null,
			editPrompt: null,
			retryPrompt: null,
		};
	}

	const latestAssistantId = getLatestAssistantMessageId(messages);
	const latestUserId = getLatestUserMessageId(messages);
	const isLatestAssistant =
		message.role === 'assistant' && message.message_id === latestAssistantId;
	const isLatestUser = message.role === 'user' && message.message_id === latestUserId;

	if (message.role === 'user') {
		const editPrompt = content;
		const canEdit = true;
		let canRetry = false;
		let retryPrompt: string | null = null;

		if (isLatestUser && !isRunning) {
			canRetry = true;
			retryPrompt = editPrompt;
		}

		return {
			canCopy: true,
			canEdit,
			canRetry,
			copyText: content,
			editPrompt,
			retryPrompt,
		};
	}

	if (message.role === 'assistant') {
		const previousUserPrompt = getPreviousUserPrompt(messages, message.message_id);
		const hasPreviousUserPrompt = previousUserPrompt !== null;
		let canRetry = false;
		let retryPrompt: string | null = null;

		if (isLatestAssistant && hasPreviousUserPrompt && !isRunning) {
			canRetry = true;
			retryPrompt = previousUserPrompt;
		}

		return {
			canCopy: true,
			canEdit: false,
			canRetry,
			copyText: content,
			editPrompt: null,
			retryPrompt,
		};
	}

	return {
		canCopy: false,
		canEdit: false,
		canRetry: false,
		copyText: null,
		editPrompt: null,
		retryPrompt: null,
	};
}
