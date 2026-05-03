import type { DesktopAgentPairingCodePayload } from '@runa/types';

const PAIRING_CODE_PATTERN = /^[A-Z0-9_-]{6,128}$/u;

export function parseDesktopPairingCodeUrl(input: string): DesktopAgentPairingCodePayload | null {
	let parsedUrl: URL;

	try {
		parsedUrl = new URL(input);
	} catch {
		return null;
	}

	if (parsedUrl.protocol !== 'runa:' || parsedUrl.hostname !== 'desktop-pair') {
		return null;
	}

	const code = parsedUrl.searchParams.get('code')?.trim();

	if (!code || !PAIRING_CODE_PATTERN.test(code)) {
		return null;
	}

	return { code };
}

export function findDesktopPairingCodeInArgv(
	argv: readonly string[],
): DesktopAgentPairingCodePayload | null {
	for (const argument of argv) {
		const payload = parseDesktopPairingCodeUrl(argument);

		if (payload) {
			return payload;
		}
	}

	return null;
}

export function maskDesktopPairingCode(code: string): string {
	const normalizedCode = code.trim();

	if (normalizedCode.length <= 4) {
		return '****';
	}

	return `${normalizedCode.slice(0, 4)}...`;
}
