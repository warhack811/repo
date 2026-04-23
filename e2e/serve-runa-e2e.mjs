import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFile);
const workspaceRoot = resolve(currentDirectory, '..');
const serverDistRoot = resolve(workspaceRoot, 'apps', 'server', 'dist');
const serverNodeModulesRoot = resolve(workspaceRoot, 'apps', 'server', 'node_modules');
const proofDirectory = join(os.tmpdir(), 'runa-e2e-proof');
const proofFilePath = join(proofDirectory, 'approval-proof.txt');
const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

mkdirSync(proofDirectory, { recursive: true });
rmSync(proofFilePath, { force: true });

process.env.NODE_ENV ??= 'development';
process.env.RUNA_DEV_AUTH_ENABLED ??= '1';
process.env.RUNA_DEV_AUTH_SECRET ??= 'runa-e2e-dev-secret';
process.env.RUNA_DEV_AUTH_EMAIL ??= 'dev@runa.local';

const originalFetch = globalThis.fetch?.bind(globalThis);

if (!originalFetch) {
	throw new Error('Global fetch is required for the E2E harness.');
}

function createJsonResponse(payload) {
	return new Response(JSON.stringify(payload), {
		headers: {
			'content-type': 'application/json',
		},
		status: 200,
	});
}

function readRequestBody(init) {
	if (!init || typeof init.body !== 'string') {
		throw new Error('Expected a JSON request body for the mocked provider.');
	}

	return JSON.parse(init.body);
}

function findLastUserMessage(messages) {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];

		if (message?.role === 'user' && typeof message.content === 'string') {
			return message.content;
		}
	}

	return '';
}

function isContinuationRequest(lastUserMessage) {
	return lastUserMessage.startsWith(
		'Continue the same user request using the latest ingested tool result from the runtime context.',
	);
}

function createMockOpenAiResponse(requestBody) {
	const lastUserMessage = findLastUserMessage(requestBody.messages ?? []);
	const model = requestBody.model ?? 'gpt-4o-mini';

	if (isContinuationRequest(lastUserMessage)) {
		return createJsonResponse({
			choices: [
				{
					finish_reason: 'stop',
					message: {
						content: `Approval flow completed. Proof saved to ${proofFilePath}.`,
						role: 'assistant',
					},
				},
			],
			id: 'chatcmpl_e2e_completed',
			model,
			usage: {
				completion_tokens: 24,
				prompt_tokens: 42,
				total_tokens: 66,
			},
		});
	}

	if (lastUserMessage.toLowerCase().includes('approval')) {
		return createJsonResponse({
			choices: [
				{
					finish_reason: 'tool_calls',
					message: {
						content: null,
						role: 'assistant',
						tool_calls: [
							{
								function: {
									arguments: JSON.stringify({
										content: 'approval e2e proof\n',
										overwrite: true,
										path: proofFilePath,
									}),
									name: 'file.write',
								},
								id: 'call_e2e_file_write',
								type: 'function',
							},
						],
					},
				},
			],
			id: 'chatcmpl_e2e_approval',
			model,
			usage: {
				completion_tokens: 16,
				prompt_tokens: 48,
				total_tokens: 64,
			},
		});
	}

	return createJsonResponse({
		choices: [
			{
				finish_reason: 'stop',
				message: {
					content: 'E2E mock assistant response.',
					role: 'assistant',
				},
			},
		],
		id: 'chatcmpl_e2e_chat',
		model,
		usage: {
			completion_tokens: 8,
			prompt_tokens: 21,
			total_tokens: 29,
		},
	});
}

globalThis.fetch = async (input, init) => {
	const url =
		typeof input === 'string' || input instanceof URL
			? String(input)
			: input instanceof Request
				? input.url
				: String(input);

	if (url === OPENAI_CHAT_COMPLETIONS_URL) {
		return createMockOpenAiResponse(readRequestBody(init));
	}

	return originalFetch(input, init);
};

