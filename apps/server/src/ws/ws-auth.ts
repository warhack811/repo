import type { AuthContext } from '@runa/types';

import {
	type AuthTokenVerifier,
	SupabaseAuthError,
	createAuthContextFromVerification,
	readBearerToken,
} from '../auth/supabase-auth.js';

interface WebSocketHandshakeRequestLike {
	readonly auth?: AuthContext;
	readonly headers: {
		readonly authorization?: string | readonly string[];
	};
	readonly id?: string;
	readonly raw?: {
		readonly url?: string;
	};
	readonly url?: string;
}

interface WebSocketConnectionLike {
	close(code?: number, reason?: string): void;
}

export interface VerifyWebSocketHandshakeInput {
	readonly request: WebSocketHandshakeRequestLike;
	readonly verify_token: AuthTokenVerifier;
}

export const WEBSOCKET_AUTH_CLOSE_CODE = 1008;

function normalizeHeaderValue(value: string | readonly string[] | undefined): string | undefined {
	if (typeof value === 'string' || value === undefined) {
		return value;
	}

	const [firstValue] = value;
	return typeof firstValue === 'string' ? firstValue : undefined;
}

function getWebSocketRequestUrl(request: WebSocketHandshakeRequestLike): string | undefined {
	return request.raw?.url ?? request.url;
}

function readHandshakeQueryToken(request: WebSocketHandshakeRequestLike): {
	readonly status: 'malformed' | 'missing' | 'present';
	readonly token?: string;
} {
	const requestUrl = getWebSocketRequestUrl(request);

	if (requestUrl === undefined) {
		return {
			status: 'missing',
		};
	}

	const parsedUrl = new URL(requestUrl, 'http://localhost');
	const accessToken = parsedUrl.searchParams.get('access_token');

	if (accessToken === null) {
		return {
			status: 'missing',
		};
	}

	if (accessToken.trim() === '') {
		return {
			status: 'malformed',
		};
	}

	return {
		status: 'present',
		token: accessToken,
	};
}

function createWebSocketAuthContext(auth: AuthContext): AuthContext {
	return {
		...auth,
		transport: 'websocket',
	};
}

export async function verifyWebSocketHandshake(
	input: VerifyWebSocketHandshakeInput,
): Promise<AuthContext> {
	const parsedHeaderToken = readBearerToken(
		normalizeHeaderValue(input.request.headers.authorization),
	);

	if (parsedHeaderToken.status === 'malformed') {
		throw new SupabaseAuthError(
			'SUPABASE_AUTH_INVALID_AUTHORIZATION_HEADER',
			'Authorization header must use the Bearer token format.',
		);
	}

	const parsedQueryToken =
		parsedHeaderToken.status === 'missing'
			? readHandshakeQueryToken(input.request)
			: parsedHeaderToken;

	if (parsedQueryToken.status === 'malformed') {
		throw new SupabaseAuthError(
			'SUPABASE_AUTH_INVALID_TOKEN',
			'WebSocket access token must be a non-empty string.',
		);
	}

	if (parsedQueryToken.status === 'missing' || parsedQueryToken.token === undefined) {
		if (
			input.request.auth?.principal.kind === 'authenticated' ||
			input.request.auth?.principal.kind === 'service'
		) {
			return createWebSocketAuthContext(input.request.auth);
		}

		throw new SupabaseAuthError(
			'SUPABASE_AUTH_REQUIRED',
			'Authenticated WebSocket connection required.',
		);
	}

	try {
		const verification = await input.verify_token({
			request_id: input.request.id,
			token: parsedQueryToken.token,
		});

		return createWebSocketAuthContext(
			createAuthContextFromVerification(verification, input.request.id),
		);
	} catch (error: unknown) {
		if (error instanceof SupabaseAuthError) {
			throw error;
		}

		throw new SupabaseAuthError('SUPABASE_AUTH_INVALID_TOKEN', 'Invalid or expired bearer token.');
	}
}

export function rejectWebSocketConnection(socket: WebSocketConnectionLike, error: unknown): void {
	const reason = error instanceof Error ? error.message : 'WebSocket authentication failed.';

	socket.close(WEBSOCKET_AUTH_CLOSE_CODE, reason);
}
