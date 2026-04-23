import type {
	AuthContext,
	SubscriptionContext,
	SubscriptionTier,
	UsageLimitRejection,
	UsageLimitScope,
	UsageMetricKey,
	UsageQuota,
} from '@runa/types';

type UsageQuotaErrorCode =
	| 'USAGE_QUOTA_AUTH_REQUIRED'
	| 'USAGE_QUOTA_CONTEXT_UNAVAILABLE'
	| 'USAGE_QUOTA_EXHAUSTED'
	| 'USAGE_RATE_LIMIT_EXCEEDED'
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

export interface TierAwareRateLimit {
	readonly limit: number;
	readonly scope: UsageLimitScope;
	readonly tier: SubscriptionTier;
	readonly window: 'minute';
	readonly window_ms: number;
}

export interface RateLimitRecord {
	readonly started_at_ms: number;
	readonly used: number;
}

export interface UsageRateLimitDecision {
	readonly allowed: boolean;
	readonly limit: TierAwareRateLimit;
	readonly metric: UsageMetricKey;
	readonly rejection?: UsageLimitRejection;
	readonly remaining: number;
	readonly retry_after_seconds?: number;
	readonly status:
		| 'allowed'
		| 'anonymous'
		| 'rate_limited'
		| 'service_bypass'
		| 'service_principal_disabled';
}

export interface EvaluateUsageRateLimitInput {
	readonly allow_service_principal?: boolean;
	readonly auth: AuthContext;
	readonly metric: UsageMetricKey;
	readonly now?: () => Date;
	readonly scope: UsageLimitScope;
	readonly subscription?: SubscriptionContext;
}

export interface ConsumeUsageRateLimitInput extends EvaluateUsageRateLimitInput {
	readonly rate_limit_store?: Map<string, RateLimitRecord>;
}

export class UsageQuotaError extends Error {
	readonly code: UsageQuotaErrorCode;
	readonly metric: UsageMetricKey;
	readonly reject_reason?: UsageLimitRejection;
	readonly statusCode: 401 | 403 | 429;

	constructor(
		code: UsageQuotaErrorCode,
		metric: UsageMetricKey,
		message: string,
		rejectReason?: UsageLimitRejection,
	) {
		super(message);
		this.code = code;
		this.metric = metric;
		this.name = 'UsageQuotaError';
		this.reject_reason = rejectReason;
		this.statusCode =
			code === 'USAGE_QUOTA_AUTH_REQUIRED'
				? 401
				: code === 'USAGE_QUOTA_EXHAUSTED' || code === 'USAGE_RATE_LIMIT_EXCEEDED'
					? 429
					: 403;
	}
}

const rateLimitWindowMs = 60_000;

const tierAwareRateLimits: Readonly<
	Record<
		UsageLimitScope,
		Readonly<Record<SubscriptionTier, Omit<TierAwareRateLimit, 'scope' | 'tier'>>>
	>
> = {
	http_request: {
		business: {
			limit: 600,
			window: 'minute',
			window_ms: rateLimitWindowMs,
		},
		free: {
			limit: 60,
			window: 'minute',
			window_ms: rateLimitWindowMs,
		},
		pro: {
			limit: 180,
			window: 'minute',
			window_ms: rateLimitWindowMs,
		},
	},
	ws_run_request: {
		business: {
			limit: 60,
			window: 'minute',
			window_ms: rateLimitWindowMs,
		},
		free: {
			limit: 5,
			window: 'minute',
			window_ms: rateLimitWindowMs,
		},
		pro: {
			limit: 20,
			window: 'minute',
			window_ms: rateLimitWindowMs,
		},
	},
};

const defaultRateLimitStore = new Map<string, RateLimitRecord>();

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

function resolveEffectiveTier(subscription: SubscriptionContext | undefined): SubscriptionTier {
	return subscription?.effective_tier ?? 'free';
}

function createRateLimitKey(input: {
	readonly auth: AuthContext;
	readonly metric: UsageMetricKey;
	readonly scope: UsageLimitScope;
}): string | undefined {
	if (input.auth.principal.kind !== 'authenticated') {
		return undefined;
	}

	return `${input.scope}:${input.metric}:${input.auth.principal.user_id}`;
}

function createTierAwareRateLimit(
	scope: UsageLimitScope,
	tier: SubscriptionTier,
): TierAwareRateLimit {
	return {
		...tierAwareRateLimits[scope][tier],
		scope,
		tier,
	};
}

function normalizeRateLimitRecord(
	record: RateLimitRecord | undefined,
	nowMs: number,
	windowMs: number,
): RateLimitRecord {
	if (!record || nowMs >= record.started_at_ms + windowMs) {
		return {
			started_at_ms: nowMs,
			used: 0,
		};
	}

	return record;
}

