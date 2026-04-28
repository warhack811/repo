import { and, asc, desc, eq } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type { RunaDatabase } from './client.js';
import {
	conversationMembersTable,
	conversationMessagesTable,
	conversationsTable,
} from './schema.js';

export type ConversationRecord = InferSelectModel<typeof conversationsTable>;
export type NewConversationRecord = InferInsertModel<typeof conversationsTable>;
export type ConversationMessageRecord = InferSelectModel<typeof conversationMessagesTable>;
export type NewConversationMessageRecord = InferInsertModel<typeof conversationMessagesTable>;
export type ConversationMemberRecord = InferSelectModel<typeof conversationMembersTable>;
export type NewConversationMemberRecord = InferInsertModel<typeof conversationMembersTable>;

export interface ListConversationRowsInput {
	readonly include_shared_with_user_id?: string;
	readonly limit?: number;
	readonly session_id?: string;
	readonly tenant_id?: string;
	readonly user_id?: string;
	readonly workspace_id?: string;
}

export interface ConversationDatabaseClient {
	get_conversation_row(conversation_id: string): Promise<ConversationRecord | null>;
	get_conversation_member_row(
		conversation_id: string,
		member_user_id: string,
	): Promise<ConversationMemberRecord | null>;
	insert_conversation_message_row(
		row: NewConversationMessageRecord,
	): Promise<ConversationMessageRecord>;
	delete_conversation_member_row(conversation_id: string, member_user_id: string): Promise<void>;
	list_conversation_member_rows(
		conversation_id: string,
	): Promise<readonly ConversationMemberRecord[]>;
	list_conversation_message_rows(
		conversation_id: string,
	): Promise<readonly ConversationMessageRecord[]>;
	list_conversation_rows(input: ListConversationRowsInput): Promise<readonly ConversationRecord[]>;
	upsert_conversation_member_row(
		row: NewConversationMemberRecord,
	): Promise<ConversationMemberRecord>;
	upsert_conversation_row(row: NewConversationRecord): Promise<ConversationRecord>;
}

function normalizeLimit(limit: number | undefined): number | undefined {
	if (limit === undefined || !Number.isFinite(limit) || limit < 1) {
		return undefined;
	}

	return Math.trunc(limit);
}

