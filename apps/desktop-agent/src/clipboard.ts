import { execFile } from 'node:child_process';

import type { ToolArguments } from '@runa/types';

const MAX_EXEC_BUFFER_BYTES = 32 * 1024;
const MAX_CLIPBOARD_BYTES = 10 * 1024;
const REDACTED_PLACEHOLDER = '[redacted-sensitive-clipboard-content]';

export interface DesktopAgentClipboardReadOutput {
	readonly byte_length: number;
	readonly character_count: number;
	readonly content: string;
	readonly is_redacted: boolean;
	readonly is_truncated: boolean;
}

export interface DesktopAgentClipboardWriteOutput {
	readonly byte_length: number;
	readonly character_count: number;
	readonly written: boolean;
}

export type DesktopAgentClipboardExecutionResult =
	| {
			readonly output: DesktopAgentClipboardReadOutput | DesktopAgentClipboardWriteOutput;
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

interface DesktopAgentClipboardDependencies {
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
		DesktopAgentClipboardExecutionResult,
		{ readonly status: 'error' }
	>['error_code'],
	error_message: string,
	details?: Readonly<Record<string, unknown>>,
	retryable?: boolean,
): Extract<DesktopAgentClipboardExecutionResult, { readonly status: 'error' }> {
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

function toPowerShellSingleQuoted(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

function runPowerShell(
	dependencies: DesktopAgentClipboardDependencies,
	script: string,
): Promise<string> {
	return new Promise((resolvePromise, rejectPromise) => {
		dependencies.execFile(
			'powershell.exe',
			['-NoProfile', '-NonInteractive', '-STA', '-Command', script],
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

function toClipboardErrorResult(
	operation: 'read' | 'write',
	error: unknown,
): Extract<DesktopAgentClipboardExecutionResult, { readonly status: 'error' }> {
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

	if (errorCode === 'EACCES' || errorCode === 'EPERM' || stderr.includes('Access is denied')) {
		return createErrorResult(
			'PERMISSION_DENIED',
			`Permission denied while attempting to ${operation} the desktop clipboard.`,
			{
				reason: `desktop_clipboard_${operation}_permission_denied`,
			},
			false,
		);
	}

	if (error instanceof Error) {
		return createErrorResult(
			'EXECUTION_FAILED',
			`Failed to ${operation} desktop clipboard: ${stderr || error.message}`,
			{
				reason: `desktop_clipboard_${operation}_failed`,
			},
			false,
		);
	}

	return createErrorResult(
		'UNKNOWN',
		`Failed to ${operation} desktop clipboard.`,
		{
			reason: `desktop_clipboard_${operation}_unknown_failure`,
		},
		false,
	);
}

function hasSensitiveClipboardPattern(content: string): boolean {
	const sensitivePatterns = [
		/\b(?:api[_-]?key|secret|token|password|passwd|pwd)\s*[:=]\s*\S+/iu,
		/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/u,
		/\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/u,
		/\b(?:sk|pk|rk|ghp|github_pat)_[A-Za-z0-9_]{12,}\b/u,
	];

	return sensitivePatterns.some((pattern) => pattern.test(content));
}

function normalizeClipboardReadOutput(rawContent: string): DesktopAgentClipboardReadOutput {
	const normalizedContent = rawContent.replace(/\r\n/gu, '\n');
	const byteLength = Buffer.byteLength(normalizedContent, 'utf8');
	const isRedacted = hasSensitiveClipboardPattern(normalizedContent);
	const isTruncated = byteLength > MAX_CLIPBOARD_BYTES;
	let content = isRedacted ? REDACTED_PLACEHOLDER : normalizedContent;

	if (!isRedacted && isTruncated) {
		content = Buffer.from(content, 'utf8').subarray(0, MAX_CLIPBOARD_BYTES).toString('utf8');
	}

	return {
		byte_length: byteLength,
		character_count: normalizedContent.length,
		content,
		is_redacted: isRedacted,
		is_truncated: isTruncated,
	};
}

function validateReadArguments(
	argumentsValue: ToolArguments,
): Extract<DesktopAgentClipboardExecutionResult, { readonly status: 'error' }> | undefined {
	const keys = Object.keys(argumentsValue);

	if (keys.length === 0) {
		return undefined;
	}

	return createErrorResult(
		'INVALID_INPUT',
		'desktop.clipboard.read does not accept any arguments.',
		{
			argument: keys[0],
			reason: 'unexpected_argument',
		},
		false,
	);
}

function validateWriteArguments(
	argumentsValue: ToolArguments,
): Extract<DesktopAgentClipboardExecutionResult, { readonly status: 'error' }> | string {
	const allowedKeys = new Set(['text']);

	for (const key of Object.keys(argumentsValue)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				'INVALID_INPUT',
				`desktop.clipboard.write does not accept the "${key}" argument.`,
				{
					argument: key,
					reason: 'unexpected_argument',
				},
				false,
			);
		}
	}

	const { text } = argumentsValue;

	if (typeof text !== 'string') {
		return createErrorResult(
			'INVALID_INPUT',
			'desktop.clipboard.write requires a text string.',
			{
				argument: 'text',
				reason: 'invalid_text',
			},
			false,
		);
	}

	if (Buffer.byteLength(text, 'utf8') > MAX_CLIPBOARD_BYTES) {
		return createErrorResult(
			'INVALID_INPUT',
			'desktop.clipboard.write text must be 10KB or smaller.',
			{
				argument: 'text',
				max_bytes: MAX_CLIPBOARD_BYTES,
				reason: 'text_too_large',
			},
			false,
		);
	}

	return text;
}

function createUnsupportedPlatformError(platform: NodeJS.Platform) {
	return createErrorResult(
		'EXECUTION_FAILED',
		'Desktop clipboard bridge is currently supported only on Windows hosts.',
		{
			platform,
			reason: 'unsupported_platform',
		},
		false,
	);
}

export async function executeDesktopAgentClipboardRead(
	argumentsValue: ToolArguments,
	dependencies: Partial<DesktopAgentClipboardDependencies> = {},
): Promise<DesktopAgentClipboardExecutionResult> {
	const invalidArguments = validateReadArguments(argumentsValue);

	if (invalidArguments) {
		return invalidArguments;
	}

	const resolvedDependencies: DesktopAgentClipboardDependencies = {
		execFile: dependencies.execFile ?? (execFile as ExecFileLike),
		platform: dependencies.platform ?? process.platform,
	};

	if (resolvedDependencies.platform !== 'win32') {
		return createUnsupportedPlatformError(resolvedDependencies.platform);
	}

	try {
		const rawContent = await runPowerShell(resolvedDependencies, 'Get-Clipboard -Raw -Format Text');

		return {
			output: normalizeClipboardReadOutput(rawContent),
			status: 'success',
		};
	} catch (error: unknown) {
		return toClipboardErrorResult('read', error);
	}
}

export async function executeDesktopAgentClipboardWrite(
	argumentsValue: ToolArguments,
	dependencies: Partial<DesktopAgentClipboardDependencies> = {},
): Promise<DesktopAgentClipboardExecutionResult> {
	const text = validateWriteArguments(argumentsValue);

	if (typeof text !== 'string') {
		return text;
	}

	const resolvedDependencies: DesktopAgentClipboardDependencies = {
		execFile: dependencies.execFile ?? (execFile as ExecFileLike),
		platform: dependencies.platform ?? process.platform,
	};

	if (resolvedDependencies.platform !== 'win32') {
		return createUnsupportedPlatformError(resolvedDependencies.platform);
	}

	try {
		await runPowerShell(
			resolvedDependencies,
			`Set-Clipboard -Value ${toPowerShellSingleQuoted(text)}`,
		);

		return {
			output: {
				byte_length: Buffer.byteLength(text, 'utf8'),
				character_count: text.length,
				written: true,
			},
			status: 'success',
		};
	} catch (error: unknown) {
		return toClipboardErrorResult('write', error);
	}
}
