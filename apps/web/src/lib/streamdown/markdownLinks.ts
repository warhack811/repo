const UNSAFE_PROTOCOLS = ['javascript:', 'data:', 'vbscript:'];
const EXTERNAL_PROTOCOLS = ['http:', 'https:'];

function isProtocolUnsafe(protocol: string): boolean {
	return UNSAFE_PROTOCOLS.includes(protocol);
}

export function isExternalHref(href: string): boolean {
	try {
		const url = new URL(href);
		return EXTERNAL_PROTOCOLS.includes(url.protocol);
	} catch {
		return false;
	}
}

export function getSafeHref(href: unknown): string | undefined {
	if (typeof href !== 'string') {
		return undefined;
	}

	const trimmed = href.trim();
	if (!trimmed) {
		return undefined;
	}

	try {
		const url = new URL(trimmed);
		if (isProtocolUnsafe(url.protocol)) {
			return undefined;
		}
	} catch {
		if (trimmed.startsWith('#') || trimmed.startsWith('/')) {
			return trimmed;
		}
		for (const protocol of UNSAFE_PROTOCOLS) {
			if (trimmed.toLowerCase().startsWith(protocol)) {
				return undefined;
			}
		}
	}

	return trimmed;
}
