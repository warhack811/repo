import { describe, expect, it } from 'vitest';

import type { AuthContext, FeatureGate, SubscriptionContext } from '@runa/types';

import {
	SubscriptionGateError,
	compareSubscriptionTiers,
	evaluateFeatureAccess,
	requireFeatureAccess,
} from './subscription-gating.js';

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

function createSubscriptionContext(
	overrides: Partial<SubscriptionContext> = {},
): SubscriptionContext {
	return {
		entitlements: [],
		effective_tier: 'free',
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
		...overrides,
	};
}

const checkpointResumeGate: FeatureGate = {
	feature_key: 'checkpoint_resume',
	minimum_tier: 'pro',
	requires_active_subscription: true,
};

describe('compareSubscriptionTiers', () => {
	it('orders free < pro < business deterministically', () => {
		expect(compareSubscriptionTiers('free', 'pro')).toBeLessThan(0);
		expect(compareSubscriptionTiers('pro', 'business')).toBeLessThan(0);
		expect(compareSubscriptionTiers('business', 'free')).toBeGreaterThan(0);
	});
});

describe('evaluateFeatureAccess', () => {
	it('allows feature access for matching free/pro/business tiers', () => {
		expect(
			evaluateFeatureAccess({
				auth: createAuthenticatedAuthContext(),
				feature_gate: {
					feature_key: 'cloud_history',
					minimum_tier: 'free',
					requires_active_subscription: false,
				},
				subscription: createSubscriptionContext({
					effective_tier: 'free',
				}),
			}).allowed,
		).toBe(true);

		expect(
			evaluateFeatureAccess({
				auth: createAuthenticatedAuthContext(),
				feature_gate: checkpointResumeGate,
				subscription: createSubscriptionContext({
					effective_tier: 'pro',
				}),
			}).allowed,
		).toBe(true);

		expect(
			evaluateFeatureAccess({
				auth: createAuthenticatedAuthContext(),
				feature_gate: {
					feature_key: 'higher_usage_limits',
					minimum_tier: 'business',
					requires_active_subscription: true,
				},
				subscription: createSubscriptionContext({
					effective_tier: 'business',
				}),
			}).allowed,
		).toBe(true);
	});

	it('rejects inactive subscription states for active-gated features', () => {
		for (const status of ['paused', 'expired', 'cancelled', 'past_due'] as const) {
			expect(
				evaluateFeatureAccess({
					auth: createAuthenticatedAuthContext(),
					feature_gate: checkpointResumeGate,
					subscription: createSubscriptionContext({
						effective_tier: 'pro',
						status,
					}),
				}),
			).toMatchObject({
				allowed: false,
				reason: 'subscription_inactive',
			});
		}
	});

	it('rejects anonymous requests on protected feature access', () => {
		expect(
			evaluateFeatureAccess({
				auth: createAnonymousAuthContext(),
				feature_gate: checkpointResumeGate,
			}),
		).toMatchObject({
			allowed: false,
			reason: 'anonymous',
		});
	});

	it('allows service principals by default and can explicitly disable them', () => {
		expect(
			evaluateFeatureAccess({
				auth: createServiceAuthContext(),
				feature_gate: checkpointResumeGate,
			}),
		).toMatchObject({
			allowed: true,
			current_tier: 'business',
		});

		expect(
			evaluateFeatureAccess({
				allow_service_principal: false,
				auth: createServiceAuthContext(),
				feature_gate: checkpointResumeGate,
			}),
		).toMatchObject({
			allowed: false,
			reason: 'service_principal_disabled',
		});
	});

	it('honors explicit disabled entitlements and missing subscription context', () => {
		expect(
			evaluateFeatureAccess({
				auth: createAuthenticatedAuthContext(),
				feature_gate: checkpointResumeGate,
				subscription: createSubscriptionContext({
					entitlements: [
						{
							feature_key: 'checkpoint_resume',
							reason: 'usage_exhausted',
							status: 'disabled',
						},
					],
				}),
			}),
		).toMatchObject({
			allowed: false,
			reason: 'usage_exhausted',
		});

		expect(
			evaluateFeatureAccess({
				auth: createAuthenticatedAuthContext(),
				feature_gate: checkpointResumeGate,
			}),
		).toMatchObject({
			allowed: false,
			reason: 'subscription_context_missing',
		});
	});
});

describe('requireFeatureAccess', () => {
	it('throws controlled gate errors for anonymous and plan-restricted access', () => {
		expect(() =>
			requireFeatureAccess({
				auth: createAnonymousAuthContext(),
				feature_gate: checkpointResumeGate,
			}),
		).toThrowError(SubscriptionGateError);

		expect(() =>
			requireFeatureAccess({
				auth: createAuthenticatedAuthContext(),
				feature_gate: checkpointResumeGate,
				subscription: createSubscriptionContext({
					effective_tier: 'free',
				}),
			}),
		).toThrowError('Feature requires pro tier access.');
	});
});
