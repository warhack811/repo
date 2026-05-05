import type {
	ModelGateway,
	ModelImageAttachment,
	ModelRequest,
	ModelResponse,
	ModelStreamChunk,
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

export type DesktopVisionVisibility = 'ambiguous' | 'not_visible' | 'visible';

export type ScreenshotToolResultResolver = (
	callId: string,
	context: ToolExecutionContext,
) => Promise<ToolResult | undefined> | ToolResult | undefined;

export type VisionModelGateway = Pick<ModelGateway, 'generate'>;

export type DesktopVisionAnalyzeArguments = ToolArguments & {
	readonly screenshot_call_id?: string;
	readonly task?: string;
};

export interface DesktopVisionAnalyzeSuccessData {
	readonly confidence?: number;
	readonly element_description: string;
	readonly reasoning_summary: string;
	readonly requires_user_confirmation: boolean;
	readonly visibility: DesktopVisionVisibility;
	readonly x: number;
	readonly y: number;
}

export type DesktopVisionAnalyzeInput = ToolCallInput<
	'desktop.vision_analyze',
	DesktopVisionAnalyzeArguments
>;

export type DesktopVisionAnalyzeSuccessResult = ToolResultSuccess<
	'desktop.vision_analyze',
	DesktopVisionAnalyzeSuccessData
>;

export type DesktopVisionAnalyzeErrorResult = ToolResultError<'desktop.vision_analyze'>;

export type DesktopVisionAnalyzeResult = ToolResult<
	'desktop.vision_analyze',
	DesktopVisionAnalyzeSuccessData
>;

export interface DesktopVisionAnalyzeDependencies {
	readonly model_gateway?: VisionModelGateway;
	readonly resolve_tool_result?: ScreenshotToolResultResolver;
}

interface DesktopScreenshotSuccessData {
	readonly base64_data: string;
	readonly byte_length: number;
	readonly format: 'png';
	readonly mime_type: 'image/png';
}

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_SCREEN_COORDINATE = 65_535;
const HITL_RISK_PATTERNS = [
	'credential',
	'password',
	'login',
	'sign in',
	'submit',
	'purchase',
	'payment',
	'checkout',
	'delete',
	'remove',
	'destructive',
	'bank',
	'2fa',
] as const;

export class VisionModelUnavailableGateway implements ModelGateway {
	async generate(): Promise<ModelResponse> {
		throw new Error('vision_model_unavailable');
	}

	stream(): AsyncIterable<ModelStreamChunk> {
		return {
			[Symbol.asyncIterator](): AsyncIterator<ModelStreamChunk> {
				return {
					next: async () =>
						({
							done: true,
							value: undefined,
						}) as IteratorResult<ModelStreamChunk>,
				};
			},
		};
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function createErrorResult(
	input: DesktopVisionAnalyzeInput,
	error_code: DesktopVisionAnalyzeErrorResult['error_code'],
	error_message: string,
	details?: DesktopVisionAnalyzeErrorResult['details'],
	retryable?: boolean,
): DesktopVisionAnalyzeErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'desktop.vision_analyze',
	};
}

function validateInput(
	input: DesktopVisionAnalyzeInput,
):
	| { readonly screenshot_call_id: string; readonly task: string }
	| DesktopVisionAnalyzeErrorResult {
	const allowedKeys = new Set(['screenshot_call_id', 'task']);

	for (const key of Object.keys(input.arguments)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				`desktop.vision_analyze does not accept the "${key}" argument.`,
				{
					argument: key,
					reason: 'unexpected_argument',
				},
				false,
			);
		}
	}

	const { screenshot_call_id: screenshotCallId, task } = input.arguments;

	if (typeof screenshotCallId !== 'string' || screenshotCallId.trim().length === 0) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'desktop.vision_analyze requires a non-empty screenshot_call_id string.',
			{
				argument: 'screenshot_call_id',
				reason: 'invalid_screenshot_call_id',
			},
			false,
		);
	}

	if (typeof task !== 'string' || task.trim().length === 0) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'desktop.vision_analyze requires a non-empty task string.',
			{
				argument: 'task',
				reason: 'invalid_task',
			},
			false,
		);
	}

	return {
		screenshot_call_id: screenshotCallId.trim(),
		task: task.trim(),
	};
}

