import type { MemoryRecord, MemoryScope, RetrievedMemoryRecord } from '@runa/types';

import type { MemoryStore } from '../persistence/memory-store.js';

import { hydrateMemorySemanticFields, tokenizeMemoryQuery } from './semantic-profile.js';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const MIN_SEMANTIC_SCORE = 0.2;
const RECENCY_WINDOW_DAYS = 14;

type ReadableMemoryStore = Pick<MemoryStore, 'listActiveMemories'>;

export interface RetrieveSemanticMemoriesInput {
	readonly limit?: number;
	readonly memory_store: ReadableMemoryStore;
	readonly query?: string;
	readonly scope: MemoryScope;
	readonly scope_id: string;
}

function normalizeLimit(limit?: number): number {
	if (limit === undefined || !Number.isFinite(limit) || limit < 1) {
		return DEFAULT_LIMIT;
	}

	return Math.min(Math.trunc(limit), MAX_LIMIT);
}

function sortByRecency(records: readonly MemoryRecord[]): readonly MemoryRecord[] {
	return [...records].sort((left, right) => {
		const updatedAtComparison = right.updated_at.localeCompare(left.updated_at);

		if (updatedAtComparison !== 0) {
			return updatedAtComparison;
		}

		return left.memory_id.localeCompare(right.memory_id);
	});
}

function clamp(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function computeRecencyBoost(updatedAt: string): number {
	const updatedTime = Date.parse(updatedAt);

	if (!Number.isFinite(updatedTime)) {
		return 0;
	}

	const ageMs = Date.now() - updatedTime;
	const ageDays = ageMs / (1000 * 60 * 60 * 24);

	return clamp(1 - ageDays / RECENCY_WINDOW_DAYS) * 0.15;
}

function computeTermOverlapScore(
	queryTerms: readonly string[],
	memoryTerms: readonly string[],
): number {
	if (queryTerms.length === 0 || memoryTerms.length === 0) {
		return 0;
	}

	const memoryTermSet = new Set(memoryTerms);
	const matchedTerms = queryTerms.filter((term) => memoryTermSet.has(term));

	if (matchedTerms.length === 0) {
		return 0;
	}

	return matchedTerms.length / Math.max(queryTerms.length, memoryTerms.length);
}

function computeSubstringScore(query: string, retrievalText: string): number {
	const normalizedQuery = query.trim().toLocaleLowerCase('en-US');
	const normalizedText = retrievalText.toLocaleLowerCase('en-US');

	if (!normalizedQuery || !normalizedText) {
		return 0;
	}

	if (normalizedText.includes(normalizedQuery)) {
		return 0.4;
	}

	return 0;
}

function scoreRecord(
	record: MemoryRecord,
	query: string,
	queryTerms: readonly string[],
): RetrievedMemoryRecord {
	const semanticFields = hydrateMemorySemanticFields(record);
	const matchedTerms = queryTerms.filter((term) =>
		semanticFields.embedding_metadata.terms.includes(term),
	);
	const termOverlapScore = computeTermOverlapScore(
		queryTerms,
		semanticFields.embedding_metadata.terms,
	);
	const substringScore = computeSubstringScore(query, semanticFields.retrieval_text);
	const recencyBoost = computeRecencyBoost(record.updated_at);
	const sourceBoost = record.source_kind === 'user_preference' ? 0.1 : 0;
	const retrieval_score = Number(
		(termOverlapScore + substringScore + recencyBoost + sourceBoost).toFixed(4),
	);

	return {
		...record,
		embedding_metadata: semanticFields.embedding_metadata,
		matched_terms: matchedTerms,
		retrieval_reason: 'semantic_overlap',
		retrieval_score,
		retrieval_text: semanticFields.retrieval_text,
	};
}

function toRecentFallback(record: MemoryRecord): RetrievedMemoryRecord {
	const semanticFields = hydrateMemorySemanticFields(record);

	return {
		...record,
		embedding_metadata: semanticFields.embedding_metadata,
		matched_terms: [],
		retrieval_reason: 'recent_fallback',
		retrieval_score: Number(computeRecencyBoost(record.updated_at).toFixed(4)),
		retrieval_text: semanticFields.retrieval_text,
	};
}

function sortRetrievedRecords(
	records: readonly RetrievedMemoryRecord[],
): readonly RetrievedMemoryRecord[] {
	return [...records].sort((left, right) => {
		if (right.retrieval_score !== left.retrieval_score) {
			return right.retrieval_score - left.retrieval_score;
		}

		const updatedAtComparison = right.updated_at.localeCompare(left.updated_at);

		if (updatedAtComparison !== 0) {
			return updatedAtComparison;
		}

		return left.memory_id.localeCompare(right.memory_id);
	});
}

export async function retrieveSemanticMemories(
	input: RetrieveSemanticMemoriesInput,
): Promise<readonly RetrievedMemoryRecord[]> {
	const records = await input.memory_store.listActiveMemories(input.scope, input.scope_id);
	const limit = normalizeLimit(input.limit);
	const query = input.query?.trim();

	if (!query) {
		return sortByRecency(records)
			.slice(0, limit)
			.map((record) => toRecentFallback(record));
	}

	const queryTerms = tokenizeMemoryQuery(query);
	const scoredRecords = sortRetrievedRecords(
		records.map((record) => scoreRecord(record, query, queryTerms)),
	);
	const semanticMatches = scoredRecords.filter(
		(record) => record.retrieval_score >= MIN_SEMANTIC_SCORE,
	);

	if (semanticMatches.length > 0) {
		return semanticMatches.slice(0, limit);
	}

	return sortByRecency(records)
		.slice(0, limit)
		.map((record) => toRecentFallback(record));
}
