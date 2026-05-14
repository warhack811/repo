import { execFile, spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_SERVER_PORT = 3000;
const DEFAULT_WEB_PORT = 5173;
const WEB_PORT_SCAN_COUNT = 8;
const CLEANUP_PATHS = [
	'apps/web/.vite-cache',
	'apps/web/node_modules/.vite',
	'apps/web/dist',
];
const TARGET_COMMAND_PATTERNS = [
	'turbo run dev',
	'apps\\web\\node_modules\\.bin\\..\\vite\\bin\\vite.js',
	'apps/server/scripts/dev.mjs',
	'scripts/dev.mjs',
];

function parsePreferredPort(value, fallback) {
	if (typeof value !== 'string' || value.trim().length === 0) {
		return fallback;
	}

	const parsed = Number.parseInt(value, 10);
	return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : fallback;
}

function buildTargetPorts() {
	const serverPort = parsePreferredPort(
		process.env['RUNA_SERVER_PORT'] ?? process.env['PORT'] ?? '',
		DEFAULT_SERVER_PORT,
	);
	const webPort = parsePreferredPort(
		process.env['RUNA_WEB_PORT'] ?? process.env['VITE_PORT'] ?? '',
		DEFAULT_WEB_PORT,
	);
	const ports = new Set([serverPort]);

	for (let index = 0; index < WEB_PORT_SCAN_COUNT; index += 1) {
		ports.add(webPort + index);
	}

	return [...ports];
}

async function getListeningPidsWindows(targetPorts) {
	const { stdout } = await execFileAsync('netstat', ['-ano', '-p', 'tcp']);
	const portSet = new Set(targetPorts);
	const pids = new Set();

	for (const line of stdout.split(/\r?\n/u)) {
		const normalizedLine = line.trim();
		if (!normalizedLine) {
			continue;
		}

		const columns = normalizedLine.split(/\s+/u);
		if (columns.length < 5) {
			continue;
		}

		const localAddress = columns[1];
		const state = columns[3];
		const pidValue = columns[4];

		if (state !== 'LISTENING') {
			continue;
		}

		const lastColonIndex = localAddress.lastIndexOf(':');
		if (lastColonIndex === -1) {
			continue;
		}

		const parsedPort = Number.parseInt(localAddress.slice(lastColonIndex + 1), 10);
		if (!portSet.has(parsedPort)) {
			continue;
		}

		const parsedPid = Number.parseInt(pidValue, 10);
		if (Number.isInteger(parsedPid) && parsedPid > 0) {
			pids.add(parsedPid);
		}
	}

	return [...pids];
}

async function getListeningPidsUnix(targetPorts) {
	const pids = new Set();

	for (const port of targetPorts) {
		try {
			const { stdout } = await execFileAsync('lsof', [
				'-nP',
				`-iTCP:${port}`,
				'-sTCP:LISTEN',
				'-t',
			]);

			for (const line of stdout.split(/\r?\n/u)) {
				const parsedPid = Number.parseInt(line.trim(), 10);
				if (Number.isInteger(parsedPid) && parsedPid > 0) {
					pids.add(parsedPid);
				}
			}
		} catch {
			// ignore missing lsof entries per port
		}
	}

	return [...pids];
}

async function getListeningPids(targetPorts) {
	if (process.platform === 'win32') {
		return getListeningPidsWindows(targetPorts);
	}

	return getListeningPidsUnix(targetPorts);
}

async function getProcessCommandLineWindows(pid) {
	const escaped = String(pid);
	const script = [
		`$process = Get-CimInstance Win32_Process -Filter "ProcessId = ${escaped}"`,
		'if ($null -eq $process) { return }',
		'$process.CommandLine',
	].join('; ');

	try {
		const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script]);
		return stdout.trim();
	} catch {
		return '';
	}
}

function shouldTerminateByCommandLine(commandLine) {
	if (!commandLine) {
		return false;
	}

	const normalized = commandLine.toLowerCase();
	return TARGET_COMMAND_PATTERNS.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

async function terminateProcess(pid) {
	try {
		process.kill(pid, 'SIGTERM');
	} catch {
		return false;
	}

	await new Promise((resolve) => setTimeout(resolve, 250));

	try {
		process.kill(pid, 0);
		process.kill(pid, 'SIGKILL');
	} catch {
		return true;
	}

	return true;
}

async function cleanupPaths() {
	for (const path of CLEANUP_PATHS) {
		try {
			await rm(path, { force: true, recursive: true });
			console.log(`[clean-start] Cleared ${path}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.warn(`[clean-start] Could not clear ${path}: ${message}`);
		}
	}
}

async function main() {
	const dryRun = process.argv.includes('--dry-run');
	const targetPorts = buildTargetPorts();
	console.log(`[clean-start] Target ports: ${targetPorts.join(', ')}`);

	const listeningPids = await getListeningPids(targetPorts);
	const candidatePids = listeningPids.filter((pid) => pid !== process.pid);
	const pidsToTerminate = [];

	for (const pid of candidatePids) {
		if (process.platform === 'win32') {
			const commandLine = await getProcessCommandLineWindows(pid);
			if (shouldTerminateByCommandLine(commandLine)) {
				pidsToTerminate.push(pid);
			}
			continue;
		}

		pidsToTerminate.push(pid);
	}

	if (pidsToTerminate.length === 0) {
		console.log('[clean-start] No stale dev listener process found.');
	} else if (dryRun) {
		console.log(`[clean-start] Dry run: would terminate PID(s): ${pidsToTerminate.join(', ')}`);
	} else {
		for (const pid of pidsToTerminate) {
			const terminated = await terminateProcess(pid);
			console.log(
				terminated
					? `[clean-start] Terminated PID ${pid}`
					: `[clean-start] Skipped PID ${pid} (not running or not permitted)`,
			);
		}
	}

	if (dryRun) {
		console.log('[clean-start] Dry run complete. Skipping cleanup and dev startup.');
		return;
	}

	await cleanupPaths();

	const child = spawn(process.execPath, ['scripts/dev.mjs'], {
		cwd: process.cwd(),
		env: process.env,
		stdio: 'inherit',
	});

	child.on('exit', (code, signal) => {
		if (signal) {
			process.exit(1);
			return;
		}

		process.exit(code ?? 0);
	});
}

await main();
