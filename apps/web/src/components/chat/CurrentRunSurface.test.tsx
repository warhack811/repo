import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ConversationMessage } from '../../hooks/useConversations.js';
import type { ChatStore } from '../../stores/chat-store.js';
import { CurrentRunSurface } from './CurrentRunSurface.js';

function createMockStore(): ChatStore {
	return {
		getState: () => ({
			presentation: {
				currentStreamingRunId: null,
				currentStreamingText: '',
			},
		}),
		setConnectionState: vi.fn(),
		setPresentationState: vi.fn(),
		setTransportState: vi.fn(),
		setRuntimeConfigState: vi.fn(),
		subscribe: vi.fn(),
	} as unknown as ChatStore;
}

function makeMessage(
	overrides: Partial<ConversationMessage> & { role: ConversationMessage['role'] },
	index = 0,
): ConversationMessage {
	return {
		content: 'test content',
		conversation_id: 'conv-1',
		created_at: new Date(`2026-05-15T10:0${index}:00Z`).toISOString(),
		message_id: `msg-${index}`,
		sequence_no: index + 1,
		...overrides,
	};
}

describe('CurrentRunSurface', () => {
	it('passes onPreparePrompt to PersistedTranscript', () => {
		const onPreparePrompt = vi.fn();
		const messages: readonly ConversationMessage[] = [
			makeMessage({ role: 'user', content: 'hello', message_id: 'msg-0' }, 0),
		];

		render(
			<CurrentRunSurface
				activeConversationId="conv-1"
				activeConversationMessages={messages}
				currentPresentationContent={null}
				currentRunId={undefined}
				emptyStateContent={null}
				store={createMockStore()}
				onPreparePrompt={onPreparePrompt}
			/>,
		);

		expect(screen.getByText('Düzenle')).toBeTruthy();
	});

	it('hides retry when isRunning is true', () => {
		const messages: readonly ConversationMessage[] = [
			makeMessage({ role: 'user', content: 'prompt', message_id: 'msg-0' }, 0),
			makeMessage({ role: 'assistant', content: 'reply', message_id: 'msg-1' }, 1),
		];

		render(
			<CurrentRunSurface
				activeConversationId="conv-1"
				activeConversationMessages={messages}
				currentPresentationContent={null}
				currentRunId={undefined}
				emptyStateContent={null}
				isRunning={true}
				store={createMockStore()}
			/>,
		);

		expect(screen.queryByText('Tekrar dene')).toBeNull();
	});
});
