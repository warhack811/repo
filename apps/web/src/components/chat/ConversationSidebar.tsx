import type { ChangeEvent, ReactElement } from 'react';
import { useState } from 'react';

import { secondaryLabelStyle } from '../../lib/chat-styles.js';
import type {
	ConversationAccessRole,
	ConversationMember,
	ConversationSummary,
} from '../../hooks/useConversations.js';

type ConversationSidebarProps = Readonly<{
	activeConversationId: string | null;
	activeConversationMembers: readonly ConversationMember[];
	activeConversationSummary: ConversationSummary | null;
	conversationError: string | null;
	conversations: readonly ConversationSummary[];
	isLoading: boolean;
	isMemberLoading: boolean;
	memberError: string | null;
	onRemoveMember: (memberUserId: string) => Promise<void>;
	onSelectConversation: (conversationId: string) => void;
	onShareMember: (
		memberUserId: string,
		role: Exclude<ConversationAccessRole, 'owner'>,
	) => Promise<void>;
	onStartNewConversation: () => void;
}>;

const sidebarStyle = {
	alignSelf: 'start',
	borderRadius: '24px',
	border: '1px solid rgba(148, 163, 184, 0.16)',
	background: 'linear-gradient(180deg, rgba(10, 15, 27, 0.88) 0%, rgba(6, 11, 21, 0.74) 100%)',
	padding: '18px',
	display: 'grid',
	gap: '14px',
	boxShadow: '0 24px 60px rgba(2, 6, 23, 0.28)',
} as const;

const actionButtonStyle = {
	borderRadius: '14px',
	border: '1px solid rgba(245, 158, 11, 0.3)',
	background: 'rgba(245, 158, 11, 0.12)',
	color: '#fde68a',
	padding: '11px 14px',
	fontWeight: 700,
	cursor: 'pointer',
	textAlign: 'left',
} as const;

const listStyle = {
	display: 'grid',
	gap: '10px',
} as const;

function roleLabel(role: ConversationAccessRole): string {
	switch (role) {
		case 'owner':
			return 'Owner';
		case 'editor':
			return 'Editor';
		case 'viewer':
			return 'Viewer';
	}
}