export function createConversationDatabaseClient(db: RunaDatabase): ConversationDatabaseClient {
	return {
		async get_conversation_row(conversation_id) {
			const rows = await db
				.select()
				.from(conversationsTable)
				.where(eq(conversationsTable.conversation_id, conversation_id))
				.limit(1);

			return rows[0] ?? null;
		},
		async get_conversation_member_row(conversation_id, member_user_id) {
			const rows = await db
				.select()
				.from(conversationMembersTable)
				.where(
					and(
						eq(conversationMembersTable.conversation_id, conversation_id),
						eq(conversationMembersTable.member_user_id, member_user_id),
					),
				)
				.limit(1);

			return rows[0] ?? null;
		},
		async insert_conversation_message_row(row) {
			const rows = await db.insert(conversationMessagesTable).values(row).returning();
			const persistedRow = rows[0];

			if (persistedRow === undefined) {
				throw new Error(
					`Conversation message row "${row.message_id}" was not returned after insert.`,
				);
			}

			return persistedRow;
		},
		async delete_conversation_member_row(conversation_id, member_user_id) {
			await db
				.delete(conversationMembersTable)
				.where(
					and(
						eq(conversationMembersTable.conversation_id, conversation_id),
						eq(conversationMembersTable.member_user_id, member_user_id),
					),
				);
		},
		async list_conversation_member_rows(conversation_id) {
			return db
				.select()
				.from(conversationMembersTable)
				.where(eq(conversationMembersTable.conversation_id, conversation_id))
				.orderBy(
					asc(conversationMembersTable.created_at),
					asc(conversationMembersTable.member_user_id),
				);
		},
		async list_conversation_message_rows(conversation_id) {
			return db
				.select()
				.from(conversationMessagesTable)
				.where(eq(conversationMessagesTable.conversation_id, conversation_id))
				.orderBy(
					asc(conversationMessagesTable.sequence_no),
					asc(conversationMessagesTable.created_at),
				);
		},
		async list_conversation_rows(input) {
			const conditions = [];

			if (input.user_id !== undefined) {
				conditions.push(eq(conversationsTable.user_id, input.user_id));
			}

			if (input.session_id !== undefined) {
				conditions.push(eq(conversationsTable.session_id, input.session_id));
			}

			if (input.tenant_id !== undefined) {
				conditions.push(eq(conversationsTable.tenant_id, input.tenant_id));
			}

			if (input.workspace_id !== undefined) {
				conditions.push(eq(conversationsTable.workspace_id, input.workspace_id));
			}

			let ownedQuery = db
				.select()
				.from(conversationsTable)
				.orderBy(desc(conversationsTable.last_message_at), desc(conversationsTable.updated_at))
				.$dynamic();

			if (conditions.length > 0) {
				ownedQuery = ownedQuery.where(and(...conditions));
			}

			const limit = normalizeLimit(input.limit);

			if (limit !== undefined) {
				ownedQuery = ownedQuery.limit(limit);
			}

			const ownedRows = await ownedQuery;

			if (!input.include_shared_with_user_id) {
				return ownedRows;
			}

			const memberConditions = [
				eq(conversationMembersTable.member_user_id, input.include_shared_with_user_id),
			];

			if (input.tenant_id !== undefined) {
				memberConditions.push(eq(conversationMembersTable.tenant_id, input.tenant_id));
			}

			if (input.workspace_id !== undefined) {
				memberConditions.push(eq(conversationMembersTable.workspace_id, input.workspace_id));
			}

			let sharedQuery = db
				.select({
					conversation: conversationsTable,
				})
				.from(conversationMembersTable)
				.innerJoin(
					conversationsTable,
					eq(conversationMembersTable.conversation_id, conversationsTable.conversation_id),
				)
				.where(and(...memberConditions))
				.orderBy(desc(conversationsTable.last_message_at), desc(conversationsTable.updated_at))
				.$dynamic();

			if (limit !== undefined) {
				sharedQuery = sharedQuery.limit(limit);
			}

			const sharedRows = (await sharedQuery).map((row) => row.conversation);
			const rowsById = new Map(
				[...ownedRows, ...sharedRows].map((row) => [row.conversation_id, row] as const),
			);

			return [...rowsById.values()].sort((left, right) => {
				if (left.last_message_at === right.last_message_at) {
					return right.updated_at.localeCompare(left.updated_at);
				}

				return right.last_message_at.localeCompare(left.last_message_at);
			});
		},
		async upsert_conversation_member_row(row) {
			const rows = await db
				.insert(conversationMembersTable)
				.values(row)
				.onConflictDoUpdate({
					set: {
						added_by_user_id: row.added_by_user_id,
						member_role: row.member_role,
						tenant_id: row.tenant_id,
						updated_at: row.updated_at,
						workspace_id: row.workspace_id,
					},
					target: [
						conversationMembersTable.conversation_id,
						conversationMembersTable.member_user_id,
					],
				})
				.returning();

			const persistedRow = rows[0];

			if (persistedRow === undefined) {
				throw new Error(
					`Conversation member row "${row.conversation_id}:${row.member_user_id}" was not returned after upsert.`,
				);
			}

			return persistedRow;
		},
		async upsert_conversation_row(row) {
			const rows = await db
				.insert(conversationsTable)
				.values(row)
				.onConflictDoUpdate({
					set: {
						last_message_at: row.last_message_at,
						last_message_preview: row.last_message_preview,
						session_id: row.session_id,
						tenant_id: row.tenant_id,
						title: row.title,
						updated_at: row.updated_at,
						user_id: row.user_id,
						workspace_id: row.workspace_id,
					},
					target: conversationsTable.conversation_id,
				})
				.returning();

			const persistedRow = rows[0];

			if (persistedRow === undefined) {
				throw new Error(`Conversation row "${row.conversation_id}" was not returned after upsert.`);
			}

			return persistedRow;
		},
	};
}
