import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

const MAX_CLIPBOARD_BYTES = 10 * 1024;

export type DesktopClipboardReadArguments = ToolArguments;

export interface DesktopClipboardReadSuccessData {
	readonly byte_length: number;
	readonly character_count: number;
	readonly content: string;
	readonly is_redacted: boolean;
	readonly is_truncated: boolean;
}

export type DesktopClipboardReadInput = ToolCallInput<
	'desktop.clipboard.read',
	DesktopClipboardReadArguments
>;

export type DesktopClipboardReadSuccessResult = ToolResultSuccess<
	'desktop.clipboard.read',
	DesktopClipboardReadSuccessData
>;

export type DesktopClipboardReadErrorResult = ToolResultError<'desktop.clipboard.read'>;

export type DesktopClipboardReadResult = ToolResult<
	'desktop.clipboard.read',
	DesktopClipboardReadSuccessData
>;

export type DesktopClipboardWriteArguments = ToolArguments & {
	readonly text?: string;
};

export interface DesktopClipboardWriteSuccessData {
	readonly byte_length: number;
	readonly character_count: number;
	readonly written: boolean;
}

export type DesktopClipboardWriteInput = ToolCallInput<
	'desktop.clipboard.write',
	DesktopClipboardWriteArguments
>;

export type DesktopClipboardWriteSuccessResult = ToolResultSuccess<
	'desktop.clipboard.write',
	DesktopClipboardWriteSuccessData
>;

export type DesktopClipboardWriteErrorResult = ToolResultError<'desktop.clipboard.write'>;

export type DesktopClipboardWriteResult = ToolResult<
	'desktop.clipboard.write',
	DesktopClipboardWriteSuccessData
>;

function createReadErrorResult(
	input: DesktopClipboardReadInput,
	error_code: DesktopClipboardReadErrorResult['error_code'],
	error_message: string,
	details?: DesktopClipboardReadErrorResult['details'],
	retryable?: boolean,
): DesktopClipboardReadErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'desktop.clipboard.read',
	};
}

function createWriteErrorResult(
	input: DesktopClipboardWriteInput,
	error_code: DesktopClipboardWriteErrorResult['error_code'],
	error_message: string,
	details?: DesktopClipboardWriteErrorResult['details'],
	retryable?: boolean,
): DesktopClipboardWriteErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'desktop.clipboard.write',
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isDesktopClipboardReadSuccessData(
	value: unknown,
): value is DesktopClipboardReadSuccessData {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as {
		readonly byte_length?: unknown;
		readonly character_count?: unknown;
		readonly content?: unknown;
		readonly is_redacted?: unknown;
		readonly is_truncated?: unknown;
	};

	return (
		isFiniteNonNegativeInteger(candidate.byte_length) &&
		isFiniteNonNegativeInteger(candidate.character_count) &&
		typeof candidate.content === 'string' &&
		typeof candidate.is_redacted === 'boolean' &&
		typeof candidate.is_truncated === 'boolean'
	);
}

function isDesktopClipboardWriteSuccessData(
	value: unknown,
): value is DesktopClipboardWriteSuccessData {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as {
		readonly byte_length?: unknown;
		readonly character_count?: unknown;
		readonly written?: unknown;
	};

	return (
		isFiniteNonNegativeInteger(candidate.byte_length) &&
		isFiniteNonNegativeInteger(candidate.character_count) &&
		candidate.written === true
	);
}

