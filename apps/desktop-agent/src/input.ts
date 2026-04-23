import { execFile } from 'node:child_process';

import type { DesktopAgentToolName, ToolArguments } from '@runa/types';

type DesktopClickButton = 'left' | 'middle' | 'right';
type DesktopKeypressModifier = 'alt' | 'ctrl' | 'shift';

interface DesktopClickOutput {
	readonly button: DesktopClickButton;
	readonly click_count: number;
	readonly position: {
		readonly x: number;
		readonly y: number;
	};
}

interface DesktopTypeOutput {
	readonly character_count: number;
	readonly delay_ms: number;
}

interface DesktopKeypressOutput {
	readonly key: string;
	readonly modifiers: readonly DesktopKeypressModifier[];
}

interface DesktopScrollOutput {
	readonly delta_x: number;
	readonly delta_y: number;
}

type DesktopAgentInputOutput =
	| DesktopClickOutput
	| DesktopKeypressOutput
	| DesktopScrollOutput
	| DesktopTypeOutput;

export type DesktopAgentInputExecutionResult =
	| {
			readonly metadata?: Readonly<Record<string, unknown>>;
			readonly output: DesktopAgentInputOutput;
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

interface DesktopAgentInputDependencies {
	readonly execFile: typeof execFile;
	readonly platform: NodeJS.Platform;
}

interface DesktopClickParams {
	readonly button: DesktopClickButton;
	readonly click_count: number;
	readonly x: number;
	readonly y: number;
}

interface DesktopTypeParams {
	readonly delay_ms: number;
	readonly text: string;
	readonly tokens: readonly string[];
}

interface DesktopKeypressParams {
	readonly key: string;
	readonly modifiers: readonly DesktopKeypressModifier[];
	readonly sequence: string;
}

interface DesktopScrollParams {
	readonly delta_x: number;
	readonly delta_y: number;
}

const MAX_EXEC_BUFFER_BYTES = 8_192;
const MAX_CLICK_COUNT = 3;
const MAX_DELAY_MS = 1_000;
const MAX_SCREEN_COORDINATE = 65_535;
const MAX_SCROLL_DELTA = 12_000;
const MAX_TEXT_LENGTH = 2_000;
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
	error_code: Extract<DesktopAgentInputExecutionResult, { readonly status: 'error' }>['error_code'],
	error_message: string,
	details?: Readonly<Record<string, unknown>>,
	retryable?: boolean,
): Extract<DesktopAgentInputExecutionResult, { readonly status: 'error' }> {
	return {
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
	};
}

