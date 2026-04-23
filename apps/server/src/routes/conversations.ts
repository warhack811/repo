import type { FastifyInstance, FastifyReply } from 'fastify';

import { requireAuthenticatedRequest } from '../auth/supabase-auth.js';
import {
	ConversationStoreAccessError,
	ConversationStoreWriteError,
	conversationScopeFromAuthContext,
	listConversationMembers,
	listConversationMessages,
	listConversations,
	removeConversationMember,
	shareConversationWithMember,
} from '../persistence/conversation-store.js';

interface ConversationListReply {
	readonly conversations: Awaited<ReturnType<typeof listConversations>>;
}

interface ConversationMessagesReply {
	readonly conversation_id: string;
	readonly messages: Awaited<ReturnType<typeof listConversationMessages>>;
}

interface ConversationMembersReply {
	readonly conversation_id: string;
	readonly members: Awaited<ReturnType<typeof listConversationMembers>>;
}

interface ConversationParams {
	readonly conversationId: string;
}

interface ConversationMemberParams extends ConversationParams {
	readonly memberUserId: string;
}

interface ShareConversationBody {
	readonly member_role: 'editor' | 'viewer';
	readonly member_user_id: string;
}

export interface RegisterConversationRoutesOptions {
	readonly list_conversation_members?: typeof listConversationMembers;
	readonly list_conversation_messages?: typeof listConversationMessages;
	readonly list_conversations?: typeof listConversations;
	readonly remove_conversation_member?: typeof removeConversationMember;
	readonly share_conversation_with_member?: typeof shareConversationWithMember;
}

function normalizeConversationId(value: string): string {
	const normalized = value.trim();

	if (normalized.length === 0) {
		throw new ConversationStoreAccessError('Conversation not found for the current user.');
	}

	return normalized;
}

function normalizeMemberUserId(value: string): string {
	const normalized = value.trim();

	if (normalized.length === 0) {
		throw new ConversationStoreWriteError('Conversation member user id is invalid.');
	}

	return normalized;
}

function isShareConversationBody(value: unknown): value is ShareConversationBody {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}

	return (
		typeof (value as ShareConversationBody).member_user_id === 'string' &&
		((value as ShareConversationBody).member_role === 'editor' ||
			(value as ShareConversationBody).member_role === 'viewer')
	);
}

function replyWithConversationStoreError(
	reply: FastifyReply,
	error: ConversationStoreAccessError | ConversationStoreWriteError,
) {
	const statusCode = error instanceof ConversationStoreAccessError ? 404 : 400;
	const errorLabel = statusCode === 404 ? 'Not Found' : 'Bad Request';

	return reply.code(statusCode).send({
		error: errorLabel,
		message: error.message,
		statusCode,
	});
}

export async function registerConversationRoutes(
	server: FastifyInstance,
	options: RegisterConversationRoutesOptions = {},
): Promise<void> {
	const listConversationMembersRoute = options.list_conversation_members ?? listConversationMembers;
	const listConversationMessagesRoute =
		options.list_conversation_messages ?? listConversationMessages;
	const listConversationsRoute = options.list_conversations ?? listConversations;
	const removeConversationMemberRoute =
		options.remove_conversation_member ?? removeConversationMember;
	const shareConversationWithMemberRoute =
		options.share_conversation_with_member ?? shareConversationWithMember;

	server.get<{ Reply: ConversationListReply }>('/conversations', async (request) => {
		requireAuthenticatedRequest(request);

		return {
			conversations: await listConversationsRoute(conversationScopeFromAuthContext(request.auth)),
		};
	});

	server.get<{ Params: ConversationParams }>(
		'/conversations/:conversationId/messages',
		async (request, reply) => {
			requireAuthenticatedRequest(request);
			try {
				const conversationId = normalizeConversationId(request.params.conversationId);
				return {
					conversation_id: conversationId,
					messages: await listConversationMessagesRoute(
						conversationId,
						conversationScopeFromAuthContext(request.auth),
					),
				};
			} catch (error) {
				if (error instanceof ConversationStoreAccessError) {
					return replyWithConversationStoreError(reply, error);
				}

				throw error;
			}
		},
	);

	server.get<{ Params: ConversationParams }>(
		'/conversations/:conversationId/members',
		async (request, reply) => {
			requireAuthenticatedRequest(request);
			try {
				const conversationId = normalizeConversationId(request.params.conversationId);
				return {
					conversation_id: conversationId,
					members: await listConversationMembersRoute(
						conversationId,
						conversationScopeFromAuthContext(request.auth),
					),
				};
			} catch (error) {
				if (error instanceof ConversationStoreAccessError) {
					return replyWithConversationStoreError(reply, error);
				}

				throw error;
			}
		},
	);

	server.post<{ Body: ShareConversationBody; Params: ConversationParams }>(
		'/conversations/:conversationId/members',
		async (request, reply) => {
			requireAuthenticatedRequest(request);

			if (!isShareConversationBody(request.body)) {
				return reply.code(400).send({
					error: 'Bad Request',
					message: 'Conversation member payload is invalid.',
					statusCode: 400,
				});
			}

			try {
				return await shareConversationWithMemberRoute({
					conversation_id: normalizeConversationId(request.params.conversationId),
					member_role: request.body.member_role,
					member_user_id: normalizeMemberUserId(request.body.member_user_id),
					scope: conversationScopeFromAuthContext(request.auth),
				});
			} catch (error) {
				if (
					error instanceof ConversationStoreAccessError ||
					error instanceof ConversationStoreWriteError
				) {
					return replyWithConversationStoreError(reply, error);
				}

				throw error;
			}
		},
	);

	server.delete<{ Params: ConversationMemberParams }>(
		'/conversations/:conversationId/members/:memberUserId',
		async (request, reply) => {
			requireAuthenticatedRequest(request);

			try {
				await removeConversationMemberRoute({
					conversation_id: normalizeConversationId(request.params.conversationId),
					member_user_id: normalizeMemberUserId(request.params.memberUserId),
					scope: conversationScopeFromAuthContext(request.auth),
				});
				return reply.code(204).send();
			} catch (error) {
				if (
					error instanceof ConversationStoreAccessError ||
					error instanceof ConversationStoreWriteError
				) {
					return replyWithConversationStoreError(reply, error);
				}

				throw error;
			}
		},
	);
}
