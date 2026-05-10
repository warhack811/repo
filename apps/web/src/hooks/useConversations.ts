import type { ModelMessage, RenderBlock } from '@runa/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

export interface ConversationRunSurface {
	readonly blocks: readonly RenderBlock[];
	readonly run_id: string;
	readonly trace_id: string;
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
	readonly activeConversationRunSurfaces: readonly ConversationRunSurface[];
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
	handleRunFinishing: (input: {
		readonly conversationId: string;
		readonly runId: string;
		readonly streamingText: string;
	}) => void;
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

interface ConversationRunBlocksResponseCandidate {
	readonly conversation_id?: unknown;
	readonly run_surfaces?: unknown;
}

interface ConversationRunSurfaceCandidate {
	readonly blocks?: unknown;
	readonly run_id?: unknown;
	readonly trace_id?: unknown;
}

type ConversationSummaryCandidate = Record<string, unknown> & {
	readonly access_role?: unknown;
	readonly conversation_id?: unknown;
	readonly created_at?: unknown;
	readonly last_message_at?: unknown;
	readonly last_message_preview?: unknown;
	readonly owner_user_id?: unknown;
	readonly title?: unknown;
	readonly updated_at?: unknown;
};

type ConversationMessageCandidate = Record<string, unknown> & {
	readonly content?: unknown;
	readonly conversation_id?: unknown;
	readonly created_at?: unknown;
	readonly message_id?: unknown;
	readonly role?: unknown;
	readonly run_id?: unknown;
	readonly sequence_no?: unknown;
	readonly trace_id?: unknown;
};

type ConversationMemberCandidate = Record<string, unknown> & {
	readonly added_by_user_id?: unknown;
	readonly conversation_id?: unknown;
	readonly created_at?: unknown;
	readonly member_role?: unknown;
	readonly member_user_id?: unknown;
	readonly updated_at?: unknown;
};

interface UseConversationsOptions {
	readonly accessToken?: string | null;
	readonly startInDraft?: boolean;
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

	const candidate = value as ConversationSummaryCandidate;