function createSuccessResult(
	output: DesktopAgentInputOutput,
): Extract<DesktopAgentInputExecutionResult, { readonly status: 'success' }> {
	return {
		output,
		status: 'success',
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isFiniteInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
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

function runPowerShell(dependencies: DesktopAgentInputDependencies, script: string): Promise<void> {
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

function createUnsupportedPlatformError(toolName: DesktopAgentToolName, platform: NodeJS.Platform) {
	return createErrorResult(
		'EXECUTION_FAILED',
		`${toolName} is currently supported only on Windows hosts.`,
		{
			platform,
			reason: 'unsupported_platform',
		},
		false,
	);
}

function validateDesktopClickArguments(
	argumentsValue: ToolArguments,
): DesktopClickParams | Extract<DesktopAgentInputExecutionResult, { readonly status: 'error' }> {
	const allowedKeys = new Set(['button', 'click_count', 'x', 'y']);

	for (const key of Object.keys(argumentsValue)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				'INVALID_INPUT',
				`desktop.click does not accept the "${key}" argument.`,
				{
					argument: key,
					reason: 'unexpected_argument',
				},
				false,
			);
		}
	}

	const { button = 'left', click_count = 1, x, y } = argumentsValue;

	if (!isFiniteInteger(x) || x < 0 || x > MAX_SCREEN_COORDINATE) {
		return createErrorResult(
			'INVALID_INPUT',
			'desktop.click requires an integer x coordinate between 0 and 65535.',
			{
				argument: 'x',
				reason: 'invalid_coordinate',
			},
			false,
		);
	}

	if (!isFiniteInteger(y) || y < 0 || y > MAX_SCREEN_COORDINATE) {
		return createErrorResult(
			'INVALID_INPUT',
			'desktop.click requires an integer y coordinate between 0 and 65535.',
			{
				argument: 'y',
				reason: 'invalid_coordinate',
			},
			false,
		);
	}

	if (button !== 'left' && button !== 'middle' && button !== 'right') {
		return createErrorResult(
			'INVALID_INPUT',
			'desktop.click button must be one of: left, right, middle.',
			{
				argument: 'button',
				reason: 'invalid_button',
			},
			false,
		);
	}

	if (!isFiniteInteger(click_count) || click_count < 1 || click_count > MAX_CLICK_COUNT) {
		return createErrorResult(
			'INVALID_INPUT',
			'desktop.click click_count must be an integer between 1 and 3.',
			{
				argument: 'click_count',
				reason: 'invalid_click_count',
			},
			false,
		);
	}

	return {
		button,
		click_count,
		x,
		y,
	};
}

function buildDesktopClickScript(input: DesktopClickParams): string {
	const flagMap: Record<DesktopClickButton, { down: string; up: string }> = {
		left: {
			down: '0x0002',
			up: '0x0004',
		},
		middle: {
			down: '0x0020',
			up: '0x0040',
		},
		right: {
			down: '0x0008',
			up: '0x0010',
		},
	};
	const flags = flagMap[input.button];

	return [
		'Add-Type @"',
		'using System;',
		'using System.Runtime.InteropServices;',
		'public static class DesktopClickNative {',
		'\t[DllImport("user32.dll", SetLastError = true)]',
		'\tpublic static extern bool SetCursorPos(int x, int y);',
		'\t[DllImport("user32.dll", SetLastError = true)]',
		'\tpublic static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);',
		'}',
		'"@',
		`if (-not [DesktopClickNative]::SetCursorPos(${String(input.x)}, ${String(input.y)})) { throw "Failed to move pointer." }`,
		`for ($i = 0; $i -lt ${String(input.click_count)}; $i++) {`,
		`\t[DesktopClickNative]::mouse_event(${flags.down}, 0, 0, 0, [UIntPtr]::Zero)`,
		'\tStart-Sleep -Milliseconds 40',
		`\t[DesktopClickNative]::mouse_event(${flags.up}, 0, 0, 0, [UIntPtr]::Zero)`,
		`\tif ($i -lt (${String(input.click_count)} - 1)) { Start-Sleep -Milliseconds 50 }`,
		'}',
	].join('\n');
}

function toDesktopClickErrorResult(error: unknown) {
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
			'Permission denied while injecting desktop click input.',
			{
				reason: 'desktop_click_permission_denied',
			},
			false,
		);
	}

	if (error instanceof Error) {
		return createErrorResult(
			'EXECUTION_FAILED',
			`Failed to execute desktop click: ${stderr || error.message}`,
			{
				reason: 'desktop_click_failed',
			},
			false,
		);
	}

	return createErrorResult(
		'UNKNOWN',
		'Failed to execute desktop click.',
		{
			reason: 'desktop_click_unknown_failure',
		},
		false,
	);
}

