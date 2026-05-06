import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import type { FeatureGate } from '@runa/types';

import {
	type AuthTokenVerifier,
	SupabaseAuthError,
	type SupabaseTokenVerifierEnvironment,
	createLocalDevTokenVerifierFromEnvironment,
	createSupabaseAuthMiddleware,
	createSupabaseTokenVerifierFromEnvironment,
} from './auth/supabase-auth.js';
import {
	type SubscriptionContextResolver,
	createSubscriptionContextMiddleware,
} from './policy/subscription-context.js';
import { type RegisterAuthRoutesOptions, registerAuthRoutes } from './routes/auth.js';
import {
	type RegisterConversationRoutesOptions,
	registerConversationRoutes,
} from './routes/conversations.js';
import { registerDesktopDeviceRoutes } from './routes/desktop-devices.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerUploadRoutes } from './routes/upload.js';
import { registerWorkspaceRoutes } from './routes/workspace.js';
import { createStorageDownloadUrlSigner } from './storage/signed-download-url.js';
import { registerStorageRoutes } from './storage/storage-routes.js';
import {
	type StorageProviderAdapter,
	StorageServiceError,
	createStorageService,
} from './storage/storage-service.js';
import {
	type SupabaseStorageEnvironment,
	type SupabaseStorageFetch,
	createSupabaseStorageAdapterFromEnvironment,
} from './storage/supabase-storage-adapter.js';
import { createLogger } from './utils/logger.js';
import { type RegisterWebSocketRoutesOptions, registerWebSocketRoutes } from './ws/register-ws.js';

export interface BuildServerOptions extends FastifyServerOptions {
	readonly auth?: {
		readonly supabase?: RegisterAuthRoutesOptions['supabase'];
		readonly verify_token?: AuthTokenVerifier;
	};
	readonly subscription?: {
		readonly resolve_context?: SubscriptionContextResolver;
		readonly websocket?: {
			readonly allow_service_principal?: boolean;
			readonly feature_gate?: FeatureGate;
		};
	};
	readonly conversations?: RegisterConversationRoutesOptions;
	readonly storage?: {
		readonly adapter?: StorageProviderAdapter;
		readonly supabase?: {
			readonly bucket?: string;
			readonly environment?: SupabaseStorageEnvironment;
			readonly fetch?: SupabaseStorageFetch;
			readonly path_prefix?: string;
		};
	};
	readonly websocket?: Pick<
		RegisterWebSocketRoutesOptions,
		'desktopAgentBridgeRegistry' | 'runtime'
	>;
}

const defaultAuthTokenVerifier: AuthTokenVerifier = async () => {
	throw new SupabaseAuthError(
		'SUPABASE_AUTH_INVALID_TOKEN',
		'Bearer token verification is not configured.',
	);
};

const defaultStorageAdapter: StorageProviderAdapter = {
	async get_object() {
		throw new StorageServiceError('STORAGE_NOT_CONFIGURED', 'Storage adapter is not configured.');
	},
	async upload_object() {
		throw new StorageServiceError('STORAGE_NOT_CONFIGURED', 'Storage adapter is not configured.');
	},
};

const serverLogger = createLogger({
	context: {
		component: 'server.app',
	},
});

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
	const {
		auth,
		conversations,
		storage,
		subscription,
		websocket: websocketOptions,
		...fastifyOptions
	} = options;
	const server = Fastify(fastifyOptions);
	const authEnvironment =
		auth?.supabase?.environment ??
		(process.env as NodeJS.ProcessEnv & SupabaseTokenVerifierEnvironment);
	const authFetch = auth?.supabase?.fetch ?? globalThis.fetch;
	const localDevVerifyToken = createLocalDevTokenVerifierFromEnvironment({
		environment: authEnvironment,
		fetch: authFetch,
	});
	const supabaseVerifyToken = createSupabaseTokenVerifierFromEnvironment({
		environment: authEnvironment,
		fetch: authFetch,
	});
	const combinedVerifyToken: AuthTokenVerifier | null =
		localDevVerifyToken && supabaseVerifyToken
			? async (input) => (await localDevVerifyToken(input)) ?? supabaseVerifyToken(input)
			: (supabaseVerifyToken ?? null);
	const resolvedVerifyToken: AuthTokenVerifier =
		auth?.verify_token ??
		(localDevVerifyToken && !supabaseVerifyToken
			? async (input) => {
					const result = await localDevVerifyToken(input);

					if (!result) {
						throw new SupabaseAuthError(
							'SUPABASE_AUTH_INVALID_TOKEN',
							'Invalid or expired bearer token.',
						);
					}

					return result;
				}
			: combinedVerifyToken) ??
		defaultAuthTokenVerifier;
	const storageAdapter =
		storage?.adapter ??
		createSupabaseStorageAdapterFromEnvironment({
			bucket: storage?.supabase?.bucket,
			environment:
				storage?.supabase?.environment ??
				(process.env as NodeJS.ProcessEnv & SupabaseStorageEnvironment),
			fetch: storage?.supabase?.fetch,
			path_prefix: storage?.supabase?.path_prefix,
		}) ??
		defaultStorageAdapter;
	const storageService = createStorageService({
		adapter: storageAdapter,
	});
	const storageDownloadUrlSigner = createStorageDownloadUrlSigner();

	server.addHook(
		'onRequest',
		createSupabaseAuthMiddleware({
			verify_token: resolvedVerifyToken,
		}),
	);
	server.addHook(
		'onRequest',
		createSubscriptionContextMiddleware({
			resolve_context: subscription?.resolve_context,
		}),
	);
	serverLogger.info('server.websocket_plugin.registering');
	await server.register(websocket);
	serverLogger.info('server.auth_routes.registering');
	await registerAuthRoutes(server, {
		supabase: {
			environment: authEnvironment as NonNullable<
				NonNullable<RegisterAuthRoutesOptions['supabase']>['environment']
			>,
			fetch: authFetch,
		},
		verify_token: resolvedVerifyToken,
	});
	await registerHealthRoutes(server);
	await registerDesktopDeviceRoutes(server, {
		desktopAgentBridgeRegistry: websocketOptions?.desktopAgentBridgeRegistry,
	});
	await registerConversationRoutes(server, conversations);
	await registerUploadRoutes(server, storageService);
	serverLogger.info('server.storage_routes.registering');
	await registerStorageRoutes(server, storageService, {
		download_url_signer: storageDownloadUrlSigner,
	});
	serverLogger.info('server.websocket_routes.registering');
	await registerWebSocketRoutes(server, {
		allow_service_principal: subscription?.websocket?.allow_service_principal,
		desktopAgentBridgeRegistry: websocketOptions?.desktopAgentBridgeRegistry,
		feature_gate: subscription?.websocket?.feature_gate,
		resolve_subscription_context: subscription?.resolve_context,
		runtime: websocketOptions?.runtime,
		storage_service: storageService,
		create_storage_download_url: storageDownloadUrlSigner.create,
		verify_token: resolvedVerifyToken,
	});
	serverLogger.info('server.build.completed');

	return server;
}
