import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ConversationMessage } from '../../hooks/useConversations.js';
import { MessageActionBar } from './MessageActionBar.js';
import type { MessageActionModel } from './messageActions.js';

function makeMessage(
	overrides: Partial<ConversationMessage> & { role: ConversationMessage['role'] },
): ConversationMessage {
	return {
		content: 'test content',
		conversation_id: 'conv-1',
		created_at: '2026-05-15T10:00:00Z',
		message_id: 'msg-1',
		sequence_no: 1,
		...overrides,
	};
}

function makeModel(overrides: Partial<MessageActionModel> = {}): MessageActionModel {
	return {
		canCopy: false,
		canEdit: false,
		canRetry: false,
		copyText: null,
		editPrompt: null,
		retryPrompt: null,
		...overrides,
	};
}

describe('MessageActionBar', () => {
	it('renders copy button when canCopy is true', () => {
		const message = makeMessage({ role: 'user' });
		const model = makeModel({ canCopy: true, copyText: 'hello' });
		render(<MessageActionBar actionModel={model} message={message} onPreparePrompt={vi.fn()} />);
		expect(screen.getByText('Kopyala')).toBeTruthy();
	});

	it('shows success state after copy', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.assign(navigator, { clipboard: { writeText } });

		const message = makeMessage({ role: 'user' });
		const model = makeModel({ canCopy: true, copyText: 'hello' });
		render(<MessageActionBar actionModel={model} message={message} onPreparePrompt={vi.fn()} />);

		fireEvent.click(screen.getByText('Kopyala'));
		await vi.waitFor(() => {
			expect(screen.getByText('Kopyalandı')).toBeTruthy();
		});
	});

	it('shows error state when copy fails', async () => {
		const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'));
		Object.assign(navigator, { clipboard: { writeText } });

		const message = makeMessage({ role: 'user' });
		const model = makeModel({ canCopy: true, copyText: 'hello' });
		render(<MessageActionBar actionModel={model} message={message} onPreparePrompt={vi.fn()} />);

		fireEvent.click(screen.getByText('Kopyala'));
		await vi.waitFor(() => {
			expect(screen.getByText('Kopyalanamadı')).toBeTruthy();
		});
	});

	it('calls onPreparePrompt with edit reason when Düzenle clicked', () => {
		const onPreparePrompt = vi.fn();

		const message = makeMessage({ role: 'user', message_id: 'u1' });
		const model = makeModel({ canEdit: true, editPrompt: 'edit me' });
		render(
			<MessageActionBar actionModel={model} message={message} onPreparePrompt={onPreparePrompt} />,
		);

		fireEvent.click(screen.getByText('Düzenle'));
		expect(onPreparePrompt).toHaveBeenCalledWith({
			prompt: 'edit me',
			reason: 'edit',
			sourceMessageId: 'u1',
		});
	});

	it('calls onPreparePrompt with retry reason when Tekrar dene clicked', () => {
		const onPreparePrompt = vi.fn();

		const message = makeMessage({ role: 'assistant', message_id: 'a1' });
		const model = makeModel({ canRetry: true, retryPrompt: 'retry me' });
		render(
			<MessageActionBar actionModel={model} message={message} onPreparePrompt={onPreparePrompt} />,
		);

		fireEvent.click(screen.getByText('Tekrar dene'));
		expect(onPreparePrompt).toHaveBeenCalledWith({
			prompt: 'retry me',
			reason: 'retry',
			sourceMessageId: 'a1',
		});
	});

	it('returns null when no actions available', () => {
		const message = makeMessage({ role: 'system' });
		const model = makeModel();
		const { container } = render(
			<MessageActionBar actionModel={model} message={message} onPreparePrompt={vi.fn()} />,
		);
		expect(container.innerHTML).toBe('');
	});

	it('preserves hook order across conditional render', () => {
		const message = makeMessage({ role: 'user' });
		const { container, rerender } = render(
			<MessageActionBar actionModel={makeModel()} message={message} onPreparePrompt={vi.fn()} />,
		);

		expect(container.innerHTML).toBe('');

		rerender(
			<MessageActionBar
				actionModel={makeModel({ canCopy: true, copyText: 'hello' })}
				message={message}
				onPreparePrompt={vi.fn()}
			/>,
		);

		expect(screen.getByText('Kopyala')).toBeTruthy();
	});

	it('handles clipboard unavailable gracefully', async () => {
		const originalClipboard = navigator.clipboard;
		Object.assign(navigator, { clipboard: undefined });

		const message = makeMessage({ role: 'user' });
		const model = makeModel({ canCopy: true, copyText: 'hello' });
		render(<MessageActionBar actionModel={model} message={message} onPreparePrompt={vi.fn()} />);

		fireEvent.click(screen.getByText('Kopyala'));
		await vi.waitFor(() => {
			expect(screen.getByText('Kopyalanamadı')).toBeTruthy();
		});

		Object.assign(navigator, { clipboard: originalClipboard });
	});

	it('does not contain forbidden technical strings', () => {
		const message = makeMessage({
			role: 'user',
			message_id: 'msg-123',
			run_id: 'run-456',
			trace_id: 'trace-789',
		});
		const model = makeModel({
			canCopy: true,
			canEdit: true,
			canRetry: true,
			copyText: 'test',
			editPrompt: 'test',
			retryPrompt: 'test',
		});
		render(<MessageActionBar actionModel={model} message={message} onPreparePrompt={vi.fn()} />);

		const body = document.body;
		const forbidden = ['message_id', 'run_id', 'trace_id', 'metadata', 'protocol', 'backend'];
		for (const term of forbidden) {
			expect(body.textContent).not.toContain(term);
		}
	});
});
