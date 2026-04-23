import { execFile } from 'node:child_process';

import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

export type DesktopTypeArguments = ToolArguments & {
	readonly delay_ms?: number;
	readonly text?: string;
};

export interface DesktopTypeSuccessData {
	readonly character_count: number;
	readonly delay_ms: number;
}

export type DesktopTypeInput = ToolCallInput<'desktop.type', DesktopTypeArguments>;

export type DesktopTypeSuccessResult = ToolResultSuccess<'desktop.type', DesktopTypeSuccessData>;

export type DesktopTypeErrorResult = ToolResultError<'desktop.type'>;

export type DesktopTypeResult = ToolResult<'desktop.type', DesktopTypeSuccessData>;

interface DesktopTypeDependencies {
	readonly execFile: typeof execFile;
	readonly platform: NodeJS.Platform;
}

interface DesktopTypeParams {
	readonly delay_ms: number;
	readonly text: string;
	readonly tokens: readonly string[];
}

const MAX_EXEC_BUFFER_BYTES = 8_192;
const MAX_TEXT_LENGTH = 2_000;
const MAX_DELAY_MS = 1_000;

function buildSafeEnvironment(): NodeJS.ProcessEnv {
	const allowedKeys = [
		'COMSPEC',
		'HOME',
		'LANG',
		'LC_ALL',
		'PATH',
		'PATHEXT',
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
	input: DesktopTypeInput,
	error_code: DesktopTypeErrorResult['error_code'],
	error_message: string,
	details?: DesktopTypeErrorResult['details'],
	retryable?: boolean,
): DesktopTypeErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'desktop.type',
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isFiniteInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
}

function toSendKeysToken(character: string): string {
	switch (character) {
		case '+':
			return '{+}';
		case '^':
			return '{^}';
		case '%':
			return '{%}';
		case '~':
			return '{~}';
		case '(':
			return '{(}';
		case ')':
			return '{)}';
		case '[':
			return '{[}';
		case ']':
			return '{]}';
		case '{':
			return '{{}';
		case '}':
			return '{}}';
		case '\n':
			return '{ENTER}';
		case '\t':
			return '{TAB}';
		default:
			return character;
	}
}

function toPowerShellSingleQuoted(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

function validateDesktopTypeArguments(
	input: DesktopTypeInput,
): DesktopTypeParams | DesktopTypeErrorResult {
	const allowedKeys = new Set(['delay_ms', 'text']);

	for (const key of Object.keys(input.arguments)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				`desktop.type does not accept the "${key}" argument.`,
				{
					argument: key,
					reason: 'unexpected_argument',
				},
				false,
			);
		}
	}

	const { delay_ms = 0, text } = input.arguments;

	if (typeof text !== 'string' || text.length === 0 || text.length > MAX_TEXT_LENGTH) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'desktop.type requires a non-empty text string up to 2000 characters.',
			{
				argument: 'text',
				reason: 'invalid_text',
			},
			false,
		);
	}

	if (!isFiniteInteger(delay_ms) || delay_ms < 0 || delay_ms > MAX_DELAY_MS) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'desktop.type delay_ms must be an integer between 0 and 1000.',
			{
				argument: 'delay_ms',
				reason: 'invalid_delay',
			},
			false,
		);
	}

	const normalizedText = text.replaceAll('\r\n', '\n');
	const tokens = Array.from(normalizedText, (character) => toSendKeysToken(character));

	return {
		delay_ms,
		text: normalizedText,
		tokens,
	};
}

function extractErrorCode(error: unknown): string | number | undefined {
	if (isRecord(error)) {
		const candidate = error as { readonly code?: unknown };

		if (typeof candidate.code === 'number' || typeof candidate.code === 'string') {
			return candidate.code;
		}
	}

	return undefined;
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
	if (isRecord(error)) {
		const candidate = error as { readonly stderr?: unknown };

		return toText(candidate.stderr);
	}

	return '';
}

