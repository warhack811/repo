import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');

function createSpawnInvocation(command, args) {
	if (process.platform !== 'win32' || !command.endsWith('.cmd')) {
		return {
			args,
			command,
		};
	}

	return {
		args: ['/d', '/s', '/c', command, ...args],
		command: process.env.ComSpec ?? 'cmd.exe',
	};
}

function appendNodeOption(currentValue, option) {
	const current = currentValue?.trim();

	if (!current) {
		return option;
	}

	if (current.split(/\s+/u).includes(option)) {
		return current;
	}

	return `${current} ${option}`;
}

async function runStep(label, command, args, options = {}) {
	const invocation = createSpawnInvocation(command, args);

	await new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(invocation.command, invocation.args, {
			cwd: packageRoot,
			env: options.env ?? process.env,
			stdio: 'inherit',
			windowsHide: true,
		});

		child.once('error', rejectPromise);
		child.once('exit', (code, signal) => {
			if (code === 0) {
				resolvePromise();
				return;
			}

			rejectPromise(
				new Error(`${label} failed with code=${code ?? 'null'}, signal=${signal ?? 'null'}.`),
			);
		});
	});
}

async function main() {
	const nodeCommand = process.execPath;
	const electronBuilderCommand = join(
		packageRoot,
		'node_modules',
		'.bin',
		process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder',
	);

	await runStep('prepare icons', nodeCommand, ['scripts/create-placeholder-icons.mjs']);
	await runStep('build main process', nodeCommand, ['scripts/build-main.mjs']);
	await runStep('build renderer', nodeCommand, ['scripts/build-renderer.mjs']);
	await runStep(
		'electron-builder',
		electronBuilderCommand,
		['--win', '--config', 'electron-builder.yml'],
		{
			env: {
				...process.env,
				NODE_OPTIONS: appendNodeOption(process.env.NODE_OPTIONS, '--no-deprecation'),
			},
		},
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
