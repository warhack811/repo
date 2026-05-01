export interface DedupCandidate {
	readonly canonical_url: string;
	readonly snippet: string;
	readonly title: string;
}

function normalizeText(value: string): string {
	return value
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}\s]+/gu, ' ')
		.replace(/\s+/gu, ' ')
		.trim();
}

function toTrigrams(value: string): ReadonlySet<string> {
	const normalizedValue = normalizeText(value);
	const shingles = new Set<string>();

	if (normalizedValue.length <= 3) {
		if (normalizedValue.length > 0) {
			shingles.add(normalizedValue);
		}

		return shingles;
	}

	for (let index = 0; index <= normalizedValue.length - 3; index += 1) {
		shingles.add(normalizedValue.slice(index, index + 3));
	}

	return shingles;
}

function jaccard(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
	if (left.size === 0 && right.size === 0) {
		return 1;
	}

	let intersection = 0;

	for (const item of left) {
		if (right.has(item)) {
			intersection += 1;
		}
	}

	return intersection / (left.size + right.size - intersection);
}

export function dedupEvidenceCandidates<TCandidate extends DedupCandidate>(
	candidates: readonly TCandidate[],
): readonly TCandidate[] {
	const keptCandidates: TCandidate[] = [];
	const seenCanonicalUrls = new Set<string>();
	const keptTextSignals: ReadonlySet<string>[] = [];

	for (const candidate of candidates) {
		if (seenCanonicalUrls.has(candidate.canonical_url)) {
			continue;
		}

		const textSignal = toTrigrams(`${candidate.title} ${candidate.snippet}`);
		const isDuplicate = keptTextSignals.some(
			(keptSignal) => jaccard(keptSignal, textSignal) > 0.85,
		);

		if (isDuplicate) {
			continue;
		}

		seenCanonicalUrls.add(candidate.canonical_url);
		keptTextSignals.push(textSignal);
		keptCandidates.push(candidate);
	}

	return keptCandidates;
}