export function ConversationSidebar({
	activeConversationId,
	activeConversationMembers,
	activeConversationSummary,
	conversationError,
	conversations,
	isLoading,
	isMemberLoading,
	memberError,
	onRemoveMember,
	onSelectConversation,
	onShareMember,
	onStartNewConversation,
}: ConversationSidebarProps): ReactElement {
	const [memberUserId, setMemberUserId] = useState('');
	const [memberRole, setMemberRole] = useState<Exclude<ConversationAccessRole, 'owner'>>('viewer');
	const [memberActionError, setMemberActionError] = useState<string | null>(null);
	const [isSavingMember, setIsSavingMember] = useState(false);
	const canManageMembers = activeConversationSummary?.access_role === 'owner';

	async function handleShareSubmit(): Promise<void> {
		const normalizedMemberUserId = memberUserId.trim();

		if (!normalizedMemberUserId) {
			setMemberActionError('Paylasim icin member user id gerekli.');
			return;
		}

		setIsSavingMember(true);
		setMemberActionError(null);

		try {
			await onShareMember(normalizedMemberUserId, memberRole);
			setMemberUserId('');
		} catch (error) {
			setMemberActionError(error instanceof Error ? error.message : 'Conversation paylasimi basarisiz.');
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
			setMemberActionError(error instanceof Error ? error.message : 'Conversation member silinemedi.');
		} finally {
			setIsSavingMember(false);
		}
	}

	return (
		<aside style={sidebarStyle} className="runa-card runa-card--subtle" aria-label="Conversation list">
			<div style={{ display: 'grid', gap: '8px' }}>
				<div style={secondaryLabelStyle}>History</div>
				<h2 style={{ margin: 0, fontSize: '20px' }}>Conversation history</h2>
				<div className="runa-subtle-copy">
					Refresh sonrasi ayni sohbete geri donebilir, ekip icinde paylasilan akislari ayri
					rol badge'leriyle gorebilirsin.
				</div>
			</div>

			<button
				type="button"
				onClick={onStartNewConversation}
				style={actionButtonStyle}
				className="runa-button runa-button--secondary"
			>
				Yeni conversation baslat
			</button>

			{conversationError ? (
				<div className="runa-alert runa-alert--danger" role="alert">
					{conversationError}
				</div>
			) : null}

			<div style={listStyle}>
				{isLoading && conversations.length === 0 ? (
					<div className="runa-subtle-copy">Conversation listesi yukleniyor...</div>
				) : conversations.length === 0 ? (
					<div className="runa-subtle-copy">
						Henuz kalici bir conversation yok. Ilk mesaji gonderdiginde burada gorunecek.
					</div>
				) : (
					conversations.map((conversation) => {
						const isActive = conversation.conversation_id === activeConversationId;

						return (
							<button
								key={conversation.conversation_id}
								type="button"
								onClick={() => onSelectConversation(conversation.conversation_id)}
								style={{
									textAlign: 'left',
									display: 'grid',
									gap: '8px',
									padding: '14px 15px',
									borderRadius: '18px',
									border: isActive
										? '1px solid rgba(245, 158, 11, 0.4)'
										: '1px solid rgba(148, 163, 184, 0.14)',
									background: isActive
										? 'linear-gradient(180deg, rgba(245, 158, 11, 0.16) 0%, rgba(30, 41, 59, 0.68) 100%)'
										: 'rgba(7, 11, 20, 0.56)',
									color: '#f8fafc',
									cursor: 'pointer',
								}}
							>
								<div
									style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										gap: '12px',
									}}
								>
									<strong style={{ fontSize: '14px' }}>{conversation.title}</strong>
									<span
										style={{
											borderRadius: '999px',
											padding: '3px 8px',
											fontSize: '11px',
											fontWeight: 700,
											background:
												conversation.access_role === 'owner'
													? 'rgba(245, 158, 11, 0.18)'
													: 'rgba(59, 130, 246, 0.18)',
											color:
												conversation.access_role === 'owner' ? '#fde68a' : '#bfdbfe',
										}}
									>
										{roleLabel(conversation.access_role)}
									</span>
								</div>
								<div
									style={{
										color: '#cbd5e1',
										fontSize: '13px',
										lineHeight: 1.5,
									}}
								>
									{conversation.last_message_preview}
								</div>
								<div style={{ color: '#94a3b8', fontSize: '12px' }}>
									{new Date(conversation.last_message_at).toLocaleString()}
								</div>
							</button>
						);
					})
				)}
			</div>

			{activeConversationSummary ? (
				<section
					style={{
						display: 'grid',
						gap: '12px',
						paddingTop: '6px',
						borderTop: '1px solid rgba(148, 163, 184, 0.14)',
					}}
				>
					<div style={{ display: 'grid', gap: '6px' }}>
						<div style={secondaryLabelStyle}>Members</div>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
							<strong>{activeConversationSummary.title}</strong>
							<span className="runa-subtle-copy">
								Current role: {roleLabel(activeConversationSummary.access_role)}
							</span>
						</div>
					</div>

					{memberError ? (
						<div className="runa-alert runa-alert--danger" role="alert">
							{memberError}
						</div>
					) : null}

					{memberActionError ? (
						<div className="runa-alert runa-alert--danger" role="alert">
							{memberActionError}
						</div>
					) : null}

					{canManageMembers ? (
						<div style={{ display: 'grid', gap: '8px' }}>
							<input
								type="text"
								value={memberUserId}
								onChange={(event: ChangeEvent<HTMLInputElement>) =>
									setMemberUserId(event.target.value)
								}
								placeholder="member user id"
								style={{
									borderRadius: '12px',
									border: '1px solid rgba(148, 163, 184, 0.18)',
									background: 'rgba(15, 23, 42, 0.68)',
									color: '#f8fafc',
									padding: '10px 12px',
								}}
							/>
							<select
								value={memberRole}
								onChange={(event: ChangeEvent<HTMLSelectElement>) =>
									setMemberRole(event.target.value as Exclude<ConversationAccessRole, 'owner'>)
								}
								style={{
									borderRadius: '12px',
									border: '1px solid rgba(148, 163, 184, 0.18)',
									background: 'rgba(15, 23, 42, 0.68)',
									color: '#f8fafc',
									padding: '10px 12px',
								}}
							>
								<option value="viewer">Viewer</option>
								<option value="editor">Editor</option>
							</select>
							<button
								type="button"
								onClick={() => {
									void handleShareSubmit();
								}}
								disabled={isSavingMember}
								style={actionButtonStyle}
								className="runa-button runa-button--secondary"
							>
								{isSavingMember ? 'Paylasiliyor...' : 'Member ekle veya guncelle'}
							</button>
						</div>
					) : (
						<div className="runa-subtle-copy">
							Bu conversation seninle paylasildi. {roleLabel(activeConversationSummary.access_role)} rolunde
							oldugun icin member listesini gorebilir, yazma yetkin varsa ayni akista calisabilirsin.
						</div>
					)}

					<div style={{ display: 'grid', gap: '8px' }}>
						{isMemberLoading ? (
							<div className="runa-subtle-copy">Conversation member listesi yukleniyor...</div>
						) : activeConversationMembers.length === 0 ? (
							<div className="runa-subtle-copy">Bu conversation icin henuz eklenmis ek uye yok.</div>
						) : (
							activeConversationMembers.map((member) => (
								<div
									key={member.member_user_id}
									style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										gap: '12px',
										padding: '10px 12px',
										borderRadius: '14px',
										background: 'rgba(15, 23, 42, 0.56)',
										border: '1px solid rgba(148, 163, 184, 0.12)',
									}}
								>
									<div style={{ display: 'grid', gap: '4px' }}>
										<strong style={{ fontSize: '13px' }}>{member.member_user_id}</strong>
										<div className="runa-subtle-copy">
											Role: {roleLabel(member.member_role)}
										</div>
									</div>
									{canManageMembers ? (
										<button
											type="button"
											onClick={() => {
												void handleRemoveMember(member.member_user_id);
											}}
											disabled={isSavingMember}
											style={{
												borderRadius: '12px',
												border: '1px solid rgba(248, 113, 113, 0.24)',
												background: 'rgba(127, 29, 29, 0.28)',
												color: '#fecaca',
												padding: '8px 10px',
												cursor: 'pointer',
											}}
										>
											Kaldir
										</button>
									) : null}
								</div>
							))
						)}
					</div>
				</section>
			) : null}
		</aside>
	);
}
