const TRACKING_QUERY_PREFIXES = ['utm_'] as const;
const TRACKING_QUERY_KEYS = new Set([
	'fbclid',
	'gclid',
	'gbraid',
	'igshid',
	'mc_cid',
	'mc_eid',
	'msclkid',
	'ref',
	'ref_src',
	'sc_campaign',
	'wbraid',
]);

export interface NormalizedUrl {
	readonly canonical_url: string;
	readonly domain: string;
	readonly favicon: string;
	readonly url: string;
}

function shouldDropSearchParam(key: string): boolean {
	const normalizedKey = key.toLocaleLowerCase();

	return (
		TRACKING_QUERY_KEYS.has(normalizedKey) ||
		TRACKING_QUERY_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix))
	);
}

export function normalizeUrlForEvidence(url: string): NormalizedUrl | undefined {
	try {
		const parsedUrl = new URL(url);

		if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
			return undefined;
		}

		parsedUrl.hash = '';
		parsedUrl.hostname = parsedUrl.hostname.replace(/^www\./u, '').toLocaleLowerCase();

		for (const key of Array.from(parsedUrl.searchParams.keys())) {
			if (shouldDropSearchParam(key)) {
				parsedUrl.searchParams.delete(key);
			}
		}

		const sortedParams = Array.from(parsedUrl.searchParams.entries()).sort(([left], [right]) =>
			left.localeCompare(right),
		);

		parsedUrl.search = '';

		for (const [key, value] of sortedParams) {
			parsedUrl.searchParams.append(key, value);
		}

		const canonicalUrl = parsedUrl.toString();

		return {
			canonical_url: canonicalUrl,
			domain: parsedUrl.hostname,
			favicon: `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=64`,
			url,
		};
	} catch {
		return undefined;
	}
}
