import type { FastifyInstance } from 'fastify';

import { type AuthTokenVerifier, SupabaseAuthError } from '../auth/supabase-auth.js';
import type { SubscriptionContextResolver } from '../policy/subscription-context.js';
import type { StorageDownloadUrlSigner } from '../storage/signed-download-url.js';
import type { StorageService } from '../storage/storage-service.js';
import { registerConversationCollaborationSocket } from './conversation-collaboration.js';
import {
	type DesktopAgentBridgeRegistry,
	defaultDesktopAgentBridgeRegistry,
} from './desktop-agent-bridge.js';
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

export interface AttachDesktopAgentWebSocketHandlerOptions {
	readonly auth_context: NonNullable<RuntimeWebSocketHandlerOptions['auth_context']>;
	readonly desktopAgentBridgeRegistry?: DesktopAgentBridgeRegistry;
}

export function attachDesktopAgentWebSocketHandler(
	socket: WebSocketConnection,
	options: AttachDesktopAgentWebSocketHandlerOptions,
): void {
	(options.desktopAgentBridgeRegistry ?? defaultDesktopAgentBridgeRegistry).attach(
		socket,
		options.auth_context,
	);
}

export interface RegisterWebSocketRoutesOptions {
	readonly allow_service_principal?: boolean;
	readonly create_storage_download_url?: StorageDownloadUrlSigner['create'];
	readonly feature_gate?: VerifyWebSocketSubscriptionAccessInput['feature_gate'];
	readonly resolve_subscription_context?: SubscriptionContextResolver;
	readonly storage_service?: StorageService;
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
				create_storage_download_url: options.create_storage_download_url,
				storage_service: options.storage_service,
				subscription_context: subscriptionAccess.subscription,
			});
		} catch (error: unknown) {
			rejectWebSocketConnection(socket, error);
		}
	});

	server.get('/ws/desktop-agent', { websocket: true }, async (socket, request) => {
		try {
			const authContext = await verifyWebSocketHandshake({
				request,
				verify_token: options.verify_token,
			});

			if (authContext.principal.kind !== 'authenticated') {
				throw new SupabaseAuthError(
					'SUPABASE_AUTH_REQUIRED',
					'Desktop agent bridge requires an authenticated user session.',
				);
			}

			attachDesktopAgentWebSocketHandler(socket, {
				auth_context: authContext,
			});
		} catch (error: unknown) {
			rejectWebSocketConnection(socket, error);
		}
	});
}
