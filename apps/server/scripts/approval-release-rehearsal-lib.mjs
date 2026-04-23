import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const serverRoot = resolve(import.meta.dirname, '..');

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

export function classifyChainFailure(chain) {
	if (!chain || typeof chain !== 'object') {
		return 'summary_missing';
	}

	if (chain.approval_boundary_observed !== true) {
		return 'approval_boundary_missing';
	}

	if (chain.approval_resolve_sent !== true) {
		return 'approval_resolve_missing';
	}

	if (chain.continuation_observed !== true) {
		return 'continuation_missing';
	}

	if (chain.reconnect_restart_tolerated !== true) {
		return 'restart_reconnect_missing';
	}

	if (chain.terminal_run_finished_completed !== true) {
		return 'terminal_finish_missing';
	}

	return null;
}

export function extractSummaryFromOutput(output, summaryToken) {
	const lines = output.split(/\r?\n/u);

	for (let index = lines.length - 1; index >= 0; index -= 1) {
		const line = lines[index]?.trim();

		if (!line?.startsWith(`${summaryToken} `)) {
			continue;
		}

		return JSON.parse(line.slice(summaryToken.length + 1));
	}

	return null;
}

export async function runSummaryScript(input) {
	const command = process.platform === 'win32' ? 'node.exe' : 'node';
	const invocation = createSpawnInvocation(command, [input.scriptPath]);
	const child = spawn(invocation.command, invocation.args, {
		cwd: input.cwd ?? serverRoot,
		env: input.env ?? process.env,
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	let stdout = '';
	let stderr = '';

	child.stdout.on('data', (chunk) => {
		const text = chunk.toString();
		stdout += text;
		process.stdout.write(text);
	});

	child.stderr.on('data', (chunk) => {
		const text = chunk.toString();
		stderr += text;
		process.stderr.write(text);
	});

	const exit = await new Promise((resolvePromise, rejectPromise) => {
		child.once('error', rejectPromise);
		child.once('exit', (code, signal) => {
			resolvePromise({
				code,
				signal,
			});
		});
	});
	const summary = extractSummaryFromOutput(stdout, input.summaryToken);

	return {
		exit,
		stderr,
		stdout,
		summary,
	};
}