	return (
		isConversationAccessRole(candidate.access_role) &&
		typeof candidate.conversation_id === 'string' &&
		typeof candidate.created_at === 'string' &&
		typeof candidate.last_message_at === 'string' &&
		typeof candidate.last_message_preview === 'string' &&
		(candidate.owner_user_id === undefined || typeof candidate.owner_user_id === 'string') &&
		typeof candidate.title === 'string' &&
		typeof candidate.updated_at === 'string'
	);
}

function isConversationMessage(value: unknown): value is ConversationMessage {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as ConversationMessageCandidate;

	return (
		typeof candidate.content === 'string' &&
		typeof candidate.conversation_id === 'string' &&
		typeof candidate.created_at === 'string' &&
		typeof candidate.message_id === 'string' &&
		(candidate.role === 'assistant' || candidate.role === 'system' || candidate.role === 'user') &&
		typeof candidate.sequence_no === 'number' &&
		(candidate.run_id === undefined || typeof candidate.run_id === 'string') &&
		(candidate.trace_id === undefined || typeof candidate.trace_id === 'string')
	);
}

function isConversationMember(value: unknown): value is ConversationMember {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as ConversationMemberCandidate;

	return (
		(candidate.added_by_user_id === undefined || typeof candidate.added_by_user_id === 'string') &&
		typeof candidate.conversation_id === 'string' &&
		typeof candidate.created_at === 'string' &&
		(candidate.member_role === 'editor' || candidate.member_role === 'viewer') &&
		typeof candidate.member_user_id === 'string' &&
		typeof candidate.updated_at === 'string'
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

function isConversationRunSurfaceCandidate(value: unknown): value is ConversationRunSurface {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as ConversationRunSurfaceCandidate;
	return (
		typeof candidate.run_id === 'string' &&
		typeof candidate.trace_id === 'string' &&
		Array.isArray(candidate.blocks)
	);
}

function isConversationRunBlocksResponse(value: unknown): value is {
	readonly conversation_id: string;
	readonly run_surfaces: readonly ConversationRunSurface[];
} {
	return (
		isRecord(value) &&
		typeof (value as ConversationRunBlocksResponseCandidate).conversation_id === 'string' &&
		Array.isArray((value as ConversationRunBlocksResponseCandidate).run_surfaces) &&
		((value as ConversationRunBlocksResponseCandidate).run_surfaces as readonly unknown[]).every(
			(entry: unknown) => isConversationRunSurfaceCandidate(entry),
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
		throw new Error('Desteklenmeyen conversation list yaniti.');
	}

	return parsed.conversations;
}

async function fetchConversationBlocks(
	conversationId: string,
	accessToken?: string | null,
	signal?: AbortSignal,
): Promise<readonly ConversationRunSurface[]> {
	const response = await fetch(`/conversations/${encodeURIComponent(conversationId)}/blocks`, {
		cache: 'no-store',
		credentials: 'same-origin',
		headers: createRequestHeaders(accessToken),
		method: 'GET',
		signal,
	});

	if (!response.ok) {
		if (response.status === 404 || response.status === 503) {
			return [];
		}

		throw new Error(await readErrorMessage(response));
	}

	const parsed = (await response.json()) as unknown;

	if (!isConversationRunBlocksResponse(parsed)) {
		return [];
	}

	return parsed.run_surfaces;
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
		if (response.status === 404 || response.status === 503) {
			return [];
		}

		throw new Error(await readErrorMessage(response));
	}

	const parsed = (await response.json()) as unknown;

	if (!isConversationMessagesResponse(parsed)) {
		throw new Error('Desteklenmeyen conversation messages yaniti.');
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
		if (response.status === 404 || response.status === 503) {
			return [];
		}

		throw new Error(await readErrorMessage(response));
	}

	const parsed = (await response.json()) as unknown;

	if (!isConversationMembersResponse(parsed)) {
		throw new Error('Desteklenmeyen conversation member yaniti.');
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
	const { accessToken, startInDraft = false } = options;
	const [conversations, setConversations] = useState<readonly ConversationSummary[]>([]);
	const [activeConversationId, setActiveConversationId] = useState<string | null>(() =>
		startInDraft ? null : readStoredActiveConversationId(),
	);
	const [activeConversationMessages, setActiveConversationMessages] = useState<
		readonly ConversationMessage[]
	>([]);
	const [activeConversationRunSurfaces, setActiveConversationRunSurfaces] = useState<
		readonly ConversationRunSurface[]
	>([]);
	const [activeConversationMembers, setActiveConversationMembers] = useState<
		readonly ConversationMember[]
	>([]);
	const [conversationError, setConversationError] = useState<string | null>(null);
	const [isConversationLoading, setIsConversationLoading] = useState(true);
	const [isMemberLoading, setIsMemberLoading] = useState(false);
	const [memberError, setMemberError] = useState<string | null>(null);
	const isDraftConversationRef = useRef(startInDraft);

	useEffect(() => {
		if (!startInDraft) {
			return;
		}

		isDraftConversationRef.current = true;
		setActiveConversationId(null);
		setActiveConversationMessages([]);
		setActiveConversationRunSurfaces([]);
		setActiveConversationMembers([]);
		setConversationError(null);
		setMemberError(null);
	}, [startInDraft]);

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
					if (isDraftConversationRef.current) {
						return null;
					}

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
					error instanceof Error ? error.message : 'Conversation listesi yuklenemedi.',
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
		if (
			activeConversationId &&
			conversations.length > 0 &&
			!conversations.some((conversation) => conversation.conversation_id === activeConversationId)
		) {
			setActiveConversationId(conversations[0]?.conversation_id ?? null);
			setActiveConversationMessages([]);
			setActiveConversationRunSurfaces([]);
			setActiveConversationMembers([]);
			return;
		}

		if (!activeConversationId) {
			setActiveConversationMessages([]);
			setActiveConversationRunSurfaces([]);
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

				try {
					const nextSurfaces = await fetchConversationBlocks(
						activeConversationId,
						accessToken,
						controller.signal,
					);

					if (!isCancelled) {
						setActiveConversationRunSurfaces(nextSurfaces);
					}
				} catch {
					// Blocks persistence is optional; keep text history usable if it is absent.
				}
			} catch (error) {
				if (isCancelled) {
					return;
				}

				setConversationError(
					error instanceof Error ? error.message : 'Conversation mesajlari yuklenemedi.',
				);
				setActiveConversationMessages([]);
				setActiveConversationRunSurfaces([]);
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
	}, [accessToken, activeConversationId, conversations]);

	useEffect(() => {
		if (
			activeConversationId &&
			conversations.length > 0 &&
			!conversations.some((conversation) => conversation.conversation_id === activeConversationId)
		) {
			setActiveConversationMembers([]);
			setMemberError(null);
			return;
		}

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
					error instanceof Error ? error.message : 'Conversation member listesi yuklenemedi.',
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
	}, [accessToken, activeConversationId, conversations]);

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

	const beginDraftConversation = useCallback((): void => {
		isDraftConversationRef.current = true;
		setActiveConversationId(null);
		setActiveConversationMessages([]);
		setActiveConversationRunSurfaces([]);
		setActiveConversationMembers([]);
		setConversationError(null);
		setMemberError(null);
	}, []);

	const selectConversation = useCallback((conversationId: string): void => {
		isDraftConversationRef.current = false;
		setActiveConversationId(conversationId);
		setActiveConversationRunSurfaces([]);
		setConversationError(null);
		setMemberError(null);
	}, []);

	const buildRequestMessages = useCallback(
		(prompt: string): readonly ModelMessage[] => {
			const normalizedPrompt = prompt.trim();
			return [
				...requestHistoryMessages,
				{
					content: normalizedPrompt,
					role: 'user',
				},
			];
		},
		[requestHistoryMessages],
	);

	const handleRunAccepted = useCallback(
		(input: {
			readonly conversationId?: string;
			readonly prompt: string;
		}): void => {
			const now = new Date().toISOString();
			const conversationId = input.conversationId?.trim();

			if (!conversationId) {
				return;
			}

			isDraftConversationRef.current = false;
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
					title:
						existingConversation?.title ?? (summarizePrompt(input.prompt, 64) || 'Yeni sohbet'),
					updated_at: now,
				};

				return [
					nextConversation,
					...currentConversations.filter(
						(conversation) => conversation.conversation_id !== conversationId,
					),
				];
			});
		},
		[],
	);

