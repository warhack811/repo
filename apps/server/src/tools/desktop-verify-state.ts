import type {
	ModelImageAttachment,
	ModelRequest,
	ModelResponse,
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

import {
	type DesktopVisionAnalyzeDependencies,
	type DesktopVisionAnalyzeInput,
	type VisionModelGateway,
	VisionModelUnavailableGateway,
	resolveScreenshotAttachment,
} from './desktop-vision-analyze.js';

export type DesktopVerifyStateArguments = ToolArguments & {
	readonly after_screenshot_call_id?: string;
	readonly before_screenshot_call_id?: string;
	readonly expected_change?: string;
};

export interface DesktopVerifyStateSuccessData {
	readonly needs_retry: boolean;
	readonly needs_user_help: boolean;
	readonly observed_change: string;
	readonly verified: boolean;
}

export type DesktopVerifyStateInput = ToolCallInput<
	'desktop.verify_state',
	DesktopVerifyStateArguments
>;

export type DesktopVerifyStateSuccessResult = ToolResultSuccess<
	'desktop.verify_state',
	DesktopVerifyStateSuccessData
>;

export type DesktopVerifyStateErrorResult = ToolResultError<'desktop.verify_state'>;

export type DesktopVerifyStateResult = ToolResult<
	'desktop.verify_state',
	DesktopVerifyStateSuccessData
>;

export interface DesktopVerifyStateDependencies
	extends Pick<DesktopVisionAnalyzeDependencies, 'resolve_tool_result'> {
	readonly model_gateway?: VisionModelGateway;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function createErrorResult(
	input: DesktopVerifyStateInput,
	error_code: DesktopVerifyStateErrorResult['error_code'],
	error_message: string,
	details?: DesktopVerifyStateErrorResult['details'],
	retryable?: boolean,
): DesktopVerifyStateErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'desktop.verify_state',
	};
}

function validateInput(input: DesktopVerifyStateInput):
	| {
			readonly after_screenshot_call_id: string;
			readonly before_screenshot_call_id: string;
			readonly expected_change: string;
	  }
	| DesktopVerifyStateErrorResult {
	const allowedKeys = new Set([
		'after_screenshot_call_id',
		'before_screenshot_call_id',
		'expected_change',
	]);

	for (const key of Object.keys(input.arguments)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				`desktop.verify_state does not accept the "${key}" argument.`,
				{
					argument: key,
					reason: 'unexpected_argument',
				},
				false,
			);
		}
	}

	const {
		after_screenshot_call_id: afterScreenshotCallId,
		before_screenshot_call_id: beforeScreenshotCallId,
		expected_change: expectedChange,
	} = input.arguments;

	if (typeof beforeScreenshotCallId !== 'string' || beforeScreenshotCallId.trim().length === 0) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'desktop.verify_state requires a non-empty before_screenshot_call_id string.',
			{
				argument: 'before_screenshot_call_id',
				reason: 'invalid_before_screenshot_call_id',
			},
			false,
		);
	}

	if (typeof afterScreenshotCallId !== 'string' || afterScreenshotCallId.trim().length === 0) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'desktop.verify_state requires a non-empty after_screenshot_call_id string.',
			{
				argument: 'after_screenshot_call_id',
				reason: 'invalid_after_screenshot_call_id',
			},
			false,
		);
	}

	if (typeof expectedChange !== 'string' || expectedChange.trim().length === 0) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'desktop.verify_state requires a non-empty expected_change string.',
			{
				argument: 'expected_change',
				reason: 'invalid_expected_change',
			},
			false,
		);
	}

	return {
		after_screenshot_call_id: afterScreenshotCallId.trim(),
		before_screenshot_call_id: beforeScreenshotCallId.trim(),
		expected_change: expectedChange.trim(),
	};
}

function parseJsonObject(content: string): unknown {
	const trimmedContent = content.trim();
	const fencedMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmedContent);
	const jsonContent = fencedMatch?.[1] ?? trimmedContent;

	return JSON.parse(jsonContent) as unknown;
}

function normalizeVerifyOutput(
	input: DesktopVerifyStateInput,
	response: ModelResponse,
): DesktopVerifyStateSuccessData | DesktopVerifyStateErrorResult {
	let parsed: unknown;

	try {
		parsed = parseJsonObject(response.message.content);
	} catch (error: unknown) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			'Vision model response was not valid JSON.',
			{
				reason: 'vision_model_invalid_response',
				source_error: error instanceof Error ? error.message : 'unknown_parse_failure',
			},
			true,
		);
	}

	if (!isRecord(parsed)) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			'Vision model response did not contain an object.',
			{
				reason: 'vision_model_invalid_response',
			},
			true,
		);
	}
	const candidate = parsed as {
		readonly needs_retry?: unknown;
		readonly needs_user_help?: unknown;
		readonly observed_change?: unknown;
		readonly verified?: unknown;
	};

	if (
		typeof candidate.verified !== 'boolean' ||
		typeof candidate.observed_change !== 'string' ||
		typeof candidate.needs_retry !== 'boolean' ||
		typeof candidate.needs_user_help !== 'boolean'
	) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			'Vision model response missed required desktop.verify_state fields.',
			{
				reason: 'vision_model_invalid_response',
			},
			true,
		);
	}

	return {
		needs_retry: candidate.verified ? false : candidate.needs_retry,
		needs_user_help: candidate.verified ? false : candidate.needs_user_help,
		observed_change: candidate.observed_change,
		verified: candidate.verified,
	};
}

