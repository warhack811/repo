import type { ChangeEvent, ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type {
	ConversationAccessRole,
	ConversationMember,
	ConversationSummary,
} from '../../hooks/useConversations.js';
import { RunaSkeleton } from '../ui/RunaSkeleton.js';
import styles from './ConversationSidebar.module.css';

type ConversationSidebarProps = Readonly<{
	activeConversationId: string | null;
	activeConversationMembers: readonly ConversationMember[];
	activeConversationSummary: ConversationSummary | null;
	conversationError: string | null;
	conversations: readonly ConversationSummary[];
	isLoading: boolean;
	isMemberLoading: boolean;
	isOpen?: boolean;
	memberError: string | null;
	onClose?: () => void;
	onRemoveMember: (memberUserId: string) => Promise<void>;
	onSelectConversation: (conversationId: string) => void;
	onShareMember: (
		memberUserId: string,
		role: Exclude<ConversationAccessRole, 'owner'>,
	) => Promise<void>;
	onStartNewConversation: () => void;
	presentation?: 'drawer' | 'embedded';
}>;

type ConversationGroup = Readonly<{
	items: readonly ConversationSummary[];
	label: string;
}>;

function roleLabel(role: ConversationAccessRole): string {
	switch (role) {
		case 'owner':
			return 'Sahip';
		case 'editor':
			return 'Düzenleyici';
		case 'viewer':
			return 'İzleyici';
	}
}

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
	const yesterday: ConversationSummary[] = [];
	const previousSevenDays: ConversationSummary[] = [];
	const older: ConversationSummary[] = [];

	for (const conversation of conversations) {
		const ageInDays = daysBetween(now, conversation.last_message_at);

		if (ageInDays <= 0) {
			today.push(conversation);
			continue;
		}

		if (ageInDays === 1) {
			yesterday.push(conversation);
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
		{ items: yesterday, label: 'Dün' },
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

	if (trimmedMessage.startsWith('{') || trimmedMessage.includes('Internal Server Error')) {
		return 'Sohbet geçmişi şu anda yüklenemedi. Biraz sonra yeniden deneyebilirsin.';
	}

	return trimmedMessage;
}

function SkeletonRows(): ReactElement {
	return (
		<output aria-busy="true" aria-label="Sohbet listesi yükleniyor" className={styles['loading']}>
			{['one', 'two', 'three'].map((key) => (
				<RunaSkeleton key={key} className="runa-conversation-skeleton" variant="rect" />
			))}
		</output>
	);
}

function MemberSkeleton(): ReactElement {
	return (
		<output aria-busy="true" className="runa-member-skeleton">
			<RunaSkeleton variant="text" />
			<RunaSkeleton variant="text" />
		</output>
	);
}

export function ConversationSidebar({
	activeConversationId,
	activeConversationMembers,
	activeConversationSummary,
	conversationError,
	conversations,
	isLoading,
	isMemberLoading,
	isOpen = true,
	memberError,
	onClose,
	onRemoveMember,
	onSelectConversation,
	onShareMember,
	onStartNewConversation,
	presentation = 'drawer',
}: ConversationSidebarProps): ReactElement {
	const [memberUserId, setMemberUserId] = useState('');
	const [memberRole, setMemberRole] = useState<Exclude<ConversationAccessRole, 'owner'>>('viewer');
	const [memberActionError, setMemberActionError] = useState<string | null>(null);
	const [isSavingMember, setIsSavingMember] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const canManageMembers = activeConversationSummary?.access_role === 'owner';
	const filteredConversations = useMemo(
		() => conversations.filter((conversation) => matchesSearch(conversation, searchQuery)),
		[conversations, searchQuery],
	);
	const groupedConversations = useMemo(
		() => groupConversations(filteredConversations),
		[filteredConversations],
	);
	const isEmbedded = presentation === 'embedded';
	const shouldShowBackdrop = !isEmbedded && isOpen;
	const navClassName = [
		'runa-card',
		'runa-card--subtle',
		'runa-conversation-sidebar',
		isOpen || isEmbedded ? 'runa-conversation-sidebar--open' : null,
		isEmbedded ? styles['embeddedNav'] : null,
	]
		.filter(Boolean)
		.join(' ');

	useEffect(() => {
		if (!isOpen || !onClose || isEmbedded) {
			return;
		}

		function handleKeyDown(event: KeyboardEvent): void {
			if (event.key === 'Escape') {
				onClose?.();
			}
		}

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [isEmbedded, isOpen, onClose]);

	async function handleShareSubmit(): Promise<void> {
		const normalizedMemberUserId = memberUserId.trim();

		if (!normalizedMemberUserId) {
			setMemberActionError('Paylaşmak için üye bilgisi gerekli.');
			return;
		}

		setIsSavingMember(true);
		setMemberActionError(null);

		try {
			await onShareMember(normalizedMemberUserId, memberRole);
			setMemberUserId('');
		} catch (error) {
			setMemberActionError(error instanceof Error ? error.message : 'Sohbet paylaşılamadı.');
		} finally {
			setIsSavingMember(false);
		}
	}

	async function handleRemoveMember(memberUserIdValue: string): Promise<void> {
		setIsSavingMember(true);
		setMemberActionError(null);

		try {
			await onRemoveMember(memberUserIdValue);
		} catch (error) {
			setMemberActionError(error instanceof Error ? error.message : 'Sohbet üyesi kaldırılamadı.');
		} finally {
			setIsSavingMember(false);
		}
	}

	function selectConversation(conversationId: string): void {
		onSelectConversation(conversationId);
		onClose?.();
	}

	function startNewConversation(): void {
		onStartNewConversation();
		onClose?.();
	}

	return (
		<>
			{shouldShowBackdrop ? (
				<button
					type="button"
					className="runa-sidebar-backdrop"
					aria-label="Sohbet geçmişini kapat"
					onClick={onClose}
				/>
			) : null}
			<nav className={navClassName} aria-label="Sohbet geçmişi">
				<div className="runa-conversation-sidebar__header">
					<div className={styles['headerGroup']}>
						<div className={styles['logo']}>Runa</div>
						<h2 className={styles['title']}>Sohbetler</h2>
					</div>
					<button
						type="button"
						onClick={startNewConversation}
						className={`runa-button ${
							isEmbedded ? 'runa-button--primary' : 'runa-button--secondary'
						} ${styles['newButton']}`}
					>
						Yeni sohbet
					</button>
				</div>

				<label className={styles['searchLabel']}>
					<span className={styles['searchIcon']}>Ara</span>
					<input
						type="search"
						className="runa-input"
						placeholder="Başlık veya önizleme ara"
						value={searchQuery}
						onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
					/>
				</label>

				{conversationError ? (
					<div className="runa-alert runa-alert--danger" role="alert">
						{getFriendlyErrorMessage(conversationError)}
					</div>
				) : null}

				<div className={styles['conversationList']}>
					{isLoading && conversations.length === 0 ? <SkeletonRows /> : null}

					{!isLoading && conversations.length === 0 ? (
						<div className="runa-empty-state">
							<strong>Henüz sohbet yok.</strong>
							<div className={styles['emptyHint']}>
								İlk mesajından sonra sohbetlerin listelenir.
							</div>
							<button
								type="button"
								onClick={startNewConversation}
								className={`runa-button runa-button--secondary ${styles['newButtonAlt']}`}
							>
								Yeni sohbet
							</button>
						</div>
					) : null}

					{!isLoading && conversations.length > 0 && filteredConversations.length === 0 ? (
						<div className="runa-empty-state">Bu aramayla eşleşen sohbet yok.</div>
					) : null}

					{groupedConversations.map((group) => (
						<section key={group.label} className="runa-conversation-group">
							<div className="runa-conversation-group__label">{group.label}</div>
							<div className={styles['groupItems']}>
								{group.items.map((conversation) => {
									const isActive = conversation.conversation_id === activeConversationId;

									return (
										<button
											key={conversation.conversation_id}
											type="button"
											onClick={() => selectConversation(conversation.conversation_id)}
											className={`runa-conversation-item${
												isActive ? ' runa-conversation-item--active' : ''
											}`}
										>
											<div className="runa-conversation-item__top">
												<strong>{conversation.title}</strong>
												<span className="runa-conversation-role">
													{roleLabel(conversation.access_role)}
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

				{activeConversationSummary ? (
					<details className="runa-conversation-members">
						<summary>Üyeler - {roleLabel(activeConversationSummary.access_role)}</summary>

						<div className={styles['membersList']}>
							{memberError ? (
								<div className="runa-alert runa-alert--danger" role="alert">
									{getFriendlyErrorMessage(memberError)}
								</div>
							) : null}

							{memberActionError ? (
								<div className="runa-alert runa-alert--danger" role="alert">
									{getFriendlyErrorMessage(memberActionError)}
								</div>
							) : null}

							{canManageMembers ? (
								<div className={styles['addMember']}>
									<input
										type="text"
										value={memberUserId}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setMemberUserId(event.target.value)
										}
										placeholder="üye bilgisi"
										className="runa-input"
									/>
									<select
										value={memberRole}
										onChange={(event: ChangeEvent<HTMLSelectElement>) =>
											setMemberRole(event.target.value as Exclude<ConversationAccessRole, 'owner'>)
										}
										className="runa-input"
									>
										<option value="viewer">İzleyici</option>
										<option value="editor">Düzenleyici</option>
									</select>
									<button
										type="button"
										onClick={() => {
											void handleShareSubmit();
										}}
										disabled={isSavingMember}
										aria-label={isSavingMember ? 'Üye kaydediliyor' : 'Üye ekle veya güncelle'}
										title={isSavingMember ? 'Üye kaydediliyor' : 'Üye ekle veya güncelle'}
										className={`runa-button runa-button--secondary ${styles['saveMemberButton']}`}
									>
										{isSavingMember ? 'Üye kaydediliyor...' : 'Üye ekle veya güncelle'}
									</button>
								</div>
							) : (
								<div className="runa-subtle-copy">
									Bu sohbet seninle paylaşılmış. Mevcut rolün{' '}
									{roleLabel(activeConversationSummary.access_role)}.
								</div>
							)}

							<div className={styles['memberItems']}>
								{isMemberLoading ? (
									<MemberSkeleton />
								) : activeConversationMembers.length === 0 ? (
									<div className="runa-subtle-copy">Henüz ek üye yok.</div>
								) : (
									activeConversationMembers.map((member) => (
										<div key={member.member_user_id} className="runa-conversation-member">
											<div className={styles['memberInfo']}>
												<strong>{member.member_user_id}</strong>
												<div className="runa-subtle-copy">Rol: {roleLabel(member.member_role)}</div>
											</div>
											{canManageMembers ? (
												<button
													type="button"
													onClick={() => {
														void handleRemoveMember(member.member_user_id);
													}}
													disabled={isSavingMember}
													className="runa-button runa-button--danger"
												>
													Kaldır
												</button>
											) : null}
										</div>
									))
								)}
							</div>
						</div>
					</details>
				) : null}

				<footer className="runa-conversation-sidebar__footer">
					<Link to="/account" className="runa-button runa-button--secondary">
						Hesap ve ayarlar
					</Link>
				</footer>
			</nav>
		</>
	);
}