const [
	fastifyModule,
	websocketModule,
	authModule,
	authRoutesModule,
	conversationStoreModule,
	healthRoutesModule,
	permissionEngineModule,
	policyWiringModule,
	registryModule,
	registerWsModule,
	wsAuthModule,
	wsSubscriptionGateModule,
] = await Promise.all([
	import(pathToFileURL(resolve(serverNodeModulesRoot, 'fastify', 'fastify.js')).href),
	import(pathToFileURL(resolve(serverNodeModulesRoot, '@fastify', 'websocket', 'index.js')).href),
	import(pathToFileURL(resolve(serverDistRoot, 'auth', 'supabase-auth.js')).href),
	import(pathToFileURL(resolve(serverDistRoot, 'routes', 'auth.js')).href),
	import(pathToFileURL(resolve(serverDistRoot, 'persistence', 'conversation-store.js')).href),
	import(pathToFileURL(resolve(serverDistRoot, 'routes', 'health.js')).href),
	import(pathToFileURL(resolve(serverDistRoot, 'policy', 'permission-engine.js')).href),
	import(pathToFileURL(resolve(serverDistRoot, 'ws', 'policy-wiring.js')).href),
	import(pathToFileURL(resolve(serverDistRoot, 'tools', 'registry.js')).href),
	import(pathToFileURL(resolve(serverDistRoot, 'ws', 'register-ws.js')).href),
	import(pathToFileURL(resolve(serverDistRoot, 'ws', 'ws-auth.js')).href),
	import(pathToFileURL(resolve(serverDistRoot, 'ws', 'ws-subscription-gate.js')).href),
]);

const Fastify = fastifyModule.default;
const websocket = websocketModule.default;
const {
	createLocalDevTokenVerifierFromEnvironment,
	createSupabaseAuthMiddleware,
	requireAuthenticatedRequest,
} = authModule;
const { registerAuthRoutes } = authRoutesModule;
const { conversationScopeFromAuthContext } = conversationStoreModule;
const { registerHealthRoutes } = healthRoutesModule;
const { createPermissionEngine } = permissionEngineModule;
const { createWebSocketPolicyWiring } = policyWiringModule;
const { createBuiltInToolRegistry } = registryModule;
const { attachRuntimeWebSocketHandler } = registerWsModule;
const { rejectWebSocketConnection, verifyWebSocketHandshake } = wsAuthModule;
const { verifyWebSocketSubscriptionAccess } = wsSubscriptionGateModule;

