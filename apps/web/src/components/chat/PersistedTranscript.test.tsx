import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ConversationMessage } from '../../hooks/useConversations.js';
import { PersistedTranscript } from './PersistedTranscript.js';

function makeMessage(
	overrides: Partial<ConversationMessage> & {
		role: ConversationMessage['role'];
	},
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

describe('PersistedTranscript', () => {
	it('renders user and assistant messages', () => {
		const messages: readonly ConversationMessage[] = [
			makeMessage({ role: 'user', content: 'hello', message_id: 'msg-0' }, 0),
			makeMessage({ role: 'assistant', content: 'world', message_id: 'msg-1' }, 1),
		];
		render(
			<PersistedTranscript
				activeConversationId="conv-1"
				activeConversationMessages={messages}
				onPreparePrompt={vi.fn()}
			/>,
		);
		expect(screen.getByText('hello')).toBeTruthy();
		expect(screen.getByText('world')).toBeTruthy();
	});

	it('shows copy action for assistant message', () => {
		const messages: readonly ConversationMessage[] = [
			makeMessage({ role: 'user', content: 'hi', message_id: 'msg-0' }, 0),
			makeMessage({ role: 'assistant', content: 'reply', message_id: 'msg-1' }, 1),
		];
		render(
			<PersistedTranscript
				activeConversationId="conv-1"
				activeConversationMessages={messages}
				onPreparePrompt={vi.fn()}
			/>,
		);
		const copyButtons = screen.getAllByText('Kopyala');
		expect(copyButtons.length).toBeGreaterThanOrEqual(1);
	});

	it('shows edit action for user message', () => {
		const messages: readonly ConversationMessage[] = [
			makeMessage({ role: 'user', content: 'edit me', message_id: 'msg-0' }, 0),
		];
		const { container } = render(
			<PersistedTranscript
				activeConversationId="conv-1"
				activeConversationMessages={messages}
				onPreparePrompt={vi.fn()}
			/>,
		);
		expect(container.textContent).toContain('Düzenle');
	});

	it('shows retry for latest assistant with previous user', () => {
		const messages: readonly ConversationMessage[] = [
			makeMessage({ role: 'user', content: 'prompt', message_id: 'msg-0' }, 0),
			makeMessage({ role: 'assistant', content: 'reply', message_id: 'msg-1' }, 1),
		];
		render(
			<PersistedTranscript
				activeConversationId="conv-1"
				activeConversationMessages={messages}
				onPreparePrompt={vi.fn()}
			/>,
		);
		const retryButtons = screen.getAllByText('Tekrar dene');
		expect(retryButtons.length).toBeGreaterThanOrEqual(1);
	});

	it('hides retry when running', () => {
		const messages: readonly ConversationMessage[] = [
			makeMessage({ role: 'user', content: 'prompt', message_id: 'msg-0' }, 0),
			makeMessage({ role: 'assistant', content: 'reply', message_id: 'msg-1' }, 1),
		];
		const { container } = render(
			<PersistedTranscript
				activeConversationId="conv-1"
				activeConversationMessages={messages}
				isRunning={true}
				onPreparePrompt={vi.fn()}
			/>,
		);
		expect(container.textContent).not.toContain('Tekrar dene');
	});

	it('does not render actions for system messages', () => {
		const messages: readonly ConversationMessage[] = [
			makeMessage({ role: 'system', content: 'system prompt', message_id: 'msg-0' }, 0),
		];
		const { container } = render(
			<PersistedTranscript
				activeConversationId="conv-1"
				activeConversationMessages={messages}
				onPreparePrompt={vi.fn()}
			/>,
		);
		expect(container.textContent).not.toContain('Kopyala');
		expect(container.textContent).not.toContain('Düzenle');
		expect(container.textContent).not.toContain('Tekrar dene');
	});

	it('does not leak raw IDs', () => {
		const messages: readonly ConversationMessage[] = [
			makeMessage(
				{
					role: 'user',
					content: 'hello',
					message_id: 'msg-user-1',
					run_id: 'run-1',
					trace_id: 'trace-1',
				},
				0,
			),
			makeMessage(
				{
					role: 'assistant',
					content: 'world',
					message_id: 'msg-assistant-1',
					run_id: 'run-1',
					trace_id: 'trace-1',
				},
				1,
			),
		];
		const { container } = render(
			<PersistedTranscript
				activeConversationId="conv-1"
				activeConversationMessages={messages}
				onPreparePrompt={vi.fn()}
			/>,
		);
		const forbidden = ['message_id', 'run_id', 'trace_id', 'metadata', 'protocol', 'backend'];
		for (const term of forbidden) {
			expect(container.textContent).not.toContain(term);
		}
	});

	it('shows empty state for draft conversation', () => {
		render(<PersistedTranscript activeConversationId={null} activeConversationMessages={[]} />);
		expect(screen.getByText('Yeni bir sohbet hazır.')).toBeTruthy();
	});
});
