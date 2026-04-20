import { eq } from 'drizzle-orm';

import type { RuntimeEvent, RuntimeState } from '@runa/types';

import type { DatabaseConnection } from './client.js';
import type { DatabaseEnvironment, DatabaseRuntimeConfig } from './config.js';
import type { DatabaseBootstrapPlan, DatabaseBootstrapResult } from './migrate.js';
import type { NewRunRecord } from './runs.js';
import type { NewRuntimeEventRecord } from './runtime-events.js';

import { closeDatabaseConnection, createDatabaseConnection } from './client.js';
import { createDatabaseBootstrapPlan, runDatabaseBootstrapPlan } from './migrate.js';
import { toRuntimeEventRecord } from './runtime-events.js';
import { runsTable, runtimeEventsTable } from './schema.js';

export const databaseCrudSmokeStepKinds = [
	'create_run',
	'read_run',
	'update_run',
	'read_run_after_update',
	'create_runtime_event',
	'read_runtime_event',
	'delete_runtime_event',
	'delete_run',
] as const;

export type DatabaseCrudSmokeStepKind = (typeof databaseCrudSmokeStepKinds)[number];

export interface DatabaseCrudSmokeStep {
	readonly kind: DatabaseCrudSmokeStepKind;
	readonly table: 'runs' | 'runtime_events';
}

export interface DatabaseCrudSmokeFixtures {
	readonly expected_updated_state: RuntimeState;
	readonly run: NewRunRecord;
	readonly runtime_event: NewRuntimeEventRecord;
}

export interface DatabaseCrudSmokePlan {
	readonly bootstrap: DatabaseBootstrapPlan;
	readonly config: DatabaseRuntimeConfig;
	readonly fixtures: DatabaseCrudSmokeFixtures;
	readonly steps: readonly DatabaseCrudSmokeStep[];
}

export interface DatabaseCrudSmokeDependencies {
	readonly bootstrap_runner?: (plan: DatabaseBootstrapPlan) => Promise<DatabaseBootstrapResult>;
	readonly cleanup_artifacts?: (
		connection: DatabaseConnection,
		plan: DatabaseCrudSmokePlan,
	) => Promise<void>;
	readonly close_connection?: (connection: DatabaseConnection) => Promise<void>;
	readonly create_connection?: (config: DatabaseRuntimeConfig) => DatabaseConnection;
	readonly execute_step?: (
		connection: DatabaseConnection,
		step: DatabaseCrudSmokeStep,
		plan: DatabaseCrudSmokePlan,
	) => Promise<void>;
}

export interface DatabaseCrudSmokeResult {
	readonly cleaned_up: boolean;
	readonly executed_steps: readonly DatabaseCrudSmokeStepKind[];
	readonly target: DatabaseRuntimeConfig['target'];
	readonly verified_tables: readonly ['runs', 'runtime_events'];
}

export class DatabaseCrudSmokeError extends Error {
	readonly code = 'DATABASE_CRUD_SMOKE_ERROR';
	readonly step: DatabaseCrudSmokeStepKind;
	readonly target: DatabaseRuntimeConfig['target'];

	constructor(
		message: string,
		options: Readonly<{
			readonly cause?: unknown;
			readonly step: DatabaseCrudSmokeStepKind;
			readonly target: DatabaseRuntimeConfig['target'];
		}>,
	) {
		super(message);
		this.name = 'DatabaseCrudSmokeError';
		this.cause = options.cause;
		this.step = options.step;
		this.target = options.target;
	}
}

function createSmokeRuntimeEvent(
	runRecord: NewRunRecord,
	eventId: string,
	timestamp: string,
): NewRuntimeEventRecord {
	const event: RuntimeEvent = {
		event_id: eventId,
		event_type: 'run.started',
		event_version: 1,
		payload: {
			entry_state: 'INIT',
			trigger: 'user_message',
		},
		run_id: runRecord.run_id,
		timestamp,
		trace_id: runRecord.trace_id,
	};

	return {
		...toRuntimeEventRecord(event),
		tenant_id: runRecord.tenant_id,
		workspace_id: runRecord.workspace_id,
	};
}

export function createDatabaseCrudSmokePlan(
	environment: DatabaseEnvironment,
	options: Readonly<{
		readonly seed?: string;
	}> = {},
): DatabaseCrudSmokePlan {
	const bootstrap = createDatabaseBootstrapPlan(environment);
	const seed = options.seed ?? `smoke_${bootstrap.config.target}`;
	const timestamp = '2026-04-16T12:00:00.000Z';
	const runRecord: NewRunRecord = {
		created_at: timestamp,
		current_state: 'INIT',
		last_state_at: timestamp,
		run_id: `${seed}_run`,
		tenant_id: `${seed}_tenant`,
		trace_id: `${seed}_trace`,
		updated_at: timestamp,
		user_id: `${seed}_user`,
		workspace_id: `${seed}_workspace`,
	};

	return {
		bootstrap,
		config: bootstrap.config,
		fixtures: {
			expected_updated_state: 'COMPLETED',
			run: runRecord,
			runtime_event: createSmokeRuntimeEvent(runRecord, `${seed}_event`, timestamp),
		},
		steps: [
			{ kind: 'create_run', table: 'runs' },
			{ kind: 'read_run', table: 'runs' },
			{ kind: 'update_run', table: 'runs' },
			{ kind: 'read_run_after_update', table: 'runs' },
			{ kind: 'create_runtime_event', table: 'runtime_events' },
			{ kind: 'read_runtime_event', table: 'runtime_events' },
			{ kind: 'delete_runtime_event', table: 'runtime_events' },
			{ kind: 'delete_run', table: 'runs' },
		],
	};
}

