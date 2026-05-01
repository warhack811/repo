import { sourceTrustConfig } from './source-trust.js';

function normalizeDomain(domain: string): string {
	return domain.replace(/^www\./u, '').toLocaleLowerCase();
}

function matchesDomain(domain: string, configuredDomain: string): boolean {
	return domain === configuredDomain || domain.endsWith(`.${configuredDomain}`);
}

export function calculateTrustScore(
	input: Readonly<{
		readonly domain: string;
		readonly url: string;
	}>,
): number {
	const domain = normalizeDomain(input.domain);
	const denylisted = sourceTrustConfig.denylist.some((entry) => matchesDomain(domain, entry));

	if (denylisted) {
		return 0.1;
	}

	const allowlisted = sourceTrustConfig.allowlist.some((entry) => matchesDomain(domain, entry));
	const baseScore = allowlisted ? 0.9 : 0.5;
	const httpsBoost = input.url.startsWith('https://') ? 0.05 : 0;

	return Math.min(1, Number((baseScore + httpsBoost).toFixed(2)));
}

export function toTrustTier(trustScore: number): 'general' | 'official' | 'reputable' | 'vendor' {
	if (trustScore >= 0.9) {
		return 'official';
	}

	if (trustScore >= 0.7) {
		return 'reputable';
	}

	if (trustScore >= 0.5) {
		return 'vendor';
	}

	return 'general';
}
