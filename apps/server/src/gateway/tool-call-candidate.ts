import type { ModelToolCallCandidate, ToolArguments, ToolName } from '@runa/types';

export type ToolInputRepairStrategy =
	| 'empty_default'
	| 'fence_stripped'
	| 'sanitized'
	| 'strict'
	| 'trailing_comma'
	| 'wrapped';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isToolName(value: unknown): value is ToolName {
	return typeof value === 'string' && value.trim().length > 0 && value.includes('.');
}

interface NormalizeToolInputResult {
	readonly repair_strategy: ToolInputRepairStrategy;
	readonly tool_input: ToolArguments;
}

function parsePlainRecord(text: string): ToolArguments | undefined {
	try {
		const parsed = JSON.parse(text) as unknown;

		return isRecord(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

function sanitizeToolInputText(value: string): string {
	let start = 0;
	let end = value.length;

	while (start < end) {
		const code = value.charCodeAt(start);
		if (code !== 0xfeff && code > 0x1f) {
			break;
		}
		start += 1;
	}

	while (end > start) {
		const code = value.charCodeAt(end - 1);
		if (code !== 0xfeff && code > 0x1f) {
			break;
		}
		end -= 1;
	}

	return value.slice(start, end).trim();
}

function stripMarkdownCodeFence(value: string): string | undefined {
	const match = /^\s*```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/u.exec(value);

	return match?.[1];
}

function stripTrailingCommas(value: string): string | undefined {
	let changed = false;
	let isEscaped = false;
	let isInString = false;
	let output = '';

	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];

		if (character === undefined) {
			continue;
		}

		if (isInString) {
			output += character;

			if (isEscaped) {
				isEscaped = false;
				continue;
			}

			if (character === '\\') {
				isEscaped = true;
				continue;
			}

			if (character === '"') {
				isInString = false;
			}

			continue;
		}

		if (character === '"') {
			isInString = true;
			output += character;
			continue;
		}

		if (character === ',') {
			let lookaheadIndex = index + 1;

			while (/\s/u.test(value[lookaheadIndex] ?? '')) {
				lookaheadIndex += 1;
			}

			const nextSignificantCharacter = value[lookaheadIndex];

			if (nextSignificantCharacter === '}' || nextSignificantCharacter === ']') {
				changed = true;
				continue;
			}
		}

		output += character;
	}

	return changed ? output : undefined;
}

function hasTopLevelColon(value: string): boolean {
	let depth = 0;
	let isEscaped = false;
	let isInString = false;

	for (const character of value) {
		if (isInString) {
			if (isEscaped) {
				isEscaped = false;
				continue;
			}

			if (character === '\\') {
				isEscaped = true;
				continue;
			}

			if (character === '"') {
				isInString = false;
			}

			continue;
		}

		if (character === '"') {
			isInString = true;
			continue;
		}

		if (character === '{' || character === '[') {
			depth += 1;
			continue;
		}

		if (character === '}' || character === ']') {
			depth -= 1;
			continue;
		}

		if (character === ':' && depth === 0) {
			return true;
		}
	}

	return false;
}

function wrapBareObject(value: string): string | undefined {
	const trimmedValue = value.trim();

	if (
		trimmedValue.length === 0 ||
		trimmedValue.startsWith('{') ||
		trimmedValue.endsWith('}') ||
		!hasTopLevelColon(trimmedValue)
	) {
		return undefined;
	}

	return `{${trimmedValue}}`;
}

function normalizeToolInput(value: unknown): NormalizeToolInputResult | undefined {
	if (value === undefined || value === null) {
		return {
			repair_strategy: 'empty_default',
			tool_input: {},
		};
	}

	if (isRecord(value)) {
		return {
			repair_strategy: 'strict',
			tool_input: value,
		};
	}

	if (typeof value !== 'string') {
		return undefined;
	}

	if (value.trim().length === 0) {
		return {
			repair_strategy: 'empty_default',
			tool_input: {},
		};
	}

	const strictParsed = parsePlainRecord(value);

	if (strictParsed) {
		return {
			repair_strategy: 'strict',
			tool_input: strictParsed,
		};
	}

	const sanitizedText = sanitizeToolInputText(value);

	if (sanitizedText.length === 0) {
		return {
			repair_strategy: 'empty_default',
			tool_input: {},
		};
	}

	const sanitizedParsed = sanitizedText === value ? undefined : parsePlainRecord(sanitizedText);

	if (sanitizedParsed) {
		return {
			repair_strategy: 'sanitized',
			tool_input: sanitizedParsed,
		};
	}

	const fenceStrippedText = stripMarkdownCodeFence(sanitizedText);
	const fenceStrippedParsed =
		fenceStrippedText === undefined ? undefined : parsePlainRecord(fenceStrippedText);

	if (fenceStrippedParsed) {
		return {
			repair_strategy: 'fence_stripped',
			tool_input: fenceStrippedParsed,
		};
	}

	const trailingCommaStrippedText = stripTrailingCommas(fenceStrippedText ?? sanitizedText);
	const trailingCommaParsed =
		trailingCommaStrippedText === undefined
			? undefined
			: parsePlainRecord(trailingCommaStrippedText);

	if (trailingCommaParsed) {
		return {
			repair_strategy: 'trailing_comma',
			tool_input: trailingCommaParsed,
		};
	}

	const wrappedText = wrapBareObject(fenceStrippedText ?? sanitizedText);
	const wrappedParsed = wrappedText === undefined ? undefined : parsePlainRecord(wrappedText);

	if (wrappedParsed) {
		return {
			repair_strategy: 'wrapped',
			tool_input: wrappedParsed,
		};
	}

	return undefined;
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
	readonly repair_strategy?: ToolInputRepairStrategy;
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

	const toolInputResult = normalizeToolInput(parts.tool_input);

	if (!toolInputResult) {
		return {
			rejection_reason: 'unparseable_tool_input',
		};
	}

	return {
		candidate: {
			call_id: parts.call_id,
			tool_input: toolInputResult.tool_input,
			tool_name: parts.tool_name,
		},
		repair_strategy: toolInputResult.repair_strategy,
	};
}

export function parseToolCallCandidateParts(
	parts: ToolCallCandidateParts,
): ModelToolCallCandidate | undefined {
	return parseToolCallCandidatePartsDetailed(parts).candidate;
}
