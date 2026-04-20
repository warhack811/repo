import { describe, expect, it } from 'vitest';

import type { DatabaseConnection } from './client.js';

import {
	DatabaseCrudSmokeError,
	createDatabaseCrudSmokePlan,
	runDatabaseCrudSmokePlan,
} from './smoke.js';

function createStubConnection(): DatabaseConnection {
	return {
		client: {} as unknown as DatabaseConnection['client'],
		db: {} as unknown as DatabaseConnection['db'],
	};
}

describe('createDatabaseCrudSmokePlan', () => {
	it('builds a deterministic local smoke plan', () => {
		const plan = createDatabaseCrudSmokePlan(
			{
				DATABASE_TARGET: 'local',
				DATABASE_URL: 'postgres://local-user:local-pass@127.0.0.1:5432/runa_local',
			},
			{
				seed: 'local_seed',
			},
		);

		expect(plan.config.target).toBe('local');
		expect(plan.bootstrap.config.target).toBe('local');
		expect(plan.fixtures.run.run_id).toBe('local_seed_run');
		expect(plan.steps.map((step) => step.kind)).toEqual([
			'create_run',
			'read_run',
			'update_run',
			'read_run_after_update',
			'create_runtime_event',
			'read_runtime_event',
			'delete_runtime_event',
			'delete_run',
		]);
	});

	it('builds a deterministic cloud smoke plan', () => {
		const plan = createDatabaseCrudSmokePlan(
			{
				DATABASE_TARGET: 'cloud',
				SUPABASE_ANON_KEY: 'supabase-anon-key',
				SUPABASE_DATABASE_URL: 'postgres://cloud-user:cloud-pass@db.supabase.co:5432/postgres',
				SUPABASE_SERVICE_ROLE_KEY: 'supabase-service-role-key',
				SUPABASE_URL: 'https://project-ref.supabase.co',
			},
			{
				seed: 'cloud_seed',
			},
		);

		expect(plan.config.target).toBe('cloud');
		expect(plan.bootstrap.config.target).toBe('cloud');
		expect(plan.fixtures.runtime_event.event_id).toBe('cloud_seed_event');
	});
});

describe('runDatabaseCrudSmokePlan', () => {
	it('uses the bootstrap seam and executes CRUD steps in deterministic order', async () => {
		const plan = createDatabaseCrudSmokePlan(
			{
				DATABASE_TARGET: 'local',
				DATABASE_URL: 'postgres://local-user:local-pass@127.0.0.1:5432/runa_local',
			},
			{
				seed: 'order_seed',
			},
		);
		const connection = createStubConnection();
		const lifecycle: string[] = [];

		const result = await runDatabaseCrudSmokePlan(plan, {
			async bootstrap_runner(receivedPlan) {
				lifecycle.push(`bootstrap:${receivedPlan.config.target}`);
				return receivedPlan;
			},
			async cleanup_artifacts(receivedConnection, receivedPlan) {
				expect(receivedConnection).toBe(connection);
				expect(receivedPlan.fixtures.run.run_id).toBe('order_seed_run');
				lifecycle.push('cleanup');
			},
			async close_connection(receivedConnection) {
				expect(receivedConnection).toBe(connection);
				lifecycle.push('close');
			},
			create_connection(config) {
				expect(config.target).toBe('local');
				lifecycle.push(`connect:${config.target}`);
				return connection;
			},
			async execute_step(receivedConnection, step) {
				expect(receivedConnection).toBe(connection);
				lifecycle.push(step.kind);
			},
		});

		expect(result).toEqual({
			cleaned_up: true,
			executed_steps: [
				'create_run',
				'read_run',
				'update_run',
				'read_run_after_update',
				'create_runtime_event',
				'read_runtime_event',
				'delete_runtime_event',
				'delete_run',
			],
			target: 'local',
			verified_tables: ['runs', 'runtime_events'],
		});
		expect(lifecycle).toEqual([
			'bootstrap:local',
			'connect:local',
			'create_run',
			'read_run',
			'update_run',
			'read_run_after_update',
			'create_runtime_event',
			'read_runtime_event',
			'delete_runtime_event',
			'delete_run',
			'cleanup',
			'close',
		]);
	});

	it('preserves cloud target wiring through the same seam', async () => {
		const plan = createDatabaseCrudSmokePlan(
			{
				DATABASE_TARGET: 'cloud',
				SUPABASE_ANON_KEY: 'supabase-anon-key',
				SUPABASE_DATABASE_URL: 'postgres://cloud-user:cloud-pass@db.supabase.co:5432/postgres',
				SUPABASE_SERVICE_ROLE_KEY: 'supabase-service-role-key',
				SUPABASE_URL: 'https://project-ref.supabase.co',
			},
			{
				seed: 'cloud_wire',
			},
		);
		let bootstrapTarget: string | undefined;
		let connectionTarget: string | undefined;

		await runDatabaseCrudSmokePlan(plan, {
			async bootstrap_runner(receivedPlan) {
				bootstrapTarget = receivedPlan.config.target;
				return receivedPlan;
			},
			async cleanup_artifacts() {
				return Promise.resolve();
			},
			async close_connection() {
				return Promise.resolve();
			},
			create_connection(config) {
				connectionTarget = config.target;
				return createStubConnection();
			},
			async execute_step() {
				return Promise.resolve();
			},
		});

		expect(bootstrapTarget).toBe('cloud');
		expect(connectionTarget).toBe('cloud');
	});

	it('wraps step failures in a controlled smoke error surface', async () => {
		const plan = createDatabaseCrudSmokePlan({
			DATABASE_TARGET: 'local',
			DATABASE_URL: 'postgres://local-user:local-pass@127.0.0.1:5432/runa_local',
		});

		await expect(
			runDatabaseCrudSmokePlan(plan, {
				async bootstrap_runner(receivedPlan) {
					return receivedPlan;
				},
				async cleanup_artifacts() {
					return Promise.resolve();
				},
				async close_connection() {
					return Promise.resolve();
				},
				create_connection() {
					return createStubConnection();
				},
				async execute_step(_connection, step) {
					if (step.kind === 'update_run') {
						throw new Error('update failed');
					}
				},
			}),
		).rejects.toBeInstanceOf(DatabaseCrudSmokeError);
	});

	it('can be validated fully through dependency seams without a real database', async () => {
		const plan = createDatabaseCrudSmokePlan({
			DATABASE_TARGET: 'local',
			DATABASE_URL: 'postgres://local-user:local-pass@127.0.0.1:5432/runa_local',
		});
		let cleanupCalled = false;
		let closeCalled = false;

		await runDatabaseCrudSmokePlan(plan, {
			async bootstrap_runner(receivedPlan) {
				return receivedPlan;
			},
			async cleanup_artifacts() {
				cleanupCalled = true;
			},
			async close_connection() {
				closeCalled = true;
			},
			create_connection() {
				return createStubConnection();
			},
			async execute_step() {
				return Promise.resolve();
			},
		});

		expect(cleanupCalled).toBe(true);
		expect(closeCalled).toBe(true);
	});
});
