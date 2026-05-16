import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConversationSummary, UseConversationsResult } from '../hooks/useConversations.js';
import { HistoryPage } from './HistoryPage.js';

const navigateMock = vi.fn<(path: string) => void>();

vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
	return {
		...actual,
		useNavigate: () => navigateMock,
	};
});

function isoDaysAgo(base: Date, days: number): string {
	const date = new Date(base);
	date.setDate(base.getDate() - days);
	return date.toISOString();
}

function createConversation(input: {
	readonly id: string;
	readonly preview: string;
	readonly title: string;
	readonly updatedAt: string;
}): ConversationSummary {
	return {
		access_role: 'owner',
		conversation_id: input.id,
		created_at: input.updatedAt,
		last_message_at: input.updatedAt,
		last_message_preview: input.preview,
		title: input.title,
		updated_at: input.updatedAt,
	};
}

function createConversations(
	overrides: Partial<UseConversationsResult> = {},
): UseConversationsResult {
	const now = new Date('2026-05-16T10:00:00.000Z');
	const conversations: readonly ConversationSummary[] = [
		createConversation({
			id: 'conversation-today',
			preview: 'Bugünkü özet',
			title: 'Bugün planı',
			updatedAt: isoDaysAgo(now, 0),
		}),
		createConversation({
			id: 'conversation-yesterday',
			preview: 'Dünden kalan not',
			title: 'Dün görevi',
			updatedAt: isoDaysAgo(now, 1),
		}),
		createConversation({
			id: 'conversation-week',
			preview: 'Üç gün önce not',
			title: 'Haftalık gözden geçirme',
			updatedAt: isoDaysAgo(now, 3),
		}),
		createConversation({
			id: 'conversation-older',
			preview: 'On iki gün önce not',
			title: 'Eski kayıt',
			updatedAt: isoDaysAgo(now, 12),
		}),
	];

	return {
		activeConversationId: 'conversation-today',
		activeConversationMembers: [],
		activeConversationMessages: [],
		activeConversationRunSurfaces: [],
		activeConversationSummary: null,
		beginDraftConversation: vi.fn(),
		buildRequestMessages: () => [],
		conversationError: null,
		conversations,
		handleRunAccepted: () => undefined,
		handleRunFinished: () => undefined,
		handleRunFinishing: () => undefined,
		isConversationLoading: false,
		isMemberLoading: false,
		memberError: null,
		removeConversationMember: vi.fn(async () => undefined),
		selectConversation: vi.fn(),
		shareConversationMember: vi.fn(async () => undefined),
		...overrides,
	};
}

function renderHistoryPage(conversations: UseConversationsResult): void {
	render(
		<MemoryRouter>
			<HistoryPage conversations={conversations} />
		</MemoryRouter>,
	);
}

beforeEach(() => {
	navigateMock.mockReset();
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-05-16T10:00:00.000Z'));
});

afterEach(() => {
	vi.useRealTimers();
});

describe('HistoryPage', () => {
	it('shows empty state copy when there are no conversations', () => {
		renderHistoryPage(createConversations({ conversations: [] }));
		expect(screen.getByText('Henüz sohbet yok.')).toBeTruthy();
		expect(screen.getByText(/İlk mesajından sonra sohbetlerin burada\s*görünür\./)).toBeTruthy();
	});

	it('shows all recency groups including yesterday', () => {
		renderHistoryPage(createConversations());
		expect(screen.getByText('Bugün')).toBeTruthy();
		expect(screen.getByText('Dün')).toBeTruthy();
		expect(screen.getByText('Son 7 gün')).toBeTruthy();
		expect(screen.getByText('Daha eski')).toBeTruthy();
	});

	it('supports search in title and preview and shows no-result copy', () => {
		renderHistoryPage(createConversations());
		const searchInput = screen.getByPlaceholderText('Başlık veya önizleme ara');

		fireEvent.change(searchInput, { target: { value: 'haftalık' } });
		expect(screen.getByText('Haftalık gözden geçirme')).toBeTruthy();

		fireEvent.change(searchInput, { target: { value: 'kalan not' } });
		expect(screen.getByText('Dün görevi')).toBeTruthy();

		fireEvent.change(searchInput, { target: { value: 'eslesme-yok' } });
		expect(screen.getByText('Bu aramayla eşleşen sohbet yok.')).toBeTruthy();
	});

	it('sanitizes raw error payloads', () => {
		renderHistoryPage(createConversations({ conversationError: '{"error":"boom"}' }));
		expect(
			screen.getByText('Sohbet geçmişi şu anda yüklenemedi. Biraz sonra yeniden deneyebilirsin.'),
		).toBeTruthy();
		expect(screen.queryByText('{"error":"boom"}')).toBeNull();
	});

	it('opens conversation and navigates to chat', () => {
		const conversations = createConversations();
		renderHistoryPage(conversations);

		fireEvent.click(screen.getByRole('button', { name: /Dün görevi/i }));

		expect(conversations.selectConversation).toHaveBeenCalledWith('conversation-yesterday');
		expect(navigateMock).toHaveBeenCalledWith('/chat');
	});

	it('starts a new conversation and navigates to chat', () => {
		const conversations = createConversations();
		renderHistoryPage(conversations);

		fireEvent.click(screen.getByRole('button', { name: 'Yeni sohbet başlat' }));

		expect(conversations.beginDraftConversation).toHaveBeenCalledTimes(1);
		expect(navigateMock).toHaveBeenCalledWith('/chat');
	});

	it('shows active conversation indicator label', () => {
		renderHistoryPage(createConversations());
		expect(screen.getByText('Açık sohbet')).toBeTruthy();
	});

	it('does not leak forbidden raw/internal strings and contains no mojibake', () => {
		renderHistoryPage(createConversations());
		const bodyText = document.body.textContent ?? '';
		const forbidden = ['conversation_id', 'Internal Server Error', '{"error"', 'trace', 'stack'];
		const mojibake = ['Ã', 'Ä', 'Å', 'â€¢', '�'];

		for (const token of forbidden) {
			expect(bodyText).not.toContain(token);
		}
		for (const token of mojibake) {
			expect(bodyText).not.toContain(token);
		}
	});
});
