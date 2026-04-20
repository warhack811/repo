export const subscriptionTiers = ['free', 'pro', 'business'] as const;

export type SubscriptionTier = (typeof subscriptionTiers)[number];

export const subscriptionStatuses = [
	'trialing',
	'active',
	'past_due',
	'paused',
	'cancelled',
	'expired',
] as const;

export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export const billingCadences = ['none', 'monthly', 'annual'] as const;

export type BillingCadence = (typeof billingCadences)[number];

export const subscriptionScopeKinds = ['user', 'workspace', 'tenant'] as const;

export type SubscriptionScopeKind = (typeof subscriptionScopeKinds)[number];

export const featureKeys = [
	'cloud_history',
	'desktop_agent',
	'web_search',
	'checkpoint_resume',
	'priority_models',
	'team_workspaces',
	'higher_usage_limits',
] as const;

export type FeatureKey = (typeof featureKeys)[number];

export const entitlementSources = ['plan', 'trial', 'grant', 'override'] as const;

export type EntitlementSource = (typeof entitlementSources)[number];

export const featureRestrictionReasons = [
	'plan_restricted',
	'subscription_inactive',
	'trial_expired',
	'usage_exhausted',
] as const;

export type FeatureRestrictionReason = (typeof featureRestrictionReasons)[number];

export const usageMetricKeys = [
	'monthly_turns',
	'monthly_tool_calls',
	'monthly_storage_bytes',
	'monthly_web_search_queries',
	'monthly_desktop_actions',
] as const;

export type UsageMetricKey = (typeof usageMetricKeys)[number];

export const usageWindows = ['daily', 'monthly', 'billing_period'] as const;

export type UsageWindow = (typeof usageWindows)[number];

export interface SubscriptionScope {
	readonly kind: SubscriptionScopeKind;
	readonly subject_id: string;
	readonly tenant_id?: string;
	readonly workspace_id?: string;
	readonly user_id?: string;
}

export type SubscriptionMetadata = Readonly<Record<string, unknown>>;

export interface BillingReference {
	readonly provider: 'internal' | 'external' | 'manual';
	readonly customer_reference?: string;
	readonly subscription_reference?: string;
	readonly plan_reference?: string;
}

export interface SubscriptionPlan {
	readonly tier: SubscriptionTier;
	readonly cadence: BillingCadence;
	readonly plan_code?: string;
}

export interface FeatureGate {
	readonly feature_key: FeatureKey;
	readonly minimum_tier: SubscriptionTier;
	readonly requires_active_subscription: boolean;
	readonly usage_metric?: UsageMetricKey;
}

export interface EnabledFeatureEntitlement {
	readonly feature_key: FeatureKey;
	readonly status: 'enabled';
	readonly source: EntitlementSource;
	readonly expires_at?: string;
}

export interface DisabledFeatureEntitlement {
	readonly feature_key: FeatureKey;
	readonly status: 'disabled';
	readonly reason: FeatureRestrictionReason;
}

export type FeatureEntitlement = EnabledFeatureEntitlement | DisabledFeatureEntitlement;

export interface UsageQuota {
	readonly metric: UsageMetricKey;
	readonly window: UsageWindow;
	readonly limit: number;
	readonly used: number;
	readonly remaining?: number;
	readonly resets_at?: string;
}

export type UsageLimit = UsageQuota;

export interface SubscriptionRecord {
	readonly subscription_id: string;
	readonly scope: SubscriptionScope;
	readonly plan: SubscriptionPlan;
	readonly status: SubscriptionStatus;
	readonly current_period_started_at?: string;
	readonly current_period_ends_at?: string;
	readonly trial_ends_at?: string;
	readonly renews_at?: string;
	readonly cancelled_at?: string;
	readonly cancel_at_period_end?: boolean;
	readonly billing_reference?: BillingReference;
	readonly metadata?: SubscriptionMetadata;
}

export interface SubscriptionContext {
	readonly scope: SubscriptionScope;
	readonly effective_tier: SubscriptionTier;
	readonly status: SubscriptionStatus;
	readonly entitlements: readonly FeatureEntitlement[];
	readonly quotas: readonly UsageQuota[];
	readonly subscription?: SubscriptionRecord;
	readonly evaluated_at?: string;
}
