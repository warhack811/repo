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

type DesktopClickButton = 'left' | 'middle' | 'right';

export type DesktopClickArguments = ToolArguments & {
	readonly button?: DesktopClickButton;
	readonly click_count?: number;
	readonly x?: number;
	readonly y?: number;
};

export interface DesktopClickSuccessData {
	readonly button: DesktopClickButton;
	readonly click_count: number;
	readonly position: {
		readonly x: number;
		readonly y: number;
	};
}

export type DesktopClickInput = ToolCallInput<'desktop.click', DesktopClickArguments>;

export type DesktopClickSuccessResult = ToolResultSuccess<'desktop.click', DesktopClickSuccessData>;

export type DesktopClickErrorResult = ToolResultError<'desktop.click'>;

export type DesktopClickResult = ToolResult<'desktop.click', DesktopClickSuccessData>;

interface DesktopClickDependencies {
	readonly execFile: typeof execFile;
	readonly platform: NodeJS.Platform;
}

interface DesktopClickParams {
	readonly button: DesktopClickButton;
	readonly click_count: number;
	readonly x: number;
	readonly y: number;
}

const MAX_EXEC_BUFFER_BYTES = 8_192;
const MAX_SCREEN_COORDINATE = 65_535;
const MAX_CLICK_COUNT = 3;

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
	input: DesktopClickInput,
	error_code: DesktopClickErrorResult['error_code'],
	error_message: string,
	details?: DesktopClickErrorResult['details'],
	retryable?: boolean,
): DesktopClickErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'desktop.click',
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isFiniteInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
}

function validateDesktopClickArguments(
	input: DesktopClickInput,
): DesktopClickParams | DesktopClickErrorResult {
	const allowedKeys = new Set(['button', 'click_count', 'x', 'y']);

	for (const key of Object.keys(input.arguments)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				input,
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

	const { button = 'left', click_count = 1, x, y } = input.arguments;

	if (!isFiniteInteger(x) || x < 0 || x > MAX_SCREEN_COORDINATE) {
		return createErrorResult(
			input,
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
			input,
			'INVALID_INPUT',
			'desktop.click requires an integer y coordinate between 0 and 65535.',
			{
				argument: 'y',
				reason: 'invalid_coordinate',
			},
			false,
		);
	}

	if (button !== 'left' && button !== 'right' && button !== 'middle') {
		return createErrorResult(
			input,
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
			input,
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

function isDesktopClickSuccessData(value: unknown): value is DesktopClickSuccessData {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as {
		readonly button?: unknown;
		readonly click_count?: unknown;
		readonly position?: unknown;
	};
	const position = candidate.position;

	if (!isRecord(position)) {
		return false;
	}

	const positionCandidate = position as {
		readonly x?: unknown;
		readonly y?: unknown;
	};

	return (
		(candidate.button === 'left' ||
			candidate.button === 'middle' ||
			candidate.button === 'right') &&
		isFiniteInteger(candidate.click_count) &&
		isFiniteInteger(positionCandidate.x) &&
		isFiniteInteger(positionCandidate.y)
	);
}

function runPowerShell(dependencies: DesktopClickDependencies, script: string): Promise<void> {
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

function toDesktopClickErrorResult(
	input: DesktopClickInput,
	error: unknown,
): DesktopClickErrorResult {
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
			'Permission denied while injecting desktop click input.',
			{
				reason: 'desktop_click_permission_denied',
			},
			false,
		);
	}

	if (error instanceof Error) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Failed to execute desktop click: ${stderr || error.message}`,
			{
				reason: 'desktop_click_failed',
			},
			false,
		);
	}

	return createErrorResult(
		input,
		'UNKNOWN',
		'Failed to execute desktop click.',
		{
			reason: 'desktop_click_unknown_failure',
		},
		false,
	);
}

export function createDesktopClickTool(
	dependencies: Partial<DesktopClickDependencies> = {},
): ToolDefinition<DesktopClickInput, DesktopClickResult> {
	const resolvedDependencies: DesktopClickDependencies = {
		execFile: dependencies.execFile ?? execFile,
		platform: dependencies.platform ?? process.platform,
	};

	return {
		callable_schema: {
			parameters: {
				button: {
					description: 'Mouse button to click: left, right, or middle.',
					type: 'string',
				},
				click_count: {
					description: 'Number of clicks to perform. Allowed range: 1-3.',
					type: 'number',
				},
				x: {
					description: 'Absolute horizontal screen coordinate in pixels.',
					required: true,
					type: 'number',
				},
				y: {
					description: 'Absolute vertical screen coordinate in pixels.',
					required: true,
					type: 'number',
				},
			},
		},
		description:
			'Moves the host pointer to a screen coordinate and performs an approval-gated mouse click on the server desktop.',
		async execute(input, context): Promise<DesktopClickResult> {
			const validatedArguments = validateDesktopClickArguments(input);

			if ('status' in validatedArguments) {
				return validatedArguments;
			}

			if (context.signal?.aborted) {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					'Desktop click was aborted before execution.',
					{
						reason: 'aborted',
					},
					true,
				);
			}

			if (context.desktop_bridge) {
				if (!context.desktop_bridge.supports('desktop.click')) {
					return createErrorResult(
						input,
						'EXECUTION_FAILED',
						'Connected desktop agent does not advertise desktop.click support.',
						{
							reason: 'desktop_agent_capability_unavailable',
						},
						false,
					);
				}

				const bridgeResult = await context.desktop_bridge.invoke(input, context);

				if (bridgeResult.status === 'success' && !isDesktopClickSuccessData(bridgeResult.output)) {
					return createErrorResult(
						input,
						'EXECUTION_FAILED',
						'Desktop agent returned an invalid click payload.',
						{
							reason: 'desktop_agent_invalid_result',
						},
						false,
					);
				}

				return bridgeResult as DesktopClickResult;
			}

			if (resolvedDependencies.platform !== 'win32') {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					'desktop.click is currently supported only on Windows hosts.',
					{
						platform: resolvedDependencies.platform,
						reason: 'unsupported_platform',
					},
					false,
				);
			}

			try {
				await runPowerShell(resolvedDependencies, buildDesktopClickScript(validatedArguments));

				if (context.signal?.aborted) {
					return createErrorResult(
						input,
						'EXECUTION_FAILED',
						'Desktop click was aborted before completion.',
						{
							reason: 'aborted',
						},
						true,
					);
				}

				return {
					call_id: input.call_id,
					output: {
						button: validatedArguments.button,
						click_count: validatedArguments.click_count,
						position: {
							x: validatedArguments.x,
							y: validatedArguments.y,
						},
					},
					status: 'success',
					tool_name: 'desktop.click',
				};
			} catch (error: unknown) {
				return toDesktopClickErrorResult(input, error);
			}
		},
		metadata: {
			capability_class: 'desktop',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'execute',
			tags: ['click', 'desktop', 'host', 'input', 'mouse'],
		},
		name: 'desktop.click',
	};
}

export const desktopClickTool = createDesktopClickTool();