	const handleRunFinished = useCallback(
		(input: { readonly conversationId?: string }): void => {
			const conversationId = input.conversationId ?? activeConversationId;

			if (!conversationId) {
				return;
			}

			void (async () => {
				try {
					const [nextConversations, nextMessages, nextMembers, nextSurfaces] = await Promise.all([
						fetchConversationList(accessToken),
						fetchConversationMessages(conversationId, accessToken),
						fetchConversationMembers(conversationId, accessToken),
						fetchConversationBlocks(conversationId, accessToken).catch(
							() => [] as readonly ConversationRunSurface[],
						),
					]);
					setConversations(nextConversations);
					setActiveConversationId(conversationId);
					setActiveConversationMessages(nextMessages);
					setActiveConversationMembers(nextMembers);
					setActiveConversationRunSurfaces(nextSurfaces);
					setConversationError(null);
					setMemberError(null);
				} catch (error) {
					setConversationError(
						error instanceof Error ? error.message : 'Conversation senkronizasyonu basarisiz oldu.',
					);
				}
			})();
		},
		[accessToken, activeConversationId],
	);

	const handleRunFinishing = useCallback(
		(input: {
			readonly conversationId: string;
			readonly runId: string;
			readonly streamingText: string;
		}): void => {
			const now = new Date().toISOString();
			setActiveConversationMessages((currentMessages) => {
				if (currentMessages.some((m) => m.run_id === input.runId && m.role === 'assistant')) {
					return currentMessages;
				}
				return [
					...currentMessages,
					{
						content: input.streamingText.trim(),
						conversation_id: input.conversationId,
						created_at: now,
						message_id: `optimistic:assistant:${input.runId}`,
						role: 'assistant' as const,
						run_id: input.runId,
						sequence_no: currentMessages.length + 1,
					},
				];
			});
		},
		[],
	);

	const shareConversationMember = useCallback(
		async (memberUserId: string, role: Exclude<ConversationAccessRole, 'owner'>): Promise<void> => {
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
		},
		[accessToken, activeConversationId],
	);

	const removeConversationMember = useCallback(
		async (memberUserId: string): Promise<void> => {
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
		},
		[accessToken, activeConversationId],
	);

	return useMemo(
		() => ({
			activeConversationId,
			activeConversationMembers,
			activeConversationMessages,
			activeConversationRunSurfaces,
			activeConversationSummary,
			beginDraftConversation,
			buildRequestMessages,
			conversationError,
			conversations,
			handleRunAccepted,
			handleRunFinished,
			handleRunFinishing,
			isConversationLoading,
			isMemberLoading,
			memberError,
			removeConversationMember,
			selectConversation,
			shareConversationMember,
		}),
		[
			activeConversationId,
			activeConversationMembers,
			activeConversationMessages,
			activeConversationRunSurfaces,
			activeConversationSummary,
			beginDraftConversation,
			buildRequestMessages,
			conversationError,
			conversations,
			handleRunAccepted,
			handleRunFinished,
			handleRunFinishing,
			isConversationLoading,
			isMemberLoading,
			memberError,
			removeConversationMember,
			selectConversation,
			shareConversationMember,
		],
	);
}