function validateReadArguments(
	input: DesktopClipboardReadInput,
): DesktopClipboardReadErrorResult | undefined {
	const keys = Object.keys(input.arguments);

	if (keys.length === 0) {
		return undefined;
	}

	return createReadErrorResult(
		input,
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
	input: DesktopClipboardWriteInput,
): string | DesktopClipboardWriteErrorResult {
	const allowedKeys = new Set(['text']);

	for (const key of Object.keys(input.arguments)) {
		if (!allowedKeys.has(key)) {
			return createWriteErrorResult(
				input,
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

	const { text } = input.arguments;

	if (typeof text !== 'string') {
		return createWriteErrorResult(
			input,
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
		return createWriteErrorResult(
			input,
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

function createMissingBridgeReadError(
	input: DesktopClipboardReadInput,
	context: ToolExecutionContext,
): DesktopClipboardReadErrorResult {
	return createReadErrorResult(
		input,
		'EXECUTION_FAILED',
		context.desktop_bridge
			? 'Connected desktop agent does not advertise desktop.clipboard.read support.'
			: 'desktop.clipboard.read requires a connected desktop agent bridge.',
		{
			reason: context.desktop_bridge
				? 'desktop_agent_capability_unavailable'
				: 'desktop_agent_required',
		},
		!context.desktop_bridge,
	);
}

function createMissingBridgeWriteError(
	input: DesktopClipboardWriteInput,
	context: ToolExecutionContext,
): DesktopClipboardWriteErrorResult {
	return createWriteErrorResult(
		input,
		'EXECUTION_FAILED',
		context.desktop_bridge
			? 'Connected desktop agent does not advertise desktop.clipboard.write support.'
			: 'desktop.clipboard.write requires a connected desktop agent bridge.',
		{
			reason: context.desktop_bridge
				? 'desktop_agent_capability_unavailable'
				: 'desktop_agent_required',
		},
		!context.desktop_bridge,
	);
}

export function createDesktopClipboardReadTool(): ToolDefinition<
	DesktopClipboardReadInput,
	DesktopClipboardReadResult
> {
	return {
		callable_schema: {
			parameters: {},
		},
		description:
			'Reads text from the connected desktop agent clipboard through an approval-gated bridge, returning a bounded redaction-aware payload.',
		async execute(input, context): Promise<DesktopClipboardReadResult> {
			const invalidArguments = validateReadArguments(input);

			if (invalidArguments) {
				return invalidArguments;
			}

			if (context.signal?.aborted) {
				return createReadErrorResult(
					input,
					'EXECUTION_FAILED',
					'Desktop clipboard read was aborted before execution.',
					{
						reason: 'aborted',
					},
					true,
				);
			}

			if (!context.desktop_bridge?.supports('desktop.clipboard.read')) {
				return createMissingBridgeReadError(input, context);
			}

			const bridgeResult = await context.desktop_bridge.invoke(input, context);

			if (
				bridgeResult.status === 'success' &&
				!isDesktopClipboardReadSuccessData(bridgeResult.output)
			) {
				return createReadErrorResult(
					input,
					'EXECUTION_FAILED',
					'Desktop agent returned an invalid clipboard read payload.',
					{
						reason: 'desktop_agent_invalid_result',
					},
					false,
				);
			}

			return bridgeResult as DesktopClipboardReadResult;
		},
		metadata: {
			capability_class: 'desktop',
			narration_policy: 'optional',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'read',
			tags: ['clipboard', 'desktop', 'host', 'read'],
		},
		name: 'desktop.clipboard.read',
	};
}

export function createDesktopClipboardWriteTool(): ToolDefinition<
	DesktopClipboardWriteInput,
	DesktopClipboardWriteResult
> {
	return {
		callable_schema: {
			parameters: {
				text: {
					description: 'Text to place on the connected desktop clipboard. Maximum 10KB.',
					required: true,
					type: 'string',
				},
			},
		},
		description:
			'Writes text to the connected desktop agent clipboard through an explicit approval-gated bridge path.',
		async execute(input, context): Promise<DesktopClipboardWriteResult> {
			const validatedText = validateWriteArguments(input);

			if (typeof validatedText !== 'string') {
				return validatedText;
			}

			if (context.signal?.aborted) {
				return createWriteErrorResult(
					input,
					'EXECUTION_FAILED',
					'Desktop clipboard write was aborted before execution.',
					{
						reason: 'aborted',
					},
					true,
				);
			}

			if (!context.desktop_bridge?.supports('desktop.clipboard.write')) {
				return createMissingBridgeWriteError(input, context);
			}

			const bridgeResult = await context.desktop_bridge.invoke(input, context);

			if (
				bridgeResult.status === 'success' &&
				!isDesktopClipboardWriteSuccessData(bridgeResult.output)
			) {
				return createWriteErrorResult(
					input,
					'EXECUTION_FAILED',
					'Desktop agent returned an invalid clipboard write payload.',
					{
						reason: 'desktop_agent_invalid_result',
					},
					false,
				);
			}

			return bridgeResult as DesktopClipboardWriteResult;
		},
		metadata: {
			capability_class: 'desktop',
			narration_policy: 'required',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'write',
			tags: ['clipboard', 'desktop', 'host', 'write'],
		},
		name: 'desktop.clipboard.write',
	};
}

export const desktopClipboardReadTool = createDesktopClipboardReadTool();
export const desktopClipboardWriteTool = createDesktopClipboardWriteTool();
