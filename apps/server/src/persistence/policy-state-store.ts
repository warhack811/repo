import {
	type NewPolicyStateRecord,
	type PolicyStateDatabaseClient,
	type PolicyStateRecord,
	createDatabaseConnection,
	createPolicyStateDatabaseClient,
	ensureDatabaseSchema,
} from '@runa/db';
import type { AuthContext } from '@runa/types';

import type { PermissionEngineState } from '../policy/permission-engine.js';
import {
	hasPersistenceDatabaseConfiguration,
	resolvePersistenceDatabaseUrl,
} from './database-config.js';

export interface PolicyStateScope {
	readonly session_id: string;
	readonly tenant_id?: string;
	readonly user_id?: string;
	readonly workspace_id?: string;
}

export interface PolicyStateStore {
	getPolicyState(scope: PolicyStateScope): Promise<PermissionEngineState | null>;
	putPolicyState(scope: PolicyStateScope, state: PermissionEngineState): Promise<void>;
}

export class PolicyStateStoreConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PolicyStateStoreConfigurationError';
	}
}

export class PolicyStateStoreReadError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'PolicyStateStoreReadError';
	}
}

export class PolicyStateStoreWriteError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'PolicyStateStoreWriteError';
	}
}

class DatabasePolicyStateClient implements PolicyStateDatabaseClient {
	readonly #client: PolicyStateDatabaseClient;
	readonly #ready: Promise<void>;

	constructor(databaseUrl: string) {
		const connection = createDatabaseConnection(databaseUrl);
		this.#client = createPolicyStateDatabaseClient(connection.db);
		this.#ready = ensureDatabaseSchema(connection);
	}

	async get_policy_state_row(session_id: string): Promise<PolicyStateRecord | null> {
		await this.#ready;
		return this.#client.get_policy_state_row(session_id);
	}

	async upsert_policy_state_row(row: NewPolicyStateRecord): Promise<PolicyStateRecord> {
		await this.#ready;
		return this.#client.upsert_policy_state_row(row);
	}
}

function toNullableScopeValue(value: string | undefined): string | null {
	return value?.trim() ? value : null;
}

function toStoredStatus(state: PermissionEngineState): 'active' | 'paused' {
	return state.session_pause.active ? 'paused' : 'active';
}

function toPolicyStateRow(
	scope: PolicyStateScope,
	state: PermissionEngineState,
	existingCreatedAt?: string,
): NewPolicyStateRecord {
	const now = new Date().toISOString();

	return {
		auto_continue_enabled: state.progressive_trust.auto_continue.enabled,
		auto_continue_enabled_at: state.progressive_trust.auto_continue.enabled_at ?? null,
		auto_continue_max_consecutive_turns:
			state.progressive_trust.auto_continue.max_consecutive_turns ?? null,
		consecutive_denials: state.denial_tracking.consecutive_denials,
		created_at: existingCreatedAt ?? now,
		last_denial_at: state.denial_tracking.last_denial_at ?? null,
		last_denied_capability_id: state.denial_tracking.last_denied_capability_id ?? null,
		session_id: scope.session_id,
		session_pause_active: state.session_pause.active,
		session_pause_paused_at: state.session_pause.paused_at ?? null,
		session_pause_reason: state.session_pause.reason ?? null,
		status: toStoredStatus(state),
		tenant_id: toNullableScopeValue(scope.tenant_id),
		threshold: state.denial_tracking.threshold,
		updated_at: now,
		user_id: toNullableScopeValue(scope.user_id),
		workspace_id: toNullableScopeValue(scope.workspace_id),
	};
}

function toPolicyState(row: PolicyStateRecord): PermissionEngineState {
	return {
		denial_tracking: {
			consecutive_denials: row.consecutive_denials,
			last_denial_at: row.last_denial_at ?? undefined,
			last_denied_capability_id: row.last_denied_capability_id ?? undefined,
			threshold: row.threshold,
		},
		progressive_trust: {
			auto_continue: {
				enabled: row.auto_continue_enabled,
				enabled_at: row.auto_continue_enabled_at ?? undefined,
				max_consecutive_turns: row.auto_continue_max_consecutive_turns ?? undefined,
			},
		},
		session_pause: {
			active: row.session_pause_active,
			paused_at: row.session_pause_paused_at ?? undefined,
			reason: row.session_pause_reason ?? undefined,
		},
	};
}

function getDatabaseUrl(): string {
	return resolvePersistenceDatabaseUrl(
		(message) => new PolicyStateStoreConfigurationError(message),
		'DATABASE_URL is required for policy state persistence.',
	);
}

let defaultStore: PolicyStateStore | null = null;

export class DatabasePolicyStateStore implements PolicyStateStore {
	readonly #client: PolicyStateDatabaseClient;

	constructor(client?: PolicyStateDatabaseClient) {
		this.#client = client ?? new DatabasePolicyStateClient(getDatabaseUrl());
	}

	async getPolicyState(scope: PolicyStateScope): Promise<PermissionEngineState | null> {
		try {
			const row = await this.#client.get_policy_state_row(scope.session_id);
			return row ? toPolicyState(row) : null;
		} catch (error) {
			if (
				error instanceof PolicyStateStoreConfigurationError ||
				error instanceof PolicyStateStoreReadError
			) {
				throw error;
			}

			throw new PolicyStateStoreReadError(
				`Failed to read policy state for session "${scope.session_id}".`,
				{
					cause: error,
				},
			);
		}
	}

	async putPolicyState(scope: PolicyStateScope, state: PermissionEngineState): Promise<void> {
		try {
			const existingRow = await this.#client.get_policy_state_row(scope.session_id);
			await this.#client.upsert_policy_state_row(
				toPolicyStateRow(scope, state, existingRow?.created_at),
			);
		} catch (error) {
			if (
				error instanceof PolicyStateStoreConfigurationError ||
				error instanceof PolicyStateStoreWriteError
			) {
				throw error;
			}

			throw new PolicyStateStoreWriteError(
				`Failed to persist policy state for session "${scope.session_id}".`,
				{
					cause: error,
				},
			);
		}
	}
}

export function createDefaultPolicyStateStore(): PolicyStateStore | null {
	if (!hasPersistenceDatabaseConfiguration()) {
		return null;
	}

	defaultStore ??= new DatabasePolicyStateStore();
	return defaultStore;
}

function getPrincipalSessionId(authContext: AuthContext): string | undefined {
	if (authContext.session?.session_id) {
		return authContext.session.session_id;
	}

	if (authContext.principal.kind === 'authenticated' || authContext.principal.kind === 'service') {
		return authContext.principal.session_id;
	}

	return authContext.claims?.session_id;
}

export function toPolicyStateScope(
	authContext: AuthContext | undefined,
): PolicyStateScope | undefined {
	if (!authContext) {
		return undefined;
	}

	const principal = authContext.principal;
	const sessionId =
		getPrincipalSessionId(authContext) ??
		(principal.kind === 'authenticated'
			? `user:${principal.user_id}`
			: principal.kind === 'service'
				? `service:${principal.service_name}`
				: undefined);

	if (!sessionId) {
		return undefined;
	}

	return {
		session_id: sessionId,
		tenant_id: principal.scope.tenant_id,
		user_id:
			principal.kind === 'authenticated'
				? principal.user_id
				: (authContext.session?.user_id ?? authContext.user?.user_id),
		workspace_id: principal.scope.workspace_id,
	};
}
