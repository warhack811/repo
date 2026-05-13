import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

const require = createRequire(import.meta.url);
const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

type ScreenshotFormat = 'png';

interface ScreenshotDesktopOptions {
	readonly format?: ScreenshotFormat;
}

type ScreenshotDesktopCapture = (options?: ScreenshotDesktopOptions) => Promise<Buffer | string>;

const screenshotDesktop = require('screenshot-desktop') as ScreenshotDesktopCapture;

export type DesktopScreenshotArguments = ToolArguments;

export interface DesktopScreenshotSuccessData {
	readonly base64_data: string;
	readonly byte_length: number;
	readonly format: ScreenshotFormat;
	readonly mime_type: 'image/png';
}

export type DesktopScreenshotInput = ToolCallInput<
	'desktop.screenshot',
	DesktopScreenshotArguments
>;

export type DesktopScreenshotSuccessResult = ToolResultSuccess<
	'desktop.screenshot',
	DesktopScreenshotSuccessData
>;

export type DesktopScreenshotErrorResult = ToolResultError<'desktop.screenshot'>;

export type DesktopScreenshotResult = ToolResult<
	'desktop.screenshot',
	DesktopScreenshotSuccessData
>;

interface DesktopScreenshotDependencies {
	readonly capture: ScreenshotDesktopCapture;
	readonly readFile: typeof readFile;
}

function createErrorResult(
	input: DesktopScreenshotInput,
	error_code: DesktopScreenshotErrorResult['error_code'],
	error_message: string,
	details?: DesktopScreenshotErrorResult['details'],
	retryable?: boolean,
): DesktopScreenshotErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'desktop.screenshot',
	};
}

function toErrorResult(
	input: DesktopScreenshotInput,
	error: unknown,
): DesktopScreenshotErrorResult {
	if (error && typeof error === 'object' && 'code' in error) {
		const errorCode = error.code;

		if (errorCode === 'EACCES' || errorCode === 'EPERM') {
			return createErrorResult(
				input,
				'PERMISSION_DENIED',
				'Permission denied while capturing desktop screenshot.',
				{
					reason: 'desktop_capture_permission_denied',
				},
				false,
			);
		}
	}

	if (error instanceof Error) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Failed to capture desktop screenshot: ${error.message}`,
			{
				reason: 'desktop_capture_failed',
			},
			false,
		);
	}

	return createErrorResult(
		input,
		'UNKNOWN',
		'Failed to capture desktop screenshot.',
		{
			reason: 'desktop_capture_unknown_failure',
		},
		false,
	);
}

async function resolveScreenshotBuffer(
	dependencies: DesktopScreenshotDependencies,
): Promise<Buffer> {
	const captured = await dependencies.capture({
		format: 'png',
	});

	if (Buffer.isBuffer(captured)) {
		return captured;
	}

	return dependencies.readFile(captured);
}

function isPngBuffer(buffer: Buffer): boolean {
	return PNG_SIGNATURE.every((byte, index) => buffer[index] === byte);
}

function validateScreenshotBuffer(buffer: Buffer): void {
	if (buffer.byteLength === 0) {
		throw new Error('Desktop screenshot capture returned an empty image buffer.');
	}

	if (!isPngBuffer(buffer)) {
		throw new Error('Desktop screenshot capture did not produce a PNG image.');
	}
}

function isDesktopScreenshotSuccessData(value: unknown): value is DesktopScreenshotSuccessData {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const candidate = value as {
		readonly base64_data?: unknown;
		readonly byte_length?: unknown;
		readonly format?: unknown;
		readonly mime_type?: unknown;
	};

	return (
		typeof candidate.base64_data === 'string' &&
		typeof candidate.byte_length === 'number' &&
		candidate.format === 'png' &&
		candidate.mime_type === 'image/png'
	);
}

export function createDesktopScreenshotTool(
	dependencies: Partial<DesktopScreenshotDependencies> = {},
): ToolDefinition<DesktopScreenshotInput, DesktopScreenshotResult> {
	const resolvedDependencies: DesktopScreenshotDependencies = {
		capture: dependencies.capture ?? screenshotDesktop,
		readFile: dependencies.readFile ?? readFile,
	};

	return {
		callable_schema: {
			parameters: {},
		},
		description:
			'Captures a screenshot of the server host desktop and returns the image as base64-encoded PNG data.',
		async execute(input, context): Promise<DesktopScreenshotResult> {
			if (Object.keys(input.arguments).length > 0) {
				return createErrorResult(
					input,
					'INVALID_INPUT',
					'desktop.screenshot does not accept any arguments.',
					{
						reason: 'unexpected_arguments',
					},
					false,
				);
			}

			if (context.signal?.aborted) {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					'Desktop screenshot capture was aborted before execution.',
					{
						reason: 'aborted',
					},
					true,
				);
			}

			if (context.desktop_bridge) {
				if (!context.desktop_bridge.supports('desktop.screenshot')) {
					return createErrorResult(
						input,
						'EXECUTION_FAILED',
						'Connected desktop agent does not advertise desktop.screenshot support.',
						{
							reason: 'desktop_agent_capability_unavailable',
						},
						false,
					);
				}

				const bridgeResult = await context.desktop_bridge.invoke(input, context);

				if (
					bridgeResult.status === 'success' &&
					!isDesktopScreenshotSuccessData(bridgeResult.output)
				) {
					return createErrorResult(
						input,
						'EXECUTION_FAILED',
						'Desktop agent returned an invalid screenshot payload.',
						{
							reason: 'desktop_agent_invalid_result',
						},
						false,
					);
				}

				return bridgeResult as DesktopScreenshotResult;
			}

			try {
				const screenshotBuffer = await resolveScreenshotBuffer(resolvedDependencies);
				validateScreenshotBuffer(screenshotBuffer);

				if (context.signal?.aborted) {
					return createErrorResult(
						input,
						'EXECUTION_FAILED',
						'Desktop screenshot capture was aborted before the image was returned.',
						{
							reason: 'aborted',
						},
						true,
					);
				}

				return {
					call_id: input.call_id,
					output: {
						base64_data: screenshotBuffer.toString('base64'),
						byte_length: screenshotBuffer.byteLength,
						format: 'png',
						mime_type: 'image/png',
					},
					status: 'success',
					tool_name: 'desktop.screenshot',
				};
			} catch (error: unknown) {
				return toErrorResult(input, error);
			}
		},
		metadata: {
			capability_class: 'desktop',
			narration_policy: 'optional',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'read',
			tags: ['desktop', 'host', 'screen', 'screenshot'],
		},
		name: 'desktop.screenshot',
		user_label_tr: 'Ekran goruntusu',
		user_summary_tr: 'Bagli masaustunden ekran goruntusu alinir.',
	};
}

export const desktopScreenshotTool = createDesktopScreenshotTool();