function isDesktopScreenshotSuccessData(value: unknown): value is DesktopScreenshotSuccessData {
	if (!isRecord(value)) {
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

function isPngBase64(base64Data: string): boolean {
	const buffer = Buffer.from(base64Data, 'base64');

	return (
		buffer.byteLength >= PNG_SIGNATURE.byteLength &&
		PNG_SIGNATURE.every((byte, index) => buffer[index] === byte)
	);
}

function toImageAttachment(
	input: DesktopVisionAnalyzeInput,
	screenshotCallId: string,
	toolResult: ToolResult | undefined,
): ModelImageAttachment | DesktopVisionAnalyzeErrorResult {
	if (toolResult === undefined) {
		return createErrorResult(
			input,
			'NOT_FOUND',
			`No tool result was found for screenshot_call_id "${screenshotCallId}".`,
			{
				reason: 'screenshot_tool_result_not_found',
				screenshot_call_id: screenshotCallId,
			},
			true,
		);
	}

	if (toolResult.status !== 'success' || toolResult.tool_name !== 'desktop.screenshot') {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'desktop.vision_analyze requires a successful desktop.screenshot tool result.',
			{
				reason: 'screenshot_tool_result_not_usable',
				screenshot_call_id: screenshotCallId,
				status: toolResult.status,
				tool_name: toolResult.tool_name,
			},
			false,
		);
	}

	if (!isDesktopScreenshotSuccessData(toolResult.output)) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			'desktop.screenshot result does not contain a usable PNG artifact.',
			{
				reason: 'screenshot_artifact_unavailable',
				screenshot_call_id: screenshotCallId,
			},
			true,
		);
	}

	if (!isPngBase64(toolResult.output.base64_data)) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			'desktop.screenshot artifact is not a valid PNG payload.',
			{
				reason: 'screenshot_artifact_invalid',
				screenshot_call_id: screenshotCallId,
			},
			false,
		);
	}

	return {
		blob_id: screenshotCallId,
		data_url: `data:image/png;base64,${toolResult.output.base64_data}`,
		filename: `${screenshotCallId}.png`,
		kind: 'image',
		media_type: 'image/png',
		size_bytes: toolResult.output.byte_length,
	};
}

export async function resolveScreenshotAttachment(
	input: DesktopVisionAnalyzeInput,
	context: ToolExecutionContext,
	dependencies: Pick<DesktopVisionAnalyzeDependencies, 'resolve_tool_result'>,
	screenshotCallId: string,
): Promise<ModelImageAttachment | DesktopVisionAnalyzeErrorResult> {
	if (dependencies.resolve_tool_result === undefined) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			'No screenshot artifact resolver is available for desktop vision analysis.',
			{
				reason: 'screenshot_artifact_resolver_unavailable',
				screenshot_call_id: screenshotCallId,
			},
			true,
		);
	}

	const toolResult = await dependencies.resolve_tool_result(screenshotCallId, context);

	return toImageAttachment(input, screenshotCallId, toolResult);
}

function parseJsonObject(content: string): unknown {
	const trimmedContent = content.trim();
	const fencedMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmedContent);
	const jsonContent = fencedMatch?.[1] ?? trimmedContent;

	return JSON.parse(jsonContent) as unknown;
}

function isVisibility(value: unknown): value is DesktopVisionVisibility {
	return value === 'visible' || value === 'not_visible' || value === 'ambiguous';
}

function normalizeCoordinate(value: unknown): number | undefined {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return undefined;
	}

	const coordinate = Math.trunc(value);

	return coordinate >= 0 && coordinate <= MAX_SCREEN_COORDINATE ? coordinate : undefined;
}

function normalizeConfidence(value: unknown): number | undefined {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return undefined;
	}

	return value >= 0 && value <= 1 ? value : undefined;
}

function requiresUserConfirmationForTask(task: string): boolean {
	const normalizedTask = task.toLowerCase();

	return HITL_RISK_PATTERNS.some((pattern) => normalizedTask.includes(pattern));
}

function normalizeVisionAnalyzeOutput(
	input: DesktopVisionAnalyzeInput,
	task: string,
	response: ModelResponse,
): DesktopVisionAnalyzeSuccessData | DesktopVisionAnalyzeErrorResult {
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
		readonly confidence?: unknown;
		readonly element_description?: unknown;
		readonly reasoning_summary?: unknown;
		readonly requires_user_confirmation?: unknown;
		readonly visibility?: unknown;
		readonly x?: unknown;
		readonly y?: unknown;
	};

	const x = normalizeCoordinate(candidate.x);
	const y = normalizeCoordinate(candidate.y);

	if (
		typeof candidate.element_description !== 'string' ||
		typeof candidate.reasoning_summary !== 'string' ||
		typeof candidate.requires_user_confirmation !== 'boolean' ||
		!isVisibility(candidate.visibility) ||
		x === undefined ||
		y === undefined
	) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			'Vision model response missed required desktop.vision_analyze fields.',
			{
				reason: 'vision_model_invalid_response',
			},
			true,
		);
	}

	const confidence = normalizeConfidence(candidate.confidence);

	return {
		...(confidence === undefined ? {} : { confidence }),
		element_description: candidate.element_description,
		reasoning_summary: candidate.reasoning_summary,
		requires_user_confirmation:
			candidate.requires_user_confirmation || requiresUserConfirmationForTask(task),
		visibility: candidate.visibility,
		x,
		y,
	};
}

