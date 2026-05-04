import { execFile } from 'node:child_process';

import type { ToolArguments } from '@runa/types';

const MAX_EXEC_BUFFER_BYTES = 8_192;
const LAUNCH_WHITELIST = [
	'calc',
	'chrome',
	'code',
	'edge',
	'explorer',
	'firefox',
	'notepad',
] as const;

type LaunchAppName = (typeof LAUNCH_WHITELIST)[number];

export interface DesktopAgentLaunchOutput {
	readonly launched: boolean;
	readonly pid?: number;
	readonly process_name: string;
}

export type DesktopAgentLaunchExecutionResult =
	| {
			readonly output: DesktopAgentLaunchOutput;
			readonly status: 'success';
	  }
	| {
			readonly details?: Readonly<Record<string, unknown>>;
			readonly error_code:
				| 'EXECUTION_FAILED'
				| 'INVALID_INPUT'
				| 'NOT_FOUND'
				| 'PERMISSION_DENIED'
				| 'TIMEOUT'
				| 'UNKNOWN';
			readonly error_message: string;
			readonly retryable?: boolean;
			readonly status: 'error';
	  };

interface DesktopAgentLaunchDependencies {
	readonly execFile: ExecFileLike;
	readonly platform: NodeJS.Platform;
}

type ExecFileCallback = (
	error: NodeJS.ErrnoException | null,
	stdout: string | Buffer,
	stderr: string | Buffer,
) => void;

type ExecFileLike = (
	file: string,
	args: readonly string[],
	options: Readonly<{
		encoding: 'utf8';
		env: NodeJS.ProcessEnv;
		maxBuffer: number;
		windowsHide: boolean;
	}>,
	callback: ExecFileCallback,
) => void;

function buildSafeEnvironment(): NodeJS.ProcessEnv {
	const allowedKeys = [
		'COMSPEC',
		'HOME',
		'LANG',
		'LC_ALL',
		'PATH',
		'PATHEXT',
		'PSModulePath',
		'SYSTEMROOT',
		'TEMP',
		'TMP',
		'USERPROFILE',
		'WINDIR',
	] as const;
	const safeEnvironment: NodeJS.ProcessEnv = {};

	for (const key of allowedKeys) {
		const value = process.env[key];

		if (value !== undefined) {
			safeEnvironment[key] = value;
		}
	}

	return safeEnvironment;
}