function runPowerShell(dependencies: DesktopTypeDependencies, script: string): Promise<void> {
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

				resolvePromise();
			},
		);
	});
}

function buildDesktopTypeScript(input: DesktopTypeParams): string {
	const serializedTokens = input.tokens.map((token) => toPowerShellSingleQuoted(token)).join(', ');

	return [
		'Add-Type -AssemblyName System.Windows.Forms',
		`$tokens = @(${serializedTokens})`,
		`$delayMs = ${String(input.delay_ms)}`,
		'foreach ($token in $tokens) {',
		'\t[System.Windows.Forms.SendKeys]::SendWait($token)',
		'\tif ($delayMs -gt 0) { Start-Sleep -Milliseconds $delayMs }',
		'}',
	].join('\n');
}

function toDesktopTypeErrorResult(input: DesktopTypeInput, error: unknown): DesktopTypeErrorResult {
	const errorCode = extractErrorCode(error);
	const stderr = extractStderr(error).trim();

	if (errorCode === 'ENOENT') {
		return createErrorResult(
			input,
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
			input,
			'PERMISSION_DENIED',
			'Permission denied while injecting desktop typing input.',
			{
				reason: 'desktop_type_permission_denied',
			},
			false,
		);
	}

	if (error instanceof Error) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Failed to execute desktop typing: ${stderr || error.message}`,
			{
				reason: 'desktop_type_failed',
			},
			false,
		);
	}

	return createErrorResult(
		input,
		'UNKNOWN',
		'Failed to execute desktop typing.',
		{
			reason: 'desktop_type_unknown_failure',
		},
		false,
	);
}

export function createDesktopTypeTool(
	dependencies: Partial<DesktopTypeDependencies> = {},
): ToolDefinition<DesktopTypeInput, DesktopTypeResult> {
	const resolvedDependencies: DesktopTypeDependencies = {
		execFile: dependencies.execFile ?? execFile,
		platform: dependencies.platform ?? process.platform,
	};

	return {
		callable_schema: {
			parameters: {
				delay_ms: {
					description: 'Optional per-character delay in milliseconds. Allowed range: 0-1000.',
					type: 'number',
				},
				text: {
					description: 'Text to type into the currently focused desktop surface.',
					required: true,
					type: 'string',
				},
			},
		},
		description:
			'Types text into the currently focused host desktop surface using an approval-gated desktop input path.',
		async execute(input, context): Promise<DesktopTypeResult> {
			const validatedArguments = validateDesktopTypeArguments(input);

			if ('status' in validatedArguments) {
				return validatedArguments;
			}

			if (context.signal?.aborted) {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					'Desktop typing was aborted before execution.',
					{
						reason: 'aborted',
					},
					true,
				);
			}

			if (resolvedDependencies.platform !== 'win32') {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					'desktop.type is currently supported only on Windows hosts.',
					{
						platform: resolvedDependencies.platform,
						reason: 'unsupported_platform',
					},
					false,
				);
			}

			try {
				await runPowerShell(resolvedDependencies, buildDesktopTypeScript(validatedArguments));

				if (context.signal?.aborted) {
					return createErrorResult(
						input,
						'EXECUTION_FAILED',
						'Desktop typing was aborted before completion.',
						{
							reason: 'aborted',
						},
						true,
					);
				}

				return {
					call_id: input.call_id,
					output: {
						character_count: validatedArguments.text.length,
						delay_ms: validatedArguments.delay_ms,
					},
					status: 'success',
					tool_name: 'desktop.type',
				};
			} catch (error: unknown) {
				return toDesktopTypeErrorResult(input, error);
			}
		},
		metadata: {
			capability_class: 'desktop',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'execute',
			tags: ['desktop', 'host', 'input', 'keyboard', 'type'],
		},
		name: 'desktop.type',
	};
}

export const desktopTypeTool = createDesktopTypeTool();
