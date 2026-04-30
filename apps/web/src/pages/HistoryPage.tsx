import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ConversationSummary, UseConversationsResult } from '../hooks/useConversations.js';
import '../styles/routes/history-migration.css';

type HistoryPageProps = Readonly<{
	conversations: UseConversationsResult;
}>;

type ConversationGroup = Readonly<{
	items: readonly ConversationSummary[];
	label: string;
}>;

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
		{ items: today, label: 'Bugün' },
		{ items: previousSevenDays, label: 'Son 7 gün' },
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
	void trimmedMessage;

	return 'Geçmiş çalışmalar şu anda yüklenemedi. Biraz sonra yeniden deneyebilirsin.';
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
			<section className="runa-migrated-pages-historypage-1" aria-labelledby="history-heading">
				<div className="runa-migrated-pages-historypage-2">
					<div className="runa-migrated-pages-historypage-3">Geçmiş</div>
					<h2 id="history-heading" className="runa-migrated-pages-historypage-4">
						Sohbet geçmişi
					</h2>
					<p className="runa-migrated-pages-historypage-5">
						Sohbetleri arayabilir, kaldığın işe geri dönebilirsin.
					</p>
				</div>

				<div className="runa-migrated-pages-historypage-6">
					<button
						type="button"
						onClick={startNewConversation}
						className="runa-button runa-button--secondary runa-migrated-pages-historypage-8"
					>
						Yeni sohbet başlat
					</button>
				</div>
			</section>

			<section className="runa-migrated-pages-historypage-9" aria-labelledby="history-list-heading">
				<div className="runa-migrated-pages-historypage-10">
					<label className="runa-migrated-pages-historypage-11">
						<span className="runa-migrated-pages-historypage-12">Ara</span>
						<input
							type="search"
							className="runa-input"
							placeholder="Başlık veya önizleme ara"
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
						/>
					</label>
					{conversations.isConversationLoading ? (
						<div className="runa-migrated-pages-historypage-13">Yükleniyor</div>
					) : null}
				</div>

				<h2 id="history-list-heading" className="runa-migrated-pages-historypage-14">
					Sohbet geçmişi
				</h2>

				{conversations.conversationError ? (
					<div className="runa-alert runa-alert--warning" role="alert">
						{getFriendlyErrorMessage(conversations.conversationError)}
					</div>
				) : null}

				{!conversations.isConversationLoading && conversations.conversations.length === 0 ? (
					<div className="runa-empty-state">
						<strong>Henüz kayıtlı sohbet yok.</strong>
						<div className="runa-migrated-pages-historypage-15">
							İlk sohbetinden sonra geçmiş listen hazır olur.
						</div>
					</div>
				) : null}

				{!conversations.isConversationLoading &&
				conversations.conversations.length > 0 &&
				filteredConversations.length === 0 ? (
					<div className="runa-empty-state">Bu aramayla eşleşen çalışma bulunamadı.</div>
				) : null}

				<div className="runa-migrated-pages-historypage-16">
					{groupedConversations.map((group) => (
						<section key={group.label} className="runa-migrated-pages-historypage-17">
							<div className="runa-migrated-pages-historypage-18">{group.label}</div>
							<div className="runa-migrated-pages-historypage-19">
								{group.items.map((conversation) => {
									const isActive =
										conversation.conversation_id === conversations.activeConversationId;

									return (
										<button
											key={conversation.conversation_id}
											type="button"
											onClick={() => openConversation(conversation.conversation_id)}
											className="runa-button runa-migrated-pages-historypage-20"
										>
											<div className="runa-conversation-item__top">
												<strong>{conversation.title}</strong>
												{isActive ? (
													<span className="runa-conversation-role">Açık sohbet</span>
												) : null}
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
