import { randomUUID } from 'node:crypto';

import {
	type ConversationMemberRecord as DatabaseConversationMemberRecord,
	type ConversationMessageRecord as DatabaseConversationMessageRecord,
	type ConversationRecord as DatabaseConversationRecord,
	type ConversationRunBlocksRecord as DatabaseConversationRunBlocksRecord,
	type NewConversationMemberRecord,
	type NewConversationMessageRecord,
	type NewConversationRecord,
	type NewConversationRunBlocksRecord,
	createConversationDatabaseClient,
	createDatabaseConnection,
	ensureDatabaseSchema,
} from '@runa/db';
import type { AuthContext, ModelMessageRole, RenderBlock } from '@runa/types';

import {
	hasPersistenceDatabaseConfiguration,
	resolvePersistenceDatabaseUrl,
} from './database-config.js';

export type ConversationMemberRole = 'editor' | 'owner' | 'viewer';

export interface ConversationSummary {
	readonly access_role: ConversationMemberRole;
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
	readonly role: ModelMessageRole;
	readonly run_id?: string;
	readonly sequence_no: number;
	readonly trace_id?: string;
}

export interface ConversationRunBlocks {
	readonly block_record_id: string;
	readonly blocks: readonly RenderBlock[];
	readonly conversation_id: string;
	readonly created_at: string;
	readonly run_id: string;
	readonly trace_id: string;
}

export interface ConversationMember {
	readonly added_by_user_id?: string;
	readonly conversation_id: string;
	readonly created_at: string;
	readonly member_role: ConversationMemberRole;
	readonly member_user_id: string;
	readonly updated_at: string;
}

export interface ConversationOwnershipScope {
	readonly session_id?: string;
	readonly tenant_id?: string;
	readonly user_id?: string;
	readonly workspace_id?: string;
}

export interface EnsureConversationInput {
	readonly conversation_id?: string;
	readonly created_at?: string;
	readonly initial_preview?: string;
	readonly scope: ConversationOwnershipScope;
}

export interface AppendConversationMessageInput {
	readonly content: string;
	readonly conversation_id: string;
	readonly created_at?: string;
	readonly role: ModelMessageRole;
	readonly run_id?: string;
	readonly scope: ConversationOwnershipScope;
	readonly trace_id?: string;
}

export interface AppendConversationRunBlocksInput {
	readonly blocks: readonly RenderBlock[];
	readonly conversation_id: string;
	readonly created_at?: string;
	readonly run_id: string;
	readonly scope: ConversationOwnershipScope;
	readonly trace_id: string;
}

export interface ConversationRecordWriter {
	deleteConversationMember(conversation_id: string, member_user_id: string): Promise<void>;
	getConversationById(conversation_id: string): Promise<DatabaseConversationRecord | null>;
	getConversationMember(
		conversation_id: string,
		member_user_id: string,
	): Promise<DatabaseConversationMemberRecord | null>;
	insertConversationMessage(
		record: NewConversationMessageRecord,
	): Promise<DatabaseConversationMessageRecord>;
	insertConversationRunBlocks(
		record: NewConversationRunBlocksRecord,
	): Promise<DatabaseConversationRunBlocksRecord>;
	listConversationMembers(
		conversation_id: string,
	): Promise<readonly DatabaseConversationMemberRecord[]>;
	listConversationMessages(
		conversation_id: string,
	): Promise<readonly DatabaseConversationMessageRecord[]>;
	listConversationRunBlocks(
		conversation_id: string,
	): Promise<readonly DatabaseConversationRunBlocksRecord[]>;
	listConversations(
		scope: ConversationOwnershipScope,
	): Promise<readonly DatabaseConversationRecord[]>;
	upsertConversation(record: NewConversationRecord): Promise<DatabaseConversationRecord>;
	upsertConversationMember(
		record: NewConversationMemberRecord,
	): Promise<DatabaseConversationMemberRecord>;
}

interface PersistOptions {
	readonly writer?: ConversationRecordWriter;
}

class DatabaseConversationRecordWriter implements ConversationRecordWriter {
	#client: ReturnType<typeof createConversationDatabaseClient>;
	#ready: Promise<void>;

	constructor(databaseUrl: string) {
		const connection = createDatabaseConnection(databaseUrl);
		this.#client = createConversationDatabaseClient(connection.db);
		this.#ready = ensureDatabaseSchema(connection);
	}

	async deleteConversationMember(conversation_id: string, member_user_id: string): Promise<void> {
		await this.#ready;
		await this.#client.delete_conversation_member_row(conversation_id, member_user_id);
	}