async function defaultExecuteStep(
	connection: DatabaseConnection,
	step: DatabaseCrudSmokeStep,
	plan: DatabaseCrudSmokePlan,
): Promise<void> {
	const runId = plan.fixtures.run.run_id;
	const eventId = plan.fixtures.runtime_event.event_id;

	switch (step.kind) {
		case 'create_run': {
			await connection.db.insert(runsTable).values(plan.fixtures.run);
			return;
		}
		case 'read_run': {
			const rows = await connection.db.select().from(runsTable).where(eq(runsTable.run_id, runId));

			if (rows.length !== 1) {
				throw new Error(`Expected run "${runId}" to exist after create.`);
			}

			return;
		}
		case 'update_run': {
			await connection.db
				.update(runsTable)
				.set({
					current_state: plan.fixtures.expected_updated_state,
					updated_at: '2026-04-16T12:05:00.000Z',
				})
				.where(eq(runsTable.run_id, runId));
			return;
		}
		case 'read_run_after_update': {
			const rows = await connection.db.select().from(runsTable).where(eq(runsTable.run_id, runId));

			if (rows.length !== 1 || rows[0]?.current_state !== plan.fixtures.expected_updated_state) {
				throw new Error(
					`Expected run "${runId}" to have state "${plan.fixtures.expected_updated_state}".`,
				);
			}

			return;
		}
		case 'create_runtime_event': {
			await connection.db.insert(runtimeEventsTable).values(plan.fixtures.runtime_event);
			return;
		}
		case 'read_runtime_event': {
			const rows = await connection.db
				.select()
				.from(runtimeEventsTable)
				.where(eq(runtimeEventsTable.event_id, eventId));

			if (rows.length !== 1) {
				throw new Error(`Expected runtime event "${eventId}" to exist after create.`);
			}

			return;
		}
		case 'delete_runtime_event': {
			await connection.db
				.delete(runtimeEventsTable)
				.where(eq(runtimeEventsTable.event_id, eventId));
			return;
		}
		case 'delete_run': {
			await connection.db.delete(runsTable).where(eq(runsTable.run_id, runId));
			return;
		}
	}
}

async function defaultCleanupArtifacts(
	connection: DatabaseConnection,
	plan: DatabaseCrudSmokePlan,
): Promise<void> {
	await connection.db
		.delete(runtimeEventsTable)
		.where(eq(runtimeEventsTable.event_id, plan.fixtures.runtime_event.event_id));
	await connection.db.delete(runsTable).where(eq(runsTable.run_id, plan.fixtures.run.run_id));
}

export async function runDatabaseCrudSmokePlan(
	plan: DatabaseCrudSmokePlan,
	dependencies: DatabaseCrudSmokeDependencies = {},
): Promise<DatabaseCrudSmokeResult> {
	const bootstrapRunner = dependencies.bootstrap_runner ?? runDatabaseBootstrapPlan;
	const createConnection = dependencies.create_connection ?? createDatabaseConnection;
	const executeStep = dependencies.execute_step ?? defaultExecuteStep;
	const cleanupArtifacts = dependencies.cleanup_artifacts ?? defaultCleanupArtifacts;
	const closeConnection = dependencies.close_connection ?? closeDatabaseConnection;
	const executedSteps: DatabaseCrudSmokeStepKind[] = [];

	await bootstrapRunner(plan.bootstrap);

	const connection = createConnection(plan.config);

	try {
		for (const step of plan.steps) {
			try {
				await executeStep(connection, step, plan);
				executedSteps.push(step.kind);
			} catch (error: unknown) {
				throw new DatabaseCrudSmokeError(
					`Database CRUD smoke failed during step "${step.kind}" for target "${plan.config.target}".`,
					{
						cause: error,
						step: step.kind,
						target: plan.config.target,
					},
				);
			}
		}

		return {
			cleaned_up: true,
			executed_steps: executedSteps,
			target: plan.config.target,
			verified_tables: ['runs', 'runtime_events'],
		};
	} finally {
		await cleanupArtifacts(connection, plan);
		await closeConnection(connection);
	}
}

export function runDatabaseCrudSmokeFromEnvironment(
	environment: DatabaseEnvironment,
	dependencies: DatabaseCrudSmokeDependencies = {},
): Promise<DatabaseCrudSmokeResult> {
	return runDatabaseCrudSmokePlan(createDatabaseCrudSmokePlan(environment), dependencies);
}
