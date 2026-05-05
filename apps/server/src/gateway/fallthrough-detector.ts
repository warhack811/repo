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
	/\b(?:i(?:'ll| will)|let me|going to)\s+call\s+(?:the\s+)?(?<toolName>[\w.-]+)(?:\s+tool)?\s+with\s+(?:parameters|arguments)\b/iu;
const mediumKeywordJsonPattern = /\b(arguments|parameters)\s*[:=]\s*\{/iu;

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
			};
		}
	}

	const jsonNameMatch = jsonNameArgumentsPattern.exec(normalizedText);

	if (jsonNameMatch) {
		return {
			confidence: 'high',
			is_fallthrough: true,
			suspected_tool_name: normalizeSuspectedToolName(jsonNameMatch.groups?.['toolName']),
		};
	}

	const jsonFunctionMatch = jsonFunctionArgumentsPattern.exec(normalizedText);

	if (jsonFunctionMatch) {
		return {
			confidence: 'high',
			is_fallthrough: true,
			suspected_tool_name: normalizeSuspectedToolName(jsonFunctionMatch.groups?.['toolName']),
		};
	}

	const functionSyntaxMatch = functionSyntaxPattern.exec(normalizedText);

	if (functionSyntaxMatch) {
		return {
			confidence: 'high',
			is_fallthrough: true,
			suspected_tool_name: normalizeSuspectedToolName(functionSyntaxMatch.groups?.['toolName']),
		};
	}

	const explicitCallMatch = explicitCallPattern.exec(normalizedText);

	if (explicitCallMatch) {
		return {
			confidence: 'high',
			is_fallthrough: true,
			suspected_tool_name: normalizeSuspectedToolName(explicitCallMatch.groups?.['toolName']),
		};
	}

	if (mediumKeywordJsonPattern.test(normalizedText)) {
		return {
			confidence: 'medium',
			is_fallthrough: true,
		};
	}

	return emptyResult();
}
