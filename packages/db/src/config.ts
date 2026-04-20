export const databaseTargets = ['local', 'cloud'] as const;

export type DatabaseTarget = (typeof databaseTargets)[number];

export type DatabaseTargetInput = DatabaseTarget | 'supabase';

export type DatabaseTargetSource = 'DATABASE_TARGET' | 'inferred';

export type DatabaseUrlSource = 'DATABASE_URL' | 'LOCAL_DATABASE_URL' | 'SUPABASE_DATABASE_URL';

export interface DatabaseEnvironment {
	readonly DATABASE_TARGET?: string;
	readonly DATABASE_URL?: string;
	readonly LOCAL_DATABASE_URL?: string;
	readonly SUPABASE_DATABASE_URL?: string;
	readonly SUPABASE_URL?: string;
	readonly SUPABASE_ANON_KEY?: string;
	readonly SUPABASE_SERVICE_ROLE_KEY?: string;
}

export interface DatabaseRuntimeConfigBase {
	readonly target: DatabaseTarget;
	readonly target_source: DatabaseTargetSource;
	readonly database_url: string;
	readonly database_url_source: DatabaseUrlSource;
}

export interface LocalDatabaseRuntimeConfig extends DatabaseRuntimeConfigBase {
	readonly target: 'local';
}

export interface CloudDatabaseRuntimeConfig extends DatabaseRuntimeConfigBase {
	readonly target: 'cloud';
	readonly supabase: {
		readonly url: string;
		readonly anon_key: string;
		readonly service_role_key: string;
	};
}

export type DatabaseRuntimeConfig = LocalDatabaseRuntimeConfig | CloudDatabaseRuntimeConfig;

export class DatabaseConfigError extends Error {
	readonly code = 'DATABASE_CONFIG_ERROR';
	readonly missing_keys: readonly string[];
	readonly target?: DatabaseTarget;

	constructor(
		message: string,
		options: Readonly<{
			readonly missing_keys?: readonly string[];
			readonly target?: DatabaseTarget;
		}> = {},
	) {
		super(message);
		this.name = 'DatabaseConfigError';
		this.missing_keys = options.missing_keys ?? [];
		this.target = options.target;
	}
}

export function isCloudDatabaseTarget(target: DatabaseTarget): target is 'cloud' {
	return target === 'cloud';
}

function normalizeDatabaseTarget(targetValue: string | undefined): DatabaseTargetInput | undefined {
	if (targetValue === undefined) {
		return undefined;
	}

	const normalizedValue = targetValue.trim().toLowerCase();

	if (
		normalizedValue === 'local' ||
		normalizedValue === 'cloud' ||
		normalizedValue === 'supabase'
	) {
		return normalizedValue;
	}

	throw new DatabaseConfigError(
		`Unsupported DATABASE_TARGET "${targetValue}". Expected one of: local, cloud, supabase.`,
	);
}

function inferDatabaseTarget(environment: DatabaseEnvironment): DatabaseTarget {
	if (
		environment.SUPABASE_URL !== undefined ||
		environment.SUPABASE_DATABASE_URL !== undefined ||
		environment.SUPABASE_ANON_KEY !== undefined ||
		environment.SUPABASE_SERVICE_ROLE_KEY !== undefined
	) {
		return 'cloud';
	}

	return 'local';
}

function resolveTarget(environment: DatabaseEnvironment): {
	readonly target: DatabaseTarget;
	readonly source: DatabaseTargetSource;
} {
	const normalizedTarget = normalizeDatabaseTarget(environment.DATABASE_TARGET);

	if (normalizedTarget === undefined) {
		return {
			source: 'inferred',
			target: inferDatabaseTarget(environment),
		};
	}

	return {
		source: 'DATABASE_TARGET',
		target: normalizedTarget === 'supabase' ? 'cloud' : normalizedTarget,
	};
}

function requireEnvironmentValue(
	environment: DatabaseEnvironment,
	key: keyof DatabaseEnvironment,
	target: DatabaseTarget,
): string {
	const value = environment[key];

	if (value === undefined || value.trim() === '') {
		throw new DatabaseConfigError(
			`Missing required environment variable "${key}" for ${target} database target.`,
			{
				missing_keys: [key],
				target,
			},
		);
	}

	return value;
}

function resolveDatabaseUrl(
	environment: DatabaseEnvironment,
	target: DatabaseTarget,
): {
	readonly database_url: string;
	readonly source: DatabaseUrlSource;
} {
	if (target === 'local') {
		if (environment.DATABASE_URL !== undefined && environment.DATABASE_URL.trim() !== '') {
			return {
				database_url: environment.DATABASE_URL,
				source: 'DATABASE_URL',
			};
		}

		return {
			database_url: requireEnvironmentValue(environment, 'LOCAL_DATABASE_URL', target),
			source: 'LOCAL_DATABASE_URL',
		};
	}

	if (
		environment.SUPABASE_DATABASE_URL !== undefined &&
		environment.SUPABASE_DATABASE_URL.trim() !== ''
	) {
		return {
			database_url: environment.SUPABASE_DATABASE_URL,
			source: 'SUPABASE_DATABASE_URL',
		};
	}

	if (environment.DATABASE_URL !== undefined && environment.DATABASE_URL.trim() !== '') {
		return {
			database_url: environment.DATABASE_URL,
			source: 'DATABASE_URL',
		};
	}

	return {
		database_url: requireEnvironmentValue(environment, 'SUPABASE_DATABASE_URL', target),
		source: 'SUPABASE_DATABASE_URL',
	};
}

export function resolveDatabaseConfig(environment: DatabaseEnvironment): DatabaseRuntimeConfig {
	const resolvedTarget = resolveTarget(environment);
	const resolvedUrl = resolveDatabaseUrl(environment, resolvedTarget.target);

	if (resolvedTarget.target === 'local') {
		return {
			database_url: resolvedUrl.database_url,
			database_url_source: resolvedUrl.source,
			target: 'local',
			target_source: resolvedTarget.source,
		};
	}

	return {
		database_url: resolvedUrl.database_url,
		database_url_source: resolvedUrl.source,
		supabase: {
			anon_key: requireEnvironmentValue(environment, 'SUPABASE_ANON_KEY', 'cloud'),
			service_role_key: requireEnvironmentValue(environment, 'SUPABASE_SERVICE_ROLE_KEY', 'cloud'),
			url: requireEnvironmentValue(environment, 'SUPABASE_URL', 'cloud'),
		},
		target: 'cloud',
		target_source: resolvedTarget.source,
	};
}
