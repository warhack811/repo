import { sql } from 'drizzle-orm';
import { type PostgresJsDatabase, drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import type { DatabaseEnvironment, DatabaseRuntimeConfig } from './config.js';

import { resolveDatabaseConfig } from './config.js';
import * as schema from './schema.js';

const SUPABASE_HOST_SUFFIXES = ['.supabase.co', '.supabase.com'] as const;

type PostgresConnectOptions = Parameters<typeof postgres>[1];

function normalizeConnectionHost(databaseUrl: string): string {
	return new URL(databaseUrl).hostname.trim().toLowerCase();
}

function isSupabaseHost(host: string): boolean {
	return SUPABASE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function createSupabaseConnectionOptions(databaseUrl: string): PostgresConnectOptions {
	const host = normalizeConnectionHost(databaseUrl);

	if (!isSupabaseHost(host)) {
		return undefined;
	}

	return {
		ssl: 'require',
	};
}

const CREATE_RUNTIME_EVENTS_TABLE_SQL = `
	CREATE TABLE IF NOT EXISTS runtime_events (
		event_id text PRIMARY KEY,
		run_id text NOT NULL,
		trace_id text NOT NULL,
		event_type text NOT NULL,
		event_version integer NOT NULL,
		timestamp timestamptz NOT NULL,
		sequence_no integer,
		payload jsonb NOT NULL,
		metadata jsonb,
		envelope jsonb NOT NULL,
		tenant_id text,
		workspace_id text
	);
`;

const ALTER_RUNTIME_EVENTS_ADD_TENANT_ID_SQL = `
	ALTER TABLE runtime_events
	ADD COLUMN IF NOT EXISTS tenant_id text;
`;

const ALTER_RUNTIME_EVENTS_ADD_WORKSPACE_ID_SQL = `
	ALTER TABLE runtime_events
	ADD COLUMN IF NOT EXISTS workspace_id text;
`;

const CREATE_RUNTIME_EVENTS_RUN_ID_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS runtime_events_run_id_idx
	ON runtime_events (run_id);
`;

const CREATE_RUNTIME_EVENTS_TRACE_ID_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS runtime_events_trace_id_idx
	ON runtime_events (trace_id);
`;

const CREATE_RUNS_TABLE_SQL = `
	CREATE TABLE IF NOT EXISTS runs (
		run_id text PRIMARY KEY,
		trace_id text NOT NULL,
		current_state text NOT NULL,
		last_state_at timestamptz NOT NULL,
		last_error_code text,
		created_at timestamptz NOT NULL,
		updated_at timestamptz NOT NULL,
		tenant_id text,
		workspace_id text,
		user_id text
	);
`;

const ALTER_RUNS_ADD_TENANT_ID_SQL = `
	ALTER TABLE runs
	ADD COLUMN IF NOT EXISTS tenant_id text;
`;

const ALTER_RUNS_ADD_WORKSPACE_ID_SQL = `
	ALTER TABLE runs
	ADD COLUMN IF NOT EXISTS workspace_id text;
`;

const ALTER_RUNS_ADD_USER_ID_SQL = `
	ALTER TABLE runs
	ADD COLUMN IF NOT EXISTS user_id text;
`;

const CREATE_RUNS_TRACE_ID_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS runs_trace_id_idx
	ON runs (trace_id);
`;

const CREATE_RUNS_CURRENT_STATE_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS runs_current_state_idx
	ON runs (current_state);
`;

const CREATE_TOOL_CALLS_TABLE_SQL = `
	CREATE TABLE IF NOT EXISTS tool_calls (
		id text PRIMARY KEY,
		run_id text NOT NULL,
		trace_id text NOT NULL,
		call_id text NOT NULL,
		tool_name text NOT NULL,
		status text NOT NULL,
		input_summary text,
		result_summary text,
		error_code text,
		state_before text,
		state_after text,
		created_at timestamptz NOT NULL,
		completed_at timestamptz,
		updated_at timestamptz NOT NULL,
		tenant_id text,
		workspace_id text
	);
`;

const ALTER_TOOL_CALLS_ADD_TENANT_ID_SQL = `
	ALTER TABLE tool_calls
	ADD COLUMN IF NOT EXISTS tenant_id text;
`;

const ALTER_TOOL_CALLS_ADD_WORKSPACE_ID_SQL = `
	ALTER TABLE tool_calls
	ADD COLUMN IF NOT EXISTS workspace_id text;
`;

const CREATE_TOOL_CALLS_RUN_ID_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS tool_calls_run_id_idx
	ON tool_calls (run_id);
`;

const CREATE_TOOL_CALLS_TRACE_ID_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS tool_calls_trace_id_idx
	ON tool_calls (trace_id);
`;

const CREATE_TOOL_CALLS_CALL_ID_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS tool_calls_call_id_idx
	ON tool_calls (call_id);
`;

const CREATE_APPROVALS_TABLE_SQL = `
	CREATE TABLE IF NOT EXISTS approvals (
		approval_id text PRIMARY KEY,
		run_id text NOT NULL,
		trace_id text NOT NULL,
		action_kind text NOT NULL,
		status text NOT NULL,
		title text NOT NULL,
		summary text NOT NULL,
		tool_name text,
		call_id text,
		tool_input jsonb,
		working_directory text,
		risk_level text,
		requires_reason boolean,
		target_kind text,
		target_label text,
		requested_at timestamptz NOT NULL,
		next_sequence_no integer NOT NULL,
		continuation_context jsonb,
		decision text,
		note text,
		resolved_at timestamptz,
		created_at timestamptz NOT NULL,
		updated_at timestamptz NOT NULL,
		tenant_id text,
		workspace_id text,
		user_id text
	);
`;

const ALTER_APPROVALS_ADD_TOOL_INPUT_SQL = `
	ALTER TABLE approvals
	ADD COLUMN IF NOT EXISTS tool_input jsonb;
`;

const ALTER_APPROVALS_ADD_WORKING_DIRECTORY_SQL = `
	ALTER TABLE approvals
	ADD COLUMN IF NOT EXISTS working_directory text;
`;

const ALTER_APPROVALS_ADD_CONTINUATION_CONTEXT_SQL = `
	ALTER TABLE approvals
	ADD COLUMN IF NOT EXISTS continuation_context jsonb;
`;

const ALTER_APPROVALS_ADD_TENANT_ID_SQL = `
	ALTER TABLE approvals
	ADD COLUMN IF NOT EXISTS tenant_id text;
`;

const ALTER_APPROVALS_ADD_WORKSPACE_ID_SQL = `
	ALTER TABLE approvals
	ADD COLUMN IF NOT EXISTS workspace_id text;
`;

const ALTER_APPROVALS_ADD_USER_ID_SQL = `
	ALTER TABLE approvals
	ADD COLUMN IF NOT EXISTS user_id text;
`;

const ALTER_APPROVALS_ADD_SESSION_ID_SQL = `
	ALTER TABLE approvals
	ADD COLUMN IF NOT EXISTS session_id text;
`;

const CREATE_APPROVALS_RUN_ID_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS approvals_run_id_idx
	ON approvals (run_id);
`;

const CREATE_APPROVALS_TRACE_ID_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS approvals_trace_id_idx
	ON approvals (trace_id);
`;

const CREATE_APPROVALS_STATUS_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS approvals_status_idx
	ON approvals (status);
`;

const CREATE_APPROVALS_CALL_ID_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS approvals_call_id_idx
	ON approvals (call_id);
`;

const CREATE_APPROVALS_SESSION_ID_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS approvals_session_id_idx
	ON approvals (session_id);
`;

const CREATE_POLICY_STATES_TABLE_SQL = `
	CREATE TABLE IF NOT EXISTS policy_states (
		session_id text PRIMARY KEY,
		user_id text,
		tenant_id text,
		workspace_id text,
		consecutive_denials integer NOT NULL,
		last_denial_at timestamptz,
		last_denied_capability_id text,
		threshold integer NOT NULL,
		auto_continue_enabled boolean NOT NULL,
		auto_continue_enabled_at timestamptz,
		auto_continue_max_consecutive_turns integer,
		session_pause_active boolean NOT NULL,
		session_pause_paused_at timestamptz,
		session_pause_reason text,
		status text NOT NULL,
		created_at timestamptz NOT NULL,
		updated_at timestamptz NOT NULL
	);
`;

const ALTER_POLICY_STATES_ADD_USER_ID_SQL = `
	ALTER TABLE policy_states
	ADD COLUMN IF NOT EXISTS user_id text;
`;

const ALTER_POLICY_STATES_ADD_TENANT_ID_SQL = `
	ALTER TABLE policy_states
	ADD COLUMN IF NOT EXISTS tenant_id text;
`;

const ALTER_POLICY_STATES_ADD_WORKSPACE_ID_SQL = `
	ALTER TABLE policy_states
	ADD COLUMN IF NOT EXISTS workspace_id text;
`;

const CREATE_POLICY_STATES_STATUS_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS policy_states_status_idx
	ON policy_states (status);
`;

const CREATE_POLICY_STATES_USER_ID_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS policy_states_user_id_idx
	ON policy_states (user_id);
`;

const CREATE_MEMORIES_TABLE_SQL = `
	CREATE TABLE IF NOT EXISTS memories (
		memory_id text PRIMARY KEY,
		scope text NOT NULL,
		scope_id text NOT NULL,
		status text NOT NULL,
		source_kind text NOT NULL,
		summary text NOT NULL,
		content text NOT NULL,
		source_run_id text,
		source_trace_id text,
		archived_at timestamptz,
		created_at timestamptz NOT NULL,
		updated_at timestamptz NOT NULL,
		tenant_id text,
		workspace_id text,
		user_id text
	);
`;

const ALTER_MEMORIES_ADD_TENANT_ID_SQL = `
	ALTER TABLE memories
	ADD COLUMN IF NOT EXISTS tenant_id text;
`;

const ALTER_MEMORIES_ADD_WORKSPACE_ID_SQL = `
	ALTER TABLE memories
	ADD COLUMN IF NOT EXISTS workspace_id text;
`;

const ALTER_MEMORIES_ADD_USER_ID_SQL = `
	ALTER TABLE memories
	ADD COLUMN IF NOT EXISTS user_id text;
`;

const CREATE_MEMORIES_SCOPE_SCOPE_ID_STATUS_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS memories_scope_scope_id_status_idx
	ON memories (scope, scope_id, status);
`;

const CREATE_MEMORIES_SOURCE_TRACE_ID_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS memories_source_trace_id_idx
	ON memories (source_trace_id);
`;

const CREATE_CHECKPOINTS_TABLE_SQL = `
	CREATE TABLE IF NOT EXISTS checkpoints (
		checkpoint_id text PRIMARY KEY,
		checkpoint_version integer NOT NULL,
		checkpointed_at timestamptz NOT NULL,
		created_at timestamptz NOT NULL,
		event_sequence_no integer,
		loop_state text NOT NULL,
		meta jsonb NOT NULL,
		metadata jsonb,
		parent_checkpoint_id text,
		persistence_mode text NOT NULL,
		resume jsonb NOT NULL,
		run_id text NOT NULL,
		runtime_state text,
		schema_version integer NOT NULL,
		scope_kind text NOT NULL,
		scope_subject_id text NOT NULL,
		session_id text,
		status text NOT NULL,
		stop_reason jsonb,
		tenant_id text,
		trace_id text NOT NULL,
		trigger text NOT NULL,
		turn_index integer NOT NULL,
		updated_at timestamptz NOT NULL,
		user_id text,
		workspace_id text
	);
`;

const CREATE_CHECKPOINTS_RUN_ID_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS checkpoints_run_id_idx
	ON checkpoints (run_id);
`;

const CREATE_CHECKPOINTS_TRACE_ID_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS checkpoints_trace_id_idx
	ON checkpoints (trace_id);
`;

const CREATE_CHECKPOINTS_STATUS_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS checkpoints_status_idx
	ON checkpoints (status);
`;

const CREATE_CHECKPOINTS_SESSION_ID_INDEX_SQL = `
	CREATE INDEX IF NOT EXISTS checkpoints_session_id_idx
	ON checkpoints (session_id);
`;

export type RunaDatabase = PostgresJsDatabase<typeof schema>;

export interface DatabaseConnection {
	readonly client: Sql;
	readonly db: RunaDatabase;
}

export function createDatabaseConnection(databaseConfig: DatabaseRuntimeConfig): DatabaseConnection;
export function createDatabaseConnection(databaseUrl: string): DatabaseConnection;
export function createDatabaseConnection(
	databaseConfigOrUrl: DatabaseRuntimeConfig | string,
): DatabaseConnection {
	const databaseUrl =
		typeof databaseConfigOrUrl === 'string'
			? databaseConfigOrUrl
			: databaseConfigOrUrl.database_url;
	const connectionOptions = createSupabaseConnectionOptions(databaseUrl);
	const client = postgres(databaseUrl, {
		max: 1,
		prepare: false,
		...connectionOptions,
		// Merkezi Gürültü Filtresi: Sadece ERROR seviyesindeki mesajlar terminale düşer.
		// "already exists" gibi bilgilendirme (NOTICE) mesajları sessize alınır.
		onnotice: () => {},
	});

	return {
		client,
		db: drizzle(client, { schema }),
	};
}

export function createDatabaseConnectionFromEnvironment(environment: DatabaseEnvironment): {
	readonly config: DatabaseRuntimeConfig;
	readonly connection: DatabaseConnection;
} {
	const config = resolveDatabaseConfig(environment);

	return {
		config,
		connection: createDatabaseConnection(config),
	};
}

export function getDatabaseSchemaBootstrapStatements(): readonly string[] {
	return [
		CREATE_RUNTIME_EVENTS_TABLE_SQL,
		ALTER_RUNTIME_EVENTS_ADD_TENANT_ID_SQL,
		ALTER_RUNTIME_EVENTS_ADD_WORKSPACE_ID_SQL,
		CREATE_RUNTIME_EVENTS_RUN_ID_INDEX_SQL,
		CREATE_RUNTIME_EVENTS_TRACE_ID_INDEX_SQL,
		CREATE_RUNS_TABLE_SQL,
		ALTER_RUNS_ADD_TENANT_ID_SQL,
		ALTER_RUNS_ADD_WORKSPACE_ID_SQL,
		ALTER_RUNS_ADD_USER_ID_SQL,
		CREATE_RUNS_TRACE_ID_INDEX_SQL,
		CREATE_RUNS_CURRENT_STATE_INDEX_SQL,
		CREATE_TOOL_CALLS_TABLE_SQL,
		ALTER_TOOL_CALLS_ADD_TENANT_ID_SQL,
		ALTER_TOOL_CALLS_ADD_WORKSPACE_ID_SQL,
		CREATE_TOOL_CALLS_RUN_ID_INDEX_SQL,
		CREATE_TOOL_CALLS_TRACE_ID_INDEX_SQL,
		CREATE_TOOL_CALLS_CALL_ID_INDEX_SQL,
		CREATE_APPROVALS_TABLE_SQL,
		ALTER_APPROVALS_ADD_TOOL_INPUT_SQL,
		ALTER_APPROVALS_ADD_WORKING_DIRECTORY_SQL,
		ALTER_APPROVALS_ADD_CONTINUATION_CONTEXT_SQL,
		ALTER_APPROVALS_ADD_TENANT_ID_SQL,
		ALTER_APPROVALS_ADD_WORKSPACE_ID_SQL,
		ALTER_APPROVALS_ADD_USER_ID_SQL,
		ALTER_APPROVALS_ADD_SESSION_ID_SQL,
		CREATE_APPROVALS_RUN_ID_INDEX_SQL,
		CREATE_APPROVALS_TRACE_ID_INDEX_SQL,
		CREATE_APPROVALS_STATUS_INDEX_SQL,
		CREATE_APPROVALS_CALL_ID_INDEX_SQL,
		CREATE_APPROVALS_SESSION_ID_INDEX_SQL,
		CREATE_POLICY_STATES_TABLE_SQL,
		ALTER_POLICY_STATES_ADD_USER_ID_SQL,
		ALTER_POLICY_STATES_ADD_TENANT_ID_SQL,
		ALTER_POLICY_STATES_ADD_WORKSPACE_ID_SQL,
		CREATE_POLICY_STATES_STATUS_INDEX_SQL,
		CREATE_POLICY_STATES_USER_ID_INDEX_SQL,
		CREATE_MEMORIES_TABLE_SQL,
		ALTER_MEMORIES_ADD_TENANT_ID_SQL,
		ALTER_MEMORIES_ADD_WORKSPACE_ID_SQL,
		ALTER_MEMORIES_ADD_USER_ID_SQL,
		CREATE_MEMORIES_SCOPE_SCOPE_ID_STATUS_INDEX_SQL,
		CREATE_MEMORIES_SOURCE_TRACE_ID_INDEX_SQL,
		CREATE_CHECKPOINTS_TABLE_SQL,
		CREATE_CHECKPOINTS_RUN_ID_INDEX_SQL,
		CREATE_CHECKPOINTS_TRACE_ID_INDEX_SQL,
		CREATE_CHECKPOINTS_STATUS_INDEX_SQL,
		CREATE_CHECKPOINTS_SESSION_ID_INDEX_SQL,
	];
}

export async function ensureDatabaseSchema(connection: DatabaseConnection): Promise<void> {
	for (const statement of getDatabaseSchemaBootstrapStatements()) {
		await connection.db.execute(sql.raw(statement));
	}
}

export async function closeDatabaseConnection(connection: DatabaseConnection): Promise<void> {
	await connection.client.end({ timeout: 5 });
}
