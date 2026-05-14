import type { FastifyInstance } from 'fastify';
import type { AuthContext } from '@runa/types';

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
import {
	resolveExpectedWorkspaceAttestationId,
	validateWorkspaceAttestation,
} from './workspace-attestation.js';
import { validateWebSocketOrigin, validateWebSocketTransportSecurity } from './ws-security.js';
import { registerWebSocketSession } from './ws-session-registry.js';
import type { WebSocketTicketPath } from './ws-ticket.js';
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
	readonly allow_ws_query_access_token?: boolean;
	readonly allowed_ws_origins?: readonly string[];
	readonly create_storage_download_url?: StorageDownloadUrlSigner['create'];
	readonly desktopAgentBridgeRegistry?: DesktopAgentBridgeRegistry;
	readonly enforce_secure_ws_transport_in_production?: boolean;
	readonly feature_gate?: VerifyWebSocketSubscriptionAccessInput['feature_gate'];
	readonly resolve_subscription_context?: SubscriptionContextResolver;
	readonly resolve_ws_ticket_auth_context?: (input: {
		readonly path: WebSocketTicketPath;
		readonly request_id?: string;
		readonly ticket: string;
	}) => AuthContext;
	readonly runtime?: Omit<
		RuntimeWebSocketHandlerOptions,
		'auth_context' | 'create_storage_download_url' | 'storage_service' | 'subscription_context'
	>;
	readonly storage_service?: StorageService;
	readonly verify_token: AuthTokenVerifier;
}

function parseSessionExpiryUnixMs(authContext: NonNullable<RuntimeWebSocketHandlerOptions['auth_context']>): number | null {
	const expiresAt = authContext.session?.expires_at;

	if (!expiresAt) {
		return null;
	}

	const parsed = Date.parse(expiresAt);
	return Number.isFinite(parsed) ? parsed : null;
}

function scheduleSocketSessionExpiryClose(
	socket: WebSocketConnection,
	authContext: NonNullable<RuntimeWebSocketHandlerOptions['auth_context']>,
): void {
	const expiresAtUnixMs = parseSessionExpiryUnixMs(authContext);

	if (expiresAtUnixMs === null) {
		return;
	}

	const delayMs = Math.max(0, expiresAtUnixMs - Date.now());
	const timeout = setTimeout(() => {
		socket.close(1008, 'WebSocket session expired. Reconnect with a fresh session.');
	}, delayMs);

	socket.on('close', () => {
		clearTimeout(timeout);
	});
}

export async function registerWebSocketRoutes(
	server: FastifyInstance,
	options: RegisterWebSocketRoutesOptions,
): Promise<void> {
	const expectedWorkspaceAttestationId = resolveExpectedWorkspaceAttestationId();
	const wsSecurityConfig = {
		allow_query_access_token: options.allow_ws_query_access_token === true,
		allowed_origins: options.allowed_ws_origins,
		enforce_secure_transport_in_production:
			options.enforce_secure_ws_transport_in_production !== false,
	};

	server.get('/ws', { websocket: true }, async (socket, request) => {
		try {
			validateWebSocketTransportSecurity(request, wsSecurityConfig);
			validateWebSocketOrigin(request, wsSecurityConfig);
			const workspaceAttestationFailure = validateWorkspaceAttestation(
				request,
				expectedWorkspaceAttestationId,
			);

			if (workspaceAttestationFailure) {
				throw new SupabaseAuthError(
					'SUPABASE_AUTH_INVALID_TOKEN',
					workspaceAttestationFailure.message,
				);
			}

			const authContext = await verifyWebSocketHandshake({
				allow_query_access_token: options.allow_ws_query_access_token,
				path: '/ws',
				request,
				resolve_ws_ticket_auth_context: options.resolve_ws_ticket_auth_context,
				verify_token: options.verify_token,
			});
			const subscriptionAccess = await verifyWebSocketSubscriptionAccess({
				allow_service_principal: options.allow_service_principal,
				auth: authContext,
				feature_gate: options.feature_gate,
				resolve_context: options.resolve_subscription_context,
			});

			attachRuntimeWebSocketHandler(socket, {
				...options.runtime,
				auth_context: subscriptionAccess.auth,
				create_storage_download_url: options.create_storage_download_url,
				storage_service: options.storage_service,
				subscription_context: subscriptionAccess.subscription,
			});
			registerWebSocketSession(socket, subscriptionAccess.auth);
			scheduleSocketSessionExpiryClose(socket, subscriptionAccess.auth);
		} catch (error: unknown) {
			rejectWebSocketConnection(socket, error);
		}
	});

	server.get('/ws/desktop-agent', { websocket: true }, async (socket, request) => {
		try {
			validateWebSocketTransportSecurity(request, wsSecurityConfig);
			validateWebSocketOrigin(request, wsSecurityConfig);
			const authContext = await verifyWebSocketHandshake({
				allow_query_access_token: options.allow_ws_query_access_token,
				path: '/ws/desktop-agent',
				request,
				resolve_ws_ticket_auth_context: options.resolve_ws_ticket_auth_context,
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
				desktopAgentBridgeRegistry: options.desktopAgentBridgeRegistry,
			});
			registerWebSocketSession(socket, authContext);
			scheduleSocketSessionExpiryClose(socket, authContext);
		} catch (error: unknown) {
			rejectWebSocketConnection(socket, error);
		}
	});
}
