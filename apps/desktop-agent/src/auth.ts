import type { AuthPasswordActionResponse, AuthSessionTokens } from '@runa/types';

export interface DesktopAgentEnvironment {
	readonly RUNA_DESKTOP_AGENT_ACCESS_TOKEN?: string;
	readonly RUNA_DESKTOP_AGENT_ID?: string;
	readonly RUNA_DESKTOP_AGENT_MACHINE_LABEL?: string;
	readonly RUNA_DESKTOP_AGENT_SERVER_URL?: string;
}

export interface DesktopAgentBootstrapConfig {
	readonly agent_id: string;
	readonly initial_session?: DesktopAgentPersistedSession;
	readonly machine_label?: string;
	readonly server_url: string;
}

export interface DesktopAgentConfig {
	readonly access_token: string;
	readonly agent_id: string;
	readonly machine_label?: string;
	readonly server_url: string;
}

export interface DesktopAgentPersistedSession extends AuthSessionTokens {
	readonly access_token: string;
	readonly expires_at?: number;
	readonly refresh_token?: string;
	readonly token_type?: string;
}

export interface DesktopAgentSessionInputPayload {
	readonly access_token: string;
	readonly expires_at?: number;
	readonly refresh_token?: string;
	readonly token_type?: string;
}

export type DesktopAgentAuthFetch = typeof fetch;

interface AuthenticatedActionResponseCandidate extends Record<string, unknown> {
	readonly outcome?: unknown;
	readonly session?: unknown;
}

interface ErrorPayloadCandidate extends Record<string, unknown> {
	readonly error?: unknown;
	readonly message?: unknown;
}

interface SessionCandidate extends Record<string, unknown> {
	readonly access_token?: unknown;
	readonly expires_at?: unknown;
	readonly expires_in?: unknown;
	readonly refresh_token?: unknown;
	readonly token_type?: unknown;
}

