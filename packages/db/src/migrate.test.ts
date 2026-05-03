import { describe, expect, it } from 'vitest';

import type { DatabaseConnection } from './client.js';

import { getDatabaseSchemaBootstrapStatements } from './client.js';
import { DatabaseConfigError } from './config.js';
import {
	createDatabaseBootstrapPlan,
	runDatabaseBootstrapFromEnvironment,
	runDatabaseBootstrapPlan,
} from './migrate.js';

function createStubConnection(): DatabaseConnection {
	return {
		client: {} as unknown as DatabaseConnection['client'],
		db: {} as unknown as DatabaseConnection['db'],
	};
}

describe('createDatabaseBootstrapPlan', () => {
	it('resolves a local bootstrap plan deterministically', () => {
		const plan = createDatabaseBootstrapPlan({
			DATABASE_TARGET: 'local',
			DATABASE_URL: 'postgres://local-user:local-pass@127.0.0.1:5432/runa_local',
		});

		expect(plan).toEqual({
			config: {
				database_url: 'postgres://local-user:local-pass@127.0.0.1:5432/runa_local',
				database_url_source: 'DATABASE_URL',
				target: 'local',
				target_source: 'DATABASE_TARGET',
			},
			operation: 'schema_bootstrap',
		});
	});

	it('resolves a cloud bootstrap plan deterministically', () => {
		const plan = createDatabaseBootstrapPlan({
			DATABASE_TARGET: 'cloud',
			SUPABASE_ANON_KEY: 'supabase-anon-key',
			SUPABASE_DATABASE_URL: 'postgres://cloud-user:cloud-pass@db.supabase.co:5432/postgres',
			SUPABASE_SERVICE_ROLE_KEY: 'supabase-service-role-key',
			SUPABASE_URL: 'https://project-ref.supabase.co',
		});

		expect(plan).toEqual({
			config: {
				database_url: 'postgres://cloud-user:cloud-pass@db.supabase.co:5432/postgres',
				database_url_source: 'SUPABASE_DATABASE_URL',
				supabase: {
					anon_key: 'supabase-anon-key',
					service_role_key: 'supabase-service-role-key',
					url: 'https://project-ref.supabase.co',
				},
				target: 'cloud',
				target_source: 'DATABASE_TARGET',
			},
			operation: 'schema_bootstrap',
		});
	});
});

describe('runDatabaseBootstrapPlan', () => {
	it('wires config target and url into the runner deterministically', async () => {
		const connection = createStubConnection();
		const events: string[] = [];
		let capturedDatabaseUrl: string | undefined;
		let capturedTarget: string | undefined;

		const result = await runDatabaseBootstrapPlan(
			createDatabaseBootstrapPlan({
				DATABASE_TARGET: 'local',
				DATABASE_URL: 'postgres://local-user:local-pass@127.0.0.1:5432/runa_local',
			}),
			{
				async close_connection(receivedConnection) {
					expect(receivedConnection).toBe(connection);
					events.push('close');
				},
				create_connection(config) {
					capturedDatabaseUrl = config.database_url;
					capturedTarget = config.target;
					events.push('create');
					return connection;
				},
				async ensure_schema(receivedConnection) {
					expect(receivedConnection).toBe(connection);
					events.push('ensure');
				},
			},
		);

		expect(capturedTarget).toBe('local');
		expect(capturedDatabaseUrl).toBe('postgres://local-user:local-pass@127.0.0.1:5432/runa_local');
		expect(events).toEqual(['create', 'ensure', 'close']);
		expect(result.operation).toBe('schema_bootstrap');
	});

	it('preserves controlled config errors when required env is missing', async () => {
		expect(() =>
			runDatabaseBootstrapFromEnvironment({
				DATABASE_TARGET: 'cloud',
				SUPABASE_URL: 'https://project-ref.supabase.co',
			}),
		).toThrowError(DatabaseConfigError);
	});

	it('closes the connection even when schema bootstrap fails', async () => {
		const connection = createStubConnection();
		const events: string[] = [];

		await expect(
			runDatabaseBootstrapPlan(
				createDatabaseBootstrapPlan({
					DATABASE_TARGET: 'local',
					DATABASE_URL: 'postgres://local-user:local-pass@127.0.0.1:5432/runa_local',
				}),
				{
					async close_connection() {
						events.push('close');
					},
					create_connection() {
						events.push('create');
						return connection;
					},
					async ensure_schema() {
						events.push('ensure');
						throw new Error('schema bootstrap failed');
					},
				},
			),
		).rejects.toThrowError('schema bootstrap failed');

		expect(events).toEqual(['create', 'ensure', 'close']);
	});
});

describe('policy_states migration statements', () => {
	it('adds approval-mode and trusted-session columns idempotently for old tables', () => {
		const bootstrapStatements = getDatabaseSchemaBootstrapStatements();

		expect(bootstrapStatements).toEqual(
			expect.arrayContaining([
				expect.stringContaining('ALTER TABLE policy_states'),
				expect.stringContaining('ADD COLUMN IF NOT EXISTS approval_mode text'),
				expect.stringContaining('ADD COLUMN IF NOT EXISTS approval_mode_updated_at timestamptz'),
				expect.stringContaining('ADD COLUMN IF NOT EXISTS trusted_session_enabled boolean'),
				expect.stringContaining('ADD COLUMN IF NOT EXISTS trusted_session_enabled_at timestamptz'),
				expect.stringContaining('ADD COLUMN IF NOT EXISTS trusted_session_expires_at timestamptz'),
				expect.stringContaining('ADD COLUMN IF NOT EXISTS trusted_session_max_turns integer'),
				expect.stringContaining('ADD COLUMN IF NOT EXISTS trusted_session_consumed_turns integer'),
				expect.stringContaining(
					'ADD COLUMN IF NOT EXISTS trusted_session_max_approved_capabilities integer',
				),
				expect.stringContaining(
					'ADD COLUMN IF NOT EXISTS trusted_session_approved_capability_count integer',
				),
			]),
		);
	});
});
