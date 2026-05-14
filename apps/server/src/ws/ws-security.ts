import { SupabaseAuthError } from '../auth/supabase-auth.js';

interface WebSocketSecurityRequestLike {
	readonly headers: {
		readonly host?: string | readonly string[];
		readonly origin?: string | readonly string[];
	};
	readonly protocol?: string;
	readonly raw?: {
		readonly socket?: unknown;
	};
}

export interface WebSocketSecurityConfig {
	readonly allow_query_access_token: boolean;
	readonly allowed_origins?: readonly string[];
	readonly enforce_secure_transport_in_production: boolean;
}

interface WebSocketSecurityEnvironment {
	readonly NODE_ENV?: string;
	readonly RUNA_WS_ALLOW_QUERY_ACCESS_TOKEN?: string;
	readonly RUNA_WS_ALLOWED_ORIGINS?: string;
	readonly RUNA_WS_ENFORCE_SECURE_TRANSPORT?: string;
}

function normalizeHeaderValue(value: string | readonly string[] | undefined): string | undefined {
	if (typeof value === 'string' || value === undefined) {
		return value;
	}

	const [firstValue] = value;
	return typeof firstValue === 'string' ? firstValue : undefined;
}

function isLoopbackHost(host: string): boolean {
	const normalizedHost = host
		.trim()
		.replace(/^\[|\]$/gu, '')
		.toLowerCase();

	return (
		normalizedHost === 'localhost' ||
		normalizedHost === '127.0.0.1' ||
		normalizedHost === '::1' ||
		normalizedHost === '::ffff:127.0.0.1'
	);
}

function normalizeHostHeader(hostHeader: string): string {
	const trimmedHost = hostHeader.trim();

	if (trimmedHost.startsWith('[')) {
		const bracketEnd = trimmedHost.indexOf(']');
		return (bracketEnd > 0 ? trimmedHost.slice(1, bracketEnd) : trimmedHost).toLowerCase();
	}

	const colonIndex = trimmedHost.indexOf(':');
	const hostWithoutPort = colonIndex >= 0 ? trimmedHost.slice(0, colonIndex) : trimmedHost;
	return hostWithoutPort.toLowerCase();
}

function parseAllowedOrigins(value: string | undefined): readonly string[] | undefined {
	if (!value || value.trim().length === 0) {
		return undefined;
	}

	const parsedOrigins = value
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)
		.map((entry) => {
			const parsed = new URL(entry);
			return parsed.origin;
		});

	return parsedOrigins.length > 0 ? parsedOrigins : undefined;
}

export function resolveWebSocketSecurityConfig(
	environment: WebSocketSecurityEnvironment = process.env,
): WebSocketSecurityConfig {
	return {
		allow_query_access_token: environment.RUNA_WS_ALLOW_QUERY_ACCESS_TOKEN?.trim() === '1',
		allowed_origins: parseAllowedOrigins(environment.RUNA_WS_ALLOWED_ORIGINS),
		enforce_secure_transport_in_production:
			environment.RUNA_WS_ENFORCE_SECURE_TRANSPORT?.trim() === '0'
				? false
				: environment.NODE_ENV?.trim() === 'production',
	};
}

function resolveAllowedOriginsForRequest(
	request: WebSocketSecurityRequestLike,
	config: WebSocketSecurityConfig,
): readonly string[] {
	if (config.allowed_origins && config.allowed_origins.length > 0) {
		return config.allowed_origins;
	}

	const hostHeader = normalizeHeaderValue(request.headers.host);

	if (!hostHeader) {
		return [];
	}

	const normalizedHost = normalizeHostHeader(hostHeader);

	return [`http://${normalizedHost}`, `https://${normalizedHost}`];
}

export function validateWebSocketOrigin(
	request: WebSocketSecurityRequestLike,
	config: WebSocketSecurityConfig,
): void {
	const originHeader = normalizeHeaderValue(request.headers.origin)?.trim();

	if (!originHeader) {
		return;
	}

	let parsedOrigin: URL;

	try {
		parsedOrigin = new URL(originHeader);
	} catch {
		throw new SupabaseAuthError(
			'SUPABASE_AUTH_INVALID_TOKEN',
			'WebSocket origin header is invalid.',
		);
	}

	const allowedOrigins = resolveAllowedOriginsForRequest(request, config);

	if (!allowedOrigins.includes(parsedOrigin.origin)) {
		throw new SupabaseAuthError(
			'SUPABASE_AUTH_INVALID_TOKEN',
			'WebSocket origin is not allowed.',
		);
	}
}

export function validateWebSocketTransportSecurity(
	request: WebSocketSecurityRequestLike,
	config: WebSocketSecurityConfig,
): void {
	if (!config.enforce_secure_transport_in_production) {
		return;
	}

	const hostHeader = normalizeHeaderValue(request.headers.host);
	const normalizedHost = hostHeader ? normalizeHostHeader(hostHeader) : undefined;

	if (normalizedHost && isLoopbackHost(normalizedHost)) {
		return;
	}

	const protocol = request.protocol?.trim().toLowerCase();
	const encrypted =
		typeof request.raw?.socket === 'object' &&
		request.raw?.socket !== null &&
		'encrypted' in request.raw.socket &&
		(request.raw.socket as { readonly encrypted?: boolean }).encrypted === true;

	if (protocol === 'https' || encrypted) {
		return;
	}

	throw new SupabaseAuthError(
		'SUPABASE_AUTH_INVALID_TOKEN',
		'In production, WebSocket upgrades require secure transport (wss/https).',
	);
}
