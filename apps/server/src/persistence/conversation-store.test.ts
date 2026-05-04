import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	type ConversationRecordWriter,
	ConversationStoreAccessError,
	ConversationStoreConfigurationError,
	appendConversationMessage,
	appendConversationRunBlocks,
	ensureConversation,
	listConversationMembers,
	listConversationMessages,
	listConversationRunBlocks,
	listConversations,
	shareConversationWithMember,
} from './conversation-store.js';

function clearDatabaseUrl(): void {
	const environment = process.env as NodeJS.ProcessEnv & {
		DATABASE_URL?: string;
		DATABASE_TARGET?: string;
		RUNA_DEBUG_PERSISTENCE?: string;
	};
	environment.DATABASE_URL = undefined;
	environment.DATABASE_TARGET = undefined;
	environment.RUNA_DEBUG_PERSISTENCE = undefined;
}

function createWriter(overrides: Partial<ConversationRecordWriter> = {}): ConversationRecordWriter {
	return {
		async deleteConversationMember() {},
		async getConversationById() {
			return null;
		},
		async getConversationMember() {
			return null;
		},
		async insertConversationMessage() {
			throw new Error('not used');
		},
		async insertConversationRunBlocks() {
			throw new Error('not used');
		},
		async listConversationMembers() {
			return [];
		},
		async listConversationMessages() {
			return [];
		},
		async listConversationRunBlocks() {
			return [];
		},
		async listConversations() {
			return [];
		},
		async upsertConversation() {
			throw new Error('not used');
		},
		async upsertConversationMember() {
			throw new Error('not used');
		},
		...overrides,
	};
}

afterEach(() => {
	clearDatabaseUrl();
	vi.restoreAllMocks();
});

