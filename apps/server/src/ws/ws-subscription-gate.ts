import type { AuthContext, FeatureGate, SubscriptionContext } from '@runa/types';

import {
	type SubscriptionContextResolver,
	createDefaultSubscriptionContext,
	resolveSubscriptionContext,
} from '../policy/subscription-context.js';
import {
	type SubscriptionGateError,
	createSubscriptionGate,
	requireFeatureAccess,
} from '../policy/subscription-gating.js';

export interface VerifyWebSocketSubscriptionAccessInput {
	readonly allow_service_principal?: boolean;
	readonly auth: AuthContext;
	readonly feature_gate?: FeatureGate;
	readonly now?: () => Date;
	readonly resolve_context?: SubscriptionContextResolver;
}

export interface WebSocketSubscriptionAccessResult {
	readonly auth: AuthContext;
	readonly subscription: SubscriptionContext;
}

export const defaultWebSocketConnectionGate = createSubscriptionGate({
	feature_key: 'cloud_history',
	minimum_tier: 'free',
	requires_active_subscription: true,
});

export async function verifyWebSocketSubscriptionAccess(
	input: VerifyWebSocketSubscriptionAccessInput,
): Promise<WebSocketSubscriptionAccessResult> {
	const subscription = await resolveSubscriptionContext({
		auth: input.auth,
		fallback_to_default: true,
		now: input.now,
		resolve_context: input.resolve_context,
	});

	requireFeatureAccess({
		allow_service_principal: input.allow_service_principal,
		auth: input.auth,
		feature_gate: input.feature_gate ?? defaultWebSocketConnectionGate,
		subscription,
	});

	return {
		auth: input.auth,
		subscription:
			subscription ??
			(() => {
				const defaultSubscription = createDefaultSubscriptionContext(input.auth, input.now);

				if (defaultSubscription === undefined) {
					throw new Error('WebSocket subscription context must exist after access verification.');
				}

				return defaultSubscription;
			})(),
	};
}

export function isSubscriptionGateError(error: unknown): error is SubscriptionGateError {
	return (
		error instanceof Error &&
		'code' in error &&
		'statusCode' in error &&
		typeof error.code === 'string' &&
		typeof error.statusCode === 'number'
	);
}
