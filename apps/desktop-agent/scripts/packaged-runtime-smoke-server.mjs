import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const desktopAgentRoot = resolve(scriptDirectory, '..');
const workspaceRoot = resolve(desktopAgentRoot, '..', '..');
const serverRoot = resolve(workspaceRoot, 'apps', 'server');
const serverDistRoot = resolve(serverRoot, 'dist');
const webDistRoot = resolve(workspaceRoot, 'apps', 'web', 'dist');
const envFilePath = resolve(workspaceRoot, '.env');
const envLocalFilePath = resolve(workspaceRoot, '.env.local');
const READY_TOKEN = 'DESKTOP_PACKAGED_SMOKE_SERVER_READY';
const LOCAL_HOST = '127.0.0.1';
const DEEPSEEK_CHAT_COMPLETIONS_URL = 'https://api.deepseek.com/chat/completions';

let activeServer = null;
let shuttingDown = false;

function createInMemoryConversationStore() {
	const conversations = new Map();

	return {
		async appendConversationMessage(input) {
			const createdAt = input.created_at ?? new Date().toISOString();
			const message = {
				content: input.content,
				conversation_id: input.conversation_id,
				created_at: createdAt,
				message_id: randomUUID(),
				role: input.role,
				run_id: input.run_id,
				trace_id: input.trace_id,
			};

			conversations.get(input.conversation_id)?.messages.push(message);

			return message;
		},
		async appendConversationRunBlocks(input) {
			const createdAt = input.created_at ?? new Date().toISOString();
			const runBlocks = {
				blocks: input.blocks,
				conversation_id: input.conversation_id,
				created_at: createdAt,
				run_blocks_id: randomUUID(),
				run_id: input.run_id,
				trace_id: input.trace_id,
			};

			conversations.get(input.conversation_id)?.run_blocks.push(runBlocks);

			return runBlocks;
		},
		async ensureConversation(input) {
			const conversationId = input.conversation_id ?? randomUUID();
			const createdAt = input.created_at ?? new Date().toISOString();
			const existing = conversations.get(conversationId);

			if (existing) {
				return existing.summary;
			}

			const summary = {
				conversation_id: conversationId,
				created_at: createdAt,
				initial_preview: input.initial_preview,
				updated_at: createdAt,
			};

			conversations.set(conversationId, {
				messages: [],
				run_blocks: [],
				summary,
			});

			return summary;
		},
	};
}

function createInMemoryApprovalStore() {
	const pendingApprovals = new Map();

	return {
		async getPendingApprovalById(approvalId) {
			return pendingApprovals.get(approvalId) ?? null;
		},
		async persistApprovalRequest(input) {
			pendingApprovals.set(input.approval_request.approval_id, {
				approval_request: input.approval_request,
				auto_continue_context: input.auto_continue_context,
				next_sequence_no: input.next_sequence_no ?? 0,
				pending_tool_call: input.pending_tool_call,
			});
		},
		async persistApprovalResolution(input) {
			pendingApprovals.delete(input.approval_request.approval_id);
		},
	};
}

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
		return 0;
	}

	const envFileContents = readFileSync(filePath, 'utf8');
	const envLines = envFileContents.split(/\r?\n/u);
	let loadedKeys = 0;

	for (const envLine of envLines) {
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
		const keyAlreadyOwnedByFile = fileOwnedKeys.has(key);

		if (key.length === 0 || (process.env[key] !== undefined && !keyAlreadyOwnedByFile)) {
			continue;
		}

		process.env[key] = normalizeEnvValue(rawValue);
		fileOwnedKeys.add(key);
		loadedKeys += 1;
	}

	return loadedKeys;
}

function loadServerEnvironment() {
	const fileOwnedKeys = new Set();
	loadEnvironmentFile(envFilePath, fileOwnedKeys);
	loadEnvironmentFile(envLocalFilePath, fileOwnedKeys);
	process.env.NODE_ENV ??= 'development';
	process.env.RUNA_DEV_AUTH_ENABLED ??= '1';
	process.env.RUNA_DEV_AUTH_SECRET ??= randomUUID();
	process.env.RUNA_DEV_AUTH_EMAIL ??= 'dev@runa.local';
	process.env.DEEPSEEK_API_KEY ??= 'packaged-runtime-smoke-key';
}

function disableDatabaseBackedPersistenceForSmoke() {
	process.env.DATABASE_TARGET = undefined;
	process.env.DATABASE_URL = undefined;
	process.env.LOCAL_DATABASE_URL = undefined;
	process.env.SUPABASE_DATABASE_URL = undefined;
}

function ensureServerDistFile(relativePath) {
	const absolutePath = resolve(serverDistRoot, relativePath);

	if (!existsSync(absolutePath)) {
		throw new Error(
			`Expected compiled server module at ${absolutePath}. Run @runa/server build first.`,
		);
	}

	return absolutePath;
}

function createJsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		headers: {
			'content-type': 'application/json',
		},
		status,
	});
}

