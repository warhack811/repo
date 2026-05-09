import type { AuthSessionTokens } from '@runa/types';

type DesktopCompanionSessionPayload = Readonly<{
	access_token: string;
	expires_at?: number;
	refresh_token?: string;
	token_type?: string;
}>;

type DesktopCompanionApi = Readonly<{
	signOut?: () => Promise<unknown>;
	submitSession?: (session: DesktopCompanionSessionPayload) => Promise<unknown>;
}>;

type WindowWithDesktopCompanion = Window &
	Readonly<{
		runaDesktop?: DesktopCompanionApi;
	}>;

function getDesktopCompanionApi(): DesktopCompanionApi | null {
	if (typeof window === 'undefined') {
		return null;
	}

	const candidate = (window as WindowWithDesktopCompanion).runaDesktop;
	return candidate && typeof candidate === 'object' ? candidate : null;
}

export function bindDesktopCompanionSession(session: AuthSessionTokens | undefined): void {
	const api = getDesktopCompanionApi();
	if (!session) {
		return;
	}

	const accessToken = session.access_token.trim();
	const refreshToken = session.refresh_token?.trim();

	if (!api?.submitSession || !accessToken) {
		return;
	}

	void api.submitSession({
		access_token: accessToken,
		expires_at: session.expires_at,
		refresh_token: refreshToken && refreshToken.length > 0 ? refreshToken : undefined,
		token_type: session.token_type,
	});
}

export function clearDesktopCompanionSession(): void {
	const api = getDesktopCompanionApi();

	if (!api?.signOut) {
		return;
	}

	void api.signOut();
}
