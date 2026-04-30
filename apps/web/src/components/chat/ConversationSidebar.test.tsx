import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { ConversationSummary } from '../../hooks/useConversations.js';
import { ConversationSidebar } from './ConversationSidebar.js';

const conversations: readonly ConversationSummary[] = [
	{
		access_role: 'owner',
		conversation_id: 'conv_today',
		created_at: '2026-04-25T12:00:00.000Z',
		last_message_at: new Date().toISOString(),
		last_message_preview: 'Continue the sidebar phase',
		title: 'UI Phase 6',
		updated_at: '2026-04-25T12:00:00.000Z',
	},
	{
		access_role: 'viewer',
		conversation_id: 'conv_old',
		created_at: '2024-01-01T10:00:00.000Z',
		last_message_at: '2024-01-01T10:00:00.000Z',
		last_message_preview: 'Older context',
		title: 'Archive',
		updated_at: '2024-01-01T10:00:00.000Z',
	},
];

function renderSidebar(input?: {
	readonly conversationError?: string | null;
	readonly searchConversationList?: readonly ConversationSummary[];
}): string {
	return renderToStaticMarkup(
		<MemoryRouter>
			<ConversationSidebar
				activeConversationId="conv_today"
				activeConversationMembers={[]}
				activeConversationSummary={conversations[0] ?? null}
				conversationError={input?.conversationError ?? null}
				conversations={input?.searchConversationList ?? conversations}
				isLoading={false}
				isMemberLoading={false}
				isOpen
				memberError={null}
				onRemoveMember={async () => undefined}
				onSelectConversation={() => undefined}
				onShareMember={async () => undefined}
				onStartNewConversation={() => undefined}
			/>
		</MemoryRouter>,
	);
}

describe('ConversationSidebar', () => {
	it('renders grouped conversations with new chat and settings affordances', () => {
		const markup = renderSidebar();

		expect(markup).toContain('Yeni sohbet');
		expect(markup).toContain('Bugün');
		expect(markup).toContain('Daha eski');
		expect(markup).toContain('UI Phase 6');
		expect(markup).toContain('Hesap ve ayarlar');
	});

	it('keeps member sharing in a secondary details section', () => {
		const markup = renderSidebar();

		expect(markup).toContain('<details');
		expect(markup).toContain('Üyeler - Sahip');
		expect(markup).toContain('üye bilgisi');
	});

	it('softens raw server errors before showing them in the sidebar', () => {
		const markup = renderSidebar({
			conversationError:
				'{"statusCode":500,"error":"Internal Server Error","message":"Failed to list conversations."}',
		});

		expect(markup).toContain('Sohbet geçmişi şu anda yüklenemedi');
		expect(markup).not.toContain('Internal Server Error');
		expect(markup).not.toContain('statusCode');
	});
});
