import type { ModelToolCallCandidate, ToolArguments, ToolName } from '@runa/types';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isToolName(value: unknown): value is ToolName {
	return typeof value === 'string' && value.trim().length > 0 && value.includes('.');
}

function normalizeToolInput(value: unknown): ToolArguments | undefined {
	if (isRecord(value)) {
		return value;
	}

	if (typeof value !== 'string') {
		return undefined;
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

export function parseToolCallCandidateParts(
	parts: ToolCallCandidateParts,
): ModelToolCallCandidate | undefined {
	if (typeof parts.call_id !== 'string' || parts.call_id.trim().length === 0) {
		return undefined;
	}

	if (!isToolName(parts.tool_name)) {
		return undefined;
	}

	const toolInput = normalizeToolInput(parts.tool_input);

	if (!toolInput) {
		return undefined;
	}

	return {
		call_id: parts.call_id,
		tool_input: toolInput,
		tool_name: parts.tool_name,
	};
}
