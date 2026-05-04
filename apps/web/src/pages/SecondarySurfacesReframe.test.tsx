import type { AuthContext } from '@runa/types';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { UseConversationsResult } from '../hooks/useConversations.js';
import { DevicesPage } from './DevicesPage.js';
import { HistoryPage } from './HistoryPage.js';
import { SettingsPage } from './SettingsPage.js';

const now = '2026-04-30T10:00:00.000Z';

const authContext: AuthContext = {
	claims: {
		email: 'person@example.com',
		email_verified: true,
		role: 'authenticated',
		scope: {},
		sub: 'user_normal',
	},
	principal: {
		email: 'person@example.com',
		kind: 'authenticated',
		provider: 'internal',
		role: 'authenticated',
		scope: {},
		user_id: 'user_normal',
	},
	transport: 'http',
	user: {
		email: 'person@example.com',
		email_verified: true,
		identities: [],
		primary_provider: 'internal',
		scope: {},
		status: 'active',
		user_id: 'user_normal',
	},
};

function createConversations(
	override: Partial<UseConversationsResult> = {},
): UseConversationsResult {
	return {
		activeConversationId: 'conversation_1',
		activeConversationMembers: [],
		activeConversationMessages: [],
		activeConversationRunSurfaces: [],
		activeConversationSummary: null,
		beginDraftConversation: () => undefined,
		buildRequestMessages: () => [],
		conversationError: null,
		conversations: [
			{
				access_role: 'owner',
				conversation_id: 'conversation_1',
				created_at: now,
				last_message_at: now,
				last_message_preview: 'Dosya taslağını hazırladık.',
				title: 'Proje notları',
				updated_at: now,
			},
		],
		handleRunAccepted: () => undefined,
		handleRunFinished: () => undefined,
		isConversationLoading: false,
		isMemberLoading: false,
		memberError: null,
		removeConversationMember: async () => undefined,
		selectConversation: () => undefined,
		shareConversationMember: async () => undefined,
		...override,
	};
}

function renderHistory(conversations: UseConversationsResult): string {
	return renderToStaticMarkup(
		<MemoryRouter>
			<HistoryPage conversations={conversations} />
		</MemoryRouter>,
	);
}

describe('secondary surfaces reframe', () => {
	it('keeps history as a simple searchable conversation list without access-role leakage', () => {
		const markup = renderHistory(createConversations());

		expect(markup).toContain('Sohbet geçmişi');
		expect(markup).toContain('Proje notları');
		expect(markup).toContain('Dosya taslağını hazırladık.');
		expect(markup).not.toContain('owner');
		expect(markup).not.toContain('editor');
		expect(markup).not.toContain('viewer');
		expect(markup).not.toContain('Desteklenmeyen');
	});

	it('shows friendly history empty and error states without raw debug text', () => {
		const emptyMarkup = renderHistory(createConversations({ conversations: [] }));
		const errorMarkup = renderHistory(
			createConversations({
				conversationError: 'Desteklenmeyen conversation list yaniti.',
				conversations: [],
			}),
		);

		expect(emptyMarkup).toContain('Henüz kayıtlı sohbet yok.');
		expect(errorMarkup).toContain('Geçmiş çalışmalar şu anda yüklenemedi.');
		expect(errorMarkup).not.toContain('Desteklenmeyen conversation list yaniti');
	});

	it('keeps account settings short and free of internal entry points', () => {
		const markup = renderToStaticMarkup(
			<MemoryRouter>
				<SettingsPage
					authContext={authContext}
					authError={null}
					isAuthPending={false}
					onLogout={async () => undefined}
				/>
			</MemoryRouter>,
		);

		expect(markup).toContain('Hesap');
		expect(markup).toContain('Tercihler');
		expect(markup).toContain('person@example.com');
		expect(markup).toContain('runa-button--danger');
		expect(markup).not.toContain('Developer');
		expect(markup).not.toContain('Project Memory');
		expect(markup).not.toContain('dev@runa.local');
	});

	it('keeps devices on one connection story surface', () => {
		const markup = renderToStaticMarkup(<DevicesPage accessToken={null} />);

		expect(markup).toContain('Bağlı bilgisayar');
		expect(markup).toContain('Bilgisayar bağlantısı');
		expect(markup).not.toContain('Connection ');
		expect(markup).not.toContain('desktop.screenshot');
		expect(markup).not.toContain('Developer');
	});
});
