import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	formatConversationUpdatedAt,
	getConversationEmptyStateCopy,
	getConversationHistoryErrorMessage,
	groupConversationsByRecency,
	matchesConversationSearch,
} from '../components/chat/conversationHistoryDisplay.js';
import type { UseConversationsResult } from '../hooks/useConversations.js';

type HistoryPageProps = Readonly<{
	conversations: UseConversationsResult;
}>;

export function HistoryPage({ conversations }: HistoryPageProps): ReactElement {
	const navigate = useNavigate();
	const [searchQuery, setSearchQuery] = useState('');
	const filteredConversations = useMemo(
		() =>
			conversations.conversations.filter((conversation) =>
				matchesConversationSearch(conversation, searchQuery),
			),
		[conversations.conversations, searchQuery],
	);
	const groupedConversations = useMemo(
		() => groupConversationsByRecency(filteredConversations),
		[filteredConversations],
	);
	const conversationErrorMessage = getConversationHistoryErrorMessage(
		conversations.conversationError,
	);
	const emptyConversationCopy = getConversationEmptyStateCopy({
		hasConversations: conversations.conversations.length > 0,
		isSearchActive: false,
		surface: 'history-page',
	});
	const emptySearchCopy = getConversationEmptyStateCopy({
		hasConversations: conversations.conversations.length > 0,
		isSearchActive: true,
		surface: 'history-page',
	});

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
			<section className="runa-page-historypage-1" aria-labelledby="history-heading">
				<div className="runa-page-historypage-2">
					<div className="runa-page-historypage-3">Geçmiş</div>
					<h2 id="history-heading" className="runa-page-historypage-4">
						Sohbet geçmişi
					</h2>
					<p className="runa-page-historypage-5">
						Sohbetleri arayabilir, kaldığın işe geri dönebilirsin.
					</p>
				</div>

				<div className="runa-page-historypage-6">
					<button
						type="button"
						onClick={startNewConversation}
						className="runa-button runa-button--secondary runa-page-historypage-8"
					>
						Yeni sohbet başlat
					</button>
				</div>
			</section>

			<section className="runa-page-historypage-9" aria-labelledby="history-list-heading">
				<div className="runa-page-historypage-10">
					<label className="runa-page-historypage-11">
						<span className="runa-page-historypage-12">Ara</span>
						<input
							type="search"
							className="runa-input"
							placeholder="Başlık veya önizleme ara"
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
						/>
					</label>
					{conversations.isConversationLoading ? (
						<div className="runa-page-historypage-13">Sohbet listesi yükleniyor</div>
					) : null}
				</div>

				<h2 id="history-list-heading" className="runa-page-historypage-14">
					Sohbet geçmişi
				</h2>

				{conversationErrorMessage ? (
					<div className="runa-alert runa-alert--warning" role="alert">
						{conversationErrorMessage}
						<span className="runa-sr-only">
							Geçmiş çalışmalar şu anda yüklenemedi. Biraz sonra yeniden deneyebilirsin.
						</span>
					</div>
				) : null}

				{!conversations.isConversationLoading && conversations.conversations.length === 0 ? (
					<div className="runa-empty-state">
						<strong>{emptyConversationCopy.title}</strong>
						{emptyConversationCopy.description ? (
							<div className="runa-page-historypage-15">{emptyConversationCopy.description}</div>
						) : null}
						<span className="runa-sr-only">Henüz kayıtlı sohbet yok.</span>
					</div>
				) : null}

				{!conversations.isConversationLoading &&
				conversations.conversations.length > 0 &&
				filteredConversations.length === 0 ? (
					<div className="runa-empty-state">
						<strong>{emptySearchCopy.title}</strong>
						{emptySearchCopy.description ? (
							<div className="runa-page-historypage-15">{emptySearchCopy.description}</div>
						) : null}
					</div>
				) : null}

				<div className="runa-page-historypage-16">
					{groupedConversations.map((group) => (
						<section key={group.label} className="runa-page-historypage-17">
							<div className="runa-page-historypage-18">{group.label}</div>
							<div className="runa-page-historypage-19">
								{group.items.map((conversation) => {
									const isActive =
										conversation.conversation_id === conversations.activeConversationId;

									return (
										<button
											key={conversation.conversation_id}
											type="button"
											onClick={() => openConversation(conversation.conversation_id)}
											className="runa-button runa-page-historypage-20"
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
												{formatConversationUpdatedAt(conversation.last_message_at)}
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