function createErrorResult(
	error_code: Extract<
		DesktopAgentLaunchExecutionResult,
		{ readonly status: 'error' }
	>['error_code'],
	error_message: string,
	details?: Readonly<Record<string, unknown>>,
	retryable?: boolean,
): Extract<DesktopAgentLaunchExecutionResult, { readonly status: 'error' }> {
	return {
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function extractErrorCode(error: unknown): string | number | undefined {
	if (!isRecord(error)) {
		return undefined;
	}

	const candidate = error as { readonly code?: unknown };

	return typeof candidate.code === 'number' || typeof candidate.code === 'string'
		? candidate.code
		: undefined;
}

function toText(value: unknown): string {
	if (typeof value === 'string') {
		return value;
	}

	if (Buffer.isBuffer(value)) {
		return value.toString('utf8');
	}

	return '';
}

function extractStderr(error: unknown): string {
	if (!isRecord(error)) {
		return '';
	}

	const candidate = error as { readonly stderr?: unknown };

	return toText(candidate.stderr);
}

function isLaunchAppName(value: string): value is LaunchAppName {
	return LAUNCH_WHITELIST.includes(value as LaunchAppName);
}

function normalizeAppName(value: string): string {
	return value.trim().toLowerCase();
}

function toPowerShellSingleQuoted(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

function validateLaunchArguments(
	argumentsValue: ToolArguments,
): Extract<DesktopAgentLaunchExecutionResult, { readonly status: 'error' }> | LaunchAppName {
	const allowedKeys = new Set(['app_name']);

	for (const key of Object.keys(argumentsValue)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				'INVALID_INPUT',
				`desktop.launch does not accept the "${key}" argument.`,
				{
					argument: key,
					reason: 'unexpected_argument',
				},
				false,
			);
		}
	}

	const { app_name: appName } = argumentsValue;

	if (typeof appName !== 'string' || appName.trim().length === 0) {
		return createErrorResult(
			'INVALID_INPUT',
			'desktop.launch requires an app_name string.',
			{
				argument: 'app_name',
				reason: 'invalid_app_name',
			},
			false,
		);
	}

	const normalizedAppName = normalizeAppName(appName);

	if (!isLaunchAppName(normalizedAppName)) {
		return createErrorResult(
			'PERMISSION_DENIED',
			`desktop.launch does not allow launching "${normalizedAppName}".`,
			{
				allowed_apps: LAUNCH_WHITELIST,
				app_name: normalizedAppName,
				reason: 'app_not_whitelisted',
			},
			false,
		);
	}

	return normalizedAppName;
}

function resolveExecutableName(appName: LaunchAppName): string {
	const executableMap: Readonly<Record<LaunchAppName, string>> = {
		calc: 'calc.exe',
		chrome: 'chrome.exe',
		code: 'code.cmd',
		edge: 'msedge.exe',
		explorer: 'explorer.exe',
		firefox: 'firefox.exe',
		notepad: 'notepad.exe',
	};

	return executableMap[appName];
}

function buildLaunchScript(appName: LaunchAppName): string {
	const executableName = resolveExecutableName(appName);

	return [
		`$process = Start-Process -FilePath ${toPowerShellSingleQuoted(executableName)} -PassThru`,
		'[Console]::Out.Write(($process.Id).ToString())',
	].join('\n');
}

function runPowerShell(
	dependencies: DesktopAgentLaunchDependencies,
	script: string,
): Promise<string> {
	return new Promise((resolvePromise, rejectPromise) => {
		dependencies.execFile(
			'powershell.exe',
			['-NoProfile', '-NonInteractive', '-Command', script],
			{
				encoding: 'utf8',
				env: buildSafeEnvironment(),
				maxBuffer: MAX_EXEC_BUFFER_BYTES,
				windowsHide: true,
			},
			(error, stdout, stderr) => {
				if (error) {
					const enrichedError = error as NodeJS.ErrnoException & {
						stderr?: string | Buffer;
						stdout?: string | Buffer;
					};
					enrichedError.stdout = stdout;
					enrichedError.stderr = stderr;
					rejectPromise(enrichedError);
					return;
				}

				resolvePromise(toText(stdout));
			},
		);
	});
}

function toLaunchErrorResult(
	appName: LaunchAppName,
	error: unknown,
): Extract<DesktopAgentLaunchExecutionResult, { readonly status: 'error' }> {
	const errorCode = extractErrorCode(error);
	const stderr = extractStderr(error).trim();

	if (errorCode === 'ENOENT') {
		return createErrorResult(
			'NOT_FOUND',
			'PowerShell is not available on this host.',
			{
				reason: 'powershell_not_found',
			},
			false,
		);
	}

	if (
		errorCode === 'EACCES' ||
		errorCode === 'EPERM' ||
		stderr.includes('Access is denied') ||
		stderr.includes('This command cannot be run')
	) {
		return createErrorResult(
			'PERMISSION_DENIED',
			`Permission denied while launching ${appName}.`,
			{
				app_name: appName,
				reason: 'desktop_launch_permission_denied',
			},
			false,
		);
	}

	if (stderr.includes('cannot find') || stderr.includes('The system cannot find')) {
		return createErrorResult(
			'NOT_FOUND',
			`Whitelisted app "${appName}" was not found on this host.`,
			{
				app_name: appName,
				executable: resolveExecutableName(appName),
				reason: 'desktop_launch_app_not_found',
			},
			false,
		);
	}

	if (error instanceof Error) {
		return createErrorResult(
			'EXECUTION_FAILED',
			`Failed to launch ${appName}: ${stderr || error.message}`,
			{
				app_name: appName,
				reason: 'desktop_launch_failed',
			},
			false,
		);
	}

	return createErrorResult(
		'UNKNOWN',
		`Failed to launch ${appName}.`,
		{
			app_name: appName,
			reason: 'desktop_launch_unknown_failure',
		},
		false,
	);
}

function createUnsupportedPlatformError(platform: NodeJS.Platform) {
	return createErrorResult(
		'EXECUTION_FAILED',
		'Desktop app launch bridge is currently supported only on Windows hosts.',
		{
			platform,
			reason: 'unsupported_platform',
		},
		false,
	);
}

export async function executeDesktopAgentLaunch(
	argumentsValue: ToolArguments,
	dependencies: Partial<DesktopAgentLaunchDependencies> = {},
): Promise<DesktopAgentLaunchExecutionResult> {
	const appName = validateLaunchArguments(argumentsValue);

	if (typeof appName !== 'string') {
		return appName;
	}

	const resolvedDependencies: DesktopAgentLaunchDependencies = {
		execFile: dependencies.execFile ?? (execFile as ExecFileLike),
		platform: dependencies.platform ?? process.platform,
	};

	if (resolvedDependencies.platform !== 'win32') {
		return createUnsupportedPlatformError(resolvedDependencies.platform);
	}

	try {
		const pidText = await runPowerShell(resolvedDependencies, buildLaunchScript(appName));
		const parsedPid = Number.parseInt(pidText.trim(), 10);

		return {
			output: {
				launched: true,
				...(Number.isInteger(parsedPid) && parsedPid > 0 ? { pid: parsedPid } : {}),
				process_name: appName,
			},
			status: 'success',
		};
	} catch (error: unknown) {
		return toLaunchErrorResult(appName, error);
	}
}
