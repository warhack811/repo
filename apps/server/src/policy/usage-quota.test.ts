import { describe, expect, it, vi } from 'vitest';

import type { AuthContext, SubscriptionContext, UsageMetricKey, UsageQuota } from '@runa/types';

import {
	evaluateResolvedUsageQuota,
	evaluateUsageQuota,
	requireUsageQuota,
	resolveUsageQuota,
} from './usage-quota.js';
import type { UsageQuotaError } from './usage-quota.js';

function createAuthenticatedAuthContext(): AuthContext {
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
	};
}

function createServiceAuthContext(): AuthContext {
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

function createUsageQuota(metric: UsageMetricKey, overrides: Partial<UsageQuota> = {}): UsageQuota {
	return {
		limit: 100,
		metric,
		resets_at: '2026-05-01T00:00:00.000Z',
		used: 25,
		window: 'monthly',
		...overrides,
	};
}

function createSubscriptionContext(
	quotas: readonly UsageQuota[] = [],
	overrides: Partial<SubscriptionContext> = {},
): SubscriptionContext {
	return {
		entitlements: [],
		effective_tier: 'pro',
		evaluated_at: '2026-04-17T10:00:00.000Z',
		quotas,
		scope: {
			kind: 'workspace',
			subject_id: 'workspace_1',
			tenant_id: 'tenant_1',
			user_id: 'user_1',
			workspace_id: 'workspace_1',
		},
		status: 'active',
		...overrides,
	};
}

describe('evaluateResolvedUsageQuota', () => {
	it('allows access when quota exists and remaining usage is available', () => {
		expect(
			evaluateResolvedUsageQuota({
				auth: createAuthenticatedAuthContext(),
				metric: 'monthly_turns',
				quota: createUsageQuota('monthly_turns', {
					remaining: 75,
					used: 25,
				}),
				subscription: createSubscriptionContext(),
			}),
		).toEqual({
			allowed: true,
			metric: 'monthly_turns',
			quota: {
				limit: 100,
				metric: 'monthly_turns',
				remaining: 75,
				resets_at: '2026-05-01T00:00:00.000Z',
				used: 25,
				window: 'monthly',
			},
			status: 'allowed',
		});
	});

	it('rejects exhausted quota even when subscription context exists and active', () => {
		expect(
			evaluateResolvedUsageQuota({
				auth: createAuthenticatedAuthContext(),
				metric: 'monthly_turns',
				quota: createUsageQuota('monthly_turns', {
					used: 100,
				}),
				subscription: createSubscriptionContext(),
			}),
		).toEqual({
			allowed: false,
			metric: 'monthly_turns',
			quota: {
				limit: 100,
				metric: 'monthly_turns',
				remaining: 0,
				resets_at: '2026-05-01T00:00:00.000Z',
				used: 100,
				window: 'monthly',
			},
			status: 'exhausted',
		});
	});

	it('returns controlled missing-context and missing-quota decisions', () => {
		expect(
			evaluateResolvedUsageQuota({
				auth: createAuthenticatedAuthContext(),
				metric: 'monthly_tool_calls',
			}),
		).toEqual({
			allowed: false,
			metric: 'monthly_tool_calls',
			status: 'subscription_context_missing',
		});

		expect(
			evaluateResolvedUsageQuota({
				auth: createAuthenticatedAuthContext(),
				metric: 'monthly_tool_calls',
				subscription: createSubscriptionContext(),
			}),
		).toEqual({
			allowed: false,
			metric: 'monthly_tool_calls',
			status: 'quota_missing',
		});
	});

	it('treats service principals as bypassed by default and as denied when explicitly disabled', () => {
		expect(
			evaluateResolvedUsageQuota({
				auth: createServiceAuthContext(),
				metric: 'monthly_storage_bytes',
			}),
		).toEqual({
			allowed: true,
			metric: 'monthly_storage_bytes',
			status: 'service_bypass',
		});

		expect(
			evaluateResolvedUsageQuota({
				allow_service_principal: false,
				auth: createServiceAuthContext(),
				metric: 'monthly_storage_bytes',
			}),
		).toEqual({
			allowed: false,
			metric: 'monthly_storage_bytes',
			status: 'service_principal_disabled',
		});
	});

	it('rejects anonymous quota evaluation requests', () => {
		expect(
			evaluateResolvedUsageQuota({
				auth: createAnonymousAuthContext(),
				metric: 'monthly_web_search_queries',
			}),
		).toEqual({
			allowed: false,
			metric: 'monthly_web_search_queries',
			status: 'anonymous',
		});
	});
});

describe('resolveUsageQuota', () => {
	it('resolves from subscription context when no custom resolver is provided', async () => {
		await expect(
			resolveUsageQuota({
				auth: createAuthenticatedAuthContext(),
				metric: 'monthly_web_search_queries',
				subscription: createSubscriptionContext([
					createUsageQuota('monthly_web_search_queries', {
						limit: 20,
						used: 6,
					}),
				]),
			}),
		).resolves.toEqual(
			createUsageQuota('monthly_web_search_queries', {
				limit: 20,
				used: 6,
			}),
		);
	});

	it('uses the injected resolver seam and allows tests without a billing backend', async () => {
		const resolveQuota = vi.fn().mockResolvedValue(
			createUsageQuota('monthly_tool_calls', {
				limit: 500,
				used: 120,
				window: 'billing_period',
			}),
		);

		const decision = await evaluateUsageQuota({
			auth: createAuthenticatedAuthContext(),
			metric: 'monthly_tool_calls',
			resolve_quota: resolveQuota,
		});

		expect(resolveQuota).toHaveBeenCalledWith({
			auth: expect.objectContaining({
				principal: expect.objectContaining({
					kind: 'authenticated',
				}),
			}),
			metric: 'monthly_tool_calls',
			subscription: undefined,
		});
		expect(decision).toEqual({
			allowed: true,
			metric: 'monthly_tool_calls',
			quota: {
				limit: 500,
				metric: 'monthly_tool_calls',
				remaining: 380,
				resets_at: '2026-05-01T00:00:00.000Z',
				used: 120,
				window: 'billing_period',
			},
			status: 'allowed',
		});
	});
});

describe('requireUsageQuota', () => {
	it('throws a controlled exhausted error for denied usage and preserves metric context', async () => {
		const expectedError: Partial<UsageQuotaError> = {
			code: 'USAGE_QUOTA_EXHAUSTED',
			metric: 'monthly_turns',
			statusCode: 429,
		};

		await expect(
			requireUsageQuota({
				auth: createAuthenticatedAuthContext(),
				metric: 'monthly_turns',
				subscription: createSubscriptionContext([
					createUsageQuota('monthly_turns', {
						remaining: 0,
						used: 100,
					}),
				]),
			}),
		).rejects.toMatchObject(expectedError);
	});
});
