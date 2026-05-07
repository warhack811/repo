import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FuseV1Options, getCurrentFuseWire } from '@electron/fuses';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const releaseRoot = path.join(packageRoot, 'release');
const unpackedRoot = path.join(releaseRoot, 'win-unpacked');
const unpackedExePath =
	process.env.RUNA_DESKTOP_DISTRIBUTION_EXE ?? path.join(unpackedRoot, 'Runa Desktop.exe');
const electronBuilderConfigPath = path.join(packageRoot, 'electron-builder.yml');
const timeoutMs = Number.parseInt(
	process.env.RUNA_DESKTOP_DISTRIBUTION_SMOKE_TIMEOUT_MS ?? '90000',
	10,
);
const sentinelAccessToken =
	'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJydW5hLWRpc3RyaWJ1dGlvbi1zbW9rZSJ9.signature-secret';
const sentinelRefreshToken = 'distribution-refresh-secret';
const sentinelQueryToken = 'distribution-query-secret';

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message) {
	throw new Error(message);
}

async function safeRmTempDirectory(directoryPath) {
	const resolvedPath = path.resolve(directoryPath);
	const resolvedTemp = path.resolve(os.tmpdir());

	if (!resolvedPath.startsWith(resolvedTemp + path.sep)) {
		fail(`Refusing to remove non-temp directory: ${resolvedPath}`);
	}

	await rm(resolvedPath, { force: true, recursive: true });
}

async function readTextFileIfExists(filePath) {
	try {
		return await readFile(filePath, 'utf8');
	} catch {
		return '';
	}
}

async function findInstallerArtifact() {
	if (!existsSync(releaseRoot)) {
		return null;
	}

	const entries = await readdir(releaseRoot, { withFileTypes: true });
	const installer = entries.find((entry) => {
		if (!entry.isFile()) {
			return false;
		}

		const name = entry.name.toLowerCase();
		return name.endsWith('.exe') && !name.includes('unpacked');
	});

	return installer ? path.join(releaseRoot, installer.name) : null;
}

async function readDistributionMetadata() {
	const config = await readFile(electronBuilderConfigPath, 'utf8');
	const installerArtifactPath = await findInstallerArtifact();
	const appIdPresent = /^appId:\s*\S+/mu.test(config);
	const productNamePresent = /^productName:\s*"?Runa Desktop"?/mu.test(config);
	const asarEnabled = /^asar:\s*true\s*$/mu.test(config);
	const fuseHookPresent = /^afterPack:\s*\.\/scripts\/apply-fuses\.mjs\s*$/mu.test(config);
	const protocolPresent = /protocols:\s*[\s\S]*schemes:\s*[\s\S]*-\s*runa/mu.test(config);
	const shortcutMetadataPresent =
		/createDesktopShortcut:\s*true/mu.test(config) &&
		/createStartMenuShortcut:\s*true/mu.test(config);
	const publishConfigured = /^publish:\s*$/mu.test(config) || /provider:\s*\S+/mu.test(config);

	return {
		appIdPresent,
		asarEnabled,
		artifactMetadataValid:
			appIdPresent &&
			productNamePresent &&
			asarEnabled &&
			fuseHookPresent &&
			protocolPresent &&
			shortcutMetadataPresent,
		autoUpdateStatus: publishConfigured ? 'configured' : 'disabled_until_release_channel',
		installerArtifactPath,
		productNamePresent,
	};
}

async function verifyElectronFuses() {
	if (!existsSync(unpackedExePath)) {
		return false;
	}

	const fuseWire = await getCurrentFuseWire(unpackedExePath);
	const expected = new Map([
		[FuseV1Options.RunAsNode, 48],
		[FuseV1Options.EnableCookieEncryption, 49],
		[FuseV1Options.EnableNodeOptionsEnvironmentVariable, 48],
		[FuseV1Options.EnableNodeCliInspectArguments, 48],
		[FuseV1Options.EnableEmbeddedAsarIntegrityValidation, 49],
		[FuseV1Options.OnlyLoadAppFromAsar, 49],
		[FuseV1Options.LoadBrowserProcessSpecificV8Snapshot, 48],
		[FuseV1Options.GrantFileProtocolExtraPrivileges, 48],
	]);

	for (const [fuseOption, expectedValue] of expected.entries()) {
		if (fuseWire[fuseOption] !== expectedValue) {
			return false;
		}
	}

	return true;
}

async function readCodeSigningStatus() {
	if (process.platform !== 'win32' || !existsSync(unpackedExePath)) {
		return 'unsigned_blocker';
	}

	const encodedPath = unpackedExePath.replaceAll("'", "''");
	const powershellCommand = [
		'$signature = Get-AuthenticodeSignature -LiteralPath',
		`'${encodedPath}';`,
		'$signature | Select-Object Status,StatusMessage | ConvertTo-Json -Compress',
	].join(' ');

	const child = spawn('powershell.exe', ['-NoProfile', '-Command', powershellCommand], {
		cwd: packageRoot,
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: true,
	});

	const { stdout } = await waitForExit(child, 15000);

	try {
		const payload = JSON.parse(stdout.trim());
		const status = String(payload.Status ?? '').toLowerCase();
		return status === 'valid' || status === '0' ? 'signed' : 'unsigned_blocker';
	} catch {
		return 'unsigned_blocker';
	}
}

