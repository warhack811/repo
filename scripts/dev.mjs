import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const DEFAULT_SERVER_PORT = 3000;
const MAX_PORT_PROBE_ATTEMPTS = 32;
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function parsePreferredPort(value) {
	if (value === undefined || value.trim().length === 0) {
		return undefined;
	}

	const parsed = Number.parseInt(value, 10);

	if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
		return undefined;
	}

	return parsed;
}

function isPortAvailable(port) {
	return new Promise((resolve) => {
		const probe = createServer();

		probe.unref();
		probe.on('error', () => {
			resolve(false);
		});
		probe.listen(
			{
				host: '127.0.0.1',
				port,
			},
			() => {
				probe.close(() => {
					resolve(true);
				});
			},
		);
	});
}

async function resolveServerPort() {
	const preferredPort =
		parsePreferredPort(process.env['RUNA_SERVER_PORT']) ??
		parsePreferredPort(process.env['PORT']) ??
		DEFAULT_SERVER_PORT;

	for (let attempt = 0; attempt < MAX_PORT_PROBE_ATTEMPTS; attempt += 1) {
		const candidatePort = preferredPort + attempt;
		if (candidatePort > 65_535) {
			break;
		}

		if (await isPortAvailable(candidatePort)) {
			return candidatePort;
		}
	}

	throw new Error(`Unable to find an available server port starting from ${preferredPort}.`);
}

async function main() {
	const serverPort = await resolveServerPort();
	const env = {
		...process.env,
		PORT: String(serverPort),
		RUNA_SERVER_PORT: String(serverPort),
	};
	const args = ['turbo', 'run', 'dev', '--filter=@runa/server', '--filter=@runa/web'];

	console.log(`[dev] Using RUNA_SERVER_PORT=${serverPort}`);

	const spawnCommand =
		process.platform === 'win32' && pnpmCommand.endsWith('.cmd')
			? (process.env.ComSpec ?? 'cmd.exe')
			: pnpmCommand;
	const spawnArgs =
		process.platform === 'win32' && pnpmCommand.endsWith('.cmd')
			? ['/d', '/s', '/c', pnpmCommand, ...args]
			: args;
	const child = spawn(spawnCommand, spawnArgs, {
		cwd: process.cwd(),
		env,
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
