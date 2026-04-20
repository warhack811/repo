import type { DatabaseConnection } from './client.js';
import type { DatabaseEnvironment, DatabaseRuntimeConfig } from './config.js';

import {
	closeDatabaseConnection,
	createDatabaseConnection,
	ensureDatabaseSchema,
} from './client.js';
import { resolveDatabaseConfig } from './config.js';

export interface DatabaseBootstrapPlan {
	readonly config: DatabaseRuntimeConfig;
	readonly operation: 'schema_bootstrap';
}

export type DatabaseBootstrapResult = DatabaseBootstrapPlan;

export interface DatabaseBootstrapDependencies {
	readonly close_connection?: (connection: DatabaseConnection) => Promise<void>;
	readonly create_connection?: (config: DatabaseRuntimeConfig) => DatabaseConnection;
	readonly ensure_schema?: (connection: DatabaseConnection) => Promise<void>;
}

export function createDatabaseBootstrapPlan(
	environment: DatabaseEnvironment,
): DatabaseBootstrapPlan {
	return {
		config: resolveDatabaseConfig(environment),
		operation: 'schema_bootstrap',
	};
}

export async function runDatabaseBootstrapPlan(
	plan: DatabaseBootstrapPlan,
	dependencies: DatabaseBootstrapDependencies = {},
): Promise<DatabaseBootstrapResult> {
	const createConnection = dependencies.create_connection ?? createDatabaseConnection;
	const ensureSchema = dependencies.ensure_schema ?? ensureDatabaseSchema;
	const closeConnection = dependencies.close_connection ?? closeDatabaseConnection;
	const connection = createConnection(plan.config);

	try {
		await ensureSchema(connection);

		return plan;
	} finally {
		await closeConnection(connection);
	}
}

export function runDatabaseBootstrapFromEnvironment(
	environment: DatabaseEnvironment,
	dependencies: DatabaseBootstrapDependencies = {},
): Promise<DatabaseBootstrapResult> {
	return runDatabaseBootstrapPlan(createDatabaseBootstrapPlan(environment), dependencies);
}