describe('conversation-store', () => {
	it('throws a typed configuration error when DATABASE_URL is missing', async () => {
		await expect(
			listConversations({
				user_id: 'user_1',
			}),
		).rejects.toThrowError(ConversationStoreConfigurationError);
	});

	it('creates a conversation with a trimmed title and preview', async () => {
		const upsertConversation: ConversationRecordWriter['upsertConversation'] = vi.fn(
			async (record) => ({
				...record,
				session_id: record.session_id ?? null,
				tenant_id: record.tenant_id ?? null,
				user_id: record.user_id ?? null,
				workspace_id: record.workspace_id ?? null,
			}),
		);

		const conversation = await ensureConversation(
			{
				created_at: '2026-04-22T10:00:00.000Z',
				initial_preview:
					'   This is the first conversation prompt and it should become the persisted title.   ',
				scope: {
					session_id: 'session_1',
					tenant_id: 'tenant_1',
					user_id: 'user_1',
					workspace_id: 'workspace_1',
				},
			},
			{
				writer: createWriter({
					upsertConversation,
				}),
			},
		);

		expect(upsertConversation).toHaveBeenCalledWith(
			expect.objectContaining({
				last_message_preview:
					'This is the first conversation prompt and it should become the persisted title.',
				title: 'This is the first conversation prompt and it should become th...',
				user_id: 'user_1',
			}),
		);
		expect(conversation.title).toBe(
			'This is the first conversation prompt and it should become th...',
		);
		expect(conversation.access_role).toBe('owner');
	});

	it('appends a user message with the next sequence number and updates the preview', async () => {
		const insertConversationMessage: ConversationRecordWriter['insertConversationMessage'] = vi.fn(
			async (record) => ({
				...record,
				run_id: record.run_id ?? null,
				tenant_id: record.tenant_id ?? null,
				trace_id: record.trace_id ?? null,
				user_id: record.user_id ?? null,
				workspace_id: record.workspace_id ?? null,
			}),
		);
		const upsertConversation: ConversationRecordWriter['upsertConversation'] = vi.fn(
			async (record) => ({
				...record,
				session_id: record.session_id ?? null,
				tenant_id: record.tenant_id ?? null,
				user_id: record.user_id ?? null,
				workspace_id: record.workspace_id ?? null,
			}),
		);

		const message = await appendConversationMessage(
			{
				content: 'Follow-up question',
				conversation_id: 'conversation_1',
				created_at: '2026-04-22T10:05:00.000Z',
				role: 'user',
				run_id: 'run_1',
				scope: {
					user_id: 'user_1',
				},
				trace_id: 'trace_1',
			},
			{
				writer: createWriter({
					getConversationById: async () => ({
						conversation_id: 'conversation_1',
						created_at: '2026-04-22T10:00:00.000Z',
						last_message_at: '2026-04-22T10:00:00.000Z',
						last_message_preview: 'Initial prompt',
						session_id: 'session_1',
						tenant_id: null,
						title: 'Initial prompt',
						updated_at: '2026-04-22T10:00:00.000Z',
						user_id: 'user_1',
						workspace_id: null,
					}),
					insertConversationMessage,
					listConversationMessages: async () => [
						{
							content: 'Initial prompt',
							conversation_id: 'conversation_1',
							created_at: '2026-04-22T10:00:00.000Z',
							message_id: 'message_1',
							role: 'user',
							run_id: 'run_0',
							sequence_no: 1,
							tenant_id: null,
							trace_id: 'trace_0',
							user_id: 'user_1',
							workspace_id: null,
						},
					],
					upsertConversation,
				}),
			},
		);

		expect(upsertConversation).toHaveBeenCalledWith(
			expect.objectContaining({
				last_message_preview: 'Follow-up question',
				last_message_at: '2026-04-22T10:05:00.000Z',
			}),
		);
		expect(insertConversationMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				conversation_id: 'conversation_1',
				role: 'user',
				run_id: 'run_1',
				sequence_no: 2,
				trace_id: 'trace_1',
			}),
		);
		expect(message.sequence_no).toBe(2);
	});

	it('allows shared viewers to read messages but not append new ones', async () => {
		const writer = createWriter({
			getConversationById: async () => ({
				conversation_id: 'conversation_shared',
				created_at: '2026-04-22T10:00:00.000Z',
				last_message_at: '2026-04-22T10:02:00.000Z',
				last_message_preview: 'Shared question',
				session_id: null,
				tenant_id: null,
				title: 'Shared conversation',
				updated_at: '2026-04-22T10:02:00.000Z',
				user_id: 'owner_user',
				workspace_id: null,
			}),
			getConversationMember: async () => ({
				added_by_user_id: 'owner_user',
				conversation_id: 'conversation_shared',
				created_at: '2026-04-22T10:01:00.000Z',
				member_role: 'viewer',
				member_user_id: 'viewer_user',
				tenant_id: null,
				updated_at: '2026-04-22T10:01:00.000Z',
				workspace_id: null,
			}),
			listConversationMessages: async () => [
				{
					content: 'Shared question',
					conversation_id: 'conversation_shared',
					created_at: '2026-04-22T10:02:00.000Z',
					message_id: 'message_1',
					role: 'user',
					run_id: 'run_1',
					sequence_no: 1,
					tenant_id: null,
					trace_id: 'trace_1',
					user_id: 'owner_user',
					workspace_id: null,
				},
			],
		});

		await expect(
			listConversationMessages(
				'conversation_shared',
				{
					user_id: 'viewer_user',
				},
				{ writer },
			),
		).resolves.toHaveLength(1);

		await expect(
			appendConversationMessage(
				{
					content: 'I should not be able to write',
					conversation_id: 'conversation_shared',
					role: 'user',
					scope: {
						user_id: 'viewer_user',
					},
				},
				{ writer },
			),
		).rejects.toThrowError(ConversationStoreAccessError);
	});

	it('persists and lists render blocks for conversation runs', async () => {
		const blocks = [
			{
				created_at: '2026-04-22T10:06:00.000Z',
				id: 'block_1',
				payload: {
					level: 'success',
					message: 'Tool completed',
				},
				schema_version: 1,
				type: 'status',
			},
		] as const;
		const insertConversationRunBlocks: ConversationRecordWriter['insertConversationRunBlocks'] =
			vi.fn(async (record) => ({
				...record,
				tenant_id: record.tenant_id ?? null,
				user_id: record.user_id ?? null,
				workspace_id: record.workspace_id ?? null,
			}));
		const writer = createWriter({
			getConversationById: async () => ({
				conversation_id: 'conversation_1',
				created_at: '2026-04-22T10:00:00.000Z',
				last_message_at: '2026-04-22T10:05:00.000Z',
				last_message_preview: 'Question',
				session_id: null,
				tenant_id: null,
				title: 'Question',
				updated_at: '2026-04-22T10:05:00.000Z',
				user_id: 'user_1',
				workspace_id: null,
			}),
			insertConversationRunBlocks,
			listConversationRunBlocks: async () => [
				{
					block_record_id: 'block_record_1',
					blocks,
					conversation_id: 'conversation_1',
					created_at: '2026-04-22T10:06:00.000Z',
					run_id: 'run_1',
					tenant_id: null,
					trace_id: 'trace_1',
					user_id: 'user_1',
					workspace_id: null,
				},
			],
		});

		const persisted = await appendConversationRunBlocks(
			{
				blocks,
				conversation_id: 'conversation_1',
				created_at: '2026-04-22T10:06:00.000Z',
				run_id: 'run_1',
				scope: {
					user_id: 'user_1',
				},
				trace_id: 'trace_1',
			},
			{ writer },
		);
		const listed = await listConversationRunBlocks(
			'conversation_1',
			{
				user_id: 'user_1',
			},
			{ writer },
		);

		expect(insertConversationRunBlocks).toHaveBeenCalledWith(
			expect.objectContaining({
				blocks,
				conversation_id: 'conversation_1',
				run_id: 'run_1',
				trace_id: 'trace_1',
				user_id: 'user_1',
			}),
		);
		expect(persisted.blocks).toEqual(blocks);
		expect(listed).toEqual([
			expect.objectContaining({
				blocks,
				run_id: 'run_1',
				trace_id: 'trace_1',
			}),
		]);
	});

	it('shares members and exposes shared conversations in list responses', async () => {
		const upsertConversationMember: ConversationRecordWriter['upsertConversationMember'] = vi.fn(
			async (record) => ({
				...record,
				added_by_user_id: record.added_by_user_id ?? null,
				tenant_id: record.tenant_id ?? null,
				workspace_id: record.workspace_id ?? null,
			}),
		);

		const sharedMember = await shareConversationWithMember(
			{
				conversation_id: 'conversation_owner',
				member_role: 'editor',
				member_user_id: 'editor_user',
				scope: {
					user_id: 'owner_user',
				},
			},
			{
				writer: createWriter({
					getConversationById: async () => ({
						conversation_id: 'conversation_owner',
						created_at: '2026-04-22T10:00:00.000Z',
						last_message_at: '2026-04-22T10:02:00.000Z',
						last_message_preview: 'Owner message',
						session_id: null,
						tenant_id: null,
						title: 'Owner conversation',
						updated_at: '2026-04-22T10:02:00.000Z',
						user_id: 'owner_user',
						workspace_id: null,
					}),
					upsertConversationMember,
				}),
			},
		);

		expect(sharedMember.member_role).toBe('editor');
		expect(upsertConversationMember).toHaveBeenCalledWith(
			expect.objectContaining({
				conversation_id: 'conversation_owner',
				member_role: 'editor',
				member_user_id: 'editor_user',
			}),
		);

		const listed = await listConversations(
			{
				user_id: 'editor_user',
			},
			{
				writer: createWriter({
					getConversationMember: async () => ({
						added_by_user_id: 'owner_user',
						conversation_id: 'conversation_owner',
						created_at: '2026-04-22T10:01:00.000Z',
						member_role: 'editor',
						member_user_id: 'editor_user',
						tenant_id: null,
						updated_at: '2026-04-22T10:01:00.000Z',
						workspace_id: null,
					}),
					listConversations: async () => [
						{
							conversation_id: 'conversation_owner',
							created_at: '2026-04-22T10:00:00.000Z',
							last_message_at: '2026-04-22T10:02:00.000Z',
							last_message_preview: 'Owner message',
							session_id: null,
							tenant_id: null,
							title: 'Owner conversation',
							updated_at: '2026-04-22T10:02:00.000Z',
							user_id: 'owner_user',
							workspace_id: null,
						},
					],
				}),
			},
		);

		expect(listed).toEqual([
			expect.objectContaining({
				access_role: 'editor',
				conversation_id: 'conversation_owner',
			}),
		]);
	});

	it('lists members for viewers', async () => {
		await expect(
			listConversationMembers(
				'conversation_shared',
				{
					user_id: 'viewer_user',
				},
				{
					writer: createWriter({
						getConversationById: async () => ({
							conversation_id: 'conversation_shared',
							created_at: '2026-04-22T10:00:00.000Z',
							last_message_at: '2026-04-22T10:02:00.000Z',
							last_message_preview: 'Shared question',
							session_id: null,
							tenant_id: null,
							title: 'Shared conversation',
							updated_at: '2026-04-22T10:02:00.000Z',
							user_id: 'owner_user',
							workspace_id: null,
						}),
						getConversationMember: async () => ({
							added_by_user_id: 'owner_user',
							conversation_id: 'conversation_shared',
							created_at: '2026-04-22T10:01:00.000Z',
							member_role: 'viewer',
							member_user_id: 'viewer_user',
							tenant_id: null,
							updated_at: '2026-04-22T10:01:00.000Z',
							workspace_id: null,
						}),
						listConversationMembers: async () => [
							{
								added_by_user_id: 'owner_user',
								conversation_id: 'conversation_shared',
								created_at: '2026-04-22T10:01:00.000Z',
								member_role: 'viewer',
								member_user_id: 'viewer_user',
								tenant_id: null,
								updated_at: '2026-04-22T10:01:00.000Z',
								workspace_id: null,
							},
						],
					}),
				},
			),
		).resolves.toEqual([
			expect.objectContaining({
				member_role: 'viewer',
				member_user_id: 'viewer_user',
			}),
		]);
	});
});