function createVerifyStateRequest(
	input: DesktopVerifyStateInput,
	context: ToolExecutionContext,
	expectedChange: string,
	beforeAttachment: ModelImageAttachment,
	afterAttachment: ModelImageAttachment,
): ModelRequest {
	return {
		attachments: [beforeAttachment, afterAttachment],
		max_output_tokens: 700,
		messages: [
			{
				content:
					'You are a cautious desktop state verifier. Compare before and after screenshots. Return only strict JSON. Do not say an action succeeded unless the expected change is explicitly visible.',
				role: 'system',
			},
			{
				content: [
					`Expected change: ${expectedChange}`,
					'The first image is before the action and the second image is after the action.',
					'Return JSON with exactly: verified, observed_change, needs_retry, needs_user_help.',
					'If the expected change is absent or ambiguous, set verified false and explain the observed state.',
				].join('\n'),
				role: 'user',
			},
		],
		metadata: {
			after_screenshot_call_id: input.arguments.after_screenshot_call_id,
			before_screenshot_call_id: input.arguments.before_screenshot_call_id,
			purpose: 'desktop.verify_state',
		},
		run_id: context.run_id,
		trace_id: context.trace_id,
	};
}

function toVisionModelUnavailableResult(
	input: DesktopVerifyStateInput,
	error?: unknown,
): DesktopVerifyStateErrorResult {
	return createErrorResult(
		input,
		'EXECUTION_FAILED',
		'Vision model is unavailable for desktop.verify_state.',
		{
			reason: 'vision_model_unavailable',
			source_error: error instanceof Error ? error.message : undefined,
		},
		true,
	);
}

function remapAnalyzeError(
	input: DesktopVerifyStateInput,
	result: ToolResultError<'desktop.vision_analyze'>,
): DesktopVerifyStateErrorResult {
	return {
		call_id: input.call_id,
		details: result.details,
		error_code: result.error_code,
		error_message: result.error_message,
		retryable: result.retryable,
		status: 'error',
		tool_name: 'desktop.verify_state',
	};
}

export function createDesktopVerifyStateTool(
	dependencies: DesktopVerifyStateDependencies = {},
): ToolDefinition<DesktopVerifyStateInput, DesktopVerifyStateResult> {
	return {
		callable_schema: {
			parameters: {
				after_screenshot_call_id: {
					description: 'Call id of the desktop.screenshot result captured after the action.',
					required: true,
					type: 'string',
				},
				before_screenshot_call_id: {
					description: 'Call id of the desktop.screenshot result captured before the action.',
					required: true,
					type: 'string',
				},
				expected_change: {
					description: 'Concrete state change that must be visible in the after screenshot.',
					required: true,
					type: 'string',
				},
			},
		},
		description:
			'Verifies a desktop action by comparing before and after screenshots through ModelGateway.generate before success is claimed.',
		async execute(input, context): Promise<DesktopVerifyStateResult> {
			const validatedInput = validateInput(input);

			if ('status' in validatedInput) {
				return validatedInput;
			}

			if (context.signal?.aborted) {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					'Desktop state verification was aborted before execution.',
					{
						reason: 'aborted',
					},
					true,
				);
			}

			const beforeInput: DesktopVisionAnalyzeInput = {
				arguments: {
					screenshot_call_id: validatedInput.before_screenshot_call_id,
					task: validatedInput.expected_change,
				},
				call_id: input.call_id,
				tool_name: 'desktop.vision_analyze',
			};
			const afterInput: DesktopVisionAnalyzeInput = {
				arguments: {
					screenshot_call_id: validatedInput.after_screenshot_call_id,
					task: validatedInput.expected_change,
				},
				call_id: input.call_id,
				tool_name: 'desktop.vision_analyze',
			};
			const beforeAttachment = await resolveScreenshotAttachment(
				beforeInput,
				context,
				dependencies,
				validatedInput.before_screenshot_call_id,
			);

			if ('status' in beforeAttachment) {
				return remapAnalyzeError(input, beforeAttachment);
			}

			const afterAttachment = await resolveScreenshotAttachment(
				afterInput,
				context,
				dependencies,
				validatedInput.after_screenshot_call_id,
			);

			if ('status' in afterAttachment) {
				return remapAnalyzeError(input, afterAttachment);
			}

			const modelGateway = dependencies.model_gateway ?? new VisionModelUnavailableGateway();

			try {
				const modelResponse = await modelGateway.generate(
					createVerifyStateRequest(
						input,
						context,
						validatedInput.expected_change,
						beforeAttachment,
						afterAttachment,
					),
				);
				const output = normalizeVerifyOutput(input, modelResponse);

				if ('status' in output) {
					return output;
				}

				return {
					call_id: input.call_id,
					output,
					status: 'success',
					tool_name: 'desktop.verify_state',
				};
			} catch (error: unknown) {
				return toVisionModelUnavailableResult(input, error);
			}
		},
		metadata: {
			capability_class: 'desktop',
			requires_approval: false,
			risk_level: 'medium',
			side_effect_level: 'read',
			tags: ['desktop', 'vision', 'screenshot', 'verify-after-action'],
		},
		name: 'desktop.verify_state',
	};
}

export const desktopVerifyStateTool = createDesktopVerifyStateTool();
