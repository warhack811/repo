import type { CSSProperties, ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
	appShellButtonRowStyle,
	appShellMutedTextStyle,
	appShellPanelStyle,
	appShellSecondaryButtonStyle,
	appShellSecondaryLabelStyle,
} from '../components/app/AppShell.js';
import type { ConversationSummary, UseConversationsResult } from '../hooks/useConversations.js';
import { pillStyle } from '../lib/chat-styles.js';

type HistoryPageProps = Readonly<{
	conversations: UseConversationsResult;
}>;

type ConversationGroup = Readonly<{
	items: readonly ConversationSummary[];
	label: string;
}>;

const listStyle: CSSProperties = {
	display: 'grid',
	gap: '12px',
};

const historyItemStyle: CSSProperties = {
	display: 'grid',
	gap: '8px',
	width: '100%',
	textAlign: 'left',
	padding: '14px 16px',
	borderRadius: '18px',
	border: '1px solid rgba(148, 163, 184, 0.16)',
	background: 'rgba(9, 14, 25, 0.68)',
	color: '#f8fafc',
	cursor: 'pointer',
};

const toolbarStyle: CSSProperties = {
	display: 'grid',
	gap: '12px',
	gridTemplateColumns: 'minmax(0, 1fr) auto',
	alignItems: 'end',
};

function formatUpdatedAt(value: string): string {
	const parsed = new Date(value);

	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(parsed);
}

function daysBetween(now: Date, value: string): number {
	const parsed = new Date(value);

	if (Number.isNaN(parsed.getTime())) {
		return Number.POSITIVE_INFINITY;
	}

	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();

	return Math.floor((today - target) / 86_400_000);
}

function groupConversations(
	conversations: readonly ConversationSummary[],
): readonly ConversationGroup[] {
	const now = new Date();
	const today: ConversationSummary[] = [];
	const previousSevenDays: ConversationSummary[] = [];
	const older: ConversationSummary[] = [];

	for (const conversation of conversations) {
		const ageInDays = daysBetween(now, conversation.last_message_at);

		if (ageInDays <= 0) {
			today.push(conversation);
			continue;
		}

		if (ageInDays <= 7) {
			previousSevenDays.push(conversation);
			continue;
		}

		older.push(conversation);
	}

	const groups: ConversationGroup[] = [
		{ items: today, label: 'Bugun' },
		{ items: previousSevenDays, label: 'Son 7 gun' },
		{ items: older, label: 'Daha eski' },
	];

	return groups.filter((group) => group.items.length > 0);
}

function matchesSearch(conversation: ConversationSummary, searchQuery: string): boolean {
	const normalizedSearchQuery = searchQuery.trim().toLowerCase();

	if (normalizedSearchQuery.length === 0) {
		return true;
	}

	return `${conversation.title} ${conversation.last_message_preview}`
		.toLowerCase()
		.includes(normalizedSearchQuery);
}

function getFriendlyErrorMessage(message: string): string {
	const trimmedMessage = message.trim();

	if (trimmedMessage.startsWith('{') || trimmedMessage.includes('Internal Server Error')) {
		return 'Gecmis calismalar su anda yuklenemedi. Biraz sonra yeniden deneyebilirsin.';
	}

	return trimmedMessage;
}

export function HistoryPage({ conversations }: HistoryPageProps): ReactElement {
	const navigate = useNavigate();
	const [searchQuery, setSearchQuery] = useState('');
	const filteredConversations = useMemo(
		() =>
			conversations.conversations.filter((conversation) =>
				matchesSearch(conversation, searchQuery),
			),
		[conversations.conversations, searchQuery],
	);
	const groupedConversations = useMemo(
		() => groupConversations(filteredConversations),
		[filteredConversations],
	);

	function openConversation(conversationId: string): void {
		conversations.selectConversation(conversationId);
		navigate('/chat');
	}

	function startNewConversation(): void {
		conversations.beginDraftConversation();
		navigate('/chat');
	}

	return (
		<>
			<section style={appShellPanelStyle} aria-labelledby="history-heading">
				<div style={{ display: 'grid', gap: '10px' }}>
					<div style={appShellSecondaryLabelStyle}>Gecmis</div>
					<h2 id="history-heading" style={{ margin: 0, fontSize: '24px' }}>
						Kayitli calismalar
					</h2>
					<p style={appShellMutedTextStyle}>
						Runa ile yaptigin sohbetler ve paylasilan calismalar burada kalir. Yeni bir is baslatmak
						icin ana sohbet yuzeyine donebilirsin.
					</p>
				</div>

				<div style={{ ...appShellButtonRowStyle, marginTop: '18px' }}>
					<span style={pillStyle}>{conversations.conversations.length} sohbet</span>
					<button
						type="button"
						onClick={startNewConversation}
						style={appShellSecondaryButtonStyle}
						className="runa-button runa-button--secondary"
					>
						Yeni sohbet baslat
					</button>
				</div>
			</section>

			<section style={appShellPanelStyle} aria-labelledby="history-list-heading">
				<div style={toolbarStyle}>
					<label style={{ display: 'grid', gap: '8px', minWidth: 0 }}>
						<span style={appShellSecondaryLabelStyle}>Ara</span>
						<input
							type="search"
							className="runa-input"
							placeholder="Baslik veya onizleme ara"
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
						/>
					</label>
					<div style={{ ...pillStyle, width: 'fit-content' }}>
						{conversations.isConversationLoading ? 'Yukleniyor' : 'Hazir'}
					</div>
				</div>

				<h2 id="history-list-heading" style={{ margin: '18px 0 12px', fontSize: '20px' }}>
					Sohbet gecmisi
				</h2>

				{conversations.conversationError ? (
					<div className="runa-alert runa-alert--warning" role="alert">
						{getFriendlyErrorMessage(conversations.conversationError)}
					</div>
				) : null}

				{!conversations.isConversationLoading && conversations.conversations.length === 0 ? (
					<div className="runa-empty-state">
						<strong>Henuz kayitli sohbet yok.</strong>
						<div style={{ marginTop: '8px' }}>
							Ilk calismayi baslattiginda gecmis burada aranabilir hale gelecek.
						</div>
					</div>
				) : null}

				{!conversations.isConversationLoading &&
				conversations.conversations.length > 0 &&
				filteredConversations.length === 0 ? (
					<div className="runa-empty-state">Bu aramayla eslesen calisma bulunamadi.</div>
				) : null}

				<div style={listStyle}>
					{groupedConversations.map((group) => (
						<section key={group.label} style={{ display: 'grid', gap: '10px' }}>
							<div style={appShellSecondaryLabelStyle}>{group.label}</div>
							<div style={listStyle}>
								{group.items.map((conversation) => {
									const isActive =
										conversation.conversation_id === conversations.activeConversationId;

									return (
										<button
											key={conversation.conversation_id}
											type="button"
											onClick={() => openConversation(conversation.conversation_id)}
											style={{
												...historyItemStyle,
												border: isActive
													? '1px solid rgba(245, 158, 11, 0.42)'
													: historyItemStyle.border,
											}}
											className="runa-button"
										>
											<div className="runa-conversation-item__top">
												<strong>{conversation.title}</strong>
												<span className="runa-conversation-role">
													{isActive ? 'Acik sohbet' : conversation.access_role}
												</span>
											</div>
											<div className="runa-conversation-preview">
												{conversation.last_message_preview}
											</div>
											<div className="runa-conversation-time">
												{formatUpdatedAt(conversation.last_message_at)}
											</div>
										</button>
									);
								})}
							</div>
						</section>
					))}
				</div>
			</section>
		</>
	);
}
