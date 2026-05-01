import type { EvidencePack, EvidenceSource } from '@runa/types';

import type { SearchIntent, SearchProvider } from '../search/provider.js';
import { sanitizePromptContent } from '../utils/sanitize-prompt-content.js';
import { dedupEvidenceCandidates } from './dedup.js';
import { extractContent } from './extract-content.js';
import { extractPublishedAt } from './extract-date.js';
import { normalizeUrlForEvidence } from './normalize.js';
import { getRecencyRankScore } from './recency-rank.js';
import { evidenceCompilerStrings } from './strings.js';
import { calculateTrustScore } from './trust-score.js';

const DEFAULT_EVIDENCE_LIMIT = 8;
const UNRELIABLE_TRUST_THRESHOLD = 0.3;

export interface CompileOptions {
	readonly country?: string;
	readonly freshness?: 'hour' | 'day' | 'week' | 'month' | 'year' | null;
	readonly intent: SearchIntent;
	readonly limit?: number;
	readonly locale?: string;
	readonly now?: Date;
	readonly provider: SearchProvider;
}

export interface CompiledEvidence {
	readonly evidence: EvidencePack;
	readonly model_context: string;
	readonly provider: string;
}

interface CandidateEvidenceSource extends EvidenceSource {
	readonly position: number;
}

function normalizeLimit(limit: number | undefined): number {
	if (limit === undefined) {
		return DEFAULT_EVIDENCE_LIMIT;
	}

	return Number.isInteger(limit) && limit > 0
		? Math.min(limit, DEFAULT_EVIDENCE_LIMIT)
		: DEFAULT_EVIDENCE_LIMIT;
}

function createSourceId(index: number): string {
	return `src-${index + 1}`;
}

function createModelContext(evidence: EvidencePack): string {
	if (evidence.unreliable === true || evidence.sources.length === 0) {
		return evidenceCompilerStrings.noReliableCurrentSources;
	}

	return evidence.sources
		.map((source, index) => {
			const publishedAt = source.published_at ?? 'unknown date';
			return `${index + 1}. ${source.title} (${source.domain}, ${publishedAt}) - ${source.snippet}`;
		})
		.join('\n');
}

export async function compileEvidence(
	query: string,
	options: CompileOptions,
): Promise<CompiledEvidence> {
	const limit = normalizeLimit(options.limit);
	const rawResults = await options.provider.search(query, {
		country: options.country ?? 'tr',
		freshness: options.freshness ?? null,
		intent: options.intent,
		locale: options.locale ?? 'tr-TR',
		top_k: Math.min(limit * 2, 10),
	});

	const candidates: CandidateEvidenceSource[] = [];

	for (const rawResult of rawResults) {
		const normalizedUrl = normalizeUrlForEvidence(rawResult.url);

		if (!normalizedUrl) {
			continue;
		}

		const content = await extractContent(rawResult);
		const trustScore = calculateTrustScore({
			domain: normalizedUrl.domain,
			url: normalizedUrl.canonical_url,
		});

		candidates.push({
			canonical_url: normalizedUrl.canonical_url,
			domain: normalizedUrl.domain,
			favicon: normalizedUrl.favicon,
			id: createSourceId(candidates.length),
			position: rawResult.position,
			published_at: extractPublishedAt(rawResult.raw_date, { now: options.now }),
			snippet: sanitizePromptContent(content.snippet),
			title: sanitizePromptContent(rawResult.title),
			trust_score: trustScore,
			url: normalizedUrl.url,
		});
	}

	const dedupedCandidates = dedupEvidenceCandidates(candidates);
	const rankedCandidates = [...dedupedCandidates].sort((left, right) => {
		const rightScore = getRecencyRankScore(right, {
			intent: options.intent,
			now: options.now,
		});
		const leftScore = getRecencyRankScore(left, {
			intent: options.intent,
			now: options.now,
		});

		return rightScore - leftScore;
	});
	const visibleSources = rankedCandidates.slice(0, limit).map((source, index) => ({
		...source,
		id: createSourceId(index),
	}));
	const allSourcesUnreliable =
		visibleSources.length > 0 &&
		visibleSources.every((source) => source.trust_score < UNRELIABLE_TRUST_THRESHOLD);
	const finalSources = allSourcesUnreliable ? [] : visibleSources;
	const evidence: EvidencePack = {
		query,
		results: finalSources.length,
		searches: 1,
		sources: finalSources,
		truncated: rankedCandidates.length > finalSources.length,
		unreliable: allSourcesUnreliable ? true : undefined,
	};

	return {
		evidence,
		model_context: createModelContext(evidence),
		provider: options.provider.name,
	};
}
