import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
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
const scenarioWriteProofPath = join(proofDirectory, 'scenario-write-proof.txt');
const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const DEEPSEEK_CHAT_COMPLETIONS_URL = 'https://api.deepseek.com/chat/completions';
const envFilePath = resolve(workspaceRoot, '.env');
const envLocalFilePath = resolve(workspaceRoot, '.env.local');

mkdirSync(proofDirectory, { recursive: true });
rmSync(proofFilePath, { force: true });
rmSync(scenarioWriteProofPath, { force: true });

process.env.NODE_ENV ??= 'development';
process.env.RUNA_DEV_AUTH_ENABLED ??= '1';
process.env.RUNA_DEV_AUTH_SECRET ??= 'runa-e2e-dev-secret';
process.env.RUNA_DEV_AUTH_EMAIL ??= 'dev@runa.local';

function normalizeEnvValue(rawValue) {
	const trimmedValue = rawValue.trim();

	if (
		(trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
		(trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
	) {
		return trimmedValue.slice(1, -1);
	}

	return trimmedValue;
}

function loadEnvironmentFile(filePath, fileOwnedKeys) {
	if (!existsSync(filePath)) {
		return;
	}

	const envFileContents = readFileSync(filePath, 'utf8');

	for (const envLine of envFileContents.split(/\r?\n/u)) {
		const trimmedLine = envLine.trim();

		if (trimmedLine.length === 0 || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
			continue;
		}

		const separatorIndex = trimmedLine.indexOf('=');

		if (separatorIndex <= 0) {
			continue;
		}

		const key = trimmedLine.slice(0, separatorIndex).trim();
		const rawValue = trimmedLine.slice(separatorIndex + 1);

		if (key.length === 0 || (process.env[key] !== undefined && !fileOwnedKeys.has(key))) {
			continue;
		}

		process.env[key] = normalizeEnvValue(rawValue);
		fileOwnedKeys.add(key);
	}
}

{
	const fileOwnedKeys = new Set();
	loadEnvironmentFile(envFilePath, fileOwnedKeys);
	loadEnvironmentFile(envLocalFilePath, fileOwnedKeys);
}

process.env.DEEPSEEK_API_KEY ??= 'e2e-deepseek-key';

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

function collectUserMessageText(messages) {
	return (messages ?? [])
		.filter((message) => message?.role === 'user' && typeof message.content === 'string')
		.map((message) => message.content)
		.join('\n');
}

function findScenarioUserMessage(messages) {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];

		if (message?.role !== 'user' || typeof message.content !== 'string') {
			continue;
		}

		const content = message.content.trim();

		if (content.length <= 240 && content.includes('[runa-e2e:cap-')) {
			return content;
		}
	}

	return '';
}

function isContinuationRequest(lastUserMessage) {
	return lastUserMessage.startsWith(
		'Continue the same user request using the latest ingested tool result from the runtime context.',
	);
}

function createToolCall(name, args, callId) {
	return {
		function: {
			arguments: JSON.stringify(args),
			name,
		},
		id: callId,
		type: 'function',
	};
}

