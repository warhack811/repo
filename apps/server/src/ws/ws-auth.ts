import type { AuthContext } from '@runa/types';

import {
	type AuthTokenVerifier,
	SupabaseAuthError,
	createAuthContextFromVerification,
	readBearerToken,
} from '../auth/supabase-auth.js';
import { type WebSocketTicketPath, WebSocketTicketError } from './ws-ticket.js';

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
	readonly allow_query_access_token?: boolean;
	readonly path: WebSocketTicketPath;
	readonly request: WebSocketHandshakeRequestLike;
	readonly resolve_ws_ticket_auth_context?: (input: {
		readonly path: WebSocketTicketPath;
		readonly request_id?: string;
		readonly ticket: string;
	}) => AuthContext;
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

interface ParsedHandshakeQueryValue {
	readonly value?: string;
	readonly status: 'malformed' | 'missing' | 'present';
}

function readHandshakeQueryValue(
	request: WebSocketHandshakeRequestLike,
	queryKey: 'access_token' | 'ws_ticket',
): ParsedHandshakeQueryValue {
	const requestUrl = getWebSocketRequestUrl(request);

	if (requestUrl === undefined) {
		return {
			status: 'missing',
		};
	}

	const parsedUrl = new URL(requestUrl, 'http://localhost');
	const queryValue = parsedUrl.searchParams.get(queryKey);

	if (queryValue === null) {
		return {
			status: 'missing',
		};
	}

	if (queryValue.trim() === '') {
		return {
			status: 'malformed',
		};
	}

	return {
		status: 'present',
		value: queryValue,
	};
}

function readHandshakeAccessTokenQuery(request: WebSocketHandshakeRequestLike): {
	readonly status: 'malformed' | 'missing' | 'present';
	readonly token?: string;
} {
	const parsedValue = readHandshakeQueryValue(request, 'access_token');

	if (parsedValue.status === 'missing') {
		return {
			status: 'missing',
		};
	}

	if (parsedValue.status === 'malformed') {
		return {
			status: 'malformed',
		};
	}

	return {
		status: 'present',
		token: parsedValue.value,
	};
}

function readHandshakeWebSocketTicket(request: WebSocketHandshakeRequestLike): ParsedHandshakeQueryValue {
	return readHandshakeQueryValue(request, 'ws_ticket');
}

function throwFromWebSocketTicketError(error: WebSocketTicketError): never {
	switch (error.code) {
		case 'WS_TICKET_REUSED':
			throw new SupabaseAuthError('SUPABASE_AUTH_INVALID_TOKEN', error.message);
		case 'WS_TICKET_EXPIRED':
			throw new SupabaseAuthError('SUPABASE_AUTH_INVALID_TOKEN', error.message);
		case 'WS_TICKET_PATH_MISMATCH':
			throw new SupabaseAuthError('SUPABASE_AUTH_INVALID_TOKEN', error.message);
		default:
			throw new SupabaseAuthError('SUPABASE_AUTH_INVALID_TOKEN', error.message);
	}
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
	const parsedWebSocketTicket = readHandshakeWebSocketTicket(input.request);
	const parsedQueryAccessToken = readHandshakeAccessTokenQuery(input.request);

	const parsedHeaderToken = readBearerToken(
		normalizeHeaderValue(input.request.headers.authorization),
	);

	if (parsedHeaderToken.status === 'malformed') {
		throw new SupabaseAuthError(
			'SUPABASE_AUTH_INVALID_AUTHORIZATION_HEADER',
			'Authorization header must use the Bearer token format.',
		);
	}

	if (parsedWebSocketTicket.status === 'malformed') {
		throw new SupabaseAuthError(
			'SUPABASE_AUTH_INVALID_TOKEN',
			'WebSocket ticket must be a non-empty string.',
		);
	}

	if (parsedQueryAccessToken.status === 'malformed') {
		throw new SupabaseAuthError(
			'SUPABASE_AUTH_INVALID_TOKEN',
			'WebSocket access token must be a non-empty string.',
		);
	}

	if (
		parsedWebSocketTicket.status === 'present' &&
		parsedWebSocketTicket.value !== undefined &&
		input.resolve_ws_ticket_auth_context
	) {
		try {
			const ticketAuthContext = input.resolve_ws_ticket_auth_context({
				path: input.path,
				request_id: input.request.id,
				ticket: parsedWebSocketTicket.value,
			});

			return createWebSocketAuthContext(ticketAuthContext);
		} catch (error: unknown) {
			if (error instanceof WebSocketTicketError) {
				throwFromWebSocketTicketError(error);
			}

			if (error instanceof SupabaseAuthError) {
				throw error;
			}

			throw new SupabaseAuthError(
				'SUPABASE_AUTH_INVALID_TOKEN',
				'WebSocket ticket validation failed.',
			);
		}
	}

	const parsedQueryToken =
		parsedHeaderToken.status === 'missing' ? parsedQueryAccessToken : parsedHeaderToken;

	if (parsedQueryToken.status === 'malformed') {
		throw new SupabaseAuthError(
			'SUPABASE_AUTH_INVALID_TOKEN',
			'WebSocket access token must be a non-empty string.',
		);
	}

	if (
		parsedHeaderToken.status === 'missing' &&
		parsedQueryToken.status === 'present' &&
		input.allow_query_access_token !== true
	) {
		throw new SupabaseAuthError(
			'SUPABASE_AUTH_INVALID_TOKEN',
			'WebSocket query access_token is deprecated and disabled. Use ws_ticket or authenticated session context.',
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
			'Authenticated WebSocket connection required. Provide a valid ws_ticket or authenticated session context.',
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
