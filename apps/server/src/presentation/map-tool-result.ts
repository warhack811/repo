import type {
	ToolName,
	ToolResult,
	ToolResultBlock,
	ToolResultBlockPreview,
	ToolResultBlockStatus,
} from '@runa/types';

import type { IngestedToolResult } from '../runtime/ingest-tool-result.js';

const STRING_PREVIEW_LIMIT = 120;

interface MapToolResultInput {
	readonly call_id: string;
	readonly created_at: string;
	readonly result: IngestedToolResult | ToolResult;
	readonly tool_name: ToolName;
}

function truncateText(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, maxLength - 3)}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildObjectPreview(value: Record<string, unknown>): ToolResultBlockPreview {
	const keys = Object.keys(value).sort();
	const previewKeys = keys.slice(0, 3);
	const remainingKeyCount = keys.length - previewKeys.length;
	const summarySuffix = remainingKeyCount > 0 ? `, +${remainingKeyCount} more` : '';

	return {
		kind: 'object',
		summary_text: `Object{${previewKeys.join(', ')}}${summarySuffix}`,
	};
}

function getSuccessEffect(output: unknown): 'already_applied' | 'applied' | undefined {
	if (!isRecord(output)) {
		return undefined;
	}

	const effect = (output as { effect?: unknown }).effect;

	return effect === 'already_applied' || effect === 'applied' ? effect : undefined;
}

function buildSuccessPreview(output: unknown): ToolResultBlockPreview | undefined {
	if (typeof output === 'string') {
		return {
			kind: 'string',
			summary_text: truncateText(output, STRING_PREVIEW_LIMIT),
		};
	}

	if (typeof output === 'number') {
		return {
			kind: 'number',
			summary_text: output.toString(),
		};
	}

	if (typeof output === 'boolean') {
		return {
			kind: 'boolean',
			summary_text: output ? 'true' : 'false',
		};
	}

	if (output === null) {
		return {
			kind: 'null',
			summary_text: 'null',
		};
	}

	if (Array.isArray(output)) {
		return {
			kind: 'array',
			summary_text: `Array(${output.length})`,
		};
	}

	if (isRecord(output)) {
		return buildObjectPreview(output);
	}

	return undefined;
}

function isToolResultErrorResult(
	result: IngestedToolResult | ToolResult,
): result is
	| Extract<IngestedToolResult, { result_status: 'error' }>
	| Extract<ToolResult, { status: 'error' }> {
	return (
		('status' in result && result.status === 'error') ||
		('result_status' in result && result.result_status === 'error')
	);
}

function getBlockStatus(result: IngestedToolResult | ToolResult): ToolResultBlockStatus {
	return isToolResultErrorResult(result) ? 'error' : 'success';
}

function buildSummary(toolName: ToolName, result: IngestedToolResult | ToolResult): string {
	if (isToolResultErrorResult(result)) {
		const errorMessage =
			'error_message' in result ? result.error_message : 'Tool execution failed.';
		return `${toolName} failed: ${truncateText(errorMessage, STRING_PREVIEW_LIMIT)}`;
	}

	if (getSuccessEffect(result.output) === 'already_applied') {
		return `${toolName} already applied; skipped duplicate execution.`;
	}

	return `${toolName} completed successfully.`;
}

function getErrorCode(
	result: IngestedToolResult | ToolResult,
): ToolResultBlock['payload']['error_code'] {
	if (isToolResultErrorResult(result)) {
		return result.error_code;
	}

	return undefined;
}

function getResultPreview(
	result: IngestedToolResult | ToolResult,
): ToolResultBlock['payload']['result_preview'] {
	if (isToolResultErrorResult(result)) {
		return undefined;
	}

	return buildSuccessPreview(result.output);
}

export function mapToolResultToBlock(input: MapToolResultInput): ToolResultBlock {
	return {
		created_at: input.created_at,
		id: `tool_result:${input.tool_name}:${input.call_id}`,
		payload: {
			call_id: input.call_id,
			error_code: getErrorCode(input.result),
			result_preview: getResultPreview(input.result),
			status: getBlockStatus(input.result),
			summary: buildSummary(input.tool_name, input.result),
			tool_name: input.tool_name,
		},
		schema_version: 1,
		type: 'tool_result',
	};
}
