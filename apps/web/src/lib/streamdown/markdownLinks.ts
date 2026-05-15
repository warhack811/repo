const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];
const BLOCKED_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:', 'ftp:', 'chrome:'];

function getProtocol(href: string): string | null {
	try {
		return new URL(href).protocol;
	} catch {
		return null;
	}
}

export function isExternalHref(href: string): boolean {
	if (href.startsWith('//')) {
		return true;
	}

	const protocol = getProtocol(href);
	return protocol === 'http:' || protocol === 'https:';
}

export function getSafeHref(href: unknown): string | undefined {
	if (typeof href !== 'string') {
		return undefined;
	}

	const trimmed = href.trim();
	if (!trimmed) {
		return undefined;
	}

	const protocol = getProtocol(trimmed);

	if (protocol) {
		if (ALLOWED_PROTOCOLS.includes(protocol)) {
			return trimmed;
		}

		return undefined;
	}

	if (trimmed.startsWith('//')) {
		return trimmed;
	}

	if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
		return trimmed;
	}

	const lower = trimmed.toLowerCase();
	for (const blocked of BLOCKED_PROTOCOLS) {
		if (lower.startsWith(blocked)) {
			return undefined;
		}
	}

	if (/^[a-z][a-z0-9.+-]*:\/\//i.test(trimmed)) {
		return undefined;
	}

	return trimmed;
}
