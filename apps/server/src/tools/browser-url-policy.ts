import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const BLOCKED_HOSTNAMES = new Set([
	'0.0.0.0',
	'127.0.0.1',
	'::',
	'::1',
	'gateway.docker.internal',
	'host.docker.internal',
	'kubernetes.docker.internal',
	'localhost',
	'metadata',
	'metadata.google.internal',
]);
const BLOCKED_HOSTNAME_SUFFIXES = ['.internal', '.local', '.localhost'] as const;
const BLOCKED_METADATA_HOSTS = new Set(['169.254.169.254', '100.100.100.200']);

export type BrowserUrlPolicyReason =
	| 'credentials_in_url'
	| 'dangerous_scheme'
	| 'invalid_url'
	| 'local_network'
	| 'metadata_endpoint';

export interface BrowserUrlPolicyAllowedResult {
	readonly normalized_url: string;
	readonly status: 'allowed';
}

export interface BrowserUrlPolicyBlockedResult {
	readonly detail: string;
	readonly reason: BrowserUrlPolicyReason;
	readonly status: 'blocked';
}

export type BrowserUrlPolicyResult = BrowserUrlPolicyAllowedResult | BrowserUrlPolicyBlockedResult;

export interface BrowserUrlPolicyDependencies {
	readonly lookupHostAddresses: (hostname: string) => Promise<readonly string[]>;
}

function normalizeHostname(hostname: string): string {
	return hostname.trim().toLocaleLowerCase();
}

function normalizeIpv4(value: string): string | undefined {
	const parts = value.split('.');

	if (parts.length !== 4) {
		return undefined;
	}

	const octets = parts.map((part) => Number.parseInt(part, 10));

	if (
		octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255) ||
		octets.length !== 4
	) {
		return undefined;
	}

	return octets.join('.');
}

function isPrivateIpv4(value: string): boolean {
	const normalized = normalizeIpv4(value);

	if (!normalized) {
		return false;
	}

	const octets = normalized.split('.').map((part) => Number.parseInt(part, 10));
	const first = octets[0];
	const second = octets[1];

	if (first === undefined || second === undefined) {
		return false;
	}

	if (
		first === 0 ||
		first === 10 ||
		first === 127 ||
		(first === 169 && second === 254) ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 168)
	) {
		return true;
	}

	if (first === 100 && second >= 64 && second <= 127) {
		return true;
	}

	return false;
}

function isPrivateIpv6(value: string): boolean {
	const normalized = value.trim().toLocaleLowerCase();

	return (
		normalized === '::' ||
		normalized === '::1' ||
		normalized.startsWith('fc') ||
		normalized.startsWith('fd') ||
		normalized.startsWith('fe8') ||
		normalized.startsWith('fe9') ||
		normalized.startsWith('fea') ||
		normalized.startsWith('feb')
	);
}

function isPrivateAddress(value: string): boolean {
	const version = isIP(value);

	if (version === 4) {
		return isPrivateIpv4(value);
	}

	if (version === 6) {
		return isPrivateIpv6(value);
	}

	return false;
}

function isBlockedHostname(hostname: string): boolean {
	const normalizedHostname = normalizeHostname(hostname);

	if (BLOCKED_HOSTNAMES.has(normalizedHostname)) {
		return true;
	}

	return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => normalizedHostname.endsWith(suffix));
}

async function defaultLookupHostAddresses(hostname: string): Promise<readonly string[]> {
	const results = await dnsLookup(hostname, { all: true });

	return results.map((result) => result.address);
}

function createBlockedResult(
	reason: BrowserUrlPolicyReason,
	detail: string,
): BrowserUrlPolicyBlockedResult {
	return {
		detail,
		reason,
		status: 'blocked',
	};
}

export async function evaluateBrowserUrlPolicy(
	url: string,
	dependencies: BrowserUrlPolicyDependencies = {
		lookupHostAddresses: defaultLookupHostAddresses,
	},
): Promise<BrowserUrlPolicyResult> {
	let parsedUrl: URL;

	try {
		parsedUrl = new URL(url);
	} catch {
		return createBlockedResult('invalid_url', 'browser.navigate requires a valid absolute URL.');
	}

	if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
		return createBlockedResult(
			'dangerous_scheme',
			`URL scheme ${parsedUrl.protocol} is blocked for browser automation.`,
		);
	}

	if (parsedUrl.username.length > 0 || parsedUrl.password.length > 0) {
		return createBlockedResult(
			'credentials_in_url',
			'Credential-bearing URLs are blocked for browser automation.',
		);
	}

	const hostname = normalizeHostname(parsedUrl.hostname);

	if (BLOCKED_METADATA_HOSTS.has(hostname)) {
		return createBlockedResult(
			'metadata_endpoint',
			`Metadata endpoint access is blocked: ${hostname}.`,
		);
	}

	if (isBlockedHostname(hostname) || isPrivateAddress(hostname)) {
		return createBlockedResult(
			'local_network',
			`Local or private network targets are blocked: ${hostname}.`,
		);
	}

	try {
		const resolvedAddresses = await dependencies.lookupHostAddresses(hostname);

		if (resolvedAddresses.some((address) => BLOCKED_METADATA_HOSTS.has(address))) {
			return createBlockedResult(
				'metadata_endpoint',
				`Metadata endpoint access is blocked: ${hostname}.`,
			);
		}

		if (resolvedAddresses.some((address) => isPrivateAddress(address))) {
			return createBlockedResult(
				'local_network',
				`Resolved private network target is blocked: ${hostname}.`,
			);
		}
	} catch {
		// Fall through. The browser layer can report normal resolution failures.
	}

	return {
		normalized_url: parsedUrl.toString(),
		status: 'allowed',
	};
}

export const defaultBrowserUrlPolicyDependencies = {
	lookupHostAddresses: defaultLookupHostAddresses,
} as const satisfies BrowserUrlPolicyDependencies;
