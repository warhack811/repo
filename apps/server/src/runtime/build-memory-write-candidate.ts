import type {
	MemoryScope,
	MemoryWriteCandidate,
	UserPreferenceCategory,
	UserPreferenceMemory,
} from '@runa/types';

const MAX_MEMORY_CONTENT_LENGTH = 280;
const MAX_MEMORY_SUMMARY_LENGTH = 120;
const MIN_MEANINGFUL_CONTENT_LENGTH = 8;

const EXPLICIT_USER_MEMORY_PATTERNS = [
	/^remember(?:\s+that|\s+this)?[:\s-]*/iu,
	/^please\s+remember(?:\s+that|\s+this)?[:\s-]*/iu,
	/^my\s+preference\s+is[:\s-]*/iu,
	/^i\s+prefer[:\s-]*/iu,
	/^(?:l(?:u|\u00fc)tfen\s+)?(?:bunu|[\u015fs]unu)\s+hat(?:i|\u0131)rla[:\s-]*/iu,
	/^(?:benim\s+)?tercihim[:\s-]*/iu,
] as const;

export interface UserTextMemoryCandidateSource {
	readonly kind: 'user_text';
	readonly text: string;
}

export interface AssistantTextMemoryCandidateSource {
	readonly content?: string;
	readonly kind: 'assistant_text';
	readonly summary: string;
}

export interface ToolResultMemoryCandidateSource {
	readonly content?: string;
	readonly kind: 'tool_result';
	readonly summary: string;
}

export type BuildMemoryWriteCandidateSource =
	| AssistantTextMemoryCandidateSource
	| ToolResultMemoryCandidateSource
	| UserTextMemoryCandidateSource;

export interface BuildMemoryWriteCandidateInput {
	readonly candidate_policy?: 'general' | 'user_preference';
	readonly run_id?: string;
	readonly scope: MemoryScope;
	readonly scope_id: string;
	readonly source: BuildMemoryWriteCandidateSource;
	readonly trace_id?: string;
}

export interface BuildMemoryWriteCandidateFailure {
	readonly code: 'INVALID_SCOPE_ID';
	readonly message: string;
}

export interface MemoryWriteCandidateCreatedResult {
	readonly candidate: MemoryWriteCandidate;
	readonly status: 'candidate_created';
}

export interface MemoryWriteCandidateNoCandidateResult {
	readonly reason: 'empty_content' | 'insufficient_signal';
	readonly status: 'no_candidate';
}

export interface MemoryWriteCandidateFailureResult {
	readonly failure: BuildMemoryWriteCandidateFailure;
	readonly status: 'failed';
}

export type BuildMemoryWriteCandidateResult =
	| MemoryWriteCandidateCreatedResult
	| MemoryWriteCandidateFailureResult
	| MemoryWriteCandidateNoCandidateResult;

function createFailure(message: string): BuildMemoryWriteCandidateFailure {
	return {
		code: 'INVALID_SCOPE_ID',
		message,
	};
}

function normalizeMemoryText(text: string): string {
	return text.replace(/\s+/gu, ' ').trim();
}

function stripTrailingSentencePunctuation(text: string): string {
	return text.replace(/[.!?]+$/u, '').trim();
}