function resolveScenarioToolCall(userMessageText) {
	const normalizedText = userMessageText.toLowerCase();

	if (normalizedText.includes('[runa-e2e:cap-file-list]')) {
		return createToolCall(
			'file_list',
			{
				include_hidden: false,
				path: '.',
			},
			'call_e2e_file_list',
		);
	}

	if (normalizedText.includes('[runa-e2e:cap-file-read]')) {
		return createToolCall(
			'file_read',
			{
				end_line: 8,
				path: 'README.md',
				start_line: 1,
			},
			'call_e2e_file_read',
		);
	}

	if (normalizedText.includes('[runa-e2e:cap-search-grep]')) {
		return createToolCall(
			'search_grep',
			{
				case_sensitive: false,
				path: 'docs',
				query: 'Runa',
			},
			'call_e2e_search_grep',
		);
	}

	if (normalizedText.includes('[runa-e2e:cap-search-codebase]')) {
		return createToolCall(
			'search_codebase',
			{
				include_hidden: false,
				query: 'createWebSocketPolicyWiring',
				working_directory: 'apps/server/src/ws',
			},
			'call_e2e_search_codebase',
		);
	}

	if (normalizedText.includes('[runa-e2e:cap-git-status]')) {
		return createToolCall('git_status', {}, 'call_e2e_git_status');
	}

	if (normalizedText.includes('[runa-e2e:cap-git-diff]')) {
		return createToolCall(
			'git_diff',
			{
				cached: false,
			},
			'call_e2e_git_diff',
		);
	}

	if (normalizedText.includes('[runa-e2e:cap-file-write]')) {
		return createToolCall(
			'file_write',
			{
				content: 'scenario write proof\n',
				overwrite: true,
				path: scenarioWriteProofPath,
			},
			'call_e2e_file_write_scenario',
		);
	}

	if (normalizedText.includes('[runa-e2e:cap-shell-exec]')) {
		return createToolCall(
			'shell_exec',
			{
				args: ['-e', "console.log('shell scenario ok')"],
				command: 'node',
				timeout_ms: 5_000,
			},
			'call_e2e_shell_exec',
		);
	}

	if (normalizedText.includes('[runa-e2e:cap-browser-navigate]')) {
		return createToolCall(
			'browser_navigate',
			{
				url: 'http://127.0.0.1:4173/tests/visual/evidence-sources-fixture.html',
				wait_until: 'domcontentloaded',
			},
			'call_e2e_browser_navigate',
		);
	}

	return null;
}

function createMockDeepSeekResponse(requestBody) {
	const userMessageText = collectUserMessageText(requestBody.messages);
	const lastUserMessage = findLastUserMessage(requestBody.messages ?? []);
	const scenarioUserMessage = findScenarioUserMessage(requestBody.messages ?? []);
	const model = requestBody.model ?? 'deepseek-v4-flash';

	if (isContinuationRequest(lastUserMessage)) {
		return createJsonResponse({
			choices: [
				{
					finish_reason: 'stop',
					message: {
						content: `E2E scenario completed. Proof directory: ${proofDirectory}.`,
						role: 'assistant',
					},
				},
			],
			id: 'deepseek_e2e_completed',
			model,
			usage: {
				completion_tokens: 24,
				prompt_tokens: 42,
				total_tokens: 66,
			},
		});
	}

	const scenarioToolCall = resolveScenarioToolCall(scenarioUserMessage);

	if (scenarioToolCall) {
		return createJsonResponse({
			choices: [
				{
					finish_reason: 'tool_calls',
					message: {
						content: null,
						role: 'assistant',
						tool_calls: [scenarioToolCall],
					},
				},
			],
			id: 'deepseek_e2e_capability_scenario',
			model,
			usage: {
				completion_tokens: 18,
				prompt_tokens: 48,
				total_tokens: 66,
			},
		});
	}

	if (userMessageText.toLowerCase().includes('approval')) {
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
									name: 'file_write',
								},
								id: 'call_deepseek_e2e_file_write',
								type: 'function',
							},
						],
					},
				},
			],
			id: 'deepseek_e2e_approval',
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
		id: 'deepseek_e2e_chat',
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

	if (url === DEEPSEEK_CHAT_COMPLETIONS_URL) {
		return createMockDeepSeekResponse(readRequestBody(init));
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
	usageQuotaModule,
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
	import(pathToFileURL(resolve(serverDistRoot, 'policy', 'usage-quota.js')).href),
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
const { resetUsageRateLimitStore } = usageQuotaModule;
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

server.get('/conversations/:conversationId/members', async (request) => {
	requireAuthenticatedRequest(request);

	return {
		conversation_id: request.params.conversationId,
		members: [],
	};
});

server.get('/desktop/devices', async (request) => {
	requireAuthenticatedRequest(request);

	return {
		devices: [],
	};
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

		resetUsageRateLimitStore();

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
