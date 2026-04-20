import type {
	AuthContext,
	FeatureEntitlement,
	FeatureGate,
	FeatureRestrictionReason,
	SubscriptionContext,
	SubscriptionStatus,
	SubscriptionTier,
} from '@runa/types';

type SubscriptionGateErrorCode =
	| 'SUBSCRIPTION_AUTH_REQUIRED'
	| 'SUBSCRIPTION_FEATURE_FORBIDDEN'
	| 'SUBSCRIPTION_SERVICE_PRINCIPAL_FORBIDDEN';

export interface EvaluateFeatureAccessInput {
	readonly allow_service_principal?: boolean;
	readonly auth: AuthContext;
	readonly feature_gate: FeatureGate;
	readonly subscription?: SubscriptionContext;
}

export interface FeatureAccessDecision {
	readonly allowed: boolean;
	readonly current_tier?: SubscriptionTier;
	readonly reason?:
		| FeatureRestrictionReason
		| 'anonymous'
		| 'service_principal_disabled'
		| 'subscription_context_missing';
	readonly required_tier?: SubscriptionTier;
}

export class SubscriptionGateError extends Error {
	readonly code: SubscriptionGateErrorCode;
	readonly feature_key: FeatureGate['feature_key'];
	readonly statusCode: 401 | 403;

	constructor(
		code: SubscriptionGateErrorCode,
		featureKey: FeatureGate['feature_key'],
		message: string,
	) {
		super(message);
		this.code = code;
		this.feature_key = featureKey;
		this.name = 'SubscriptionGateError';
		this.statusCode = code === 'SUBSCRIPTION_AUTH_REQUIRED' ? 401 : 403;
	}
}

const tierRank: Readonly<Record<SubscriptionTier, number>> = {
	business: 2,
	free: 0,
	pro: 1,
};

function isSubscriptionActive(status: SubscriptionStatus): boolean {
	return status === 'active' || status === 'trialing';
}

function getFeatureEntitlement(
	subscription: SubscriptionContext,
	featureKey: FeatureGate['feature_key'],
): FeatureEntitlement | undefined {
	return subscription.entitlements.find((entitlement) => entitlement.feature_key === featureKey);
}

export function compareSubscriptionTiers(left: SubscriptionTier, right: SubscriptionTier): number {
	return tierRank[left] - tierRank[right];
}

export function createSubscriptionGate(feature_gate: FeatureGate): FeatureGate {
	return feature_gate;
}

export function evaluateFeatureAccess(input: EvaluateFeatureAccessInput): FeatureAccessDecision {
	if (input.auth.principal.kind === 'anonymous') {
		return {
			allowed: false,
			reason: 'anonymous',
			required_tier: input.feature_gate.minimum_tier,
		};
	}

	if (input.auth.principal.kind === 'service') {
		if (input.allow_service_principal === false) {
			return {
				allowed: false,
				reason: 'service_principal_disabled',
				required_tier: input.feature_gate.minimum_tier,
			};
		}

		return {
			allowed: true,
			current_tier: 'business',
			required_tier: input.feature_gate.minimum_tier,
		};
	}

	if (input.subscription === undefined) {
		return {
			allowed: false,
			reason: 'subscription_context_missing',
			required_tier: input.feature_gate.minimum_tier,
		};
	}

	const entitlement = getFeatureEntitlement(input.subscription, input.feature_gate.feature_key);

	if (entitlement?.status === 'enabled') {
		return {
			allowed: true,
			current_tier: input.subscription.effective_tier,
			required_tier: input.feature_gate.minimum_tier,
		};
	}

	if (entitlement?.status === 'disabled') {
		return {
			allowed: false,
			current_tier: input.subscription.effective_tier,
			reason: entitlement.reason,
			required_tier: input.feature_gate.minimum_tier,
		};
	}

	if (
		compareSubscriptionTiers(input.subscription.effective_tier, input.feature_gate.minimum_tier) < 0
	) {
		return {
			allowed: false,
			current_tier: input.subscription.effective_tier,
			reason: 'plan_restricted',
			required_tier: input.feature_gate.minimum_tier,
		};
	}

	if (
		(input.feature_gate.requires_active_subscription ||
			input.subscription.effective_tier !== 'free') &&
		!isSubscriptionActive(input.subscription.status)
	) {
		return {
			allowed: false,
			current_tier: input.subscription.effective_tier,
			reason: 'subscription_inactive',
			required_tier: input.feature_gate.minimum_tier,
		};
	}

	return {
		allowed: true,
		current_tier: input.subscription.effective_tier,
		required_tier: input.feature_gate.minimum_tier,
	};
}

export function requireFeatureAccess(input: EvaluateFeatureAccessInput): void {
	const decision = evaluateFeatureAccess(input);

	if (decision.allowed) {
		return;
	}

	if (decision.reason === 'anonymous') {
		throw new SubscriptionGateError(
			'SUBSCRIPTION_AUTH_REQUIRED',
			input.feature_gate.feature_key,
			'Authenticated subscription context required.',
		);
	}

	if (decision.reason === 'service_principal_disabled') {
		throw new SubscriptionGateError(
			'SUBSCRIPTION_SERVICE_PRINCIPAL_FORBIDDEN',
			input.feature_gate.feature_key,
			'Service principal access is not allowed for this feature.',
		);
	}

	if (decision.reason === 'subscription_context_missing') {
		throw new SubscriptionGateError(
			'SUBSCRIPTION_FEATURE_FORBIDDEN',
			input.feature_gate.feature_key,
			'Subscription context is unavailable for this feature.',
		);
	}

	if (decision.reason === 'plan_restricted') {
		throw new SubscriptionGateError(
			'SUBSCRIPTION_FEATURE_FORBIDDEN',
			input.feature_gate.feature_key,
			`Feature requires ${input.feature_gate.minimum_tier} tier access.`,
		);
	}

	if (decision.reason === 'subscription_inactive') {
		throw new SubscriptionGateError(
			'SUBSCRIPTION_FEATURE_FORBIDDEN',
			input.feature_gate.feature_key,
			'Feature requires an active subscription.',
		);
	}

	if (decision.reason === 'trial_expired') {
		throw new SubscriptionGateError(
			'SUBSCRIPTION_FEATURE_FORBIDDEN',
			input.feature_gate.feature_key,
			'Feature access ended with the trial period.',
		);
	}

	throw new SubscriptionGateError(
		'SUBSCRIPTION_FEATURE_FORBIDDEN',
		input.feature_gate.feature_key,
		'Feature access is unavailable under the current subscription.',
	);
}