	async getConversationById(conversation_id: string): Promise<DatabaseConversationRecord | null> {
		await this.#ready;
		return this.#client.get_conversation_row(conversation_id);
	}

	async getConversationMember(
		conversation_id: string,
		member_user_id: string,
	): Promise<DatabaseConversationMemberRecord | null> {
		await this.#ready;
		return this.#client.get_conversation_member_row(conversation_id, member_user_id);
	}

	async insertConversationMessage(
		record: NewConversationMessageRecord,
	): Promise<DatabaseConversationMessageRecord> {
		await this.#ready;
		return this.#client.insert_conversation_message_row(record);
	}

	async insertConversationRunBlocks(
		record: NewConversationRunBlocksRecord,
	): Promise<DatabaseConversationRunBlocksRecord> {
		await this.#ready;
		return this.#client.upsert_conversation_run_blocks_row(record);
	}

	async listConversationMembers(
		conversation_id: string,
	): Promise<readonly DatabaseConversationMemberRecord[]> {
		await this.#ready;
		return this.#client.list_conversation_member_rows(conversation_id);
	}

	async listConversationMessages(
		conversation_id: string,
	): Promise<readonly DatabaseConversationMessageRecord[]> {
		await this.#ready;
		return this.#client.list_conversation_message_rows(conversation_id);
	}

	async listConversationRunBlocks(
		conversation_id: string,
	): Promise<readonly DatabaseConversationRunBlocksRecord[]> {
		await this.#ready;
		return this.#client.list_conversation_run_blocks_rows(conversation_id);
	}

	async listConversations(
		scope: ConversationOwnershipScope,
	): Promise<readonly DatabaseConversationRecord[]> {
		await this.#ready;
		return this.#client.list_conversation_rows({
			...scope,
			include_shared_with_user_id: scope.user_id,
		});
	}

	async upsertConversation(record: NewConversationRecord): Promise<DatabaseConversationRecord> {
		await this.#ready;
		return this.#client.upsert_conversation_row(record);
	}

	async upsertConversationMember(
		record: NewConversationMemberRecord,
	): Promise<DatabaseConversationMemberRecord> {
		await this.#ready;
		return this.#client.upsert_conversation_member_row(record);
	}
}

export class ConversationStoreConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConversationStoreConfigurationError';
	}
}

export class ConversationStoreReadError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'ConversationStoreReadError';
	}
}

export class ConversationStoreWriteError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'ConversationStoreWriteError';
	}
}

export class ConversationStoreAccessError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConversationStoreAccessError';
	}
}

let defaultWriterPromise: Promise<ConversationRecordWriter> | null = null;

function getDatabaseUrl(): string {
	return resolvePersistenceDatabaseUrl(
		(message) => new ConversationStoreConfigurationError(message),
		'DATABASE_URL is required for conversation persistence.',
	);
}

async function getDefaultWriter(): Promise<ConversationRecordWriter> {
	if (!defaultWriterPromise) {
		defaultWriterPromise = Promise.resolve(new DatabaseConversationRecordWriter(getDatabaseUrl()));
	}

	try {
		return await defaultWriterPromise;
	} catch (error) {
		defaultWriterPromise = null;
		throw error;
	}
}

