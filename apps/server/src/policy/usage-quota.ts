import type { AuthContext, SubscriptionContext, UsageMetricKey, UsageQuota } from '@runa/types';

type UsageQuotaErrorCode =
	| 'USAGE_QUOTA_AUTH_REQUIRED'
	| 'USAGE_QUOTA_CONTEXT_UNAVAILABLE'
	| 'USAGE_QUOTA_EXHAUSTED'
	| 'USAGE_QUOTA_SERVICE_PRINCIPAL_FORBIDDEN';

export interface ResolvedUsageQuota extends UsageQuota {
	readonly remaining: number;
}

export interface UsageQuotaResolverInput {
	readonly auth: AuthContext;
	readonly metric: UsageMetricKey;
	readonly subscription?: SubscriptionContext;
}

export type UsageQuotaResolver = (
	input: UsageQuotaResolverInput,
) => Promise<UsageQuota | null | undefined> | UsageQuota | null | undefined;

export interface ResolveUsageQuotaInput extends UsageQuotaResolverInput {
	readonly resolve_quota?: UsageQuotaResolver;
}

export interface EvaluateResolvedUsageQuotaInput {
	readonly allow_service_principal?: boolean;
	readonly auth: AuthContext;
	readonly metric: UsageMetricKey;
	readonly quota?: UsageQuota;
	readonly subscription?: SubscriptionContext;
}

export interface EvaluateUsageQuotaInput extends EvaluateResolvedUsageQuotaInput {
	readonly resolve_quota?: UsageQuotaResolver;
}

export type UsageQuotaDecisionStatus =
	| 'allowed'
	| 'anonymous'
	| 'service_bypass'
	| 'service_principal_disabled'
	| 'subscription_context_missing'
	| 'quota_missing'
	| 'exhausted';

export interface UsageQuotaDecision {
	readonly allowed: boolean;
	readonly metric: UsageMetricKey;
	readonly quota?: ResolvedUsageQuota;
	readonly status: UsageQuotaDecisionStatus;
}

export class UsageQuotaError extends Error {
	readonly code: UsageQuotaErrorCode;
	readonly metric: UsageMetricKey;
	readonly statusCode: 401 | 403 | 429;

	constructor(code: UsageQuotaErrorCode, metric: UsageMetricKey, message: string) {
		super(message);
		this.code = code;
		this.metric = metric;
		this.name = 'UsageQuotaError';
		this.statusCode =
			code === 'USAGE_QUOTA_AUTH_REQUIRED' ? 401 : code === 'USAGE_QUOTA_EXHAUSTED' ? 429 : 403;
	}
}

function normalizeUsageQuota(quota: UsageQuota): ResolvedUsageQuota {
	return {
		...quota,
		remaining: Math.max(0, quota.remaining ?? quota.limit - quota.used),
	};
}

function findUsageQuota(
	subscription: SubscriptionContext | undefined,
	metric: UsageMetricKey,
): UsageQuota | undefined {
	return subscription?.quotas.find((quota) => quota.metric === metric);
}

export async function resolveUsageQuota(
	input: ResolveUsageQuotaInput,
): Promise<UsageQuota | undefined> {
	const resolvedQuota = await input.resolve_quota?.({
		auth: input.auth,
		metric: input.metric,
		subscription: input.subscription,
	});

	if (resolvedQuota !== null && resolvedQuota !== undefined) {
		return resolvedQuota;
	}

	return findUsageQuota(input.subscription, input.metric);
}

export function evaluateResolvedUsageQuota(
	input: EvaluateResolvedUsageQuotaInput,
): UsageQuotaDecision {
	if (input.auth.principal.kind === 'anonymous') {
		return {
			allowed: false,
			metric: input.metric,
			status: 'anonymous',
		};
	}

	if (input.auth.principal.kind === 'service') {
		if (input.allow_service_principal === false) {
			return {
				allowed: false,
				metric: input.metric,
				status: 'service_principal_disabled',
			};
		}

		return {
			allowed: true,
			metric: input.metric,
			status: 'service_bypass',
		};
	}

	if (input.quota === undefined && input.subscription === undefined) {
		return {
			allowed: false,
			metric: input.metric,
			status: 'subscription_context_missing',
		};
	}

	if (input.quota === undefined) {
		return {
			allowed: false,
			metric: input.metric,
			status: 'quota_missing',
		};
	}

	const normalizedQuota = normalizeUsageQuota(input.quota);

	if (normalizedQuota.used >= normalizedQuota.limit || normalizedQuota.remaining <= 0) {
		return {
			allowed: false,
			metric: input.metric,
			quota: normalizedQuota,
			status: 'exhausted',
		};
	}

	return {
		allowed: true,
		metric: input.metric,
		quota: normalizedQuota,
		status: 'allowed',
	};
}

export async function evaluateUsageQuota(
	input: EvaluateUsageQuotaInput,
): Promise<UsageQuotaDecision> {
	const resolvedQuota =
		input.quota ??
		(await resolveUsageQuota({
			auth: input.auth,
			metric: input.metric,
			resolve_quota: input.resolve_quota,
			subscription: input.subscription,
		}));

	return evaluateResolvedUsageQuota({
		allow_service_principal: input.allow_service_principal,
		auth: input.auth,
		metric: input.metric,
		quota: resolvedQuota,
		subscription: input.subscription,
	});
}

export async function requireUsageQuota(
	input: EvaluateUsageQuotaInput,
): Promise<ResolvedUsageQuota | undefined> {
	const decision = await evaluateUsageQuota(input);

	if (decision.allowed) {
		return decision.quota;
	}

	if (decision.status === 'anonymous') {
		throw new UsageQuotaError(
			'USAGE_QUOTA_AUTH_REQUIRED',
			input.metric,
			'Authenticated usage quota context required.',
		);
	}

	if (decision.status === 'service_principal_disabled') {
		throw new UsageQuotaError(
			'USAGE_QUOTA_SERVICE_PRINCIPAL_FORBIDDEN',
			input.metric,
			'Service principal access is not allowed for this usage quota.',
		);
	}

	if (decision.status === 'subscription_context_missing') {
		throw new UsageQuotaError(
			'USAGE_QUOTA_CONTEXT_UNAVAILABLE',
			input.metric,
			'Subscription context is unavailable for usage quota evaluation.',
		);
	}

	if (decision.status === 'quota_missing') {
		throw new UsageQuotaError(
			'USAGE_QUOTA_CONTEXT_UNAVAILABLE',
			input.metric,
			`Usage quota is unavailable for metric "${input.metric}".`,
		);
	}

	throw new UsageQuotaError(
		'USAGE_QUOTA_EXHAUSTED',
		input.metric,
		`Usage quota exhausted for metric "${input.metric}".`,
	);
}