function readRequiredValue(value: string | undefined, key: keyof DesktopAgentEnvironment): string {
	const normalized = value?.trim();

	if (!normalized) {
		throw new Error(`Desktop agent environment is missing ${key}.`);
	}

	return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAuthenticatedActionResponse(
	value: unknown,
): value is Extract<AuthPasswordActionResponse, { readonly outcome: 'authenticated' }> {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as AuthenticatedActionResponseCandidate;

	if (candidate.outcome !== 'authenticated' || !isRecord(candidate.session)) {
		return false;
	}

	const sessionCandidate = candidate.session as SessionCandidate;

	return typeof sessionCandidate.access_token === 'string';
}

async function readResponsePayload(response: Response): Promise<unknown> {
	const responseText = await response.text();
	const normalizedResponse = responseText.trim();

	if (normalizedResponse.length === 0) {
		return null;
	}

	try {
		return JSON.parse(normalizedResponse) as unknown;
	} catch {
		return normalizedResponse;
	}
}

function readErrorMessage(payload: unknown, status: number): string {
	if (typeof payload === 'string' && payload.trim().length > 0) {
		return payload;
	}

	if (isRecord(payload)) {
		const errorPayload = payload as ErrorPayloadCandidate;
		const message = errorPayload.message;

		if (typeof message === 'string' && message.trim().length > 0) {
			return message;
		}

		const error = errorPayload.error;

		if (typeof error === 'string' && error.trim().length > 0) {
			return error;
		}
	}

	return `Desktop agent auth request failed with status ${status}.`;
}

export function resolveDesktopAgentWebSocketUrl(serverUrl: string): string {
	const normalizedUrl = new URL(serverUrl);

	if (normalizedUrl.protocol === 'http:') {
		normalizedUrl.protocol = 'ws:';
	} else if (normalizedUrl.protocol === 'https:') {
		normalizedUrl.protocol = 'wss:';
	} else if (normalizedUrl.protocol !== 'ws:' && normalizedUrl.protocol !== 'wss:') {
		throw new Error(`Unsupported desktop agent server URL protocol: ${normalizedUrl.protocol}`);
	}

	normalizedUrl.pathname = '/ws/desktop-agent';
	normalizedUrl.search = '';
	normalizedUrl.hash = '';
	return normalizedUrl.toString();
}

export function resolveDesktopAgentHttpUrl(serverUrl: string, pathname: string): string {
	const normalizedUrl = new URL(serverUrl);

	if (normalizedUrl.protocol === 'ws:') {
		normalizedUrl.protocol = 'http:';
	} else if (normalizedUrl.protocol === 'wss:') {
		normalizedUrl.protocol = 'https:';
	} else if (normalizedUrl.protocol !== 'http:' && normalizedUrl.protocol !== 'https:') {
		throw new Error(`Unsupported desktop agent server URL protocol: ${normalizedUrl.protocol}`);
	}

	normalizedUrl.pathname = pathname;
	normalizedUrl.search = '';
	normalizedUrl.hash = '';
	return normalizedUrl.toString();
}

export function normalizeDesktopAgentPersistedSession(
	session: AuthSessionTokens,
	now: Date = new Date(),
): DesktopAgentPersistedSession {
	const accessToken = session.access_token.trim();

	if (accessToken.length === 0) {
		throw new Error('Desktop agent session is missing access_token.');
	}

	const expiresAt =
		typeof session.expires_at === 'number'
			? session.expires_at
			: typeof session.expires_in === 'number'
				? Math.trunc(now.getTime() / 1000) + session.expires_in
				: undefined;

	return {
		access_token: accessToken,
		expires_at: expiresAt,
		expires_in: session.expires_in,
		refresh_token: session.refresh_token?.trim() || undefined,
		token_type: session.token_type?.trim() || undefined,
	};
}

export function normalizeDesktopAgentSessionInputPayload(
	sessionInput: DesktopAgentSessionInputPayload,
	now: Date = new Date(),
): DesktopAgentPersistedSession {
	const accessToken = sessionInput.access_token.trim();

	if (accessToken.length === 0) {
		throw new Error('Paste your access token to continue.');
	}

	const refreshToken = sessionInput.refresh_token?.trim();

	if (
		typeof sessionInput.expires_at !== 'undefined' &&
		(typeof sessionInput.expires_at !== 'number' || !Number.isFinite(sessionInput.expires_at))
	) {
		throw new Error('Use a valid session expiry to continue.');
	}

	return normalizeDesktopAgentPersistedSession(
		{
			access_token: accessToken,
			expires_at:
				typeof sessionInput.expires_at === 'number'
					? Math.trunc(sessionInput.expires_at)
					: undefined,
			refresh_token: refreshToken && refreshToken.length > 0 ? refreshToken : undefined,
			token_type: sessionInput.token_type?.trim() || undefined,
		},
		now,
	);
}

export function readDesktopAgentBootstrapConfigFromEnvironment(
	environment: DesktopAgentEnvironment = process.env,
): DesktopAgentBootstrapConfig {
	const accessToken = environment.RUNA_DESKTOP_AGENT_ACCESS_TOKEN?.trim();

	return {
		agent_id: readRequiredValue(environment.RUNA_DESKTOP_AGENT_ID, 'RUNA_DESKTOP_AGENT_ID'),
		initial_session:
			accessToken && accessToken.length > 0
				? normalizeDesktopAgentPersistedSession({
						access_token: accessToken,
					})
				: undefined,
		machine_label: environment.RUNA_DESKTOP_AGENT_MACHINE_LABEL?.trim() || undefined,
		server_url: resolveDesktopAgentWebSocketUrl(
			readRequiredValue(environment.RUNA_DESKTOP_AGENT_SERVER_URL, 'RUNA_DESKTOP_AGENT_SERVER_URL'),
		),
	};
}

export function readDesktopAgentConfigFromEnvironment(
	environment: DesktopAgentEnvironment = process.env,
): DesktopAgentConfig {
	const bootstrapConfig = readDesktopAgentBootstrapConfigFromEnvironment(environment);
	const initialSession = bootstrapConfig.initial_session;

	if (!initialSession) {
		throw new Error('Desktop agent environment is missing RUNA_DESKTOP_AGENT_ACCESS_TOKEN.');
	}

	return {
		access_token: initialSession.access_token,
		agent_id: bootstrapConfig.agent_id,
		machine_label: bootstrapConfig.machine_label,
		server_url: bootstrapConfig.server_url,
	};
}

export async function refreshDesktopAgentSession(
	input: Readonly<{
		readonly auth_fetch?: DesktopAgentAuthFetch;
		readonly server_url: string;
		readonly session: Pick<DesktopAgentPersistedSession, 'refresh_token'>;
	}>,
): Promise<DesktopAgentPersistedSession> {
	const refreshToken = input.session.refresh_token?.trim();

	if (!refreshToken) {
		throw new Error('Desktop agent session refresh requires a refresh_token.');
	}

	const authFetch = input.auth_fetch ?? globalThis.fetch;

	if (!authFetch) {
		throw new Error('Desktop agent session refresh requires a fetch implementation.');
	}

	const response = await authFetch(
		resolveDesktopAgentHttpUrl(input.server_url, '/auth/session/refresh'),
		{
			body: JSON.stringify({
				refresh_token: refreshToken,
			}),
			headers: {
				accept: 'application/json',
				'content-type': 'application/json',
			},
			method: 'POST',
		},
	);
	const payload = await readResponsePayload(response);

	if (!response.ok) {
		throw new Error(readErrorMessage(payload, response.status));
	}

	if (!isAuthenticatedActionResponse(payload)) {
		throw new Error('Desktop agent session refresh returned an unsupported payload shape.');
	}

	return normalizeDesktopAgentPersistedSession(payload.session);
}
