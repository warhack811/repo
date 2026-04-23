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

type DesktopKeypressModifier = 'alt' | 'ctrl' | 'shift';

export type DesktopKeypressArguments = ToolArguments & {
	readonly key?: string;
	readonly modifiers?: readonly string[];
};

export interface DesktopKeypressSuccessData {
	readonly key: string;
	readonly modifiers: readonly DesktopKeypressModifier[];
}

export type DesktopKeypressInput = ToolCallInput<'desktop.keypress', DesktopKeypressArguments>;

export type DesktopKeypressSuccessResult = ToolResultSuccess<
	'desktop.keypress',
	DesktopKeypressSuccessData
>;

export type DesktopKeypressErrorResult = ToolResultError<'desktop.keypress'>;

export type DesktopKeypressResult = ToolResult<'desktop.keypress', DesktopKeypressSuccessData>;

interface DesktopKeypressDependencies {
	readonly execFile: typeof execFile;
	readonly platform: NodeJS.Platform;
}

interface DesktopKeypressParams {
	readonly key: string;
	readonly modifiers: readonly DesktopKeypressModifier[];
	readonly sequence: string;
}

const MAX_EXEC_BUFFER_BYTES = 8_192;
const ALLOWED_MODIFIERS = new Set<DesktopKeypressModifier>(['alt', 'ctrl', 'shift']);

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
	input: DesktopKeypressInput,
	error_code: DesktopKeypressErrorResult['error_code'],
	error_message: string,
	details?: DesktopKeypressErrorResult['details'],
	retryable?: boolean,
): DesktopKeypressErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'desktop.keypress',
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
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

function toPowerShellSingleQuoted(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

function toSendKeysKeyToken(key: string): string | undefined {
	const normalizedKey = key.trim().toLowerCase();
	const namedKeyMap: Record<string, string> = {
		backspace: '{BACKSPACE}',
		delete: '{DELETE}',
		down: '{DOWN}',
		end: '{END}',
		enter: '{ENTER}',
		esc: '{ESC}',
		escape: '{ESC}',
		f1: '{F1}',
		f2: '{F2}',
		f3: '{F3}',
		f4: '{F4}',
		f5: '{F5}',
		f6: '{F6}',
		f7: '{F7}',
		f8: '{F8}',
		f9: '{F9}',
		f10: '{F10}',
		f11: '{F11}',
		f12: '{F12}',
		home: '{HOME}',
		insert: '{INSERT}',
		left: '{LEFT}',
		pagedown: '{PGDN}',
		pageup: '{PGUP}',
		right: '{RIGHT}',
		space: '{SPACE}',
		tab: '{TAB}',
		up: '{UP}',
	};

	if (namedKeyMap[normalizedKey]) {
		return namedKeyMap[normalizedKey];
	}

	if (/^[a-z0-9]$/u.test(normalizedKey)) {
		return normalizedKey;
	}

	return undefined;
}

function validateDesktopKeypressArguments(
	input: DesktopKeypressInput,
): DesktopKeypressParams | DesktopKeypressErrorResult {
	const allowedKeys = new Set(['key', 'modifiers']);

	for (const key of Object.keys(input.arguments)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				`desktop.keypress does not accept the "${key}" argument.`,
				{
					argument: key,
					reason: 'unexpected_argument',
				},
				false,
			);
		}
	}

	const { key, modifiers = [] } = input.arguments;

	if (typeof key !== 'string' || key.trim().length === 0) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'desktop.keypress requires a non-empty key string.',
			{
				argument: 'key',
				reason: 'invalid_key',
			},
			false,
		);
	}

	if (!Array.isArray(modifiers)) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'desktop.keypress modifiers must be an array when provided.',
			{
				argument: 'modifiers',
				reason: 'invalid_modifiers',
			},
			false,
		);
	}

	const normalizedModifiers: DesktopKeypressModifier[] = [];

	for (const modifier of modifiers) {
		if (typeof modifier !== 'string') {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				'desktop.keypress modifiers must contain only strings.',
				{
					argument: 'modifiers',
					reason: 'invalid_modifier_entry',
				},
				false,
			);
		}

		const normalizedModifier = modifier.trim().toLowerCase() as DesktopKeypressModifier;

		if (!ALLOWED_MODIFIERS.has(normalizedModifier)) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				'desktop.keypress modifiers must be chosen from ctrl, alt, shift.',
				{
					argument: 'modifiers',
					reason: 'unsupported_modifier',
				},
				false,
			);
		}

		if (!normalizedModifiers.includes(normalizedModifier)) {
			normalizedModifiers.push(normalizedModifier);
		}
	}

	const keyToken = toSendKeysKeyToken(key);

	if (!keyToken) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'desktop.keypress key must be a supported named key, letter, or digit.',
			{
				argument: 'key',
				reason: 'unsupported_key',
			},
			false,
		);
	}

	const modifierPrefix = normalizedModifiers
		.map((modifier) => {
			switch (modifier) {
				case 'ctrl':
					return '^';
				case 'alt':
					return '%';
				case 'shift':
					return '+';
			}
		})
		.join('');

	return {
		key: key.trim().toLowerCase(),
		modifiers: normalizedModifiers,
		sequence: `${modifierPrefix}${keyToken}`,
	};
}