function summarizeConversationText(value: string, maxLength: number): string {
	const normalized = value.replace(/\s+/gu, ' ').trim();
	return normalized.length <= maxLength
		? normalized
		: `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function toConversationSummary(
	record: DatabaseConversationRecord,
	role: ConversationMemberRole,
): ConversationSummary {
	return {
		access_role: role,
		conversation_id: record.conversation_id,
		created_at: record.created_at,
		last_message_at: record.last_message_at,
		last_message_preview: record.last_message_preview,
		owner_user_id: record.user_id ?? undefined,
		title: record.title,
		updated_at: record.updated_at,
	};
}

function toConversationRunBlocks(
	record: DatabaseConversationRunBlocksRecord,
): ConversationRunBlocks {
	return {
		block_record_id: record.block_record_id,
		blocks: record.blocks,
		conversation_id: record.conversation_id,
		created_at: record.created_at,
		run_id: record.run_id,
		trace_id: record.trace_id,
	};
}

function toConversationMessage(record: DatabaseConversationMessageRecord): ConversationMessage {
	return {
		content: record.content,
		conversation_id: record.conversation_id,
		created_at: record.created_at,
		message_id: record.message_id,
		role: record.role,
		run_id: record.run_id ?? undefined,
		sequence_no: record.sequence_no,
		trace_id: record.trace_id ?? undefined,
	};
}

function toConversationMember(record: DatabaseConversationMemberRecord): ConversationMember {
	return {
		added_by_user_id: record.added_by_user_id ?? undefined,
		conversation_id: record.conversation_id,
		created_at: record.created_at,
		member_role: record.member_role,
		member_user_id: record.member_user_id,
		updated_at: record.updated_at,
	};
}

function recordMatchesScope(
	record: DatabaseConversationRecord,
	scope: ConversationOwnershipScope,
): boolean {
	if (scope.user_id !== undefined && record.user_id !== scope.user_id) {
		return false;
	}

	if (
		scope.user_id === undefined &&
		scope.session_id !== undefined &&
		record.session_id !== scope.session_id
	) {
		return false;
	}

	if (scope.tenant_id !== undefined && record.tenant_id !== scope.tenant_id) {
		return false;
	}

	if (scope.workspace_id !== undefined && record.workspace_id !== scope.workspace_id) {
		return false;
	}

	return true;
}

function toConversationRoleWeight(role: ConversationMemberRole): number {
	switch (role) {
		case 'owner':
			return 3;
		case 'editor':
			return 2;
		case 'viewer':
			return 1;
	}
}

function hasRequiredConversationRole(
	role: ConversationMemberRole,
	requiredRole: ConversationMemberRole,
): boolean {
	return toConversationRoleWeight(role) >= toConversationRoleWeight(requiredRole);
}

async function resolveConversationRole(
	writer: ConversationRecordWriter,
	record: DatabaseConversationRecord,
	scope: ConversationOwnershipScope,
): Promise<ConversationMemberRole | null> {
	if (recordMatchesScope(record, scope)) {
		return 'owner';
	}

	if (!scope.user_id) {
		return null;
	}

	const membership = await writer.getConversationMember(record.conversation_id, scope.user_id);

	if (!membership) {
		return null;
	}

	if (
		(scope.tenant_id !== undefined && membership.tenant_id !== scope.tenant_id) ||
		(scope.workspace_id !== undefined && membership.workspace_id !== scope.workspace_id)
	) {
		return null;
	}

	return membership.member_role;
}

function toConversationRecord(
	input: Readonly<{
		readonly conversation_id: string;
		readonly created_at: string;
		readonly existing?: DatabaseConversationRecord | null;
		readonly last_message_at: string;
		readonly last_message_preview: string;
		readonly scope: ConversationOwnershipScope;
		readonly title: string;
	}>,
): NewConversationRecord {
	return {
		conversation_id: input.conversation_id,
		created_at: input.existing?.created_at ?? input.created_at,
		last_message_at: input.last_message_at,
		last_message_preview: input.last_message_preview,
		session_id: input.scope.session_id ?? input.existing?.session_id ?? null,
		tenant_id: input.scope.tenant_id ?? input.existing?.tenant_id ?? null,
		title: input.title,
		updated_at: input.last_message_at,
		user_id: input.scope.user_id ?? input.existing?.user_id ?? null,
		workspace_id: input.scope.workspace_id ?? input.existing?.workspace_id ?? null,
	};
}

function toConversationRunBlocksRecord(
	input: Readonly<{
		readonly blocks: readonly RenderBlock[];
		readonly conversation_id: string;
		readonly created_at: string;
		readonly run_id: string;
		readonly scope: ConversationOwnershipScope;
		readonly trace_id: string;
	}>,
): NewConversationRunBlocksRecord {
	return {
		block_record_id: randomUUID(),
		blocks: input.blocks,
		conversation_id: input.conversation_id,
		created_at: input.created_at,
		run_id: input.run_id,
		tenant_id: input.scope.tenant_id ?? null,
		trace_id: input.trace_id,
		user_id: input.scope.user_id ?? null,
		workspace_id: input.scope.workspace_id ?? null,
	};
}

function toConversationMessageRecord(
	input: Readonly<{
		readonly content: string;
		readonly conversation_id: string;
		readonly created_at: string;
		readonly role: ModelMessageRole;
		readonly run_id?: string;
		readonly scope: ConversationOwnershipScope;
		readonly sequence_no: number;
		readonly trace_id?: string;
	}>,
): NewConversationMessageRecord {
	return {
		content: input.content,
		conversation_id: input.conversation_id,
		created_at: input.created_at,
		message_id: randomUUID(),
		role: input.role,
		run_id: input.run_id ?? null,
		sequence_no: input.sequence_no,
		tenant_id: input.scope.tenant_id ?? null,
		trace_id: input.trace_id ?? null,
		user_id: input.scope.user_id ?? null,
		workspace_id: input.scope.workspace_id ?? null,
	};
}

function toConversationMemberRecord(
	input: Readonly<{
		readonly added_by_user_id: string;
		readonly conversation_id: string;
		readonly member_role: Extract<ConversationMemberRole, 'editor' | 'viewer'>;
		readonly member_user_id: string;
		readonly scope: ConversationOwnershipScope;
		readonly timestamp: string;
	}>,
): NewConversationMemberRecord {
	return {
		added_by_user_id: input.added_by_user_id,
		conversation_id: input.conversation_id,
		created_at: input.timestamp,
		member_role: input.member_role,
		member_user_id: input.member_user_id,
		tenant_id: input.scope.tenant_id ?? null,
		updated_at: input.timestamp,
		workspace_id: input.scope.workspace_id ?? null,
	};
}

async function requireConversationRole(
	writer: ConversationRecordWriter,
	conversation_id: string,
	scope: ConversationOwnershipScope,
	requiredRole: ConversationMemberRole,
): Promise<
	Readonly<{
		readonly conversation: DatabaseConversationRecord;
		readonly role: ConversationMemberRole;
	}>
> {
	const conversation = await writer.getConversationById(conversation_id);

	if (!conversation) {
		throw new ConversationStoreAccessError('Conversation not found for the current user.');
	}

	const role = await resolveConversationRole(writer, conversation, scope);

	if (!role || !hasRequiredConversationRole(role, requiredRole)) {
		throw new ConversationStoreAccessError('Conversation not found for the current user.');
	}

	return {
		conversation,
		role,
	};
}

export function conversationScopeFromAuthContext(
	authContext: AuthContext | undefined,
): ConversationOwnershipScope {
	if (!authContext) {
		return {};
	}

	const principal = authContext.principal;

	return {
		session_id:
			authContext.session?.session_id ??
			(principal.kind === 'anonymous' ? undefined : principal.session_id) ??
			authContext.claims?.session_id,
		tenant_id:
			principal.scope.tenant_id ??
			authContext.session?.scope.tenant_id ??
			authContext.user?.scope.tenant_id,
		user_id:
			principal.kind === 'authenticated'
				? principal.user_id
				: (authContext.session?.user_id ?? authContext.user?.user_id),
		workspace_id:
			principal.scope.workspace_id ??
			authContext.session?.scope.workspace_id ??
			authContext.user?.scope.workspace_id,
	};
}

export function hasConversationStoreConfiguration(): boolean {
	return hasPersistenceDatabaseConfiguration();
}

export async function ensureConversation(
	input: EnsureConversationInput,
	options: PersistOptions = {},
): Promise<ConversationSummary> {
	const writer = options.writer ?? (await getDefaultWriter());
	const now = input.created_at ?? new Date().toISOString();
	const conversationId = input.conversation_id ?? randomUUID();

	try {
		const existing = await writer.getConversationById(conversationId);

		if (existing) {
			const role = await resolveConversationRole(writer, existing, input.scope);

			if (!role || !hasRequiredConversationRole(role, 'editor')) {
				throw new ConversationStoreAccessError('Conversation not found for the current user.');
			}

			return toConversationSummary(existing, role);
		}

		const preview = summarizeConversationText(input.initial_preview ?? 'Yeni sohbet', 160);
		const title = summarizeConversationText(input.initial_preview ?? 'Yeni sohbet', 64);
		const persisted = await writer.upsertConversation(
			toConversationRecord({
				conversation_id: conversationId,
				created_at: now,
				last_message_at: now,
				last_message_preview: preview,
				scope: input.scope,
				title,
			}),
		);

		return toConversationSummary(persisted, 'owner');
	} catch (error) {
		if (
			error instanceof ConversationStoreAccessError ||
			error instanceof ConversationStoreConfigurationError ||
			error instanceof ConversationStoreWriteError
		) {
			throw error;
		}

		throw new ConversationStoreWriteError('Failed to ensure conversation.', {
			cause: error,
		});
	}
}

export async function appendConversationRunBlocks(
	input: AppendConversationRunBlocksInput,
	options: PersistOptions = {},
): Promise<ConversationRunBlocks> {
	const writer = options.writer ?? (await getDefaultWriter());
	const createdAt = input.created_at ?? new Date().toISOString();

	try {
		await requireConversationRole(writer, input.conversation_id, input.scope, 'editor');
		const persisted = await writer.insertConversationRunBlocks(
			toConversationRunBlocksRecord({
				blocks: input.blocks,
				conversation_id: input.conversation_id,
				created_at: createdAt,
				run_id: input.run_id,
				scope: input.scope,
				trace_id: input.trace_id,
			}),
		);
		return toConversationRunBlocks(persisted);
	} catch (error) {
		if (
			error instanceof ConversationStoreAccessError ||
			error instanceof ConversationStoreConfigurationError ||
			error instanceof ConversationStoreWriteError
		) {
			throw error;
		}

		throw new ConversationStoreWriteError('Failed to append conversation run blocks.', {
			cause: error,
		});
	}
}

export async function appendConversationMessage(
	input: AppendConversationMessageInput,
	options: PersistOptions = {},
): Promise<ConversationMessage> {
	const writer = options.writer ?? (await getDefaultWriter());
	const createdAt = input.created_at ?? new Date().toISOString();

	try {
		const { conversation: existingConversation } = await requireConversationRole(
			writer,
			input.conversation_id,
			input.scope,
			'editor',
		);
		const existingMessages = await writer.listConversationMessages(input.conversation_id);
		const nextSequenceNo = (existingMessages.at(-1)?.sequence_no ?? 0) + 1;
		const persistedConversation = await writer.upsertConversation(
			toConversationRecord({
				conversation_id: input.conversation_id,
				created_at: existingConversation.created_at,
				existing: existingConversation,
				last_message_at: createdAt,
				last_message_preview: summarizeConversationText(input.content, 160),
				scope: input.scope,
				title:
					existingMessages.length === 0 && input.role === 'user'
						? summarizeConversationText(input.content, 64)
						: existingConversation.title,
			}),
		);
		const persistedMessage = await writer.insertConversationMessage(
			toConversationMessageRecord({
				content: input.content,
				conversation_id: persistedConversation.conversation_id,
				created_at: createdAt,
				role: input.role,
				run_id: input.run_id,
				scope: input.scope,
				sequence_no: nextSequenceNo,
				trace_id: input.trace_id,
			}),
		);

		return toConversationMessage(persistedMessage);
	} catch (error) {
		if (
			error instanceof ConversationStoreAccessError ||
			error instanceof ConversationStoreConfigurationError ||
			error instanceof ConversationStoreWriteError
		) {
			throw error;
		}

		throw new ConversationStoreWriteError('Failed to append conversation message.', {
			cause: error,
		});
	}
}

export async function listConversations(
	scope: ConversationOwnershipScope,
	options: PersistOptions = {},
): Promise<readonly ConversationSummary[]> {
	try {
		const writer = options.writer ?? (await getDefaultWriter());
		const records = await writer.listConversations(scope);
		const summaries = await Promise.all(
			records.map(async (record) => {
				const role = await resolveConversationRole(writer, record, scope);
				return role ? toConversationSummary(record, role) : null;
			}),
		);
		return summaries.filter((summary): summary is ConversationSummary => summary !== null);
	} catch (error) {
		if (
			error instanceof ConversationStoreConfigurationError ||
			error instanceof ConversationStoreReadError
		) {
			throw error;
		}

		throw new ConversationStoreReadError('Failed to list conversations.', {
			cause: error,
		});
	}
}

export async function listConversationMessages(
	conversation_id: string,
	scope: ConversationOwnershipScope,
	options: PersistOptions = {},
): Promise<readonly ConversationMessage[]> {
	try {
		const writer = options.writer ?? (await getDefaultWriter());
		await requireConversationRole(writer, conversation_id, scope, 'viewer');
		const records = await writer.listConversationMessages(conversation_id);
		return records.map(toConversationMessage);
	} catch (error) {
		if (
			error instanceof ConversationStoreAccessError ||
			error instanceof ConversationStoreConfigurationError ||
			error instanceof ConversationStoreReadError
		) {
			throw error;
		}

		throw new ConversationStoreReadError('Failed to list conversation messages.', {
			cause: error,
		});
	}
}

export async function listConversationRunBlocks(
	conversation_id: string,
	scope: ConversationOwnershipScope,
	options: PersistOptions = {},
): Promise<readonly ConversationRunBlocks[]> {
	try {
		const writer = options.writer ?? (await getDefaultWriter());
		await requireConversationRole(writer, conversation_id, scope, 'viewer');
		const records = await writer.listConversationRunBlocks(conversation_id);
		return records.map(toConversationRunBlocks);
	} catch (error) {
		if (
			error instanceof ConversationStoreAccessError ||
			error instanceof ConversationStoreConfigurationError ||
			error instanceof ConversationStoreReadError
		) {
			throw error;
		}

		throw new ConversationStoreReadError('Failed to list conversation run blocks.', {
			cause: error,
		});
	}
}

export async function listConversationMembers(
	conversation_id: string,
	scope: ConversationOwnershipScope,
	options: PersistOptions = {},
): Promise<readonly ConversationMember[]> {
	try {
		const writer = options.writer ?? (await getDefaultWriter());
		await requireConversationRole(writer, conversation_id, scope, 'viewer');
		const records = await writer.listConversationMembers(conversation_id);
		return records.map(toConversationMember);
	} catch (error) {
		if (
			error instanceof ConversationStoreAccessError ||
			error instanceof ConversationStoreConfigurationError ||
			error instanceof ConversationStoreReadError
		) {
			throw error;
		}

		throw new ConversationStoreReadError('Failed to list conversation members.', {
			cause: error,
		});
	}
}

export async function getConversationAccessRole(
	conversation_id: string,
	scope: ConversationOwnershipScope,
	options: PersistOptions = {},
): Promise<ConversationMemberRole | null> {
	try {
		const writer = options.writer ?? (await getDefaultWriter());
		const conversation = await writer.getConversationById(conversation_id);

		if (!conversation) {
			return null;
		}

		return resolveConversationRole(writer, conversation, scope);
	} catch (error) {
		if (
			error instanceof ConversationStoreConfigurationError ||
			error instanceof ConversationStoreReadError
		) {
			throw error;
		}

		throw new ConversationStoreReadError('Failed to resolve conversation access role.', {
			cause: error,
		});
	}
}

export async function shareConversationWithMember(
	input: Readonly<{
		readonly conversation_id: string;
		readonly member_role: Extract<ConversationMemberRole, 'editor' | 'viewer'>;
		readonly member_user_id: string;
		readonly scope: ConversationOwnershipScope;
	}>,
	options: PersistOptions = {},
): Promise<ConversationMember> {
	try {
		const writer = options.writer ?? (await getDefaultWriter());
		const { conversation } = await requireConversationRole(
			writer,
			input.conversation_id,
			input.scope,
			'owner',
		);

		if (!input.scope.user_id) {
			throw new ConversationStoreAccessError(
				'Only authenticated owners can manage conversation members.',
			);
		}

		const memberUserId = input.member_user_id.trim();

		if (memberUserId.length === 0 || memberUserId === conversation.user_id) {
			throw new ConversationStoreWriteError('Conversation member user id is invalid.');
		}

		const timestamp = new Date().toISOString();
		const persisted = await writer.upsertConversationMember(
			toConversationMemberRecord({
				added_by_user_id: input.scope.user_id,
				conversation_id: conversation.conversation_id,
				member_role: input.member_role,
				member_user_id: memberUserId,
				scope: input.scope,
				timestamp,
			}),
		);

		return toConversationMember(persisted);
	} catch (error) {
		if (
			error instanceof ConversationStoreAccessError ||
			error instanceof ConversationStoreConfigurationError ||
			error instanceof ConversationStoreWriteError
		) {
			throw error;
		}

		throw new ConversationStoreWriteError('Failed to share conversation with member.', {
			cause: error,
		});
	}
}

export async function removeConversationMember(
	input: Readonly<{
		readonly conversation_id: string;
		readonly member_user_id: string;
		readonly scope: ConversationOwnershipScope;
	}>,
	options: PersistOptions = {},
): Promise<void> {
	try {
		const writer = options.writer ?? (await getDefaultWriter());
		const { conversation } = await requireConversationRole(
			writer,
			input.conversation_id,
			input.scope,
			'owner',
		);
		const memberUserId = input.member_user_id.trim();

		if (memberUserId.length === 0 || memberUserId === conversation.user_id) {
			throw new ConversationStoreWriteError('Conversation member user id is invalid.');
		}

		await writer.deleteConversationMember(conversation.conversation_id, memberUserId);
	} catch (error) {
		if (
			error instanceof ConversationStoreAccessError ||
			error instanceof ConversationStoreConfigurationError ||
			error instanceof ConversationStoreWriteError
		) {
			throw error;
		}

		throw new ConversationStoreWriteError('Failed to remove conversation member.', {
			cause: error,
		});
	}
}
