import type { ReactNode } from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import '../../src/styles/index.css';
import { ConversationSidebar } from '../../src/components/chat/ConversationSidebar.js';
import type { ConversationSummary, UseConversationsResult } from '../../src/hooks/useConversations.js';
import { HistoryPage } from '../../src/pages/HistoryPage.js';

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

function createConversations(baseDate: Date = new Date()): readonly ConversationSummary[] {
	const now = new Date(baseDate);
	now.setHours(12, 0, 0, 0);
	return [
		createConversation({
			id: 'conversation-today',
			preview: 'Bugünkü plan notu',
			title: 'Bugün planı',
			updatedAt: isoDaysAgo(now, 0),
		}),
		createConversation({
			id: 'conversation-yesterday',
			preview: 'Dünden kalan görevler',
			title: 'Dün görevleri',
			updatedAt: isoDaysAgo(now, 1),
		}),
		createConversation({
			id: 'conversation-week',
			preview: 'Üç gün önceki özet',
			title: 'Haftalık gözden geçirme',
			updatedAt: isoDaysAgo(now, 3),
		}),
		createConversation({
			id: 'conversation-older',
			preview: 'On iki gün önceki not',
			title: 'Eski kayıt',
			updatedAt: isoDaysAgo(now, 12),
		}),
	];
}

const conversations = createConversations();

function createUseConversationsResult(input?: {
	readonly conversationError?: string | null;
	readonly conversations?: readonly ConversationSummary[];
}): UseConversationsResult {
	return {
		activeConversationId: 'conversation-yesterday',
		activeConversationMembers: [],
		activeConversationMessages: [],
		activeConversationRunSurfaces: [],
		activeConversationSummary: null,
		beginDraftConversation: () => undefined,
		buildRequestMessages: () => [],
		conversationError: input?.conversationError ?? null,
		conversations: input?.conversations ?? conversations,
		handleRunAccepted: () => undefined,
		handleRunFinished: () => undefined,
		handleRunFinishing: () => undefined,
		isConversationLoading: false,
		isMemberLoading: false,
		memberError: null,
		removeConversationMember: async () => undefined,
		selectConversation: () => undefined,
		shareConversationMember: async () => undefined,
	};
}

function Section(props: { children: ReactNode; label: string; testId: string }): ReactNode {
	return (
		<section
			aria-label={props.label}
			data-testid={props.testId}
			style={{
				border: '1px solid color-mix(in srgb, var(--ink-1) 14%, transparent)',
				borderRadius: 12,
				display: 'grid',
				gap: 10,
				marginBottom: 14,
				padding: 12,
			}}
		>
			<h2
				style={{
					fontSize: 14,
					fontWeight: 600,
					margin: 0,
				}}
			>
				{props.label}
			</h2>
			{props.children}
		</section>
	);
}

function Fixture(): ReactNode {
	return (
		<main className="runa-page runa-page--chat-product">
			<div style={{ margin: '0 auto', maxWidth: 980, padding: 12 }}>
				<Section label="Sidebar parity state" testId="sidebar-parity-state">
					<MemoryRouter>
						<ConversationSidebar
							activeConversationId="conversation-yesterday"
							activeConversationMembers={[]}
							activeConversationSummary={conversations[0] ?? null}
							conversationError={null}
							conversations={conversations}
							isLoading={false}
							isMemberLoading={false}
							memberError={null}
							onRemoveMember={async () => undefined}
							onSelectConversation={() => undefined}
							onShareMember={async () => undefined}
							onStartNewConversation={() => undefined}
							presentation="embedded"
						/>
					</MemoryRouter>
				</Section>

				<Section label="History page parity state" testId="history-parity-state">
					<MemoryRouter>
						<HistoryPage conversations={createUseConversationsResult()} />
					</MemoryRouter>
				</Section>

				<Section label="History error recovery state" testId="history-error-state">
					<MemoryRouter>
						<ConversationSidebar
							activeConversationId={null}
							activeConversationMembers={[]}
							activeConversationSummary={null}
							conversationError='{"error":"boom"}'
							conversations={conversations}
							isLoading={false}
							isMemberLoading={false}
							memberError={null}
							onRemoveMember={async () => undefined}
							onSelectConversation={() => undefined}
							onShareMember={async () => undefined}
							onStartNewConversation={() => undefined}
							presentation="embedded"
						/>
					</MemoryRouter>
				</Section>

				<Section label="History empty state" testId="history-empty-state">
					<MemoryRouter>
						<HistoryPage conversations={createUseConversationsResult({ conversations: [] })} />
					</MemoryRouter>
				</Section>
			</div>
		</main>
	);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
	throw new Error('Fixture root element is missing.');
}

createRoot(rootElement).render(
	<StrictMode>
		<Fixture />
	</StrictMode>,
);
