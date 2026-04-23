import type { FastifyInstance } from 'fastify';

import type { AuthTokenVerifier } from '../auth/supabase-auth.js';
import type { SubscriptionContextResolver } from '../policy/subscription-context.js';
import { registerConversationCollaborationSocket } from './conversation-collaboration.js';
import { type RuntimeWebSocketHandlerOptions, handleWebSocketMessage } from './orchestration.js';
import {
	type WebSocketConnection,
	attachWebSocketTransport,
	getWebSocketAuthContext,
	getWebSocketSubscriptionContext,
} from './transport.js';
import { rejectWebSocketConnection, verifyWebSocketHandshake } from './ws-auth.js';
import {
	type VerifyWebSocketSubscriptionAccessInput,
	verifyWebSocketSubscriptionAccess,
} from './ws-subscription-gate.js';

export { getWebSocketAuthContext, getWebSocketSubscriptionContext };
export { handleWebSocketMessage } from './orchestration.js';

export function attachRuntimeWebSocketHandler(
	socket: WebSocketConnection,
	options: RuntimeWebSocketHandlerOptions = {},
): void {
	registerConversationCollaborationSocket(socket, options.auth_context);
	attachWebSocketTransport(socket, {
		auth_context: options.auth_context,
		on_message: (message) => {
			void handleWebSocketMessage(socket, message, options);
		},
		subscription_context: options.subscription_context,
	});
}

export interface RegisterWebSocketRoutesOptions {
	readonly allow_service_principal?: boolean;
	readonly feature_gate?: VerifyWebSocketSubscriptionAccessInput['feature_gate'];
	readonly resolve_subscription_context?: SubscriptionContextResolver;
	readonly verify_token: AuthTokenVerifier;
}

export async function registerWebSocketRoutes(
	server: FastifyInstance,
	options: RegisterWebSocketRoutesOptions,
): Promise<void> {
	server.get('/ws', { websocket: true }, async (socket, request) => {
		try {
			const authContext = await verifyWebSocketHandshake({
				request,
				verify_token: options.verify_token,
			});
			const subscriptionAccess = await verifyWebSocketSubscriptionAccess({
				allow_service_principal: options.allow_service_principal,
				auth: authContext,
				feature_gate: options.feature_gate,
				resolve_context: options.resolve_subscription_context,
			});

			attachRuntimeWebSocketHandler(socket, {
				auth_context: subscriptionAccess.auth,
				subscription_context: subscriptionAccess.subscription,
			});
		} catch (error: unknown) {
			rejectWebSocketConnection(socket, error);
		}
	});
}