async function executeDesktopClick(
	dependencies: DesktopAgentInputDependencies,
	argumentsValue: ToolArguments,
): Promise<DesktopAgentInputExecutionResult> {
	const validatedArguments = validateDesktopClickArguments(argumentsValue);

	if ('status' in validatedArguments) {
		return validatedArguments;
	}

	if (dependencies.platform !== 'win32') {
		return createUnsupportedPlatformError('desktop.click', dependencies.platform);
	}

	try {
		await runPowerShell(dependencies, buildDesktopClickScript(validatedArguments));

		return createSuccessResult({
			button: validatedArguments.button,
			click_count: validatedArguments.click_count,
			position: {
				x: validatedArguments.x,
				y: validatedArguments.y,
			},
		});
	} catch (error: unknown) {
		return toDesktopClickErrorResult(error);
	}
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

function validateDesktopTypeArguments(
	argumentsValue: ToolArguments,
): DesktopTypeParams | Extract<DesktopAgentInputExecutionResult, { readonly status: 'error' }> {
	const allowedKeys = new Set(['delay_ms', 'text']);

	for (const key of Object.keys(argumentsValue)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
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

	const { delay_ms = 0, text } = argumentsValue;

	if (typeof text !== 'string' || text.length === 0 || text.length > MAX_TEXT_LENGTH) {
		return createErrorResult(
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

	return {
		delay_ms,
		text: normalizedText,
		tokens: Array.from(normalizedText, (character) => toSendKeysToken(character)),
	};
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

function toDesktopTypeErrorResult(error: unknown) {
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
			'Permission denied while injecting desktop typing input.',
			{
				reason: 'desktop_type_permission_denied',
			},
			false,
		);
	}

	if (error instanceof Error) {
		return createErrorResult(
			'EXECUTION_FAILED',
			`Failed to execute desktop typing: ${stderr || error.message}`,
			{
				reason: 'desktop_type_failed',
			},
			false,
		);
	}

	return createErrorResult(
		'UNKNOWN',
		'Failed to execute desktop typing.',
		{
			reason: 'desktop_type_unknown_failure',
		},
		false,
	);
}

async function executeDesktopType(
	dependencies: DesktopAgentInputDependencies,
	argumentsValue: ToolArguments,
): Promise<DesktopAgentInputExecutionResult> {
	const validatedArguments = validateDesktopTypeArguments(argumentsValue);

	if ('status' in validatedArguments) {
		return validatedArguments;
	}

	if (dependencies.platform !== 'win32') {
		return createUnsupportedPlatformError('desktop.type', dependencies.platform);
	}

	try {
		await runPowerShell(dependencies, buildDesktopTypeScript(validatedArguments));

		return createSuccessResult({
			character_count: validatedArguments.text.length,
			delay_ms: validatedArguments.delay_ms,
		});
	} catch (error: unknown) {
		return toDesktopTypeErrorResult(error);
	}
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
	argumentsValue: ToolArguments,
): DesktopKeypressParams | Extract<DesktopAgentInputExecutionResult, { readonly status: 'error' }> {
	const allowedKeys = new Set(['key', 'modifiers']);

	for (const key of Object.keys(argumentsValue)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
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

	const { key, modifiers = [] } = argumentsValue;

	if (typeof key !== 'string' || key.trim().length === 0) {
		return createErrorResult(
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

function buildDesktopKeypressScript(input: DesktopKeypressParams): string {
	return [
		'Add-Type -AssemblyName System.Windows.Forms',
		`[System.Windows.Forms.SendKeys]::SendWait(${toPowerShellSingleQuoted(input.sequence)})`,
	].join('\n');
}

function toDesktopKeypressErrorResult(error: unknown) {
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
			'Permission denied while injecting desktop keypress input.',
			{
				reason: 'desktop_keypress_permission_denied',
			},
			false,
		);
	}

	if (error instanceof Error) {
		return createErrorResult(
			'EXECUTION_FAILED',
			`Failed to execute desktop keypress: ${stderr || error.message}`,
			{
				reason: 'desktop_keypress_failed',
			},
			false,
		);
	}

	return createErrorResult(
		'UNKNOWN',
		'Failed to execute desktop keypress.',
		{
			reason: 'desktop_keypress_unknown_failure',
		},
		false,
	);
}

async function executeDesktopKeypress(
	dependencies: DesktopAgentInputDependencies,
	argumentsValue: ToolArguments,
): Promise<DesktopAgentInputExecutionResult> {
	const validatedArguments = validateDesktopKeypressArguments(argumentsValue);

	if ('status' in validatedArguments) {
		return validatedArguments;
	}

	if (dependencies.platform !== 'win32') {
		return createUnsupportedPlatformError('desktop.keypress', dependencies.platform);
	}

	try {
		await runPowerShell(dependencies, buildDesktopKeypressScript(validatedArguments));

		return createSuccessResult({
			key: validatedArguments.key,
			modifiers: validatedArguments.modifiers,
		});
	} catch (error: unknown) {
		return toDesktopKeypressErrorResult(error);
	}
}

function validateDesktopScrollArguments(
	argumentsValue: ToolArguments,
): DesktopScrollParams | Extract<DesktopAgentInputExecutionResult, { readonly status: 'error' }> {
	const allowedKeys = new Set(['delta_x', 'delta_y']);

	for (const key of Object.keys(argumentsValue)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				'INVALID_INPUT',
				`desktop.scroll does not accept the "${key}" argument.`,
				{
					argument: key,
					reason: 'unexpected_argument',
				},
				false,
			);
		}
	}

	const { delta_x = 0, delta_y = 0 } = argumentsValue;

	if (!isFiniteInteger(delta_x) || Math.abs(delta_x) > MAX_SCROLL_DELTA) {
		return createErrorResult(
			'INVALID_INPUT',
			'desktop.scroll delta_x must be an integer between -12000 and 12000.',
			{
				argument: 'delta_x',
				reason: 'invalid_delta',
			},
			false,
		);
	}

	if (!isFiniteInteger(delta_y) || Math.abs(delta_y) > MAX_SCROLL_DELTA) {
		return createErrorResult(
			'INVALID_INPUT',
			'desktop.scroll delta_y must be an integer between -12000 and 12000.',
			{
				argument: 'delta_y',
				reason: 'invalid_delta',
			},
			false,
		);
	}

	if (delta_x === 0 && delta_y === 0) {
		return createErrorResult(
			'INVALID_INPUT',
			'desktop.scroll requires at least one non-zero delta.',
			{
				reason: 'zero_scroll_delta',
			},
			false,
		);
	}

	return {
		delta_x,
		delta_y,
	};
}

function buildDesktopScrollScript(input: DesktopScrollParams): string {
	return [
		'Add-Type @"',
		'using System;',
		'using System.Runtime.InteropServices;',
		'public static class DesktopScrollNative {',
		'\t[DllImport("user32.dll", SetLastError = true)]',
		'\tpublic static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);',
		'}',
		'"@',
		`if (${String(input.delta_y)} -ne 0) { [DesktopScrollNative]::mouse_event(0x0800, 0, 0, [uint32]${String(input.delta_y)}, [UIntPtr]::Zero) }`,
		`if (${String(input.delta_x)} -ne 0) { [DesktopScrollNative]::mouse_event(0x01000, 0, 0, [uint32]${String(input.delta_x)}, [UIntPtr]::Zero) }`,
	].join('\n');
}

function toDesktopScrollErrorResult(error: unknown) {
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
			'Permission denied while injecting desktop scroll input.',
			{
				reason: 'desktop_scroll_permission_denied',
			},
			false,
		);
	}

	if (error instanceof Error) {
		return createErrorResult(
			'EXECUTION_FAILED',
			`Failed to execute desktop scroll: ${stderr || error.message}`,
			{
				reason: 'desktop_scroll_failed',
			},
			false,
		);
	}

	return createErrorResult(
		'UNKNOWN',
		'Failed to execute desktop scroll.',
		{
			reason: 'desktop_scroll_unknown_failure',
		},
		false,
	);
}

async function executeDesktopScroll(
	dependencies: DesktopAgentInputDependencies,
	argumentsValue: ToolArguments,
): Promise<DesktopAgentInputExecutionResult> {
	const validatedArguments = validateDesktopScrollArguments(argumentsValue);

	if ('status' in validatedArguments) {
		return validatedArguments;
	}

	if (dependencies.platform !== 'win32') {
		return createUnsupportedPlatformError('desktop.scroll', dependencies.platform);
	}

	try {
		await runPowerShell(dependencies, buildDesktopScrollScript(validatedArguments));

		return createSuccessResult({
			delta_x: validatedArguments.delta_x,
			delta_y: validatedArguments.delta_y,
		});
	} catch (error: unknown) {
		return toDesktopScrollErrorResult(error);
	}
}

export async function executeDesktopAgentInput(
	toolName: DesktopAgentToolName,
	argumentsValue: ToolArguments,
	dependencies: Partial<DesktopAgentInputDependencies> = {},
): Promise<DesktopAgentInputExecutionResult> {
	const resolvedDependencies: DesktopAgentInputDependencies = {
		execFile: dependencies.execFile ?? execFile,
		platform: dependencies.platform ?? process.platform,
	};

	switch (toolName) {
		case 'desktop.click':
			return await executeDesktopClick(resolvedDependencies, argumentsValue);
		case 'desktop.type':
			return await executeDesktopType(resolvedDependencies, argumentsValue);
		case 'desktop.keypress':
			return await executeDesktopKeypress(resolvedDependencies, argumentsValue);
		case 'desktop.scroll':
			return await executeDesktopScroll(resolvedDependencies, argumentsValue);
		default:
			return createErrorResult(
				'INVALID_INPUT',
				`Desktop agent has not implemented ${toolName} yet.`,
				{
					reason: 'unsupported_capability',
				},
				false,
			);
	}
}
