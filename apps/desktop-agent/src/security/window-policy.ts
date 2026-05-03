export interface AllowedExternalUrlPolicy {
	readonly allowed_domains: readonly string[];
}

const DEFAULT_ALLOWED_EXTERNAL_DOMAINS = ['runa.app', '*.runa.app'] as const;

function normalizeDomain(domain: string): string | null {
	const normalized = domain.trim().toLowerCase();

	if (!normalized || normalized.includes('://') || normalized.includes('/')) {
		return null;
	}

	return normalized;
}

export function readAllowedExternalUrlPolicy(
	environment: NodeJS.ProcessEnv = process.env,
): AllowedExternalUrlPolicy {
	const configuredDomains = environment['RUNA_ALLOWED_EXTERNAL_DOMAINS']
		?.split(',')
		.map((domain) => normalizeDomain(domain))
		.filter((domain): domain is string => domain !== null);

	return {
		allowed_domains:
			configuredDomains && configuredDomains.length > 0
				? configuredDomains
				: DEFAULT_ALLOWED_EXTERNAL_DOMAINS,
	};
}

function matchesAllowedDomain(hostname: string, allowedDomain: string): boolean {
	const normalizedHostname = hostname.toLowerCase();

	if (allowedDomain.startsWith('*.')) {
		const suffix = allowedDomain.slice(2);
		return normalizedHostname !== suffix && normalizedHostname.endsWith(`.${suffix}`);
	}

	return normalizedHostname === allowedDomain;
}

export function isAllowedExternalUrl(
	url: string,
	policy: AllowedExternalUrlPolicy = readAllowedExternalUrlPolicy(),
): boolean {
	let parsedUrl: URL;

	try {
		parsedUrl = new URL(url);
	} catch {
		return false;
	}

	if (parsedUrl.protocol !== 'https:') {
		return false;
	}

	return policy.allowed_domains.some((domain) => matchesAllowedDomain(parsedUrl.hostname, domain));
}
