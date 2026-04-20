import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(packageRoot, '..', '..');
const distEntry = resolve(packageRoot, 'dist/index.js');
const envFilePath = resolve(workspaceRoot, '.env');
const envLocalFilePath = resolve(workspaceRoot, '.env.local');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

let shuttingDown = false;
const childProcesses = [];

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
	const envLines = envFileContents.split(/\r?\n/);
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

function loadServerDevEnvironment() {
	const fileOwnedKeys = new Set();
	const loadedEnvKeys = loadEnvironmentFile(envFilePath, fileOwnedKeys);
	const loadedLocalEnvKeys = loadEnvironmentFile(envLocalFilePath, fileOwnedKeys);

	process.env.NODE_ENV ??= 'development';
	process.env.RUNA_DEV_AUTH_ENABLED ??= '1';
	process.env.RUNA_DEV_AUTH_SECRET ??= randomUUID();
	process.env.RUNA_DEV_AUTH_EMAIL ??= 'dev@runa.local';

	if (loadedEnvKeys > 0) {
		console.log(`[server:dev] Loaded ${loadedEnvKeys} environment value(s) from ${envFilePath}.`);
	}

	if (loadedLocalEnvKeys > 0) {
		console.log(
			`[server:dev] Loaded ${loadedLocalEnvKeys} environment value(s) from ${envLocalFilePath}.`,
		);
	}

	if (process.env.RUNA_DEV_AUTH_ENABLED === '1') {
		console.log('[server:dev] Local dev auth bootstrap is enabled for loopback browser sessions.');
	}
}

function stopChildren() {
	for (const childProcess of childProcesses) {
		if (!childProcess.killed) {
			childProcess.kill('SIGTERM');
		}
	}
}

function shutdown(exitCode = 0) {
	if (shuttingDown) {
		return;
	}

	shuttingDown = true;
	stopChildren();
	setTimeout(() => {
		process.exit(exitCode);
	}, 50).unref();
}

function getSpawnOptions() {
	return {
		cwd: packageRoot,
		stdio: 'inherit',
	};
}

function createSpawnInvocation(command, args) {
	if (process.platform !== 'win32' || !command.endsWith('.cmd')) {
		return {
			args,
			command,
		};
	}

	const shellCommand = process.env.ComSpec ?? 'cmd.exe';

	return {
		args: ['/d', '/s', '/c', command, ...args],
		command: shellCommand,
	};
}

function spawnProcess(command, args, label) {
	const invocation = createSpawnInvocation(command, args);
	const childProcess = spawn(invocation.command, invocation.args, getSpawnOptions());

	childProcess.on('exit', (code, signal) => {
		if (shuttingDown) {
			return;
		}

		const detail = signal === null ? `code ${code ?? 'unknown'}` : `signal ${signal}`;
		console.error(`[server:${label}] exited unexpectedly with ${detail}.`);
		shutdown(code ?? 1);
	});

	childProcess.on('error', (error) => {
		if (shuttingDown) {
			return;
		}

		console.error(`[server:${label}] failed to start.`, error);
		shutdown(1);
	});

	childProcesses.push(childProcess);
	return childProcess;
}

function runInitialBuild() {
	return new Promise((resolvePromise, rejectPromise) => {
		const invocation = createSpawnInvocation(pnpmCommand, ['exec', 'tsc']);
		const buildProcess = spawn(invocation.command, invocation.args, getSpawnOptions());

		buildProcess.on('exit', (code) => {
			if (code === 0) {
				resolvePromise();
				return;
			}

			rejectPromise(new Error(`Initial server build failed with code ${code ?? 'unknown'}.`));
		});

		buildProcess.on('error', (error) => {
			rejectPromise(error);
		});
	});
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

try {
	loadServerDevEnvironment();
	await runInitialBuild();

	if (!existsSync(distEntry)) {
		throw new Error(`Expected compiled server entry at ${distEntry}.`);
	}

	spawnProcess(pnpmCommand, ['exec', 'tsc', '--watch', '--preserveWatchOutput'], 'tsc');
	spawnProcess(process.execPath, ['--watch', distEntry], 'node');

	await new Promise(() => {});
} catch (error) {
	console.error('[server:dev] Failed to start development bootstrap.', error);
	shutdown(1);
}
