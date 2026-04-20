import { describe, expect, it } from 'vitest';

import type { DatabaseConnection } from './client.js';
import type { RlsPlan } from './rls.js';

import { DatabaseConfigError } from './config.js';
import {
	RlsApplyError,
	applyRlsPlan,
	applyRlsPlanFromEnvironment,
	createRlsPlan,
	createRlsPlanFromEnvironment,
} from './rls.js';

function createStubConnection(): DatabaseConnection {
	return {
		client: {} as unknown as DatabaseConnection['client'],
		db: {} as unknown as DatabaseConnection['db'],
	};
}

function createExecutablePlan(): RlsPlan {
	return {
		config: {
			database_url: 'postgres://cloud-user:cloud-pass@db.supabase.co:5432/postgres',
			database_url_source: 'DATABASE_URL',
			supabase: {
				anon_key: 'supabase-anon-key',
				service_role_key: 'supabase-service-role-key',
				url: 'https://project-ref.supabase.co',
			},
			target: 'cloud',
			target_source: 'DATABASE_TARGET',
		},
		mode: 'ready',
		resources: [
			{
				access_model: 'workspace_isolation',
				policies: [
					{
						kind: 'select',
						name: 'runs_select_policy',
						sql: 'alter table runs enable row level security;',
						status: 'ready',
					},
					{
						kind: 'insert',
						name: 'runs_insert_policy',
						sql: 'create policy runs_insert_policy on runs for insert using (true);',
						status: 'ready',
					},
				],
				required_scope_columns: ['tenant_id', 'workspace_id'],
				resource: 'runs',
			},
		],
	};
}

describe('createRlsPlan', () => {
	it('builds a deterministic deferred cloud plan from current schema assumptions', () => {
		const plan = createRlsPlan({
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

		expect(plan.mode).toBe('deferred');
		expect(plan.resources.map((resource) => resource.resource)).toEqual([
			'runs',
			'runtime_events',
			'tool_calls',
			'approvals',
			'policy_states',
			'memories',
		]);
		expect(plan.resources[0]).toMatchObject({
			access_model: 'workspace_or_user_isolation',
			required_scope_columns: ['tenant_id', 'workspace_id', 'user_id'],
			resource: 'runs',
		});
		expect(plan.resources[5]).toMatchObject({
			access_model: 'workspace_or_user_isolation',
			required_scope_columns: ['tenant_id', 'workspace_id', 'user_id'],
			resource: 'memories',
		});
		expect(
			plan.resources.every((resource) =>
				resource.policies.every((policy) => policy.status === 'deferred'),
			),
		).toBe(true);
	});

	it('keeps local and cloud targets distinct through the plan seam', () => {
		const localPlan = createRlsPlanFromEnvironment({
			DATABASE_TARGET: 'local',
			DATABASE_URL: 'postgres://local-user:local-pass@127.0.0.1:5432/runa_local',
		});
		const cloudPlan = createRlsPlanFromEnvironment({
			DATABASE_TARGET: 'cloud',
			SUPABASE_ANON_KEY: 'supabase-anon-key',
			SUPABASE_DATABASE_URL: 'postgres://cloud-user:cloud-pass@db.supabase.co:5432/postgres',
			SUPABASE_SERVICE_ROLE_KEY: 'supabase-service-role-key',
			SUPABASE_URL: 'https://project-ref.supabase.co',
		});

		expect(localPlan.mode).toBe('skip');
		expect(localPlan.config.target).toBe('local');
		expect(cloudPlan.mode).toBe('deferred');
		expect(cloudPlan.config.target).toBe('cloud');
	});
});

describe('applyRlsPlan', () => {
	it('processes ready policies in a deterministic order', async () => {
		const connection = createStubConnection();
		const appliedPolicies: string[] = [];
		const lifecycle: string[] = [];

		const result = await applyRlsPlan(createExecutablePlan(), {
			async close_connection(receivedConnection) {
				expect(receivedConnection).toBe(connection);
				lifecycle.push('close');
			},
			create_connection() {
				lifecycle.push('create');
				return connection;
			},
			async execute_policy(receivedConnection, policy) {
				expect(receivedConnection).toBe(connection);
				lifecycle.push(`execute:${policy.name}`);
				appliedPolicies.push(policy.name);
			},
		});

		expect(appliedPolicies).toEqual(['runs_select_policy', 'runs_insert_policy']);
		expect(lifecycle).toEqual([
			'create',
			'execute:runs_select_policy',
			'execute:runs_insert_policy',
			'close',
		]);
		expect(result.executed_policies).toEqual(['runs_select_policy', 'runs_insert_policy']);
	});

	it('preserves a controlled error surface when policy application fails', async () => {
		await expect(
			applyRlsPlan(createExecutablePlan(), {
				async close_connection() {
					return Promise.resolve();
				},
				create_connection() {
					return createStubConnection();
				},
				async execute_policy() {
					throw new Error('policy apply failed');
				},
			}),
		).rejects.toBeInstanceOf(RlsApplyError);
	});

	it('can be validated without a real database connection for deferred plans', async () => {
		const result = await applyRlsPlanFromEnvironment({
			DATABASE_TARGET: 'cloud',
			SUPABASE_ANON_KEY: 'supabase-anon-key',
			SUPABASE_DATABASE_URL: 'postgres://cloud-user:cloud-pass@db.supabase.co:5432/postgres',
			SUPABASE_SERVICE_ROLE_KEY: 'supabase-service-role-key',
			SUPABASE_URL: 'https://project-ref.supabase.co',
		});

		expect(result.mode).toBe('deferred');
		expect(result.executed_policies).toEqual([]);
		expect(result.skipped_policies).toContain('runs_select_policy');
	});

	it('preserves controlled config errors before any apply work begins', () => {
		expect(() =>
			applyRlsPlanFromEnvironment({
				DATABASE_TARGET: 'cloud',
				SUPABASE_URL: 'https://project-ref.supabase.co',
			}),
		).toThrowError(DatabaseConfigError);
	});
});
