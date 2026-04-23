import type { MemoryEmbeddingMetadata, MemoryRecord } from '@runa/types';

const MAX_PROFILE_TERMS = 24;

const STOP_WORDS = new Set([
	'a',
	'an',
	'and',
	'are',
	'as',
	'at',
	'be',
	'bu',
	'burada',
	'da',
	'daha',
	'de',
	'for',
	'from',
	'has',
	'have',
	'i',
	'icin',
	'ile',
	'in',
	'is',
	'it',
	'mi',
	'my',
	'of',
	'on',
	'or',
	'that',
	'the',
	'this',
	'tu',
	'un',
	've',
	'veya',
	'we',
	'with',
	'ya',
	'your',
]);

function normalizeText(text: string): string {
	return text
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLocaleLowerCase('en-US')
		.replace(/[^a-z0-9\s]+/gu, ' ')
		.replace(/\s+/gu, ' ')
		.trim();
}

function tokenize(text: string): readonly string[] {
	return normalizeText(text)
		.split(' ')
		.filter((term) => term.length >= 3 && !STOP_WORDS.has(term));
}

function uniqueTerms(terms: readonly string[]): readonly string[] {
	return Array.from(new Set(terms)).sort((left, right) => {
		if (right.length !== left.length) {
			return right.length - left.length;
		}

		return left.localeCompare(right);
	});
}

function createFingerprint(text: string): string {
	return normalizeText(text).replace(/\s+/gu, '-');
}

export function buildMemoryRetrievalText(input: {
	readonly content: string;
	readonly summary: string;
}): string {
	return [input.summary.trim(), input.content.trim()]
		.filter((value) => value.length > 0)
		.join('\n');
}

export function buildMemoryEmbeddingMetadata(input: {
	readonly content: string;
	readonly summary: string;
}): MemoryEmbeddingMetadata {
	const retrievalText = buildMemoryRetrievalText(input);
	const terms = uniqueTerms(tokenize(retrievalText)).slice(0, MAX_PROFILE_TERMS);

	return {
		content_fingerprint: createFingerprint(retrievalText),
		profile: 'token_overlap_v1',
		term_count: terms.length,
		terms,
	};
}

export function hydrateMemorySemanticFields(
	record: Pick<MemoryRecord, 'content' | 'embedding_metadata' | 'retrieval_text' | 'summary'>,
): Readonly<{
	readonly embedding_metadata: MemoryEmbeddingMetadata;
	readonly retrieval_text: string;
}> {
	const retrieval_text =
		record.retrieval_text && record.retrieval_text.trim().length > 0
			? record.retrieval_text
			: buildMemoryRetrievalText(record);
	const embedding_metadata =
		record.embedding_metadata &&
		record.embedding_metadata.profile === 'token_overlap_v1' &&
		record.embedding_metadata.terms.length > 0
			? record.embedding_metadata
			: buildMemoryEmbeddingMetadata({
					content: record.content,
					summary: record.summary,
				});

	return {
		embedding_metadata,
		retrieval_text,
	};
}

export function tokenizeMemoryQuery(query: string): readonly string[] {
	return uniqueTerms(tokenize(query)).slice(0, MAX_PROFILE_TERMS);
}
