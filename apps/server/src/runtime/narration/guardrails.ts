import type { SupportedLocale } from '@runa/types';

export interface GuardrailContext {
	readonly locale: SupportedLocale;
	readonly previous_narrations: readonly string[];
}

export type GuardrailRejectReason =
	| 'deliberation'
	| 'duplicate'
	| 'empty'
	| 'too_long'
	| 'tool_result_quote';

export interface GuardrailResult {
	readonly accepted: boolean;
	readonly reject_reason?: GuardrailRejectReason;
	readonly sanitized?: string;
}

const MAX_NARRATION_LENGTH = 240;
const TOOL_RESULT_QUOTE_MIN_LENGTH = 30;

const deliberationKeywordsByLocale: Record<SupportedLocale, readonly string[]> = {
	en: [
		'maybe',
		'perhaps',
		'i think',
		"i'm not sure",
		'let me think',
		"i'll try",
		'might',
		'i suppose',
		'i guess',
	],
	tr: [
		'acaba',
		'belki',
		'sanirim',
		'san\u0131r\u0131m',
		'once sunu deneyeyim',
		'\u00f6nce \u015funu deneyeyim',
		'dusunuyorum',
		'd\u00fc\u015f\u00fcn\u00fcyorum',
		'emin degilim',
		'emin de\u011filim',
		'galiba',
		'sanki',
		'olabilir mi',
	],
};

function normalizeText(value: string): string {
	return value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/gu, ' ');
}

function normalizeTextForLocale(value: string, locale: SupportedLocale): string {
	return value
		.trim()
		.toLocaleLowerCase(locale === 'tr' ? 'tr-TR' : 'en-US')
		.replace(/\s+/gu, ' ');
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function createKeywordPattern(keyword: string): RegExp {
	return new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(keyword)}([^\\p{L}\\p{N}_]|$)`, 'iu');
}

function hasDeliberationKeyword(text: string, locale: SupportedLocale): boolean {
	return (Object.keys(deliberationKeywordsByLocale) as SupportedLocale[]).some((keywordLocale) => {
		const normalized = normalizeTextForLocale(text, keywordLocale);

		return deliberationKeywordsByLocale[keywordLocale].some((keyword) =>
			createKeywordPattern(normalizeTextForLocale(keyword, keywordLocale)).test(normalized),
		);
	});
}

function jaccardSimilarity(left: string, right: string): number {
	const leftTerms = new Set(normalizeText(left).split(' ').filter(Boolean));
	const rightTerms = new Set(normalizeText(right).split(' ').filter(Boolean));

	if (leftTerms.size === 0 && rightTerms.size === 0) {
		return 1;
	}

	const intersection = [...leftTerms].filter((term) => rightTerms.has(term)).length;
	const union = new Set([...leftTerms, ...rightTerms]).size;

	return union === 0 ? 0 : intersection / union;
}

function levenshteinSimilarity(left: string, right: string): number {
	const normalizedLeft = normalizeText(left);
	const normalizedRight = normalizeText(right);

	if (normalizedLeft === normalizedRight) {
		return 1;
	}

	const leftLength = normalizedLeft.length;
	const rightLength = normalizedRight.length;

	if (leftLength === 0 || rightLength === 0) {
		return 0;
	}

	const previousRow = Array.from({ length: rightLength + 1 }, (_, index) => index);
	const currentRow = Array.from({ length: rightLength + 1 }, () => 0);

	for (let leftIndex = 1; leftIndex <= leftLength; leftIndex += 1) {
		currentRow[0] = leftIndex;

		for (let rightIndex = 1; rightIndex <= rightLength; rightIndex += 1) {
			const substitutionCost =
				normalizedLeft[leftIndex - 1] === normalizedRight[rightIndex - 1] ? 0 : 1;

			currentRow[rightIndex] = Math.min(
				(previousRow[rightIndex] ?? 0) + 1,
				(currentRow[rightIndex - 1] ?? 0) + 1,
				(previousRow[rightIndex - 1] ?? 0) + substitutionCost,
			);
		}

		for (let index = 0; index <= rightLength; index += 1) {
			previousRow[index] = currentRow[index] ?? 0;
		}
	}

	const distance = previousRow[rightLength] ?? Math.max(leftLength, rightLength);

	return 1 - distance / Math.max(leftLength, rightLength);
}

function isDuplicate(text: string, previousNarrations: readonly string[]): boolean {
	const normalizedText = normalizeText(text);

	return previousNarrations.some((previous) => {
		const normalizedPrevious = normalizeText(previous);

		return (
			normalizedText.includes(normalizedPrevious) ||
			normalizedPrevious.includes(normalizedText) ||
			jaccardSimilarity(normalizedText, normalizedPrevious) > 0.85 ||
			levenshteinSimilarity(normalizedText, normalizedPrevious) > 0.85
		);
	});
}

function truncateAtSentenceBoundary(text: string): string {
	if (text.length <= MAX_NARRATION_LENGTH) {
		return text;
	}

	const clipped = text.slice(0, MAX_NARRATION_LENGTH);
	const sentenceBoundary = Math.max(
		clipped.lastIndexOf('.'),
		clipped.lastIndexOf('!'),
		clipped.lastIndexOf('?'),
		clipped.lastIndexOf('\u3002'),
	);

	if (sentenceBoundary > 0) {
		return clipped.slice(0, sentenceBoundary + 1).trim();
	}

	return `${clipped.slice(0, MAX_NARRATION_LENGTH - 1).trimEnd()}\u2026`;
}

function hasToolResultQuote(text: string, recentToolResults: readonly string[]): boolean {
	const normalizedText = normalizeText(text);

	return recentToolResults.some((result) => {
		const normalizedResult = normalizeText(result);

		if (normalizedText.length < TOOL_RESULT_QUOTE_MIN_LENGTH) {
			return false;
		}

		for (let index = 0; index <= normalizedText.length - TOOL_RESULT_QUOTE_MIN_LENGTH; index += 1) {
			const fragment = normalizedText.slice(index, index + TOOL_RESULT_QUOTE_MIN_LENGTH);

			if (normalizedResult.includes(fragment)) {
				return true;
			}
		}

		return false;
	});
}

export function applyGuardrails(
	text: string,
	ctx: GuardrailContext,
	recent_tool_results: readonly string[] = [],
): GuardrailResult {
	const trimmed = text.trim();

	if (trimmed.length === 0) {
		return {
			accepted: false,
			reject_reason: 'empty',
		};
	}

	if (isDuplicate(trimmed, ctx.previous_narrations)) {
		return {
			accepted: false,
			reject_reason: 'duplicate',
		};
	}

	if (hasDeliberationKeyword(trimmed, ctx.locale)) {
		return {
			accepted: false,
			reject_reason: 'deliberation',
		};
	}

	if (hasToolResultQuote(trimmed, recent_tool_results)) {
		return {
			accepted: false,
			reject_reason: 'tool_result_quote',
		};
	}

	if (trimmed.length > MAX_NARRATION_LENGTH) {
		return {
			accepted: true,
			sanitized: truncateAtSentenceBoundary(trimmed),
		};
	}

	return {
		accepted: true,
		sanitized: trimmed,
	};
}