function summarizePrompt(value, maxLength) {
	const normalized = value.replace(/\s+/gu, ' ').trim();
	return normalized.length <= maxLength
		? normalized
		: `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function createInMemoryConversationStore() {
	const conversations = new Map();
	const messagesByConversationId = new Map();

	function matchesScope(recordScope, scope) {
		if (scope.user_id !== undefined && recordScope.user_id !== scope.user_id) {
			return false;
		}

		if (scope.session_id !== undefined && recordScope.session_id !== scope.session_id) {
			return false;
		}

		return true;
	}

	return {
		async appendConversationMessage(input) {
			const conversation = conversations.get(input.conversation_id);

			if (!conversation || !matchesScope(conversation.scope, input.scope)) {
				throw new Error('Conversation not found for the current user.');
			}

			const existingMessages = messagesByConversationId.get(input.conversation_id) ?? [];
			const createdAt = input.created_at ?? new Date().toISOString();
			const nextMessage = {
				content: input.content,
				conversation_id: input.conversation_id,
				created_at: createdAt,
				message_id: randomUUID(),
				role: input.role,
				run_id: input.run_id,
				sequence_no: existingMessages.length + 1,
				trace_id: input.trace_id,
			};

			messagesByConversationId.set(input.conversation_id, [...existingMessages, nextMessage]);
			conversations.set(input.conversation_id, {
				...conversation,
				last_message_at: createdAt,
				last_message_preview: summarizePrompt(input.content, 160),
				title:
					existingMessages.length === 0 && input.role === 'user'
						? summarizePrompt(input.content, 64)
						: conversation.title,
				updated_at: createdAt,
			});

			return nextMessage;
		},
		async ensureConversation(input) {
			const conversationId = input.conversation_id?.trim() || randomUUID();
			const existingConversation = conversations.get(conversationId);

			if (existingConversation) {
				if (!matchesScope(existingConversation.scope, input.scope)) {
					throw new Error('Conversation not found for the current user.');
				}

				return existingConversation;
			}

			const now = input.created_at ?? new Date().toISOString();
			const initialPreview = summarizePrompt(input.initial_preview ?? 'Yeni sohbet', 160);
			const nextConversation = {
				conversation_id: conversationId,
				created_at: now,
				last_message_at: now,
				last_message_preview: initialPreview,
				scope: input.scope,
				title: summarizePrompt(input.initial_preview ?? 'Yeni sohbet', 64),
				updated_at: now,
			};

			conversations.set(conversationId, nextConversation);
			messagesByConversationId.set(conversationId, []);
			return nextConversation;
		},
		async listConversationMessages(conversationId, scope) {
			const conversation = conversations.get(conversationId);

			if (!conversation || !matchesScope(conversation.scope, scope)) {
				throw new Error('Conversation not found for the current user.');
			}

			return messagesByConversationId.get(conversationId) ?? [];
		},
		async listConversations(scope) {
			return [...conversations.values()]
				.filter((conversation) => matchesScope(conversation.scope, scope))
				.map((conversation) => ({
					conversation_id: conversation.conversation_id,
					created_at: conversation.created_at,
					last_message_at: conversation.last_message_at,
					last_message_preview: conversation.last_message_preview,
					title: conversation.title,
					updated_at: conversation.updated_at,
				}))
				.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
		},
	};
}

function createInMemoryApprovalStore() {
	const approvals = new Map();

	return {
		async getPendingApprovalById(approvalId) {
			return approvals.get(approvalId) ?? null;
		},
		async persistApprovalRequest(input) {
			approvals.set(input.approval_request.approval_id, {
				approval_request: input.approval_request,
				auto_continue_context: input.auto_continue_context,
				next_sequence_no: input.next_sequence_no ?? 1,
				pending_tool_call: input.pending_tool_call,
			});
		},
		async persistApprovalResolution(input) {
			approvals.delete(input.approval_request.approval_id);
		},
	};
}

const verifyToken = createLocalDevTokenVerifierFromEnvironment({
	environment: process.env,
	fetch: globalThis.fetch,
});

if (!verifyToken) {
	throw new Error('Local dev auth verifier could not be created for the E2E harness.');
}

const conversationStore = createInMemoryConversationStore();
const approvalStore = createInMemoryApprovalStore();
const toolRegistry = createBuiltInToolRegistry();
const policyWiring = createWebSocketPolicyWiring({
	permission_engine: createPermissionEngine(),
	policy_state_store: null,
});

const server = Fastify();

server.addHook(
	'onRequest',
	createSupabaseAuthMiddleware({
		verify_token: async (input) => {
			const result = await verifyToken(input);

			if (!result) {
				throw new Error('Invalid local dev auth token.');
			}

			return result;
		},
	}),
);

await server.register(websocket);
await registerAuthRoutes(server, {
	supabase: {
		environment: process.env,
		fetch: globalThis.fetch,
	},
	verify_token: async (input) => {
		const result = await verifyToken(input);

		if (!result) {
			throw new Error('Invalid local dev auth token.');
		}

		return result;
	},
});
await registerHealthRoutes(server);

server.get('/conversations', async (request) => {
	requireAuthenticatedRequest(request);

	return {
		conversations: await conversationStore.listConversations(
			conversationScopeFromAuthContext(request.auth),
		),
	};
});

server.get('/conversations/:conversationId/messages', async (request, reply) => {
	requireAuthenticatedRequest(request);

	try {
		return {
			conversation_id: request.params.conversationId,
			messages: await conversationStore.listConversationMessages(
				request.params.conversationId,
				conversationScopeFromAuthContext(request.auth),
			),
		};
	} catch (error) {
		return reply.code(404).send({
			error: 'Not Found',
			message: error instanceof Error ? error.message : 'Conversation not found.',
			statusCode: 404,
		});
	}
});

server.get('/ws', { websocket: true }, async (socket, request) => {
	try {
		const authContext = await verifyWebSocketHandshake({
			request,
			verify_token: async (input) => {
				const result = await verifyToken(input);

				if (!result) {
					throw new Error('Invalid local dev auth token.');
				}

				return result;
			},
		});
		const subscriptionAccess = await verifyWebSocketSubscriptionAccess({
			auth: authContext,
		});

		attachRuntimeWebSocketHandler(socket, {
			approvalStore,
			auth_context: subscriptionAccess.auth,
			conversationStore,
			persistEvents: async () => {},
			persistRunState: async () => {},
			policy_wiring: policyWiring,
			subscription_context: subscriptionAccess.subscription,
			toolRegistry,
		});
	} catch (error) {
		rejectWebSocketConnection(socket, error);
	}
});

const shutdown = async () => {
	await server.close();
	process.exit(0);
};

process.on('SIGINT', () => {
	void shutdown();
});
process.on('SIGTERM', () => {
	void shutdown();
});

await server.listen({
	host: '127.0.0.1',
	port: 3000,
});

console.log(
	JSON.stringify({
		proof_file_path: proofFilePath,
		runtime_config_storage_key: runtimeConfigStorageKey,
		status: 'ready',
	}),
);
