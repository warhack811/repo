import type { ModelToolCallFallthroughSignal } from '@runa/types';

export interface ToolCallFallthroughDetection extends ModelToolCallFallthroughSignal {
	readonly is_fallthrough: boolean;
}

const dsmlMarkers = [/\|DSML\|/iu, /<function_call>/iu, /<\/function_call>/iu];
const jsonNameArgumentsPattern =
	/^\s*\{\s*"name"\s*:\s*"(?<toolName>[\w.-]+)"\s*,\s*"arguments"\s*:\s*\{/iu;
const jsonFunctionArgumentsPattern =
	/^\s*\{\s*"function"\s*:\s*\{\s*"name"\s*:\s*"(?<toolName>[\w.-]+)"\s*,\s*"arguments"\s*:/iu;
const functionSyntaxPattern = /^\s*(?<toolName>[a-zA-Z_][\w.-]*)\s*\(\s*\{/u;
const explicitCallPattern =
	/\b(?:i(?:'ll| will)|let me|going to|calling)\s+call?\s*(?:the\s+)?(?<toolName>[\w.-]+)?(?:\s+tool)?\s+(?:with|using)\s+(?:parameters|arguments)\b/iu;
const callingToolPattern =
	/\bcalling\s+(?:the\s+)?(?<toolName>[\w.-]+)\s+tool\b.*\b(?:with|using)\b/iu;
const partialJsonPattern = /(?:^|[^\w])\{\s*"name"\s*:\s*"(?<toolName>[\w.-]+)"(?:\s*[,}])/iu;
const mediumKeywordJsonPattern = /\b(arguments|parameters)\s*[:=]\s*\{/iu;
const lowKeywordPattern = /\b(tool|function|call)\b/iu;

function emptyResult(): ToolCallFallthroughDetection {
	return {
		confidence: 'low',
		is_fallthrough: false,
	};
}

function normalizeSuspectedToolName(value: string | undefined): string | undefined {
	if (value === undefined) {
		return undefined;
	}

	const trimmed = value.trim();

	return trimmed.length > 0 ? trimmed : undefined;
}

export function detectToolCallFallthrough(textContent: string): ToolCallFallthroughDetection {
	const normalizedText = textContent.trim();

	if (normalizedText.length === 0) {
		return emptyResult();
	}

	for (const markerPattern of dsmlMarkers) {
		if (markerPattern.test(normalizedText)) {
			return {
				confidence: 'high',
				is_fallthrough: true,
				matched_pattern: markerPattern.source,
			};
		}
	}

	const jsonNameMatch = jsonNameArgumentsPattern.exec(normalizedText);

	if (jsonNameMatch) {
		return {
			confidence: 'high',
			is_fallthrough: true,
			matched_pattern: jsonNameArgumentsPattern.source,
			suspected_tool_name: normalizeSuspectedToolName(jsonNameMatch.groups?.['toolName']),
		};
	}

	const jsonFunctionMatch = jsonFunctionArgumentsPattern.exec(normalizedText);

	if (jsonFunctionMatch) {
		return {
			confidence: 'high',
			is_fallthrough: true,
			matched_pattern: jsonFunctionArgumentsPattern.source,
			suspected_tool_name: normalizeSuspectedToolName(jsonFunctionMatch.groups?.['toolName']),
		};
	}

	const functionSyntaxMatch = functionSyntaxPattern.exec(normalizedText);

	if (functionSyntaxMatch) {
		return {
			confidence: 'high',
			is_fallthrough: true,
			matched_pattern: functionSyntaxPattern.source,
			suspected_tool_name: normalizeSuspectedToolName(functionSyntaxMatch.groups?.['toolName']),
		};
	}

	const explicitCallMatch = explicitCallPattern.exec(normalizedText);

	if (explicitCallMatch) {
		return {
			confidence: 'medium',
			is_fallthrough: true,
			matched_pattern: explicitCallPattern.source,
			suspected_tool_name: normalizeSuspectedToolName(explicitCallMatch.groups?.['toolName']),
		};
	}

	const callingToolMatch = callingToolPattern.exec(normalizedText);

	if (callingToolMatch) {
		return {
			confidence: 'medium',
			is_fallthrough: true,
			matched_pattern: callingToolPattern.source,
			suspected_tool_name: normalizeSuspectedToolName(callingToolMatch.groups?.['toolName']),
		};
	}

	const partialJsonMatch = partialJsonPattern.exec(normalizedText);

	if (partialJsonMatch) {
		return {
			confidence: 'medium',
			is_fallthrough: true,
			matched_pattern: partialJsonPattern.source,
			suspected_tool_name: normalizeSuspectedToolName(partialJsonMatch.groups?.['toolName']),
		};
	}

	if (mediumKeywordJsonPattern.test(normalizedText)) {
		return {
			confidence: 'medium',
			is_fallthrough: true,
			matched_pattern: mediumKeywordJsonPattern.source,
		};
	}

	if (lowKeywordPattern.test(normalizedText)) {
		return {
			confidence: 'low',
			is_fallthrough: true,
			matched_pattern: lowKeywordPattern.source,
		};
	}

	return emptyResult();
}
