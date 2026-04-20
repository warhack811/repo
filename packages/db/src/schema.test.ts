import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { getDatabaseSchemaBootstrapStatements } from './client.js';
import { createRlsPlan } from './rls.js';
import {
	approvalsTable,
	checkpointsTable,
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
		const toolCallColumns = getTableColumns(toolCallsTable);
		const approvalColumns = getTableColumns(approvalsTable);
		const memoryColumns = getTableColumns(memoriesTable);
		const checkpointColumns = getTableColumns(checkpointsTable);
		const policyStateColumns = getTableColumns(policyStatesTable);

		expect(getColumnNames(runtimeEventColumns)).toEqual(
			expect.arrayContaining(['tenant_id', 'workspace_id']),
		);
		expect(getColumnNames(runColumns)).toEqual(
			expect.arrayContaining(['tenant_id', 'workspace_id', 'user_id']),
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
			expect.arrayContaining(['tenant_id', 'workspace_id', 'user_id']),
		);
		expect(getColumnNames(checkpointColumns)).toEqual(
			expect.arrayContaining(['tenant_id', 'workspace_id', 'user_id']),
		);
		expect(getColumnNames(policyStateColumns)).toEqual(
			expect.arrayContaining(['tenant_id', 'workspace_id', 'user_id']),
		);

		expect(runtimeEventColumns.tenant_id.notNull).toBe(false);
		expect(runColumns.user_id.notNull).toBe(false);
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
				expect.stringContaining('ADD COLUMN IF NOT EXISTS user_id text'),
				expect.stringContaining('ALTER TABLE approvals'),
				expect.stringContaining('ADD COLUMN IF NOT EXISTS continuation_context jsonb'),
				expect.stringContaining('CREATE TABLE IF NOT EXISTS policy_states'),
				expect.stringContaining('ALTER TABLE memories'),
				expect.stringContaining('CREATE TABLE IF NOT EXISTS checkpoints'),
			]),
		);
	});
});