function runPowerShell(dependencies: DesktopKeypressDependencies, script: string): Promise<void> {
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

function buildDesktopKeypressScript(input: DesktopKeypressParams): string {
	return [
		'Add-Type -AssemblyName System.Windows.Forms',
		`[System.Windows.Forms.SendKeys]::SendWait(${toPowerShellSingleQuoted(input.sequence)})`,
	].join('\n');
}

function toDesktopKeypressErrorResult(
	input: DesktopKeypressInput,
	error: unknown,
): DesktopKeypressErrorResult {
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
			'Permission denied while injecting desktop keypress input.',
			{
				reason: 'desktop_keypress_permission_denied',
			},
			false,
		);
	}

	if (error instanceof Error) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Failed to execute desktop keypress: ${stderr || error.message}`,
			{
				reason: 'desktop_keypress_failed',
			},
			false,
		);
	}

	return createErrorResult(
		input,
		'UNKNOWN',
		'Failed to execute desktop keypress.',
		{
			reason: 'desktop_keypress_unknown_failure',
		},
		false,
	);
}

export function createDesktopKeypressTool(
	dependencies: Partial<DesktopKeypressDependencies> = {},
): ToolDefinition<DesktopKeypressInput, DesktopKeypressResult> {
	const resolvedDependencies: DesktopKeypressDependencies = {
		execFile: dependencies.execFile ?? execFile,
		platform: dependencies.platform ?? process.platform,
	};

	return {
		callable_schema: {
			parameters: {
				key: {
					description:
						'Key to press. Supports letters, digits, and named keys like enter, tab, escape, arrows, home, end, pageup, pagedown, insert, delete, f1-f12.',
					required: true,
					type: 'string',
				},
				modifiers: {
					description: 'Optional modifier keys. Allowed values: ctrl, alt, shift.',
					items: {
						type: 'string',
					},
					type: 'array',
				},
			},
		},
		description:
			'Sends an approval-gated keyboard shortcut or keypress to the currently focused host desktop surface.',
		async execute(input, context): Promise<DesktopKeypressResult> {
			const validatedArguments = validateDesktopKeypressArguments(input);

			if ('status' in validatedArguments) {
				return validatedArguments;
			}

			if (context.signal?.aborted) {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					'Desktop keypress was aborted before execution.',
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
					'desktop.keypress is currently supported only on Windows hosts.',
					{
						platform: resolvedDependencies.platform,
						reason: 'unsupported_platform',
					},
					false,
				);
			}

			try {
				await runPowerShell(resolvedDependencies, buildDesktopKeypressScript(validatedArguments));

				if (context.signal?.aborted) {
					return createErrorResult(
						input,
						'EXECUTION_FAILED',
						'Desktop keypress was aborted before completion.',
						{
							reason: 'aborted',
						},
						true,
					);
				}

				return {
					call_id: input.call_id,
					output: {
						key: validatedArguments.key,
						modifiers: validatedArguments.modifiers,
					},
					status: 'success',
					tool_name: 'desktop.keypress',
				};
			} catch (error: unknown) {
				return toDesktopKeypressErrorResult(input, error);
			}
		},
		metadata: {
			capability_class: 'desktop',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'execute',
			tags: ['desktop', 'host', 'input', 'keyboard', 'keypress'],
		},
		name: 'desktop.keypress',
	};
}

export const desktopKeypressTool = createDesktopKeypressTool();