function buildRateLimitRejection(input: {
	readonly limit: TierAwareRateLimit;
	readonly metric: UsageMetricKey;
	readonly now_ms: number;
	readonly record: RateLimitRecord;
}): UsageLimitRejection {
	const resetAtMs = input.record.started_at_ms + input.limit.window_ms;

	return {
		kind: 'rate_limited',
		limit: input.limit.limit,
		metric: input.metric,
		remaining: 0,
		resets_at: new Date(resetAtMs).toISOString(),
		retry_after_seconds: Math.max(1, Math.ceil((resetAtMs - input.now_ms) / 1000)),
		scope: input.limit.scope,
		tier: input.limit.tier,
		window: input.limit.window,
	};
}

function buildQuotaExhaustedRejection(
	metric: UsageMetricKey,
	quota: ResolvedUsageQuota,
): UsageLimitRejection {
	return {
		kind: 'quota_exhausted',
		limit: quota.limit,
		metric,
		remaining: quota.remaining,
		resets_at: quota.resets_at,
		scope: 'ws_run_request',
		window: quota.window,
	};
}

export function resetUsageRateLimitStore(): void {
	defaultRateLimitStore.clear();
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

export function evaluateUsageRateLimit(
	input: EvaluateUsageRateLimitInput,
	record: RateLimitRecord | undefined,
): UsageRateLimitDecision {
	if (input.auth.principal.kind === 'anonymous') {
		return {
			allowed: false,
			limit: createTierAwareRateLimit(input.scope, resolveEffectiveTier(input.subscription)),
			metric: input.metric,
			remaining: 0,
			status: 'anonymous',
		};
	}

	if (input.auth.principal.kind === 'service') {
		const serviceLimit = createTierAwareRateLimit(input.scope, 'business');

		if (input.allow_service_principal === false) {
			return {
				allowed: false,
				limit: serviceLimit,
				metric: input.metric,
				remaining: 0,
				status: 'service_principal_disabled',
			};
		}

		return {
			allowed: true,
			limit: serviceLimit,
			metric: input.metric,
			remaining: Number.POSITIVE_INFINITY,
			status: 'service_bypass',
		};
	}

	const tier = resolveEffectiveTier(input.subscription);
	const limit = createTierAwareRateLimit(input.scope, tier);
	const nowMs = (input.now ?? (() => new Date()))().getTime();
	const normalizedRecord = normalizeRateLimitRecord(record, nowMs, limit.window_ms);
	const nextUsed = normalizedRecord.used + 1;
	const remaining = Math.max(0, limit.limit - nextUsed);

	if (nextUsed > limit.limit) {
		return {
			allowed: false,
			limit,
			metric: input.metric,
			rejection: buildRateLimitRejection({
				limit,
				metric: input.metric,
				now_ms: nowMs,
				record: normalizedRecord,
			}),
			remaining: 0,
			retry_after_seconds: Math.max(
				1,
				Math.ceil((normalizedRecord.started_at_ms + limit.window_ms - nowMs) / 1000),
			),
			status: 'rate_limited',
		};
	}

	return {
		allowed: true,
		limit,
		metric: input.metric,
		remaining,
		status: 'allowed',
	};
}

export function consumeUsageRateLimit(input: ConsumeUsageRateLimitInput): UsageRateLimitDecision {
	const rateLimitStore = input.rate_limit_store ?? defaultRateLimitStore;
	const rateLimitKey = createRateLimitKey({
		auth: input.auth,
		metric: input.metric,
		scope: input.scope,
	});
	const existingRecord = rateLimitKey ? rateLimitStore.get(rateLimitKey) : undefined;
	const decision = evaluateUsageRateLimit(input, existingRecord);

	if (
		decision.allowed &&
		input.auth.principal.kind === 'authenticated' &&
		rateLimitKey !== undefined
	) {
		const nowMs = (input.now ?? (() => new Date()))().getTime();
		const normalizedRecord = normalizeRateLimitRecord(
			existingRecord,
			nowMs,
			decision.limit.window_ms,
		);

		rateLimitStore.set(rateLimitKey, {
			started_at_ms: normalizedRecord.started_at_ms,
			used: normalizedRecord.used + 1,
		});
	}

	return decision;
}

export function requireUsageRateLimit(input: ConsumeUsageRateLimitInput): TierAwareRateLimit {
	const decision = consumeUsageRateLimit(input);

	if (decision.allowed) {
		return decision.limit;
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

	throw new UsageQuotaError(
		'USAGE_RATE_LIMIT_EXCEEDED',
		input.metric,
		`Rate limit exhausted for metric "${input.metric}" on scope "${input.scope}".`,
		decision.rejection,
	);
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
		decision.quota ? buildQuotaExhaustedRejection(input.metric, decision.quota) : undefined,
	);
}
