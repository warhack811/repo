import type { ModelToolCallCandidate, ToolArguments, ToolName } from '@runa/types';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isToolName(value: unknown): value is ToolName {
	return typeof value === 'string' && value.trim().length > 0 && value.includes('.');
}

function normalizeToolInput(value: unknown): ToolArguments | undefined {
	if (value === undefined || value === null) {
		return {};
	}

	if (isRecord(value)) {
		return value;
	}

	if (typeof value !== 'string') {
		return undefined;
	}

	if (value.trim().length === 0) {
		return {};
	}

	try {
		const parsed = JSON.parse(value) as unknown;

		return isRecord(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

export interface ToolCallCandidateParts {
	readonly call_id: unknown;
	readonly tool_input: unknown;
	readonly tool_name: unknown;
}

export type ToolCallCandidateRejectionReason =
	| 'invalid_tool_name'
	| 'missing_call_id'
	| 'unparseable_tool_input';

export interface ToolCallCandidateParseResult {
	readonly candidate?: ModelToolCallCandidate;
	readonly rejection_reason?: ToolCallCandidateRejectionReason;
}

export function parseToolCallCandidatePartsDetailed(
	parts: ToolCallCandidateParts,
): ToolCallCandidateParseResult {
	if (typeof parts.call_id !== 'string' || parts.call_id.trim().length === 0) {
		return {
			rejection_reason: 'missing_call_id',
		};
	}

	if (!isToolName(parts.tool_name)) {
		return {
			rejection_reason: 'invalid_tool_name',
		};
	}

	const toolInput = normalizeToolInput(parts.tool_input);

	if (!toolInput) {
		return {
			rejection_reason: 'unparseable_tool_input',
		};
	}

	return {
		candidate: {
			call_id: parts.call_id,
			tool_input: toolInput,
			tool_name: parts.tool_name,
		},
	};
}

export function parseToolCallCandidateParts(
	parts: ToolCallCandidateParts,
): ModelToolCallCandidate | undefined {
	return parseToolCallCandidatePartsDetailed(parts).candidate;
}
