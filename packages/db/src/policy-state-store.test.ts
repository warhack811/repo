import { describe, expect, it } from 'vitest';

import type { RunaDatabase } from './client.js';
import type { NewPolicyStateRecord, PolicyStateRecord } from './policy-states.js';

import { createPolicyStateDatabaseClient } from './policy-state-store.js';

function createPolicyStateRow(overrides: Partial<PolicyStateRecord> = {}): PolicyStateRecord {
	return {
		approval_mode: 'trusted-session',
		approval_mode_updated_at: '2026-05-03T10:00:00.000Z',
		auto_continue_enabled: false,
		auto_continue_enabled_at: null,
		auto_continue_max_consecutive_turns: null,
		consecutive_denials: 0,
		created_at: '2026-05-03T10:00:00.000Z',
		last_denial_at: null,
		last_denied_capability_id: null,
		session_id: 'session_policy_db',
		session_pause_active: false,
		session_pause_paused_at: null,
		session_pause_reason: null,
		status: 'active',
		tenant_id: 'tenant_policy_db',
		threshold: 3,
		trusted_session_approved_capability_count: 2,
		trusted_session_consumed_turns: 4,
		trusted_session_enabled: true,
		trusted_session_enabled_at: '2026-05-03T10:00:00.000Z',
		trusted_session_expires_at: '2026-05-03T11:00:00.000Z',
		trusted_session_max_approved_capabilities: 50,
		trusted_session_max_turns: 20,
		updated_at: '2026-05-03T10:10:00.000Z',
		user_id: 'user_policy_db',
		workspace_id: 'workspace_policy_db',
		...overrides,
	};
}

function createFakeDatabase() {
	const rows = new Map<string, PolicyStateRecord>();

	return {
		db: {
			insert() {
				return {
					values(row: NewPolicyStateRecord) {
						return {
							onConflictDoUpdate(input: {
								readonly set: Partial<PolicyStateRecord>;
							}) {
								return {
									async returning() {
										const existing = rows.get(row.session_id);
										const nextRow = createPolicyStateRow({
											...existing,
											...row,
											...input.set,
										});
										rows.set(row.session_id, nextRow);
										return [nextRow];
									},
								};
							},
						};
					},
				};
			},
			select() {
				return {
					from() {
						return {
							where() {
								return {
									async limit() {
										return Array.from(rows.values());
									},
								};
							},
						};
					},
				};
			},
		} as unknown as RunaDatabase,
		rows,
	};
}

describe('policy state database client', () => {
	it('roundtrips approval mode and trusted-session fields through upsert/read', async () => {
		const fakeDatabase = createFakeDatabase();
		const client = createPolicyStateDatabaseClient(fakeDatabase.db);
		const row = createPolicyStateRow();

		await expect(client.upsert_policy_state_row(row)).resolves.toMatchObject({
			approval_mode: 'trusted-session',
			trusted_session_approved_capability_count: 2,
			trusted_session_consumed_turns: 4,
			trusted_session_enabled: true,
		});

		await expect(client.get_policy_state_row('session_policy_db')).resolves.toMatchObject({
			approval_mode: 'trusted-session',
			approval_mode_updated_at: '2026-05-03T10:00:00.000Z',
			trusted_session_approved_capability_count: 2,
			trusted_session_consumed_turns: 4,
			trusted_session_enabled: true,
			trusted_session_enabled_at: '2026-05-03T10:00:00.000Z',
			trusted_session_expires_at: '2026-05-03T11:00:00.000Z',
			trusted_session_max_approved_capabilities: 50,
			trusted_session_max_turns: 20,
		});
	});
});
