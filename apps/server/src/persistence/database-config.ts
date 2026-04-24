import {
	DatabaseConfigError,
	type DatabaseEnvironment,
	type DatabaseRuntimeConfig,
	resolveDatabaseConfig,
} from '@runa/db';

function readRuntimeEnvironment(): DatabaseEnvironment {
	return process.env as NodeJS.ProcessEnv & DatabaseEnvironment;
}

function hasAnyConfiguredDatabaseUrl(environment: DatabaseEnvironment): boolean {
	return [
		environment.DATABASE_URL,
		environment.LOCAL_DATABASE_URL,
		environment.SUPABASE_DATABASE_URL,
	].some((value) => typeof value === 'string' && value.trim().length > 0);
}

export interface PersistenceDebugDatabaseSelection {
	readonly database_url_source?: DatabaseRuntimeConfig['database_url_source'];
	readonly target?: DatabaseRuntimeConfig['target'];
	readonly target_source?: DatabaseRuntimeConfig['target_source'];
}

export interface PersistenceDebugFailureInput {
	readonly error: unknown;
	readonly operation: string;
	readonly run_id?: string;
	readonly stage?: string;
	readonly store: 'event-store' | 'memory-store' | 'run-store';
	readonly table?: 'memories' | 'runs' | 'runtime_events' | 'tool_calls';
	readonly trace_id?: string;
}

function isPersistenceDebugEnabled(): boolean {
	const environment = process.env as NodeJS.ProcessEnv & {
		RUNA_DEBUG_PERSISTENCE?: string;
	};

	return environment.RUNA_DEBUG_PERSISTENCE === '1';
}

function toPersistenceDebugError(error: unknown): {
	readonly error_message: string;
	readonly error_name: string;
} {
	if (error instanceof Error) {
		return {
			error_message: error.message,
			error_name: error.name,
		};
	}

	return {
		error_message: String(error),
		error_name: 'NonErrorThrow',
	};
}

export function resolvePersistenceDebugDatabaseSelection():
	| PersistenceDebugDatabaseSelection
	| {
			readonly config_error_message: string;
			readonly config_error_name: string;
	  } {
	try {
		const config = resolveDatabaseConfig(readRuntimeEnvironment());
		return {
			database_url_source: config.database_url_source,
			target: config.target,
			target_source: config.target_source,
		};
	} catch (error) {
		if (error instanceof DatabaseConfigError) {
			return {
				config_error_message: error.message,
				config_error_name: error.name,
			};
		}

		throw error;
	}
}

export function logPersistenceDebugFailure(input: PersistenceDebugFailureInput): void {
	if (!isPersistenceDebugEnabled()) {
		return;
	}

	const errorSummary = toPersistenceDebugError(input.error);
	const databaseSelection = resolvePersistenceDebugDatabaseSelection();

	console.error('[persistence.error.debug]', {
		...databaseSelection,
		...errorSummary,
		operation: input.operation,
		run_id: input.run_id,
		stage: input.stage,
		store: input.store,
		table: input.table,
		trace_id: input.trace_id,
	});
}

export function resolvePersistenceDatabaseUrl(
	createConfigurationError: (message: string) => Error,
	fallbackMessage: string,
): string {
	const environment = readRuntimeEnvironment();

	try {
		return resolveDatabaseConfig(environment).database_url.trim();
	} catch (error) {
		if (error instanceof DatabaseConfigError) {
			throw createConfigurationError(
				hasAnyConfiguredDatabaseUrl(environment) ? error.message : fallbackMessage,
			);
		}

		throw error;
	}
}

export function hasPersistenceDatabaseConfiguration(): boolean {
	const environment = readRuntimeEnvironment();

	try {
		const databaseUrl = resolveDatabaseConfig(environment).database_url.trim();
		return databaseUrl.length > 0;
	} catch (error) {
		if (error instanceof DatabaseConfigError) {
			return false;
		}

		throw error;
	}
}
