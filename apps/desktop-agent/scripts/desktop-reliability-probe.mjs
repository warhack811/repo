import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');

function runCommand(command, args, options = {}) {
	return new Promise((resolve) => {
		const invocation =
			process.platform === 'win32' && command.endsWith('.cmd')
				? {
						args: ['/d', '/s', '/c', command, ...args],
						command: process.env.ComSpec ?? 'cmd.exe',
					}
				: {
						args,
						command,
					};
		const child = spawn(invocation.command, invocation.args, {
			cwd: options.cwd ?? packageRoot,
			env: process.env,
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
		});
		let stdout = '';
		let stderr = '';

		child.stdout?.on('data', (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr?.on('data', (chunk) => {
			stderr += chunk.toString();
		});
		child.once('exit', (code, signal) => {
			resolve({
				code,
				signal,
				stderr,
				stdout,
			});
		});
	});
}

function includesAll(source, patterns) {
	return patterns.every((pattern) => source.includes(pattern));
}

function extractReconnectDelay(source) {
	const match = source.match(/BRIDGE_RECONNECT_DELAY_MS\s*=\s*([\d_]+)/u);
	return match ? Number.parseInt(match[1].replaceAll('_', ''), 10) : null;
}

async function main() {
	const [sessionSource, sessionTestSource, shellSource, electronMainSource] = await Promise.all([
		readFile(path.join(packageRoot, 'src', 'session.ts'), 'utf8'),
		readFile(path.join(packageRoot, 'src', 'session.test.ts'), 'utf8'),
		readFile(path.join(packageRoot, 'src', 'shell.ts'), 'utf8'),
		readFile(path.join(packageRoot, 'electron', 'main.ts'), 'utf8').catch(() => ''),
	]);
	const vitestCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
	const vitestResult = await runCommand(vitestCommand, [
		'exec',
		'vitest',
		'run',
		'src/session.test.ts',
		'--config',
		'./vitest.config.mjs',
	]);

	const reconnectDelayMs = extractReconnectDelay(sessionSource);
	const unexpectedCloseReconnectTestPresent = sessionTestSource.includes(
		'reconnects the desktop bridge after an unexpected socket close',
	);
	const retryUntilServerBackTestPresent = sessionTestSource.includes(
		'keeps retrying when the first reconnect attempt happens before the server is back',
	);
	const intentionalStopNoReconnectTestPresent = sessionTestSource.includes(
		'does not reconnect after an intentional stop',
	);
	const expiredSessionNoBridgeTestPresent = sessionTestSource.includes(
		'clears an expired stored session when no refresh token is available',
	);
	const bridgeLifecycleCloseObserved = includesAll(sessionSource, [
		"addEventListener('close'",
		'#scheduleReconnect(session)',
	]);
	const bridgeLifecycleErrorObserved = includesAll(sessionSource, [
		"addEventListener('error'",
		'#scheduleReconnect(session)',
	]);
	const stopClearsReconnect = includesAll(sessionSource, [
		'stop(): Promise<DesktopAgentRuntimeSnapshot>',
		'this.#clearReconnectTimeout();',
		"'Desktop runtime stopped.'",
	]);
	const signOutClearsReconnect = includesAll(sessionSource, [
		'signOut(): Promise<DesktopAgentRuntimeSnapshot>',
		'this.#clearReconnectTimeout();',
		"'Desktop runtime signed out.'",
	]);
	const shellPollsRuntimeStatus = includesAll(shellSource, [
		'SHELL_RUNTIME_WATCH_INTERVAL_MS',
		'this.#runtime.getSnapshot()',
	]);
	const powerMonitorHookPresent =
		electronMainSource.includes('powerMonitor') &&
		(electronMainSource.includes("'resume'") || electronMainSource.includes('"resume"'));
	const jitterBackoffPresent =
		sessionSource.includes('Math.random') ||
		sessionSource.includes('jitter') ||
		sessionSource.includes('backoff');
	const packagedServerRestartProbePresent =
		sessionTestSource.includes('server restart') ||
		sessionTestSource.includes('packaged restart') ||
		sessionTestSource.includes('sleep') ||
		sessionTestSource.includes('resume');

	const runtimeReconnectUnitCoverage =
		vitestResult.code === 0 &&
		unexpectedCloseReconnectTestPresent &&
		retryUntilServerBackTestPresent &&
		intentionalStopNoReconnectTestPresent &&
		expiredSessionNoBridgeTestPresent;
	const measuredGaps = [
		...(jitterBackoffPresent ? [] : ['reconnect_backoff_is_fixed_no_jitter']),
		...(powerMonitorHookPresent ? [] : ['sleep_wake_resume_hook_missing']),
		...(packagedServerRestartProbePresent ? [] : ['packaged_server_restart_probe_missing']),
	];
	const summary = {
		bridge_lifecycle_close_observed: bridgeLifecycleCloseObserved,
		bridge_lifecycle_error_observed: bridgeLifecycleErrorObserved,
		expired_session_no_bridge_test_present: expiredSessionNoBridgeTestPresent,
		fixed_reconnect_delay_ms: reconnectDelayMs,
		intentional_stop_no_reconnect_test_present: intentionalStopNoReconnectTestPresent,
		measured_gaps: measuredGaps,
		packaged_server_restart_probe_present: packagedServerRestartProbePresent,
		phase1_status: measuredGaps.length === 0 ? 'measured_no_gaps' : 'measured_with_gaps',
		power_monitor_resume_hook_present: powerMonitorHookPresent,
		reconnect_backoff_has_jitter: jitterBackoffPresent,
		retry_until_server_back_test_present: retryUntilServerBackTestPresent,
		runtime_reconnect_unit_coverage: runtimeReconnectUnitCoverage,
		session_unit_test_exit_code: vitestResult.code,
		shell_polls_runtime_status: shellPollsRuntimeStatus,
		sign_out_clears_reconnect: signOutClearsReconnect,
		stop_clears_reconnect: stopClearsReconnect,
		unexpected_close_reconnect_test_present: unexpectedCloseReconnectTestPresent,
	};

	if (vitestResult.code !== 0) {
		process.stdout.write(vitestResult.stdout);
		process.stderr.write(vitestResult.stderr);
	}

	console.log(`DESKTOP_AGENT_RELIABILITY_PROBE_SUMMARY ${JSON.stringify(summary)}`);

	if (!runtimeReconnectUnitCoverage) {
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(
		`DESKTOP_AGENT_RELIABILITY_PROBE_FAILED ${
			error instanceof Error ? error.message : String(error)
		}`,
	);
	process.exitCode = 1;
});
