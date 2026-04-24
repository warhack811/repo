import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(scriptDirectory, '..');
const workspaceRoot = resolve(serverRoot, '..', '..');
const distRoot = resolve(serverRoot, 'dist');
const envFilePath = resolve(workspaceRoot, '.env');
const envLocalFilePath = resolve(workspaceRoot, '.env.local');
const READY_TOKEN = 'APPROVAL_SMOKE_SERVER_READY';
const LOCAL_HOST = '127.0.0.1';

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
}

function ensureDistFile(relativePath) {
	const absolutePath = resolve(distRoot, relativePath);

	if (!existsSync(absolutePath)) {
		throw new Error(`Expected compiled module at ${absolutePath}. Run the server build first.`);
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

function createFetchStub(phase, targetPath) {
	let requestCount = 0;

	return async (url) => {
		if (typeof url !== 'string' || url !== 'https://api.groq.com/openai/v1/chat/completions') {
			throw new Error(
				`[approval-smoke] Unexpected fetch target for phase ${phase}: ${String(url)}`,
			);
		}

		requestCount += 1;

		if (phase === 'tool-approval-initial' && requestCount === 1) {
			return createJsonResponse({
				choices: [
					{
						finish_reason: 'tool_calls',
						message: {
							role: 'assistant',
							tool_calls: [
								{
									function: {
										arguments: {
											content: 'approved content from restart smoke',
											overwrite: true,
											path: targetPath,
										},
										name: 'file.write',
									},
									id: 'call_smoke_tool_approval_1',
									type: 'function',
								},
							],
						},
					},
				],
				id: 'chatcmpl_smoke_tool_approval_1',
				model: 'llama-3.3-70b-versatile',
				usage: {
					completion_tokens: 12,
					prompt_tokens: 8,
					total_tokens: 20,
				},
			});
		}

		if (phase === 'auto-continue-initial' && requestCount === 1) {
			return createJsonResponse({
				choices: [
					{
						finish_reason: 'tool_calls',
						message: {
							role: 'assistant',
							tool_calls: [
								{
									function: {
										arguments: {
											path: targetPath,
										},
										name: 'file.read',
									},
									id: 'call_smoke_auto_continue_1',
									type: 'function',
								},
							],
						},
					},
				],
				id: 'chatcmpl_smoke_auto_continue_1',
				model: 'llama-3.3-70b-versatile',
				usage: {
					completion_tokens: 12,
					prompt_tokens: 8,
					total_tokens: 20,
				},
			});
		}

		if (phase === 'auto-continue-resume' && requestCount === 1) {
			return createJsonResponse({
				choices: [
					{
						finish_reason: 'stop',
						message: {
							content: 'The file exports value = 1.',
							role: 'assistant',
						},
					},
				],
				id: 'chatcmpl_smoke_auto_continue_2',
				model: 'llama-3.3-70b-versatile',
				usage: {
					completion_tokens: 10,
					prompt_tokens: 10,
					total_tokens: 20,
				},
			});
		}

		throw new Error(
			`[approval-smoke] Unexpected provider fetch for phase ${phase} at request ${requestCount}.`,
		);
	};
}

async function loadStartServer() {
	const indexModule = await import(pathToFileURL(ensureDistFile('index.js')).href);
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

	const phase = process.env.RUNA_APPROVAL_SMOKE_PHASE?.trim();
	const targetPath = process.env.RUNA_APPROVAL_SMOKE_TARGET_PATH?.trim();

	if (!phase) {
		throw new Error('RUNA_APPROVAL_SMOKE_PHASE is required.');
	}

	if (
		(phase === 'tool-approval-initial' || phase === 'auto-continue-initial') &&
		(!targetPath || targetPath.length === 0)
	) {
		throw new Error(`RUNA_APPROVAL_SMOKE_TARGET_PATH is required for phase ${phase}.`);
	}

	globalThis.fetch = createFetchStub(phase, targetPath);

	const startServer = await loadStartServer();
	activeServer = await startServer({
		host: LOCAL_HOST,
		port: 0,
	});

	const address = activeServer.server.address();

	if (address === null || typeof address === 'string') {
		throw new Error('Unable to resolve approval smoke server address.');
	}

	process.stdout.write(
		`${READY_TOKEN} ${JSON.stringify({ phase, port: address.port, target_path: targetPath ?? null })}\n`,
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
	console.error('[approval-smoke-server] Failed to start.', error);
	await stopServerAndExit(1);
}