function createVisionAnalyzeRequest(
	input: DesktopVisionAnalyzeInput,
	task: string,
	attachment: ModelImageAttachment,
	context: ToolExecutionContext,
): ModelRequest {
	return {
		attachments: [attachment],
		max_output_tokens: 700,
		messages: [
			{
				content:
					'You are a cautious desktop UI vision analyzer. Return only strict JSON. Never claim an action succeeded. Treat credential, login, submit, delete, payment, purchase, and sensitive form tasks as requiring user confirmation.',
				role: 'system',
			},
			{
				content: [
					`Task: ${task}`,
					'Analyze the attached screenshot and identify the target UI element for the next desktop action.',
					'Return JSON with exactly: element_description, x, y, reasoning_summary, requires_user_confirmation, visibility, and optional confidence.',
					'Use visibility "not_visible" when the target is absent, "ambiguous" when multiple plausible targets exist, and "visible" only when a specific target is visible.',
					'Coordinates must be absolute screen pixel coordinates for the center of the target when possible.',
				].join('\n'),
				role: 'user',
			},
		],
		metadata: {
			purpose: 'desktop.vision_analyze',
			screenshot_call_id: input.arguments.screenshot_call_id,
		},
		run_id: context.run_id,
		trace_id: context.trace_id,
	};
}

function toVisionModelUnavailableResult(
	input: DesktopVisionAnalyzeInput,
	error?: unknown,
): DesktopVisionAnalyzeErrorResult {
	return createErrorResult(
		input,
		'EXECUTION_FAILED',
		'Vision model is unavailable for desktop.vision_analyze.',
		{
			reason: 'vision_model_unavailable',
			source_error: error instanceof Error ? error.message : undefined,
		},
		false,
	);
}

export function createDesktopVisionAnalyzeTool(
	dependencies: DesktopVisionAnalyzeDependencies = {},
): ToolDefinition<DesktopVisionAnalyzeInput, DesktopVisionAnalyzeResult> {
	return {
		callable_schema: {
			parameters: {
				screenshot_call_id: {
					description: 'Call id of a prior successful desktop.screenshot result.',
					required: true,
					type: 'string',
				},
				task: {
					description: 'Natural-language desktop task to locate in the screenshot.',
					required: true,
					type: 'string',
				},
			},
		},
		description:
			'Analyzes a prior desktop screenshot through ModelGateway.generate and proposes a target coordinate without claiming action success.',
		async execute(input, context): Promise<DesktopVisionAnalyzeResult> {
			const validatedInput = validateInput(input);

			if ('status' in validatedInput) {
				return validatedInput;
			}

			if (context.signal?.aborted) {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					'Desktop vision analysis was aborted before execution.',
					{
						reason: 'aborted',
					},
					true,
				);
			}

			const attachment = await resolveScreenshotAttachment(
				input,
				context,
				dependencies,
				validatedInput.screenshot_call_id,
			);

			if ('status' in attachment) {
				return attachment;
			}

			if (dependencies.model_gateway === undefined) {
				return toVisionModelUnavailableResult(input);
			}

			try {
				const modelResponse = await dependencies.model_gateway.generate(
					createVisionAnalyzeRequest(input, validatedInput.task, attachment, context),
				);
				const output = normalizeVisionAnalyzeOutput(input, validatedInput.task, modelResponse);

				if ('status' in output) {
					return output;
				}

				return {
					call_id: input.call_id,
					output,
					status: 'success',
					tool_name: 'desktop.vision_analyze',
				};
			} catch (error: unknown) {
				return toVisionModelUnavailableResult(input, error);
			}
		},
		metadata: {
			capability_class: 'desktop',
			narration_policy: 'optional',
			requires_approval: false,
			risk_level: 'medium',
			side_effect_level: 'read',
			tags: [
				'desktop',
				'vision',
				'screenshot',
				'coordinate',
				'hitl-risk:credential',
				'hitl-risk:login',
				'hitl-risk:submit',
				'hitl-risk:delete',
				'hitl-risk:purchase',
			],
		},
		name: 'desktop.vision_analyze',
	};
}

export const desktopVisionAnalyzeTool = createDesktopVisionAnalyzeTool();