function createRunState(label) {
	return {
		cleanShutdown: false,
		fallbackRendered: false,
		logText: '',
		ready: false,
		stderr: '',
		stdout: '',
		userDataDirectory: '',
		label,
	};
}

function waitForExit(child, waitMs = timeoutMs) {
	return new Promise((resolve, reject) => {
		let stdout = '';
		let stderr = '';
		const timeout = setTimeout(() => {
			reject(new Error(`Process timed out after ${waitMs}ms`));
		}, waitMs);

		child.stdout?.on('data', (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr?.on('data', (chunk) => {
			stderr += chunk.toString();
		});
		child.once('error', (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		child.once('exit', (code, signal) => {
			clearTimeout(timeout);
			resolve({ code, signal, stderr, stdout });
		});
	});
}

async function runPackagedAppScenario(label, envPatch) {
	const state = createRunState(label);
	const tempRoot = await mkdtemp(path.join(os.tmpdir(), `runa-distribution-${label}-`));
	state.userDataDirectory = tempRoot;
	const shutdownFilePath = path.join(tempRoot, `shutdown-${randomUUID()}.flag`);
	const env = {
		...process.env,
		ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
		RUNA_DESKTOP_AGENT_SMOKE_SHUTDOWN_FILE: shutdownFilePath,
		RUNA_DESKTOP_AGENT_USER_DATA_DIR: tempRoot,
		...envPatch,
	};

	const child = spawn(unpackedExePath, ['--no-sandbox'], {
		cwd: unpackedRoot,
		env,
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

	const readyDeadline = Date.now() + timeoutMs;
	while (Date.now() < readyDeadline) {
		if (
			stdout.includes('[boot:window:ready-to-show]') ||
			stdout.includes('[boot:window:fallback-renderer-selected]') ||
			stdout.includes('[boot:window:did-finish-load]')
		) {
			state.ready = true;
			break;
		}

		if (child.exitCode !== null) {
			break;
		}

		await delay(250);
	}

	await writeFile(shutdownFilePath, 'shutdown', 'utf8');
	const exitResult = await waitForExit(child, 15000).catch(async (error) => {
		child.kill('SIGTERM');
		await delay(1000);
		throw error;
	});

	state.stdout = stdout + exitResult.stdout;
	state.stderr = stderr + exitResult.stderr;
	state.cleanShutdown = exitResult.code === 0;
	state.fallbackRendered =
		state.stdout.includes('[boot:window:fallback-renderer-selected]') ||
		state.stdout.includes('[boot:window:ready-to-show]');
	state.logText = await readTextFileIfExists(path.join(tempRoot, 'logs', 'main.log'));

	await safeRmTempDirectory(tempRoot);
	return state;
}

function textContainsSentinel(text) {
	return (
		text.includes(sentinelAccessToken) ||
		text.includes(sentinelRefreshToken) ||
		text.includes(sentinelQueryToken) ||
		text.includes('Bearer distribution-bearer-secret')
	);
}

function summarizeSecretSafety(states) {
	const combinedLogs = states
		.map((state) => `${state.stdout}\n${state.stderr}\n${state.logText}`)
		.join('\n');
	const tokensNotInLogs = !textContainsSentinel(combinedLogs);

	return {
		diagnosticsRedacted: tokensNotInLogs,
		logsRedacted: tokensNotInLogs,
		tokensNotInLogs,
	};
}

function parsePackagedSmokeSummary(output) {
	const line = output
		.split(/\r?\n/u)
		.find((candidate) => candidate.startsWith('DESKTOP_PACKAGED_RUNTIME_SMOKE_SUMMARY '));

	if (!line) {
		return null;
	}

	try {
		return JSON.parse(line.slice('DESKTOP_PACKAGED_RUNTIME_SMOKE_SUMMARY '.length));
	} catch {
		return null;
	}
}

async function runPackagedSmokeProof() {
	if (process.env.RUNA_DESKTOP_DISTRIBUTION_SKIP_PACKAGED_SMOKE === '1') {
		return false;
	}

	const child = spawn(process.execPath, ['scripts/packaged-runtime-smoke.mjs'], {
		cwd: packageRoot,
		env: process.env,
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: true,
	});
	const result = await waitForExit(child, 180000);
	const output = `${result.stdout}\n${result.stderr}`;
	process.stdout.write(result.stdout);
	process.stderr.write(result.stderr);
	const summary = parsePackagedSmokeSummary(output);

	return (
		result.code === 0 &&
		summary?.screenshot_succeeded === true &&
		summary?.approval_resolve_sent === true &&
		summary?.final_message_type === 'run.finished' &&
		summary?.run_status === 'completed'
	);
}

async function main() {
	const metadata = await readDistributionMetadata();
	const installerArtifactExists = Boolean(metadata.installerArtifactPath);
	const unpackedExeExists = existsSync(unpackedExePath);
	const asarEnabled =
		metadata.asarEnabled && existsSync(path.join(unpackedRoot, 'resources', 'app.asar'));
	const electronFusesVerified = await verifyElectronFuses();
	const codeSigningStatus = await readCodeSigningStatus();

	const missingConfigRun = await runPackagedAppScenario('missing-config', {
		RUNA_DESKTOP_DISABLE_WEB_FALLBACK: '1',
		RUNA_DESKTOP_WEB_URL: '',
		RUNA_WEB_URL: '',
		RUNA_DESKTOP_AGENT_SERVER_URL: '',
	});
	const invalidWebUrlRun = await runPackagedAppScenario('invalid-web-url', {
		RUNA_DESKTOP_AGENT_SERVER_URL: 'http://127.0.0.1:9',
		RUNA_DESKTOP_DISABLE_WEB_FALLBACK: '1',
		RUNA_DESKTOP_WEB_URL: 'runa://invalid',
	});
	const unreachableRun = await runPackagedAppScenario('server-unreachable', {
		RUNA_DESKTOP_AGENT_ACCESS_TOKEN: sentinelAccessToken,
		RUNA_DESKTOP_AGENT_REFRESH_TOKEN: sentinelRefreshToken,
		RUNA_DESKTOP_AGENT_SERVER_URL: 'http://127.0.0.1:9',
		RUNA_DESKTOP_WEB_URL: `http://127.0.0.1:9/chat?access_token=${sentinelQueryToken}`,
		RUNA_WEB_URL: `http://127.0.0.1:9/chat?refresh_token=${sentinelRefreshToken}`,
	});
	const runStates = [missingConfigRun, invalidWebUrlRun, unreachableRun];
	const secretSafety = summarizeSecretSafety(runStates);
	const smokePackagedStillPasses = await runPackagedSmokeProof();

	const packagedAppStarted = runStates.every((state) => state.ready);
	const packagedAppShutdownClean = runStates.every((state) => state.cleanShutdown);
	const missingWebUrlNoBlankScreen = missingConfigRun.ready && missingConfigRun.fallbackRendered;
	const missingServerUrlNoBlankScreen = missingConfigRun.ready && missingConfigRun.fallbackRendered;
	const invalidWebUrlNoBlankScreen = invalidWebUrlRun.ready && invalidWebUrlRun.fallbackRendered;
	const serverUnreachableNoBlankScreen = unreachableRun.ready && unreachableRun.fallbackRendered;
	const offlineStateRendered =
		missingWebUrlNoBlankScreen &&
		missingServerUrlNoBlankScreen &&
		invalidWebUrlNoBlankScreen &&
		serverUnreachableNoBlankScreen;

	const summary = {
		app_id_present: metadata.appIdPresent,
		asar_enabled: asarEnabled,
		artifact_metadata_valid: metadata.artifactMetadataValid,
		auto_update_status: metadata.autoUpdateStatus,
		code_signing_status: codeSigningStatus,
		diagnostics_redacted: secretSafety.diagnosticsRedacted,
		electron_fuses_verified: electronFusesVerified,
		installer_artifact_exists: installerArtifactExists,
		invalid_web_url_no_blank_screen: invalidWebUrlNoBlankScreen,
		logs_redacted: secretSafety.logsRedacted,
		missing_server_url_no_blank_screen: missingServerUrlNoBlankScreen,
		missing_web_url_no_blank_screen: missingWebUrlNoBlankScreen,
		offline_state_rendered: offlineStateRendered,
		packaged_app_shutdown_clean: packagedAppShutdownClean,
		packaged_app_started: packagedAppStarted,
		product_name_present: metadata.productNamePresent,
		server_unreachable_no_blank_screen: serverUnreachableNoBlankScreen,
		smoke_packaged_still_passes: smokePackagedStillPasses,
		summary_does_not_include_token: false,
		tokens_not_in_logs: secretSafety.tokensNotInLogs,
		unpacked_exe_exists: unpackedExeExists,
	};
	summary.summary_does_not_include_token = !textContainsSentinel(JSON.stringify(summary));

	const summaryText = JSON.stringify(summary);
	console.log(`DESKTOP_DISTRIBUTION_SMOKE_SUMMARY ${summaryText}`);

	const engineeringPass =
		summary.unpacked_exe_exists &&
		summary.installer_artifact_exists &&
		summary.artifact_metadata_valid &&
		summary.app_id_present &&
		summary.product_name_present &&
		summary.asar_enabled &&
		summary.electron_fuses_verified &&
		summary.packaged_app_started &&
		summary.packaged_app_shutdown_clean &&
		summary.missing_web_url_no_blank_screen &&
		summary.missing_server_url_no_blank_screen &&
		summary.invalid_web_url_no_blank_screen &&
		summary.server_unreachable_no_blank_screen &&
		summary.offline_state_rendered &&
		summary.logs_redacted &&
		summary.tokens_not_in_logs &&
		summary.diagnostics_redacted &&
		summary.summary_does_not_include_token &&
		summary.smoke_packaged_still_passes;

	if (!engineeringPass) {
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(
		`DESKTOP_DISTRIBUTION_SMOKE_FAILED ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
});
