import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { getDatabaseSchemaBootstrapStatements } from './client.js';
import { createRlsPlan } from './rls.js';
import {
	approvalsTable,
	checkpointsTable,
	conversationMembersTable,
	conversationMessagesTable,
	conversationsTable,
	memoriesTable,
	policyStatesTable,
	runsTable,
	runtimeEventsTable,
	toolCallsTable,
} from './schema.js';

function getColumnNames(columns: Record<string, unknown>): readonly string[] {
	return Object.keys(columns);
}

describe('schema scope columns', () => {
	it('adds nullable scope columns to the core tables required for future RLS', () => {
		const runtimeEventColumns = getTableColumns(runtimeEventsTable);
		const runColumns = getTableColumns(runsTable);
		const conversationColumns = getTableColumns(conversationsTable);
		const conversationMessageColumns = getTableColumns(conversationMessagesTable);
		const conversationMemberColumns = getTableColumns(conversationMembersTable);
		const toolCallColumns = getTableColumns(toolCallsTable);
		const approvalColumns = getTableColumns(approvalsTable);
		const memoryColumns = getTableColumns(memoriesTable);
		const checkpointColumns = getTableColumns(checkpointsTable);
		const policyStateColumns = getTableColumns(policyStatesTable);

		expect(getColumnNames(runtimeEventColumns)).toEqual(
			expect.arrayContaining(['tenant_id', 'workspace_id']),
		);
		expect(getColumnNames(runColumns)).toEqual(
			expect.arrayContaining(['conversation_id', 'tenant_id', 'workspace_id', 'user_id']),
		);
		expect(getColumnNames(conversationColumns)).toEqual(
			expect.arrayContaining([
				'conversation_id',
				'title',
				'last_message_preview',
				'last_message_at',
				'session_id',
				'tenant_id',
				'workspace_id',
				'user_id',
			]),
		);
		expect(getColumnNames(conversationMessageColumns)).toEqual(
			expect.arrayContaining([
				'conversation_id',
				'run_id',
				'trace_id',
				'role',
				'content',
				'sequence_no',
				'tenant_id',
				'workspace_id',
				'user_id',
			]),
		);
		expect(getColumnNames(conversationMemberColumns)).toEqual(
			expect.arrayContaining([
				'conversation_id',
				'member_user_id',
				'member_role',
				'added_by_user_id',
				'tenant_id',
				'workspace_id',
			]),
		);
		expect(getColumnNames(toolCallColumns)).toEqual(
			expect.arrayContaining(['tenant_id', 'workspace_id']),
		);
		expect(getColumnNames(approvalColumns)).toEqual(
			expect.arrayContaining([
				'continuation_context',
				'tenant_id',
				'workspace_id',
				'user_id',
				'session_id',
			]),
		);
		expect(getColumnNames(memoryColumns)).toEqual(
			expect.arrayContaining([
				'embedding_metadata',
				'retrieval_text',
				'tenant_id',
				'workspace_id',
				'user_id',
			]),
		);
		expect(getColumnNames(checkpointColumns)).toEqual(
			expect.arrayContaining(['tenant_id', 'workspace_id', 'user_id']),
		);
		expect(getColumnNames(policyStateColumns)).toEqual(
			expect.arrayContaining(['tenant_id', 'workspace_id', 'user_id']),
		);

		expect(runtimeEventColumns.tenant_id.notNull).toBe(false);
		expect(runColumns.conversation_id.notNull).toBe(false);
		expect(runColumns.user_id.notNull).toBe(false);
		expect(conversationColumns.user_id.notNull).toBe(false);
		expect(approvalColumns.workspace_id.notNull).toBe(false);
		expect(memoryColumns.user_id.notNull).toBe(false);
		expect(checkpointColumns.user_id.notNull).toBe(false);
		expect(policyStateColumns.user_id.notNull).toBe(false);
	});

	it('stays aligned with rls required scope assumptions', () => {
		const rlsPlan = createRlsPlan({
			database_url: 'postgres://cloud-user:cloud-pass@db.supabase.co:5432/postgres',
			database_url_source: 'DATABASE_URL',
			supabase: {
				anon_key: 'supabase-anon-key',
				service_role_key: 'supabase-service-role-key',
				url: 'https://project-ref.supabase.co',
			},
			target: 'cloud',
			target_source: 'DATABASE_TARGET',
		});
		const schemaColumnsByResource = {
			approvals: getColumnNames(getTableColumns(approvalsTable)),
			memories: getColumnNames(getTableColumns(memoriesTable)),
			policy_states: getColumnNames(getTableColumns(policyStatesTable)),
			runs: getColumnNames(getTableColumns(runsTable)),
			runtime_events: getColumnNames(getTableColumns(runtimeEventsTable)),
			tool_calls: getColumnNames(getTableColumns(toolCallsTable)),
		} as const;

		for (const resourcePlan of rlsPlan.resources) {
			const schemaColumns = schemaColumnsByResource[resourcePlan.resource];

			expect(schemaColumns).toEqual(
				expect.arrayContaining([...resourcePlan.required_scope_columns]),
			);
		}
	});

	it('keeps bootstrap statements migration-safe for existing databases', () => {
		const bootstrapStatements = getDatabaseSchemaBootstrapStatements();

		expect(bootstrapStatements).toEqual(
			expect.arrayContaining([
				expect.stringContaining('ALTER TABLE runtime_events'),
				expect.stringContaining('ADD COLUMN IF NOT EXISTS tenant_id text'),
				expect.stringContaining('ALTER TABLE runs'),
				expect.stringContaining('ADD COLUMN IF NOT EXISTS conversation_id text'),
				expect.stringContaining('ADD COLUMN IF NOT EXISTS user_id text'),
				expect.stringContaining('CREATE TABLE IF NOT EXISTS conversations'),
				expect.stringContaining('CREATE TABLE IF NOT EXISTS conversation_messages'),
				expect.stringContaining('CREATE TABLE IF NOT EXISTS conversation_members'),
				expect.stringContaining('ALTER TABLE approvals'),
				expect.stringContaining('ADD COLUMN IF NOT EXISTS continuation_context jsonb'),
				expect.stringContaining('CREATE TABLE IF NOT EXISTS policy_states'),
				expect.stringContaining('ALTER TABLE memories'),
				expect.stringContaining('ADD COLUMN IF NOT EXISTS retrieval_text text'),
				expect.stringContaining('ADD COLUMN IF NOT EXISTS embedding_metadata jsonb'),
				expect.stringContaining('CREATE TABLE IF NOT EXISTS checkpoints'),
			]),
		);
	});
});
