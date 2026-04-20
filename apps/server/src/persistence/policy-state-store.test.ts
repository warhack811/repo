import type { NewPolicyStateRecord, PolicyStateDatabaseClient } from '@runa/db';

import { describe, expect, it, vi } from 'vitest';

import {
	DatabasePolicyStateStore,
	PolicyStateStoreReadError,
	PolicyStateStoreWriteError,
	toPolicyStateScope,
} from './policy-state-store.js';

function createState() {
	return {
		denial_tracking: {
			consecutive_denials: 2,
			last_denial_at: '2026-04-20T10:00:00.000Z',
			last_denied_capability_id: 'shell.exec',
			threshold: 3,
		},
		progressive_trust: {
			auto_continue: {
				enabled: true,
				enabled_at: '2026-04-20T10:05:00.000Z',
				max_consecutive_turns: 4,
			},
		},
		session_pause: {
			active: true,
			paused_at: '2026-04-20T10:06:00.000Z',
			reason: 'denial_threshold' as const,
		},
	};
}

function createPolicyStateRow() {
	return {
		auto_continue_enabled: true,
		auto_continue_enabled_at: '2026-04-20T10:05:00.000Z',
		auto_continue_max_consecutive_turns: 4,
		consecutive_denials: 2,
		created_at: '2026-04-20T10:00:00.000Z',
		last_denial_at: '2026-04-20T10:00:00.000Z',
		last_denied_capability_id: 'shell.exec',
		session_id: 'session_1',
		session_pause_active: true,
		session_pause_paused_at: '2026-04-20T10:06:00.000Z',
		session_pause_reason: 'denial_threshold' as const,
		status: 'paused' as const,
		tenant_id: 'tenant_1',
		threshold: 3,
		updated_at: '2026-04-20T10:06:00.000Z',
		user_id: 'user_1',
		workspace_id: 'workspace_1',
	};
}

describe('policy-state-store', () => {
	it('hydrates database rows into permission engine state', async () => {
		const client: PolicyStateDatabaseClient = {
			get_policy_state_row: vi.fn(async () => createPolicyStateRow()),
			upsert_policy_state_row: vi.fn(),
		};
		const store = new DatabasePolicyStateStore(client);

		await expect(
			store.getPolicyState({
				session_id: 'session_1',
				tenant_id: 'tenant_1',
				user_id: 'user_1',
				workspace_id: 'workspace_1',
			}),
		).resolves.toEqual(createState());
	});

	it('maps permission engine state into deterministic upserts', async () => {
		const getPolicyStateRow: PolicyStateDatabaseClient['get_policy_state_row'] = vi.fn(
			async () => null,
		);
		const upsertPolicyStateRow: PolicyStateDatabaseClient['upsert_policy_state_row'] = vi.fn(
			async () => createPolicyStateRow(),
		);
		const store = new DatabasePolicyStateStore({
			get_policy_state_row: getPolicyStateRow,
			upsert_policy_state_row: upsertPolicyStateRow,
		});

		await store.putPolicyState(
			{
				session_id: 'session_1',
				tenant_id: 'tenant_1',
				user_id: 'user_1',
				workspace_id: 'workspace_1',
			},
			createState(),
		);

		expect(upsertPolicyStateRow).toHaveBeenCalledWith(
			expect.objectContaining<NewPolicyStateRecord>({
				auto_continue_enabled: true,
				auto_continue_enabled_at: '2026-04-20T10:05:00.000Z',
				auto_continue_max_consecutive_turns: 4,
				consecutive_denials: 2,
				last_denial_at: '2026-04-20T10:00:00.000Z',
				last_denied_capability_id: 'shell.exec',
				session_id: 'session_1',
				created_at: expect.any(String),
				session_pause_active: true,
				session_pause_paused_at: '2026-04-20T10:06:00.000Z',
				session_pause_reason: 'denial_threshold',
				status: 'paused',
				tenant_id: 'tenant_1',
				threshold: 3,
				updated_at: expect.any(String),
				user_id: 'user_1',
				workspace_id: 'workspace_1',
			}),
		);
	});

	it('wraps read and write failures in typed persistence errors', async () => {
		const readStore = new DatabasePolicyStateStore({
			get_policy_state_row: vi.fn(async () => {
				throw new Error('read failed');
			}),
			upsert_policy_state_row: vi.fn(),
		});
		const writeStore = new DatabasePolicyStateStore({
			get_policy_state_row: vi.fn(async () => null),
			upsert_policy_state_row: vi.fn(async () => {
				throw new Error('write failed');
			}),
		});

		await expect(readStore.getPolicyState({ session_id: 'session_1' })).rejects.toThrowError(
			PolicyStateStoreReadError,
		);
		await expect(
			writeStore.putPolicyState({ session_id: 'session_1' }, createState()),
		).rejects.toThrowError(PolicyStateStoreWriteError);
	});

	it('derives policy scope from authenticated auth context', () => {
		expect(
			toPolicyStateScope({
				principal: {
					email: 'user@example.com',
					kind: 'authenticated',
					provider: 'supabase',
					role: 'authenticated',
					scope: {
						tenant_id: 'tenant_1',
						workspace_id: 'workspace_1',
					},
					session_id: 'session_1',
					user_id: 'user_1',
				},
				session: {
					identity_provider: 'email_password',
					provider: 'supabase',
					scope: {
						tenant_id: 'tenant_1',
						workspace_id: 'workspace_1',
					},
					session_id: 'session_1',
					user_id: 'user_1',
				},
				transport: 'websocket',
			}),
		).toEqual({
			session_id: 'session_1',
			tenant_id: 'tenant_1',
			user_id: 'user_1',
			workspace_id: 'workspace_1',
		});
	});
});