function truncateMemoryText(text: string, maxLength: number): string {
	return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

function hasMeaningfulContent(text: string): boolean {
	return text.length >= MIN_MEANINGFUL_CONTENT_LENGTH && /[\p{L}\p{N}]/u.test(text);
}

function stripExplicitUserMemoryPrefix(text: string): string {
	const normalizedText = normalizeMemoryText(text);

	if (!normalizedText) {
		return '';
	}

	for (const pattern of EXPLICIT_USER_MEMORY_PATTERNS) {
		if (!pattern.test(normalizedText)) {
			continue;
		}

		return normalizeMemoryText(normalizedText.replace(pattern, ''));
	}

	return normalizedText;
}

function hasExplicitUserMemoryPrefix(text: string): boolean {
	const normalizedText = normalizeMemoryText(text);

	if (!normalizedText) {
		return false;
	}

	return EXPLICIT_USER_MEMORY_PATTERNS.some((pattern) => pattern.test(normalizedText));
}

function extractExplicitUserMemoryContent(text: string): string | undefined {
	if (!hasExplicitUserMemoryPrefix(text)) {
		return undefined;
	}

	const strippedText = stripExplicitUserMemoryPrefix(text);
	return strippedText || undefined;
}

function buildUserPreferenceMemory(
	category: UserPreferenceCategory,
	instruction: UserPreferenceMemory['instruction'],
): UserPreferenceMemory {
	const summaryByCategory: Record<UserPreferenceCategory, UserPreferenceMemory['summary']> = {
		code_example_language: 'Code example language preference',
		response_language: 'Language preference',
		response_style: 'Response style preference',
		test_framework: 'Test framework preference',
		tool_output_style: 'Tool output preference',
	};

	return {
		category,
		instruction,
		scope: 'user',
		source_kind: 'user_preference',
		summary: summaryByCategory[category],
	};
}

function detectUserPreferenceMemory(text: string): UserPreferenceMemory | undefined {
	const normalizedText = normalizeMemoryText(text);
	const strippedText = stripExplicitUserMemoryPrefix(normalizedText);
	const candidateSignals = [
		stripTrailingSentencePunctuation(normalizedText),
		stripTrailingSentencePunctuation(strippedText),
	].filter((signal, index, signals) => signal.length > 0 && signals.indexOf(signal) === index);

	for (const signal of candidateSignals) {
		if (
			/^(?:bundan\s+sonra\s+)?(?:yanıtları|yanitlari|cevapları|cevaplari)\s+(?:türkçe|turkce)\s+ver$/iu.test(
				signal,
			) ||
			/^(?:please\s+)?(?:reply|respond|answer)\s+in\s+turkish$/iu.test(signal)
		) {
			return buildUserPreferenceMemory('response_language', 'Reply in Turkish by default.');
		}

		if (
			/^(?:bundan\s+sonra\s+)?(?:yanıtları|yanitlari|cevapları|cevaplari)\s+(?:ingilizce|english)\s+ver$/iu.test(
				signal,
			) ||
			/^(?:please\s+)?(?:reply|respond|answer)\s+in\s+english$/iu.test(signal)
		) {
			return buildUserPreferenceMemory('response_language', 'Reply in English by default.');
		}

		if (
			/^(?:bundan\s+sonra\s+)?(?:yanıtları|yanitlari|cevapları|cevaplari)\s+(?:kısa|kisa)\s+ver$/iu.test(
				signal,
			) ||
			/^(?:please\s+)?(?:(?:keep|make)\s+(?:your\s+)?(?:answers|responses)\s+(?:short|concise)|be\s+(?:brief|concise))$/iu.test(
				signal,
			)
		) {
			return buildUserPreferenceMemory('response_style', 'Keep responses concise by default.');
		}

		if (
			/^(?:bundan\s+sonra\s+)?(?:yanıtları|yanitlari|cevapları|cevaplari)\s+(?:detaylı|detayli)\s+ver$/iu.test(
				signal,
			) ||
			/^(?:please\s+)?(?:(?:keep|make)\s+(?:your\s+)?(?:answers|responses)\s+detailed|be\s+detailed)$/iu.test(
				signal,
			)
		) {
			return buildUserPreferenceMemory(
				'response_style',
				'Provide more detailed responses by default.',
			);
		}

		if (
			/^(?:kod\s+örneklerinde|kod\s+orneklerinde)\s+typescript\s+tercih\s+et$/iu.test(signal) ||
			/^(?:please\s+)?prefer\s+typescript\s+(?:for\s+)?(?:code\s+examples?|examples)$/iu.test(
				signal,
			)
		) {
			return buildUserPreferenceMemory(
				'code_example_language',
				'Prefer TypeScript for code examples.',
			);
		}

		if (
			/^(?:test\s+eklerken)\s+vitest\s+kullan$/iu.test(signal) ||
			/^(?:please\s+)?use\s+vitest\s+(?:when\s+adding\s+tests?)$/iu.test(signal)
		) {
			return buildUserPreferenceMemory('test_framework', 'Use Vitest when adding tests.');
		}

		if (
			/^(?:diff\s+yerine)\s+direkt\s+d[uü]zeltme\s+[oö]nerisi\s+ver$/iu.test(signal) ||
			/^(?:please\s+)?prefer\s+direct\s+fix(?:es)?\s+over\s+diff(?:\s+previews?)?$/iu.test(signal)
		) {
			return buildUserPreferenceMemory(
				'tool_output_style',
				'Prefer direct fix suggestions over diff previews when safe.',
			);
		}
	}

	return undefined;
}

function buildCandidate(
	input: BuildMemoryWriteCandidateInput,
	source_kind: MemoryWriteCandidate['source_kind'],
	content: string,
	summary: string,
): MemoryWriteCandidateCreatedResult {
	return {
		candidate: {
			content: truncateMemoryText(content, MAX_MEMORY_CONTENT_LENGTH),
			scope: input.scope,
			scope_id: input.scope_id,
			source_kind,
			source_run_id: input.run_id,
			source_trace_id: input.trace_id,
			summary: truncateMemoryText(summary, MAX_MEMORY_SUMMARY_LENGTH),
		},
		status: 'candidate_created',
	};
}

function buildFromUserText(
	input: BuildMemoryWriteCandidateInput,
	source: UserTextMemoryCandidateSource,
): BuildMemoryWriteCandidateResult {
	if (input.candidate_policy === 'user_preference') {
		const preferenceMemory = detectUserPreferenceMemory(source.text);

		if (!preferenceMemory) {
			return {
				reason: normalizeMemoryText(source.text) ? 'insufficient_signal' : 'empty_content',
				status: 'no_candidate',
			};
		}

		if (!hasMeaningfulContent(preferenceMemory.instruction)) {
			return {
				reason: 'insufficient_signal',
				status: 'no_candidate',
			};
		}

		return buildCandidate(
			input,
			preferenceMemory.source_kind,
			preferenceMemory.instruction,
			preferenceMemory.summary,
		);
	}

	const extractedContent = extractExplicitUserMemoryContent(source.text);

	if (!extractedContent) {
		return {
			reason: normalizeMemoryText(source.text) ? 'insufficient_signal' : 'empty_content',
			status: 'no_candidate',
		};
	}

	if (!hasMeaningfulContent(extractedContent)) {
		return {
			reason: 'insufficient_signal',
			status: 'no_candidate',
		};
	}

	return buildCandidate(input, 'user_explicit', extractedContent, extractedContent);
}

function buildFromSummarySource(
	input: BuildMemoryWriteCandidateInput,
	source_kind: MemoryWriteCandidate['source_kind'],
	source: AssistantTextMemoryCandidateSource | ToolResultMemoryCandidateSource,
): BuildMemoryWriteCandidateResult {
	const normalizedSummary = normalizeMemoryText(source.summary);
	const normalizedContent = normalizeMemoryText(source.content ?? source.summary);

	if (!normalizedSummary || !normalizedContent) {
		return {
			reason: 'empty_content',
			status: 'no_candidate',
		};
	}

	if (!hasMeaningfulContent(normalizedSummary) || !hasMeaningfulContent(normalizedContent)) {
		return {
			reason: 'insufficient_signal',
			status: 'no_candidate',
		};
	}

	return buildCandidate(input, source_kind, normalizedContent, normalizedSummary);
}

export function buildMemoryWriteCandidate(
	input: BuildMemoryWriteCandidateInput,
): BuildMemoryWriteCandidateResult {
	if (!normalizeMemoryText(input.scope_id)) {
		return {
			failure: createFailure('buildMemoryWriteCandidate requires a non-empty scope_id.'),
			status: 'failed',
		};
	}

	if (input.source.kind === 'user_text') {
		return buildFromUserText(input, input.source);
	}

	if (input.source.kind === 'assistant_text') {
		return buildFromSummarySource(input, 'system_inferred', input.source);
	}

	return buildFromSummarySource(input, 'tool_result', input.source);
}
