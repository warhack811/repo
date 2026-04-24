import type { ModelMessage } from '@runa/types';
import { useEffect, useMemo, useState } from 'react';

const ACTIVE_CONVERSATION_STORAGE_KEY = 'runa.chat.active_conversation_id';

export type ConversationAccessRole = 'editor' | 'owner' | 'viewer';

export interface ConversationSummary {
	readonly access_role: ConversationAccessRole;
	readonly conversation_id: string;
	readonly created_at: string;
	readonly last_message_at: string;
	readonly last_message_preview: string;
	readonly owner_user_id?: string;
	readonly title: string;
	readonly updated_at: string;
}

export interface ConversationMessage {
	readonly content: string;
	readonly conversation_id: string;
	readonly created_at: string;
	readonly message_id: string;
	readonly role: ModelMessage['role'];
	readonly run_id?: string;
	readonly sequence_no: number;
	readonly trace_id?: string;
}

export interface ConversationMember {
	readonly added_by_user_id?: string;
	readonly conversation_id: string;
	readonly created_at: string;
	readonly member_role: Exclude<ConversationAccessRole, 'owner'>;
	readonly member_user_id: string;
	readonly updated_at: string;
}

export interface UseConversationsResult {
	readonly activeConversationId: string | null;
	readonly activeConversationMembers: readonly ConversationMember[];
	readonly activeConversationMessages: readonly ConversationMessage[];
	readonly activeConversationSummary: ConversationSummary | null;
	readonly conversationError: string | null;
	readonly conversations: readonly ConversationSummary[];
	readonly isConversationLoading: boolean;
	readonly isMemberLoading: boolean;
	readonly memberError: string | null;
	beginDraftConversation: () => void;
	buildRequestMessages: (prompt: string) => readonly ModelMessage[];
	handleRunAccepted: (input: {
		readonly conversationId?: string;
		readonly prompt: string;
	}) => void;
	handleRunFinished: (input: { readonly conversationId?: string }) => void;
	removeConversationMember: (memberUserId: string) => Promise<void>;
	selectConversation: (conversationId: string) => void;
	shareConversationMember: (
		memberUserId: string,
		role: Exclude<ConversationAccessRole, 'owner'>,
	) => Promise<void>;
}

interface ConversationListResponseCandidate {
	readonly conversations?: unknown;
}

interface ConversationMembersResponseCandidate {
	readonly conversation_id?: unknown;
	readonly members?: unknown;
}

interface ConversationMessagesResponseCandidate {
	readonly conversation_id?: unknown;
	readonly messages?: unknown;
}

interface ErrorResponseCandidate {
	readonly code?: unknown;
	readonly message?: unknown;
}

interface UseConversationsOptions {
	readonly accessToken?: string | null;
}

function resolveConversationStorage(): Storage | null {
	if (typeof window === 'undefined') {
		return null;
	}

	return window.localStorage;
}

function readStoredActiveConversationId(): string | null {
	const storage = resolveConversationStorage();

	if (!storage) {
		return null;
	}

	const storedValue = storage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY)?.trim();
	return storedValue && storedValue.length > 0 ? storedValue : null;
}

