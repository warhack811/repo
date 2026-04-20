import type { AuthContext, SubscriptionContext, SubscriptionScope } from '@runa/types';
import type { FastifyReply, FastifyRequest } from 'fastify';

export interface SubscriptionContextResolverInput {
	readonly auth: AuthContext;
}

export type SubscriptionContextResolver = (
	input: SubscriptionContextResolverInput,
) => Promise<SubscriptionContext | null> | SubscriptionContext | null;

export interface ResolveSubscriptionContextInput {
	readonly auth: AuthContext;
	readonly fallback_to_default?: boolean;
	readonly now?: () => Date;
	readonly resolve_context?: SubscriptionContextResolver;
}

export interface CreateSubscriptionContextMiddlewareInput {
	readonly now?: () => Date;
	readonly resolve_context?: SubscriptionContextResolver;
}

declare module 'fastify' {
	interface FastifyRequest {
		subscription?: SubscriptionContext;
	}
}

function createEvaluatedAt(now: (() => Date) | undefined): string {
	return (now ?? (() => new Date()))().toISOString();
}

export function resolveSubscriptionScope(auth: AuthContext): SubscriptionScope | undefined {
	if (auth.principal.kind === 'anonymous') {
		return undefined;
	}

	if (auth.principal.kind === 'authenticated') {
		if (auth.principal.scope.workspace_id !== undefined) {
			return {
				kind: 'workspace',
				subject_id: auth.principal.scope.workspace_id,
				tenant_id: auth.principal.scope.tenant_id,
				user_id: auth.principal.user_id,
				workspace_id: auth.principal.scope.workspace_id,
			};
		}

		return {
			kind: 'user',
			subject_id: auth.principal.user_id,
			tenant_id: auth.principal.scope.tenant_id,
			user_id: auth.principal.user_id,
			workspace_id: auth.principal.scope.workspace_id,
		};
	}

	if (auth.principal.scope.workspace_id !== undefined) {
		return {
			kind: 'workspace',
			subject_id: auth.principal.scope.workspace_id,
			tenant_id: auth.principal.scope.tenant_id,
			workspace_id: auth.principal.scope.workspace_id,
		};
	}

	if (auth.principal.scope.tenant_id !== undefined) {
		return {
			kind: 'tenant',
			subject_id: auth.principal.scope.tenant_id,
			tenant_id: auth.principal.scope.tenant_id,
			workspace_id: auth.principal.scope.workspace_id,
		};
	}

	return {
		kind: 'tenant',
		subject_id: auth.principal.service_name,
		tenant_id: auth.principal.scope.tenant_id,
		workspace_id: auth.principal.scope.workspace_id,
	};
}

export function createDefaultSubscriptionContext(
	auth: AuthContext,
	now?: () => Date,
): SubscriptionContext | undefined {
	const scope = resolveSubscriptionScope(auth);

	if (scope === undefined) {
		return undefined;
	}

	return {
		entitlements: [],
		effective_tier: 'free',
		evaluated_at: createEvaluatedAt(now),
		quotas: [],
		scope,
		status: 'active',
	};
}

export async function resolveSubscriptionContext(
	input: ResolveSubscriptionContextInput,
): Promise<SubscriptionContext | undefined> {
	if (input.auth.principal.kind === 'anonymous') {
		return undefined;
	}

	const resolvedContext = await input.resolve_context?.({
		auth: input.auth,
	});

	if (resolvedContext !== null && resolvedContext !== undefined) {
		return resolvedContext;
	}

	if (input.fallback_to_default === false) {
		return undefined;
	}

	return createDefaultSubscriptionContext(input.auth, input.now);
}

export function createSubscriptionContextMiddleware(
	input: CreateSubscriptionContextMiddlewareInput,
) {
	return async function subscriptionContextMiddleware(
		request: FastifyRequest,
		_reply: FastifyReply,
	): Promise<void> {
		request.subscription = await resolveSubscriptionContext({
			auth: request.auth,
			now: input.now,
			resolve_context: input.resolve_context,
		});
	};
}
