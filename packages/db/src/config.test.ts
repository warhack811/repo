import { describe, expect, it } from 'vitest';

import {
	type CloudDatabaseRuntimeConfig,
	DatabaseConfigError,
	isCloudDatabaseTarget,
	resolveDatabaseConfig,
} from './config.js';

describe('resolveDatabaseConfig', () => {
	it('resolves the local target from DATABASE_TARGET with DATABASE_URL', () => {
		const config = resolveDatabaseConfig({
			DATABASE_TARGET: 'local',
			DATABASE_URL: 'postgres://local-user:local-pass@127.0.0.1:5432/runa_local',
		});

		expect(config).toEqual({
			database_url: 'postgres://local-user:local-pass@127.0.0.1:5432/runa_local',
			database_url_source: 'DATABASE_URL',
			target: 'local',
			target_source: 'DATABASE_TARGET',
		});
		expect(isCloudDatabaseTarget(config.target)).toBe(false);
	});

	it('resolves the cloud target from supabase alias and exposes supabase seams', () => {
		const config = resolveDatabaseConfig({
			DATABASE_TARGET: 'supabase',
			DATABASE_URL: 'postgres://cloud-user:cloud-pass@db.supabase.co:5432/postgres',
			SUPABASE_ANON_KEY: 'supabase-anon-key',
			SUPABASE_SERVICE_ROLE_KEY: 'supabase-service-role-key',
			SUPABASE_URL: 'https://project-ref.supabase.co',
		});

		expect(config).toEqual({
			database_url: 'postgres://cloud-user:cloud-pass@db.supabase.co:5432/postgres',
			database_url_source: 'DATABASE_URL',
			supabase: {
				anon_key: 'supabase-anon-key',
				service_role_key: 'supabase-service-role-key',
				url: 'https://project-ref.supabase.co',
			},
			target: 'cloud',
			target_source: 'DATABASE_TARGET',
		} satisfies CloudDatabaseRuntimeConfig);
		expect(isCloudDatabaseTarget(config.target)).toBe(true);
	});

	it('throws a controlled error when required local env keys are missing', () => {
		expect(() =>
			resolveDatabaseConfig({
				DATABASE_TARGET: 'local',
			}),
		).toThrowError(DatabaseConfigError);

		expect(() =>
			resolveDatabaseConfig({
				DATABASE_TARGET: 'local',
			}),
		).toThrowError('LOCAL_DATABASE_URL');
	});

	it('uses target-aware database URL precedence for local and cloud targets', () => {
		const localConfig = resolveDatabaseConfig({
			DATABASE_TARGET: 'local',
			DATABASE_URL: 'postgres://preferred-local/runa',
			LOCAL_DATABASE_URL: 'postgres://fallback-local/runa',
		});
		const cloudConfig = resolveDatabaseConfig({
			DATABASE_TARGET: 'cloud',
			DATABASE_URL: 'postgres://preferred-cloud/postgres',
			SUPABASE_ANON_KEY: 'supabase-anon-key',
			SUPABASE_DATABASE_URL: 'postgres://fallback-cloud/postgres',
			SUPABASE_SERVICE_ROLE_KEY: 'supabase-service-role-key',
			SUPABASE_URL: 'https://project-ref.supabase.co',
		});

		expect(localConfig.database_url).toBe('postgres://preferred-local/runa');
		expect(localConfig.database_url_source).toBe('DATABASE_URL');
		expect(cloudConfig.database_url).toBe('postgres://fallback-cloud/postgres');
		expect(cloudConfig.database_url_source).toBe('SUPABASE_DATABASE_URL');
	});

	it('supports env override driven target selection while keeping local target on DATABASE_URL', () => {
		const config = resolveDatabaseConfig({
			DATABASE_TARGET: 'local',
			DATABASE_URL: 'postgres://local-override/runa',
			SUPABASE_ANON_KEY: 'supabase-anon-key',
			SUPABASE_DATABASE_URL: 'postgres://cloud-fallback/postgres',
			SUPABASE_SERVICE_ROLE_KEY: 'supabase-service-role-key',
			SUPABASE_URL: 'https://project-ref.supabase.co',
		});

		expect(config.target).toBe('local');
		expect(config.target_source).toBe('DATABASE_TARGET');
		expect(config.database_url).toBe('postgres://local-override/runa');
	});

	it('infers the cloud target when supabase env keys are present and no explicit target is set', () => {
		const config = resolveDatabaseConfig({
			SUPABASE_ANON_KEY: 'supabase-anon-key',
			SUPABASE_DATABASE_URL: 'postgres://cloud-fallback/postgres',
			SUPABASE_SERVICE_ROLE_KEY: 'supabase-service-role-key',
			SUPABASE_URL: 'https://project-ref.supabase.co',
		});

		expect(config.target).toBe('cloud');
		expect(config.target_source).toBe('inferred');
		expect(config.database_url_source).toBe('SUPABASE_DATABASE_URL');
	});
});