function persistActiveConversationId(conversationId: string | null): void {
	const storage = resolveConversationStorage();

	if (!storage) {
		return;
	}

	if (!conversationId) {
		storage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
		return;
	}

	storage.setItem(ACTIVE_CONVERSATION_STORAGE_KEY, conversationId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isConversationAccessRole(value: unknown): value is ConversationAccessRole {
	return value === 'owner' || value === 'editor' || value === 'viewer';
}

function isConversationSummary(value: unknown): value is ConversationSummary {
	if (!isRecord(value)) {
		return false;
	}

	const {
		access_role,
		conversation_id,
		created_at,
		last_message_at,
		last_message_preview,
		owner_user_id,
		title,
		updated_at,
	} = value;

	return (
		isConversationAccessRole(access_role) &&
		typeof conversation_id === 'string' &&
		typeof created_at === 'string' &&
		typeof last_message_at === 'string' &&
		typeof last_message_preview === 'string' &&
		(owner_user_id === undefined || typeof owner_user_id === 'string') &&
		typeof title === 'string' &&
		typeof updated_at === 'string'
	);
}

function isConversationMessage(value: unknown): value is ConversationMessage {
	if (!isRecord(value)) {
		return false;
	}

	const { content, conversation_id, created_at, message_id, role, run_id, sequence_no, trace_id } =
		value;

	return (
		typeof content === 'string' &&
		typeof conversation_id === 'string' &&
		typeof created_at === 'string' &&
		typeof message_id === 'string' &&
		(role === 'assistant' || role === 'system' || role === 'user') &&
		typeof sequence_no === 'number' &&
		(run_id === undefined || typeof run_id === 'string') &&
		(trace_id === undefined || typeof trace_id === 'string')
	);
}

function isConversationMember(value: unknown): value is ConversationMember {
	if (!isRecord(value)) {
		return false;
	}

	const { added_by_user_id, conversation_id, created_at, member_role, member_user_id, updated_at } =
		value;

	return (
		(added_by_user_id === undefined || typeof added_by_user_id === 'string') &&
		typeof conversation_id === 'string' &&
		typeof created_at === 'string' &&
		(member_role === 'editor' || member_role === 'viewer') &&
		typeof member_user_id === 'string' &&
		typeof updated_at === 'string'
	);
}

function isConversationListResponse(value: unknown): value is {
	readonly conversations: readonly ConversationSummary[];
} {
	return (
		isRecord(value) &&
		Array.isArray((value as ConversationListResponseCandidate).conversations) &&
		((value as ConversationListResponseCandidate).conversations as readonly unknown[]).every(
			(entry: unknown) => isConversationSummary(entry),
		)
	);
}

function isConversationMessagesResponse(value: unknown): value is {
	readonly conversation_id: string;
	readonly messages: readonly ConversationMessage[];
} {
	return (
		isRecord(value) &&
		typeof (value as ConversationMessagesResponseCandidate).conversation_id === 'string' &&
		Array.isArray((value as ConversationMessagesResponseCandidate).messages) &&
		((value as ConversationMessagesResponseCandidate).messages as readonly unknown[]).every(
			(entry: unknown) => isConversationMessage(entry),
		)
	);
}

function isConversationMembersResponse(value: unknown): value is {
	readonly conversation_id: string;
	readonly members: readonly ConversationMember[];
} {
	return (
		isRecord(value) &&
		typeof (value as ConversationMembersResponseCandidate).conversation_id === 'string' &&
		Array.isArray((value as ConversationMembersResponseCandidate).members) &&
		((value as ConversationMembersResponseCandidate).members as readonly unknown[]).every(
			(entry: unknown) => isConversationMember(entry),
		)
	);
}

function createRequestHeaders(accessToken?: string | null): Headers {
	const headers = new Headers({
		accept: 'application/json',
	});
	const normalizedToken = accessToken?.trim();

	if (normalizedToken) {
		headers.set('authorization', `Bearer ${normalizedToken}`);
	}

	return headers;
}

async function readErrorMessage(response: Response): Promise<string> {
	const responseText = await response.text();
	const trimmedText = responseText.trim();

	if (trimmedText.length > 0) {
		try {
			const parsed = JSON.parse(trimmedText) as unknown;

			if (isRecord(parsed)) {
				const candidate = parsed as ErrorResponseCandidate;

				if (typeof candidate.message !== 'string') {
					return trimmedText;
				}

				const message = candidate.message;
				const code = candidate.code;
				return typeof code === 'string' ? `${message} (${code})` : message;
			}
		} catch {
			return trimmedText;
		}
	}

	return trimmedText.length > 0
		? trimmedText
		: `Conversation request failed with status ${response.status}.`;
}

async function fetchConversationList(
	accessToken?: string | null,
	signal?: AbortSignal,
): Promise<readonly ConversationSummary[]> {
	const response = await fetch('/conversations', {
		cache: 'no-store',
		credentials: 'same-origin',
		headers: createRequestHeaders(accessToken),
		method: 'GET',
		signal,
	});

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	const parsed = (await response.json()) as unknown;

	if (!isConversationListResponse(parsed)) {
		throw new Error('Desteklenmeyen conversation list yanıtı.');
	}

	return parsed.conversations;
}

async function fetchConversationMessages(
	conversationId: string,
	accessToken?: string | null,
	signal?: AbortSignal,
): Promise<readonly ConversationMessage[]> {
	const response = await fetch(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
		cache: 'no-store',
		credentials: 'same-origin',
		headers: createRequestHeaders(accessToken),
		method: 'GET',
		signal,
	});

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	const parsed = (await response.json()) as unknown;

	if (!isConversationMessagesResponse(parsed)) {
		throw new Error('Desteklenmeyen conversation messages yanıtı.');
	}

	return parsed.messages;
}

async function fetchConversationMembers(
	conversationId: string,
	accessToken?: string | null,
	signal?: AbortSignal,
): Promise<readonly ConversationMember[]> {
	const response = await fetch(`/conversations/${encodeURIComponent(conversationId)}/members`, {
		cache: 'no-store',
		credentials: 'same-origin',
		headers: createRequestHeaders(accessToken),
		method: 'GET',
		signal,
	});

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	const parsed = (await response.json()) as unknown;

	if (!isConversationMembersResponse(parsed)) {
		throw new Error('Desteklenmeyen conversation member yanıtı.');
	}

	return parsed.members;
}

function summarizePrompt(value: string, maxLength: number): string {
	const normalized = value.replace(/\s+/gu, ' ').trim();
	return normalized.length <= maxLength
		? normalized
		: `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

export function useConversations(options: UseConversationsOptions = {}): UseConversationsResult {
	const { accessToken } = options;
	const [conversations, setConversations] = useState<readonly ConversationSummary[]>([]);
	const [activeConversationId, setActiveConversationId] = useState<string | null>(
		readStoredActiveConversationId(),
	);
	const [activeConversationMessages, setActiveConversationMessages] = useState<
		readonly ConversationMessage[]
	>([]);
	const [activeConversationMembers, setActiveConversationMembers] = useState<
		readonly ConversationMember[]
	>([]);
	const [conversationError, setConversationError] = useState<string | null>(null);
	const [isConversationLoading, setIsConversationLoading] = useState(true);
	const [isMemberLoading, setIsMemberLoading] = useState(false);
	const [memberError, setMemberError] = useState<string | null>(null);

	useEffect(() => {
		let isCancelled = false;
		const controller = new AbortController();

		void (async () => {
			setIsConversationLoading(true);

			try {
				const nextConversations = await fetchConversationList(accessToken, controller.signal);

				if (isCancelled) {
					return;
				}

				setConversations(nextConversations);
				setConversationError(null);
				setActiveConversationId((currentConversationId) => {
					if (
						currentConversationId &&
						nextConversations.some(
							(conversation) => conversation.conversation_id === currentConversationId,
						)
					) {
						return currentConversationId;
					}

					const storedConversationId = readStoredActiveConversationId();

					if (
						storedConversationId &&
						nextConversations.some(
							(conversation) => conversation.conversation_id === storedConversationId,
						)
					) {
						return storedConversationId;
					}

					return nextConversations[0]?.conversation_id ?? null;
				});
			} catch (error) {
				if (isCancelled) {
					return;
				}

				setConversationError(
					error instanceof Error ? error.message : 'Conversation listesi yüklenemedi.',
				);
				setConversations([]);
				setActiveConversationId(null);
			} finally {
				if (!isCancelled) {
					setIsConversationLoading(false);
				}
			}
		})();

		return () => {
			isCancelled = true;
			controller.abort();
		};
	}, [accessToken]);

	useEffect(() => {
		persistActiveConversationId(activeConversationId);
	}, [activeConversationId]);

	useEffect(() => {
		if (!activeConversationId) {
			setActiveConversationMessages([]);
			return;
		}

		let isCancelled = false;
		const controller = new AbortController();

		void (async () => {
			setIsConversationLoading(true);

			try {
				const nextMessages = await fetchConversationMessages(
					activeConversationId,
					accessToken,
					controller.signal,
				);

				if (isCancelled) {
					return;
				}

				setActiveConversationMessages(nextMessages);
				setConversationError(null);
			} catch (error) {
				if (isCancelled) {
					return;
				}

				setConversationError(
					error instanceof Error ? error.message : 'Conversation mesajları yüklenemedi.',
				);
				setActiveConversationMessages([]);
			} finally {
				if (!isCancelled) {
					setIsConversationLoading(false);
				}
			}
		})();

		return () => {
			isCancelled = true;
			controller.abort();
		};
	}, [accessToken, activeConversationId]);

	useEffect(() => {
		if (!activeConversationId) {
			setActiveConversationMembers([]);
			setMemberError(null);
			return;
		}

		let isCancelled = false;
		const controller = new AbortController();

		void (async () => {
			setIsMemberLoading(true);

			try {
				const nextMembers = await fetchConversationMembers(
					activeConversationId,
					accessToken,
					controller.signal,
				);

				if (isCancelled) {
					return;
				}

				setActiveConversationMembers(nextMembers);
				setMemberError(null);
			} catch (error) {
				if (isCancelled) {
					return;
				}

				setMemberError(
					error instanceof Error ? error.message : 'Conversation member listesi yüklenemedi.',
				);
				setActiveConversationMembers([]);
			} finally {
				if (!isCancelled) {
					setIsMemberLoading(false);
				}
			}
		})();

		return () => {
			isCancelled = true;
			controller.abort();
		};
	}, [accessToken, activeConversationId]);

	const activeConversationSummary =
		conversations.find((conversation) => conversation.conversation_id === activeConversationId) ??
		null;

	const requestHistoryMessages = useMemo(
		() =>
			activeConversationMessages.map((message) => ({
				content: message.content,
				role: message.role,
			})) satisfies readonly ModelMessage[],
		[activeConversationMessages],
	);

	function beginDraftConversation(): void {
		setActiveConversationId(null);
		setActiveConversationMessages([]);
		setActiveConversationMembers([]);
		setConversationError(null);
		setMemberError(null);
	}

	function selectConversation(conversationId: string): void {
		setActiveConversationId(conversationId);
		setConversationError(null);
		setMemberError(null);
	}

	function buildRequestMessages(prompt: string): readonly ModelMessage[] {
		const normalizedPrompt = prompt.trim();
		return [
			...requestHistoryMessages,
			{
				content: normalizedPrompt,
				role: 'user',
			},
		];
	}

	function handleRunAccepted(input: {
		readonly conversationId?: string;
		readonly prompt: string;
	}): void {
		const now = new Date().toISOString();
		const conversationId = input.conversationId?.trim();

		if (!conversationId) {
			return;
		}

		const preview = summarizePrompt(input.prompt, 160);

		setActiveConversationId(conversationId);
		setActiveConversationMessages((currentMessages) => [
			...currentMessages,
			{
				content: input.prompt.trim(),
				conversation_id: conversationId,
				created_at: now,
				message_id: `optimistic:${now}`,
				role: 'user',
				sequence_no: currentMessages.length + 1,
			},
		]);
		setConversations((currentConversations) => {
			const existingConversation = currentConversations.find(
				(conversation) => conversation.conversation_id === conversationId,
			);
			const nextConversation: ConversationSummary = {
				access_role: existingConversation?.access_role ?? 'owner',
				conversation_id: conversationId,
				created_at: existingConversation?.created_at ?? now,
				last_message_at: now,
				last_message_preview: preview,
				owner_user_id: existingConversation?.owner_user_id,
				title: existingConversation?.title ?? (summarizePrompt(input.prompt, 64) || 'Yeni sohbet'),
				updated_at: now,
			};

			return [
				nextConversation,
				...currentConversations.filter(
					(conversation) => conversation.conversation_id !== conversationId,
				),
			];
		});
	}

	function handleRunFinished(input: { readonly conversationId?: string }): void {
		const conversationId = input.conversationId ?? activeConversationId;

		if (!conversationId) {
			return;
		}

		void (async () => {
			try {
				const [nextConversations, nextMessages, nextMembers] = await Promise.all([
					fetchConversationList(accessToken),
					fetchConversationMessages(conversationId, accessToken),
					fetchConversationMembers(conversationId, accessToken),
				]);
				setConversations(nextConversations);
				setActiveConversationId(conversationId);
				setActiveConversationMessages(nextMessages);
				setActiveConversationMembers(nextMembers);
				setConversationError(null);
				setMemberError(null);
			} catch (error) {
				setConversationError(
					error instanceof Error ? error.message : 'Conversation senkronizasyonu başarısız oldu.',
				);
			}
		})();
	}

	async function shareConversationMember(
		memberUserId: string,
		role: Exclude<ConversationAccessRole, 'owner'>,
	): Promise<void> {
		if (!activeConversationId) {
			return;
		}

		const response = await fetch(
			`/conversations/${encodeURIComponent(activeConversationId)}/members`,
			{
				body: JSON.stringify({
					member_role: role,
					member_user_id: memberUserId,
				}),
				credentials: 'same-origin',
				headers: new Headers({
					'content-type': 'application/json',
					...Object.fromEntries(createRequestHeaders(accessToken).entries()),
				}),
				method: 'POST',
			},
		);

		if (!response.ok) {
			throw new Error(await readErrorMessage(response));
		}

		const nextMembers = await fetchConversationMembers(activeConversationId, accessToken);
		setActiveConversationMembers(nextMembers);
		setMemberError(null);
	}

	async function removeConversationMember(memberUserId: string): Promise<void> {
		if (!activeConversationId) {
			return;
		}

		const response = await fetch(
			`/conversations/${encodeURIComponent(activeConversationId)}/members/${encodeURIComponent(memberUserId)}`,
			{
				credentials: 'same-origin',
				headers: createRequestHeaders(accessToken),
				method: 'DELETE',
			},
		);

		if (!response.ok && response.status !== 204) {
			throw new Error(await readErrorMessage(response));
		}

		const nextMembers = await fetchConversationMembers(activeConversationId, accessToken);
		setActiveConversationMembers(nextMembers);
		setMemberError(null);
	}

	return {
		activeConversationId,
		activeConversationMembers,
		activeConversationMessages,
		activeConversationSummary,
		beginDraftConversation,
		buildRequestMessages,
		conversationError,
		conversations,
		handleRunAccepted,
		handleRunFinished,
		isConversationLoading,
		isMemberLoading,
		memberError,
		removeConversationMember,
		selectConversation,
		shareConversationMember,
	};
}
