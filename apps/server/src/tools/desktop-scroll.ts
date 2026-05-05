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

export type DesktopScrollArguments = ToolArguments & {
	readonly delta_x?: number;
	readonly delta_y?: number;
};

export interface DesktopScrollSuccessData {
	readonly delta_x: number;
	readonly delta_y: number;
}

export type DesktopScrollInput = ToolCallInput<'desktop.scroll', DesktopScrollArguments>;

export type DesktopScrollSuccessResult = ToolResultSuccess<
	'desktop.scroll',
	DesktopScrollSuccessData
>;

export type DesktopScrollErrorResult = ToolResultError<'desktop.scroll'>;

export type DesktopScrollResult = ToolResult<'desktop.scroll', DesktopScrollSuccessData>;

interface DesktopScrollDependencies {
	readonly execFile: typeof execFile;
	readonly platform: NodeJS.Platform;
}

interface DesktopScrollParams {
	readonly delta_x: number;
	readonly delta_y: number;
}

const MAX_EXEC_BUFFER_BYTES = 8_192;
const MAX_SCROLL_DELTA = 12_000;

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
	input: DesktopScrollInput,
	error_code: DesktopScrollErrorResult['error_code'],
	error_message: string,
	details?: DesktopScrollErrorResult['details'],
	retryable?: boolean,
): DesktopScrollErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'desktop.scroll',
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isFiniteInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
}

function validateDesktopScrollArguments(
	input: DesktopScrollInput,
): DesktopScrollParams | DesktopScrollErrorResult {
	const allowedKeys = new Set(['delta_x', 'delta_y']);

	for (const key of Object.keys(input.arguments)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				input,
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

	const { delta_x = 0, delta_y = 0 } = input.arguments;

	if (!isFiniteInteger(delta_x) || Math.abs(delta_x) > MAX_SCROLL_DELTA) {
		return createErrorResult(
			input,
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
			input,
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
			input,
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

function isDesktopScrollSuccessData(value: unknown): value is DesktopScrollSuccessData {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as {
		readonly delta_x?: unknown;
		readonly delta_y?: unknown;
	};

	return isFiniteInteger(candidate.delta_x) && isFiniteInteger(candidate.delta_y);
}

function runPowerShell(dependencies: DesktopScrollDependencies, script: string): Promise<void> {
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

function buildDesktopScrollScript(input: DesktopScrollParams): string {
	return [
		'Add-Type @"',
		'using System;',
		'using System.Runtime.InteropServices;',
		'public static class DesktopScrollNative {',
		'\t[DllImport("user32.dll", SetLastError = true)]',
		'\tpublic static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, UIntPtr dwExtraInfo);',
		'}',
		'"@',
		`if (${String(input.delta_y)} -ne 0) { [DesktopScrollNative]::mouse_event(0x0800, 0, 0, ${String(input.delta_y)}, [UIntPtr]::Zero) }`,
		`if (${String(input.delta_x)} -ne 0) { [DesktopScrollNative]::mouse_event(0x01000, 0, 0, ${String(input.delta_x)}, [UIntPtr]::Zero) }`,
	].join('\n');
}

function toDesktopScrollErrorResult(
	input: DesktopScrollInput,
	error: unknown,
): DesktopScrollErrorResult {
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
			'Permission denied while injecting desktop scroll input.',
			{
				reason: 'desktop_scroll_permission_denied',
			},
			false,
		);
	}

	if (error instanceof Error) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Failed to execute desktop scroll: ${stderr || error.message}`,
			{
				reason: 'desktop_scroll_failed',
			},
			false,
		);
	}

	return createErrorResult(
		input,
		'UNKNOWN',
		'Failed to execute desktop scroll.',
		{
			reason: 'desktop_scroll_unknown_failure',
		},
		false,
	);
}

export function createDesktopScrollTool(
	dependencies: Partial<DesktopScrollDependencies> = {},
): ToolDefinition<DesktopScrollInput, DesktopScrollResult> {
	const resolvedDependencies: DesktopScrollDependencies = {
		execFile: dependencies.execFile ?? execFile,
		platform: dependencies.platform ?? process.platform,
	};

	return {
		callable_schema: {
			parameters: {
				delta_x: {
					description: 'Optional horizontal wheel delta in Windows mouse-event units.',
					type: 'number',
				},
				delta_y: {
					description: 'Optional vertical wheel delta in Windows mouse-event units.',
					type: 'number',
				},
			},
		},
		description:
			'Sends an approval-gated mouse wheel scroll action to the host desktop using Windows input injection.',
		async execute(input, context): Promise<DesktopScrollResult> {
			const validatedArguments = validateDesktopScrollArguments(input);

			if ('status' in validatedArguments) {
				return validatedArguments;
			}

			if (context.signal?.aborted) {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					'Desktop scroll was aborted before execution.',
					{
						reason: 'aborted',
					},
					true,
				);
			}

			if (context.desktop_bridge) {
				if (!context.desktop_bridge.supports('desktop.scroll')) {
					return createErrorResult(
						input,
						'EXECUTION_FAILED',
						'Connected desktop agent does not advertise desktop.scroll support.',
						{
							reason: 'desktop_agent_capability_unavailable',
						},
						false,
					);
				}

				const bridgeResult = await context.desktop_bridge.invoke(input, context);

				if (bridgeResult.status === 'success' && !isDesktopScrollSuccessData(bridgeResult.output)) {
					return createErrorResult(
						input,
						'EXECUTION_FAILED',
						'Desktop agent returned an invalid scroll payload.',
						{
							reason: 'desktop_agent_invalid_result',
						},
						false,
					);
				}

				return bridgeResult as DesktopScrollResult;
			}

			if (resolvedDependencies.platform !== 'win32') {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					'desktop.scroll is currently supported only on Windows hosts.',
					{
						platform: resolvedDependencies.platform,
						reason: 'unsupported_platform',
					},
					false,
				);
			}

			try {
				await runPowerShell(resolvedDependencies, buildDesktopScrollScript(validatedArguments));

				if (context.signal?.aborted) {
					return createErrorResult(
						input,
						'EXECUTION_FAILED',
						'Desktop scroll was aborted before completion.',
						{
							reason: 'aborted',
						},
						true,
					);
				}

				return {
					call_id: input.call_id,
					output: {
						delta_x: validatedArguments.delta_x,
						delta_y: validatedArguments.delta_y,
					},
					status: 'success',
					tool_name: 'desktop.scroll',
				};
			} catch (error: unknown) {
				return toDesktopScrollErrorResult(input, error);
			}
		},
		metadata: {
			capability_class: 'desktop',
			narration_policy: 'required',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'execute',
			tags: ['desktop', 'host', 'input', 'mouse', 'scroll'],
		},
		name: 'desktop.scroll',
	};
}

export const desktopScrollTool = createDesktopScrollTool();
