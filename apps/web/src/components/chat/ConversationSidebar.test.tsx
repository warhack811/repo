import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConversationMember, ConversationSummary } from '../../hooks/useConversations.js';
import { ConversationSidebar } from './ConversationSidebar.js';

function isoDaysAgo(base: Date, days: number): string {
	const date = new Date(base);
	date.setDate(base.getDate() - days);
	return date.toISOString();
}

function createConversation(input: {
	readonly id: string;
	readonly preview: string;
	readonly role?: ConversationSummary['access_role'];
	readonly title: string;
	readonly updatedAt: string;
}): ConversationSummary {
	return {
		access_role: input.role ?? 'owner',
		conversation_id: input.id,
		created_at: input.updatedAt,
		last_message_at: input.updatedAt,
		last_message_preview: input.preview,
		title: input.title,
		updated_at: input.updatedAt,
	};
}

function createMember(
	memberUserId: string,
	role: ConversationMember['member_role'],
): ConversationMember {
	const now = '2026-05-16T10:00:00.000Z';
	return {
		conversation_id: 'conversation-today',
		created_at: now,
		member_role: role,
		member_user_id: memberUserId,
		updated_at: now,
	};
}

function renderSidebar(overrides: Partial<ComponentProps<typeof ConversationSidebar>> = {}) {
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

	const props: ComponentProps<typeof ConversationSidebar> = {
		activeConversationId: 'conversation-today',
		activeConversationMembers: [createMember('member-user-1', 'editor')],
		activeConversationSummary: conversations[0] ?? null,
		conversationError: null,
		conversations,
		isLoading: false,
		isMemberLoading: false,
		isOpen: true,
		memberError: null,
		onClose: vi.fn(),
		onRemoveMember: vi.fn(async () => undefined),
		onSelectConversation: vi.fn(),
		onShareMember: vi.fn(async () => undefined),
		onStartNewConversation: vi.fn(),
		presentation: 'drawer',
		...overrides,
	};

	render(
		<MemoryRouter>
			<ConversationSidebar {...props} />
		</MemoryRouter>,
	);

	return props;
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-05-16T10:00:00.000Z'));
});

afterEach(() => {
	vi.useRealTimers();
});

describe('ConversationSidebar', () => {
	it('shows loading state copy', () => {
		renderSidebar({ conversations: [], isLoading: true });
		expect(screen.getByLabelText('Sohbet listesi yükleniyor')).toBeTruthy();
	});

	it('shows empty state copy for no conversations', () => {
		renderSidebar({ conversations: [] });
		expect(screen.getByText('Henüz sohbet yok.')).toBeTruthy();
		expect(screen.getByText(/İlk mesajından sonra sohbetlerin burada\s*görünür\./)).toBeTruthy();
	});

	it('shows all expected recency groups', () => {
		renderSidebar();
		expect(screen.getByText('Bugün')).toBeTruthy();
		expect(screen.getByText('Dün')).toBeTruthy();
		expect(screen.getByText('Son 7 gün')).toBeTruthy();
		expect(screen.getByText('Daha eski')).toBeTruthy();
	});

	it('supports search by title and preview and shows no-result copy', () => {
		renderSidebar();
		const searchInput = screen.getByPlaceholderText('Başlık veya önizleme ara');

		fireEvent.change(searchInput, { target: { value: 'haftalık' } });
		expect(screen.getByText('Haftalık gözden geçirme')).toBeTruthy();

		fireEvent.change(searchInput, { target: { value: 'kalan not' } });
		expect(screen.getByText('Dün görevi')).toBeTruthy();

		fireEvent.change(searchInput, { target: { value: 'sonuc-yok' } });
		expect(screen.getByText('Bu aramayla eşleşen sohbet yok.')).toBeTruthy();
		expect(screen.getByText('Farklı bir başlık veya önizleme deneyebilirsin.')).toBeTruthy();
	});

	it('selects conversation and closes drawer', () => {
		const props = renderSidebar();

		fireEvent.click(screen.getByRole('button', { name: /Dün görevi/i }));

		expect(props.onSelectConversation).toHaveBeenCalledWith('conversation-yesterday');
		expect(props.onClose).toHaveBeenCalledTimes(1);
	});

	it('starts new conversation from button', () => {
		const props = renderSidebar();
		fireEvent.click(screen.getByRole('button', { name: 'Yeni sohbet' }));
		expect(props.onStartNewConversation).toHaveBeenCalledTimes(1);
	});

	it('sanitizes internal server error in conversation list surface', () => {
		renderSidebar({ conversationError: 'Internal Server Error' });
		expect(
			screen.getByText('Sohbet geçmişi şu anda yüklenemedi. Biraz sonra yeniden deneyebilirsin.'),
		).toBeTruthy();
		expect(screen.queryByText('Internal Server Error')).toBeNull();
	});

	it('keeps owner member controls visible as behavior smoke', () => {
		renderSidebar({
			activeConversationSummary: createConversation({
				id: 'conversation-today',
				preview: 'Bugünkü özet',
				role: 'owner',
				title: 'Bugün planı',
				updatedAt: '2026-05-16T08:00:00.000Z',
			}),
		});

		fireEvent.click(screen.getByText('Üyeler - Sahip'));

		expect(screen.getByPlaceholderText('Üye bilgisi')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Üye ekle veya güncelle' })).toBeTruthy();
	});

	it('does not leak forbidden raw/internal strings or mojibake in normal list output', () => {
		renderSidebar();
		const bodyText = document.body.textContent ?? '';

		const forbidden = ['conversation_id', 'Internal Server Error', '{"error"'];
		const mojibake = ['Ã', 'Ä', 'Å', 'â€¢', '�'];

		for (const token of forbidden) {
			expect(bodyText).not.toContain(token);
		}

		for (const token of mojibake) {
			expect(bodyText).not.toContain(token);
		}
	});
});
