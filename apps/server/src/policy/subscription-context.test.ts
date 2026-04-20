import { describe, expect, it, vi } from 'vitest';

import type { AuthContext, SubscriptionContext } from '@runa/types';

import {
	createDefaultSubscriptionContext,
	resolveSubscriptionContext,
	resolveSubscriptionScope,
} from './subscription-context.js';

function createAuthenticatedAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
	return {
		bearer_token_present: true,
		principal: {
			kind: 'authenticated',
			provider: 'supabase',
			role: 'authenticated',
			scope: {
				tenant_id: 'tenant_1',
				workspace_id: 'workspace_1',
				workspace_ids: ['workspace_1'],
			},
			session_id: 'session_1',
			user_id: 'user_1',
		},
		request_id: 'req_1',
		transport: 'http',
		...overrides,
	};
}

function createServiceAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
	return {
		bearer_token_present: true,
		principal: {
			kind: 'service',
			provider: 'supabase',
			role: 'service_role',
			scope: {
				tenant_id: 'tenant_1',
				workspace_id: 'workspace_1',
			},
			service_name: 'system-worker',
			session_id: 'service_session_1',
		},
		request_id: 'req_service_1',
		transport: 'internal',
		...overrides,
	};
}

function createAnonymousAuthContext(): AuthContext {
	return {
		bearer_token_present: false,
		principal: {
			kind: 'anonymous',
			provider: 'internal',
			role: 'anon',
			scope: {},
		},
		request_id: 'req_anon_1',
		transport: 'http',
	};
}

function createResolvedSubscriptionContext(): SubscriptionContext {
	return {
		entitlements: [],
		effective_tier: 'pro',
		evaluated_at: '2026-04-16T12:00:00.000Z',
		quotas: [],
		scope: {
			kind: 'workspace',
			subject_id: 'workspace_1',
			tenant_id: 'tenant_1',
			user_id: 'user_1',
			workspace_id: 'workspace_1',
		},
		status: 'active',
	};
}

describe('resolveSubscriptionScope', () => {
	it('maps authenticated principals to workspace scope when workspace context exists', () => {
		expect(resolveSubscriptionScope(createAuthenticatedAuthContext())).toEqual({
			kind: 'workspace',
			subject_id: 'workspace_1',
			tenant_id: 'tenant_1',
			user_id: 'user_1',
			workspace_id: 'workspace_1',
		});
	});

	it('maps service principals to workspace scope and anonymous principals to undefined', () => {
		expect(resolveSubscriptionScope(createServiceAuthContext())).toEqual({
			kind: 'workspace',
			subject_id: 'workspace_1',
			tenant_id: 'tenant_1',
			workspace_id: 'workspace_1',
		});
		expect(resolveSubscriptionScope(createAnonymousAuthContext())).toBeUndefined();
	});
});

describe('resolveSubscriptionContext', () => {
	it('uses the injected resolver for authenticated principals', async () => {
		const resolveContext = vi.fn().mockResolvedValue(createResolvedSubscriptionContext());

		const result = await resolveSubscriptionContext({
			auth: createAuthenticatedAuthContext(),
			resolve_context: resolveContext,
		});

		expect(resolveContext).toHaveBeenCalledWith({
			auth: expect.objectContaining({
				principal: expect.objectContaining({
					kind: 'authenticated',
				}),
			}),
		});
		expect(result).toMatchObject({
			effective_tier: 'pro',
			status: 'active',
		});
	});

	it('falls back to a default free active subscription context when the resolver returns null', async () => {
		const result = await resolveSubscriptionContext({
			auth: createAuthenticatedAuthContext(),
			now: () => new Date('2026-04-16T12:30:00.000Z'),
			resolve_context: async () => null,
		});

		expect(result).toEqual({
			entitlements: [],
			effective_tier: 'free',
			evaluated_at: '2026-04-16T12:30:00.000Z',
			quotas: [],
			scope: {
				kind: 'workspace',
				subject_id: 'workspace_1',
				tenant_id: 'tenant_1',
				user_id: 'user_1',
				workspace_id: 'workspace_1',
			},
			status: 'active',
		});
	});

	it('returns undefined for anonymous principals and a default scope-aligned context for service principals', async () => {
		await expect(
			resolveSubscriptionContext({
				auth: createAnonymousAuthContext(),
			}),
		).resolves.toBeUndefined();

		await expect(
			resolveSubscriptionContext({
				auth: createServiceAuthContext(),
				now: () => new Date('2026-04-16T12:45:00.000Z'),
			}),
		).resolves.toEqual({
			entitlements: [],
			effective_tier: 'free',
			evaluated_at: '2026-04-16T12:45:00.000Z',
			quotas: [],
			scope: {
				kind: 'workspace',
				subject_id: 'workspace_1',
				tenant_id: 'tenant_1',
				workspace_id: 'workspace_1',
			},
			status: 'active',
		});
	});
});

describe('createDefaultSubscriptionContext', () => {
	it('creates a deterministic free active baseline for authenticated principals', () => {
		expect(
			createDefaultSubscriptionContext(
				createAuthenticatedAuthContext(),
				() => new Date('2026-04-16T13:00:00.000Z'),
			),
		).toEqual({
			entitlements: [],
			effective_tier: 'free',
			evaluated_at: '2026-04-16T13:00:00.000Z',
			quotas: [],
			scope: {
				kind: 'workspace',
				subject_id: 'workspace_1',
				tenant_id: 'tenant_1',
				user_id: 'user_1',
				workspace_id: 'workspace_1',
			},
			status: 'active',
		});
	});
});