function createProviderFetchStub() {
	let requestCount = 0;

	return async (url) => {
		const targetUrl = typeof url === 'string' ? url : url?.url;

		if (targetUrl !== DEEPSEEK_CHAT_COMPLETIONS_URL) {
			throw new Error(`[desktop-packaged-smoke] Unexpected fetch target: ${String(targetUrl)}`);
		}

		requestCount += 1;

		if (requestCount % 2 === 1) {
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
										arguments: '{}',
										name: 'desktop_screenshot',
									},
									id: 'call_desktop_packaged_screenshot_1',
									type: 'function',
								},
							],
						},
					},
				],
				id: `chatcmpl_desktop_packaged_smoke_${String(requestCount)}`,
				model: 'deepseek-v4-flash',
				usage: {
					completion_tokens: 8,
					prompt_tokens: 24,
					total_tokens: 32,
				},
			});
		}

		if (requestCount % 2 === 0) {
			return createJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'Packaged desktop screenshot completed successfully.',
							role: 'assistant',
						},
					},
				],
				id: `chatcmpl_desktop_packaged_smoke_${String(requestCount)}`,
				model: 'deepseek-v4-flash',
				usage: {
					completion_tokens: 8,
					prompt_tokens: 32,
					total_tokens: 40,
				},
			});
		}

		throw new Error('[desktop-packaged-smoke] Unexpected provider fetch state.');
	};
}

function resolveSmokeWebContentType(filePath) {
	switch (extname(filePath)) {
		case '.css':
			return 'text/css; charset=utf-8';
		case '.html':
			return 'text/html; charset=utf-8';
		case '.js':
			return 'text/javascript; charset=utf-8';
		case '.json':
			return 'application/json; charset=utf-8';
		case '.png':
			return 'image/png';
		case '.svg':
			return 'image/svg+xml';
		case '.txt':
			return 'text/plain; charset=utf-8';
		case '.webp':
			return 'image/webp';
		default:
			return 'application/octet-stream';
	}
}

function resolveSmokeWebAssetPath(requestUrl) {
	const parsedUrl = new URL(requestUrl, 'http://localhost');
	const pathname = decodeURIComponent(parsedUrl.pathname);

	if (pathname.split('/').includes('..')) {
		return null;
	}

	if (pathname.startsWith('/assets/')) {
		return join(webDistRoot, pathname.slice(1));
	}

	return join(webDistRoot, 'index.html');
}

async function registerSmokeWebRoutes(server) {
	const indexPath = join(webDistRoot, 'index.html');

	if (!existsSync(indexPath)) {
		throw new Error(`Expected built web app at ${indexPath}. Run @runa/web build first.`);
	}

	server.get('/*', async (request, reply) => {
		const assetPath = resolveSmokeWebAssetPath(request.url);

		if (!assetPath) {
			reply.code(404).type('text/plain; charset=utf-8').send('Not found');
			return;
		}

		try {
			const body = await readFile(assetPath);
			reply.type(resolveSmokeWebContentType(assetPath)).send(body);
		} catch {
			reply.code(404).type('text/plain; charset=utf-8').send('Not found');
		}
	});
}

async function loadStartServer() {
	const authModule = await import(
		pathToFileURL(ensureServerDistFile('auth/supabase-auth.js')).href
	);
	const indexModule = await import(pathToFileURL(ensureServerDistFile('index.js')).href);
	const appModule = await import(pathToFileURL(ensureServerDistFile('app.js')).href);
	const policyWiringModule = await import(
		pathToFileURL(ensureServerDistFile('ws/policy-wiring.js')).href
	);

	return {
		buildServer: appModule.buildServer,
		createLocalDevSessionToken: authModule.createLocalDevSessionToken,
		createWebSocketPolicyWiring: policyWiringModule.createWebSocketPolicyWiring,
		startServer: indexModule.startServer,
	};
}

async function stopServerAndExit(exitCode) {
	if (shuttingDown) {
		return;
	}

	shuttingDown = true;

	try {
		if (activeServer) {
			await activeServer.close();
		}
	} finally {
		process.exit(exitCode);
	}
}

async function main() {
	loadServerEnvironment();
	disableDatabaseBackedPersistenceForSmoke();
	globalThis.fetch = createProviderFetchStub();

	const { buildServer, createLocalDevSessionToken, createWebSocketPolicyWiring, startServer } =
		await loadStartServer();
	const approvalStore = createInMemoryApprovalStore();
	const conversationStore = createInMemoryConversationStore();
	const policyWiring = createWebSocketPolicyWiring({
		policy_state_store: null,
	});
	activeServer = await startServer({
		build_server: async (options) => {
			const server = await buildServer({
				...options,
				websocket: {
					runtime: {
						approvalStore,
						conversationStore,
						policy_wiring: policyWiring,
						persistEvents: async () => {},
						persistRunState: async () => {},
					},
				},
			});

			await registerSmokeWebRoutes(server);
			return server;
		},
		host: LOCAL_HOST,
		port: 0,
	});

	const address = activeServer.server.address();

	if (address === null || typeof address === 'string') {
		throw new Error('Unable to resolve packaged desktop smoke server address.');
	}

	process.stdout.write(
		`${READY_TOKEN} ${JSON.stringify({
			port: address.port,
			secondary_access_token: createLocalDevSessionToken({
				email: 'other@runa.local',
				secret: process.env.RUNA_DEV_AUTH_SECRET,
				session_id: 'packaged-smoke-secondary-session',
				user_id: 'local-dev-user-2',
			}).access_token,
			server_base_url: `http://${LOCAL_HOST}:${String(address.port)}`,
		})}\n`,
	);

	await new Promise(() => {});
}

process.on('SIGINT', () => {
	void stopServerAndExit(0);
});
process.on('SIGTERM', () => {
	void stopServerAndExit(0);
});

try {
	await main();
} catch (error) {
	console.error('[desktop-packaged-smoke-server] Failed to start.', error);
	await stopServerAndExit(1);
}
