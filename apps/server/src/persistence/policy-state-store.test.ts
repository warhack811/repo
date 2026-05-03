import type { NewPolicyStateRecord, PolicyStateDatabaseClient, PolicyStateRecord } from '@runa/db';

import { describe, expect, it, vi } from 'vitest';

import {
	type PermissionEngineState,
	createPermissionEngine,
	createToolPermissionRequest,
} from '../policy/permission-engine.js';
import {
	DatabasePolicyStateStore,
	PolicyStateStoreReadError,
	PolicyStateStoreWriteError,
	toPolicyStateScope,
} from './policy-state-store.js';

function createState(): PermissionEngineState {
	return {
		denial_tracking: {
			consecutive_denials: 2,
			last_denial_at: '2026-04-20T10:00:00.000Z',
			last_denied_capability_id: 'shell.exec',
			threshold: 3,
		},
		progressive_trust: {
			approval_mode: {
				mode: 'standard',
			},
			auto_continue: {
				enabled: true,
				enabled_at: '2026-04-20T10:05:00.000Z',
				max_consecutive_turns: 4,
			},
			trusted_session: {
				approved_capability_count: 0,
				consumed_turns: 0,
				enabled: false,
			},
		},
		session_pause: {
			active: true,
			paused_at: '2026-04-20T10:06:00.000Z',
			reason: 'denial_threshold' as const,
		},
	};
}

function createPolicyStateRow(): PolicyStateRecord {
	return {
		approval_mode: 'standard',
		approval_mode_updated_at: null,
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
		trusted_session_approved_capability_count: null,
		trusted_session_consumed_turns: null,
		trusted_session_enabled: null,
		trusted_session_enabled_at: null,
		trusted_session_expires_at: null,
		trusted_session_max_approved_capabilities: null,
		trusted_session_max_turns: null,
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

	it('hydrates old rows without mode columns into standard mode with trusted-session disabled', async () => {
		const oldRow = {
			...createPolicyStateRow(),
			approval_mode: undefined,
			approval_mode_updated_at: undefined,
			trusted_session_approved_capability_count: undefined,
			trusted_session_consumed_turns: undefined,
			trusted_session_enabled: undefined,
			trusted_session_enabled_at: undefined,
			trusted_session_expires_at: undefined,
			trusted_session_max_approved_capabilities: undefined,
			trusted_session_max_turns: undefined,
		} as unknown as Awaited<ReturnType<PolicyStateDatabaseClient['get_policy_state_row']>>;
		const client: PolicyStateDatabaseClient = {
			get_policy_state_row: vi.fn(async () => oldRow),
			upsert_policy_state_row: vi.fn(),
		};
		const store = new DatabasePolicyStateStore(client);

		await expect(store.getPolicyState({ session_id: 'session_1' })).resolves.toMatchObject({
			progressive_trust: {
				approval_mode: {
					mode: 'standard',
				},
				trusted_session: {
					approved_capability_count: 0,
					consumed_turns: 0,
					enabled: false,
				},
			},
		});
	});

	it('clamps invalid stored approval modes to standard', async () => {
		const invalidModeRow = {
			...createPolicyStateRow(),
			approval_mode: 'full-access',
		} as unknown as PolicyStateRecord;
		const client: PolicyStateDatabaseClient = {
			get_policy_state_row: vi.fn(async () => invalidModeRow),
			upsert_policy_state_row: vi.fn(),
		};
		const store = new DatabasePolicyStateStore(client);

		await expect(store.getPolicyState({ session_id: 'session_1' })).resolves.toMatchObject({
			progressive_trust: {
				approval_mode: {
					mode: 'standard',
				},
				trusted_session: {
					enabled: false,
				},
			},
		});
	});

	it('hydrates trusted-session mode, ttl, and counters from persisted rows', async () => {
		const trustedRow: PolicyStateRecord = {
			...createPolicyStateRow(),
			approval_mode: 'trusted-session',
			approval_mode_updated_at: '2026-05-03T10:00:00.000Z',
			trusted_session_approved_capability_count: 7,
			trusted_session_consumed_turns: 3,
			trusted_session_enabled: true,
			trusted_session_enabled_at: '2026-05-03T10:00:00.000Z',
			trusted_session_expires_at: '2026-05-03T11:00:00.000Z',
			trusted_session_max_approved_capabilities: 50,
			trusted_session_max_turns: 20,
		};
		const client: PolicyStateDatabaseClient = {
			get_policy_state_row: vi.fn(async () => trustedRow),
			upsert_policy_state_row: vi.fn(),
		};
		const store = new DatabasePolicyStateStore(client);

		await expect(store.getPolicyState({ session_id: 'session_1' })).resolves.toMatchObject({
			progressive_trust: {
				approval_mode: {
					mode: 'trusted-session',
					updated_at: '2026-05-03T10:00:00.000Z',
				},
				trusted_session: {
					approved_capability_count: 7,
					consumed_turns: 3,
					enabled: true,
					enabled_at: '2026-05-03T10:00:00.000Z',
					expires_at: '2026-05-03T11:00:00.000Z',
					max_approved_capabilities: 50,
					max_turns: 20,
				},
			},
		});
	});

	it('hydrates expired trusted-session state without producing auto-allow evaluation', async () => {
		const expiredTrustedRow: PolicyStateRecord = {
			...createPolicyStateRow(),
			approval_mode: 'trusted-session',
			session_pause_active: false,
			session_pause_paused_at: null,
			session_pause_reason: null,
			status: 'active',
			trusted_session_approved_capability_count: 0,
			trusted_session_consumed_turns: 1,
			trusted_session_enabled: true,
			trusted_session_enabled_at: '2026-05-03T08:00:00.000Z',
			trusted_session_expires_at: '2026-05-03T09:00:00.000Z',
			trusted_session_max_approved_capabilities: 50,
			trusted_session_max_turns: 20,
		};
		const client: PolicyStateDatabaseClient = {
			get_policy_state_row: vi.fn(async () => expiredTrustedRow),
			upsert_policy_state_row: vi.fn(),
		};
		const store = new DatabasePolicyStateStore(client);
		const state = await store.getPolicyState({ session_id: 'session_1' });
		const engine = createPermissionEngine({
			now: () => '2026-05-03T10:00:00.000Z',
		});

		if (state === null) {
			throw new Error('Expected persisted policy state.');
		}

		const decision = engine.evaluatePermission({
			request: createToolPermissionRequest({
				tool_definition: {
					metadata: {
						capability_class: 'file_system',
						requires_approval: true,
						risk_level: 'medium',
						side_effect_level: 'read',
					},
					name: 'file.read',
				},
			}),
			state,
		});

		expect(decision.decision).toBe('require_approval');
		expect(decision.reason).toBe('approval_required_by_capability');
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
				approval_mode: 'standard',
				approval_mode_updated_at: null,
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
				trusted_session_approved_capability_count: 0,
				trusted_session_consumed_turns: 0,
				trusted_session_enabled: false,
				trusted_session_enabled_at: null,
				trusted_session_expires_at: null,
				trusted_session_max_approved_capabilities: null,
				trusted_session_max_turns: null,
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
