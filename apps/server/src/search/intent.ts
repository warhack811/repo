import type { SearchIntent } from './provider.js';

const NEWS_PATTERNS = [
	/\bbug[uü]n\b/iu,
	/\bson dakika\b/iu,
	/\baz [oö]nce\b/iu,
	/(^|\s)[sş]imdi($|\s)/iu,
	/\bg[uü]ncel\b/iu,
	/\bdakikalar [oö]nce\b/iu,
	/\bson haber\b/iu,
	/\bka[cç] saat [oö]nce\b/iu,
	/\btoday\b/iu,
	/\bbreaking\b/iu,
	/\blatest\b/iu,
	/\bnow\b/iu,
	/\bcurrent\b/iu,
	/\bjust now\b/iu,
] as const;

const RESEARCH_PATTERNS = [
	/\bnedir\b/iu,
	/\bkim\b/iu,
	/\ba[cç][iı]kla\b/iu,
	/\btarih[cç]e\b/iu,
	/\bnas[iı]l [cç]al[iı][sş][iı]r\b/iu,
	/\bne demek\b/iu,
	/\bwhat is\b/iu,
	/\bwho is\b/iu,
	/\bexplain\b/iu,
	/\bhistory of\b/iu,
	/\bhow does\b/iu,
	/\bmeaning of\b/iu,
] as const;

export function classifySearchIntent(query: string): SearchIntent {
	const normalizedQuery = query.replace(/\s+/gu, ' ').trim();

	if (NEWS_PATTERNS.some((pattern) => pattern.test(normalizedQuery))) {
		return 'news';
	}

	if (RESEARCH_PATTERNS.some((pattern) => pattern.test(normalizedQuery))) {
		return 'research';
	}

	return 'general';
}
