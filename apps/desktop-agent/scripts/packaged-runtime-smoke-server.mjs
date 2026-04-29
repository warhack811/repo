import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const desktopAgentRoot = resolve(scriptDirectory, '..');
const workspaceRoot = resolve(desktopAgentRoot, '..', '..');
const serverRoot = resolve(workspaceRoot, 'apps', 'server');
const serverDistRoot = resolve(serverRoot, 'dist');
const envFilePath = resolve(workspaceRoot, '.env');
const envLocalFilePath = resolve(workspaceRoot, '.env.local');
const READY_TOKEN = 'DESKTOP_PACKAGED_SMOKE_SERVER_READY';
const LOCAL_HOST = '127.0.0.1';
const DEEPSEEK_CHAT_COMPLETIONS_URL = 'https://api.deepseek.com/chat/completions';

let activeServer = null;
let shuttingDown = false;

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

		if (requestCount === 1) {
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
				id: 'chatcmpl_desktop_packaged_smoke_1',
				model: 'deepseek-v4-flash',
				usage: {
					completion_tokens: 8,
					prompt_tokens: 24,
					total_tokens: 32,
				},
			});
		}

		if (requestCount === 2) {
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
				id: 'chatcmpl_desktop_packaged_smoke_2',
				model: 'deepseek-v4-flash',
				usage: {
					completion_tokens: 8,
					prompt_tokens: 32,
					total_tokens: 40,
				},
			});
		}

		throw new Error(
			`[desktop-packaged-smoke] Unexpected provider fetch request ${String(requestCount)}.`,
		);
	};
}

async function loadStartServer() {
	const indexModule = await import(pathToFileURL(ensureServerDistFile('index.js')).href);
	return indexModule.startServer;
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
	globalThis.fetch = createProviderFetchStub();

	const startServer = await loadStartServer();
	activeServer = await startServer({
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
