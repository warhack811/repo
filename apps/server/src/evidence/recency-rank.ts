import type { SearchIntent } from '../search/provider.js';

export interface RecencyRankCandidate {
	readonly position: number;
	readonly published_at: string | null;
	readonly trust_score: number;
}

function getAgeMs(publishedAt: string | null, now: Date): number | null {
	if (!publishedAt) {
		return null;
	}

	const time = Date.parse(publishedAt);

	return Number.isFinite(time) ? now.getTime() - time : null;
}

export function getRecencyRankScore(
	candidate: RecencyRankCandidate,
	options: Readonly<{
		readonly intent: SearchIntent;
		readonly now?: Date;
	}>,
): number {
	const relevanceScore = Math.max(0, 1 - (candidate.position - 1) * 0.05);
	const trustScore = candidate.trust_score;

	if (options.intent !== 'news') {
		return relevanceScore * 0.65 + trustScore * 0.35;
	}

	const ageMs = getAgeMs(candidate.published_at, options.now ?? new Date());
	let recencyScore = 0.1;

	if (ageMs !== null && ageMs >= 0) {
		const ageHours = ageMs / (60 * 60 * 1000);

		if (ageHours <= 24) {
			recencyScore = 1;
		} else if (ageHours <= 24 * 7) {
			recencyScore = 0.75;
		} else if (ageHours <= 24 * 30) {
			recencyScore = 0.45;
		} else {
			recencyScore = 0.15;
		}
	}

	return relevanceScore * 0.35 + trustScore * 0.25 + recencyScore * 0.4;
}
