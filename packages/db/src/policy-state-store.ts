import { eq } from 'drizzle-orm';

import type { RunaDatabase } from './client.js';
import type { NewPolicyStateRecord, PolicyStateRecord } from './policy-states.js';
import { policyStatesTable } from './schema.js';

export interface PolicyStateDatabaseClient {
	get_policy_state_row(session_id: string): Promise<PolicyStateRecord | null>;
	upsert_policy_state_row(row: NewPolicyStateRecord): Promise<PolicyStateRecord>;
}

function toPolicyStateUpsertSet(
	row: NewPolicyStateRecord,
): Omit<NewPolicyStateRecord, 'session_id'> {
	return {
		approval_mode: row.approval_mode,
		approval_mode_updated_at: row.approval_mode_updated_at,
		auto_continue_enabled: row.auto_continue_enabled,
		auto_continue_enabled_at: row.auto_continue_enabled_at,
		auto_continue_max_consecutive_turns: row.auto_continue_max_consecutive_turns,
		consecutive_denials: row.consecutive_denials,
		created_at: row.created_at,
		last_denial_at: row.last_denial_at,
		last_denied_capability_id: row.last_denied_capability_id,
		session_pause_active: row.session_pause_active,
		session_pause_paused_at: row.session_pause_paused_at,
		session_pause_reason: row.session_pause_reason,
		status: row.status,
		tenant_id: row.tenant_id,
		threshold: row.threshold,
		trusted_session_approved_capability_count: row.trusted_session_approved_capability_count,
		trusted_session_consumed_turns: row.trusted_session_consumed_turns,
		trusted_session_enabled: row.trusted_session_enabled,
		trusted_session_enabled_at: row.trusted_session_enabled_at,
		trusted_session_expires_at: row.trusted_session_expires_at,
		trusted_session_max_approved_capabilities: row.trusted_session_max_approved_capabilities,
		trusted_session_max_turns: row.trusted_session_max_turns,
		updated_at: row.updated_at,
		user_id: row.user_id,
		workspace_id: row.workspace_id,
	};
}

export function createPolicyStateDatabaseClient(db: RunaDatabase): PolicyStateDatabaseClient {
	return {
		async get_policy_state_row(session_id) {
			const rows = await db
				.select()
				.from(policyStatesTable)
				.where(eq(policyStatesTable.session_id, session_id))
				.limit(1);

			return rows[0] ?? null;
		},
		async upsert_policy_state_row(row) {
			const rows = await db
				.insert(policyStatesTable)
				.values(row)
				.onConflictDoUpdate({
					set: toPolicyStateUpsertSet(row),
					target: policyStatesTable.session_id,
				})
				.returning();

			const persistedRow = rows[0];

			if (persistedRow === undefined) {
				throw new Error(`Policy state row "${row.session_id}" was not returned after upsert.`);
			}

			return persistedRow;
		},
	};
}
