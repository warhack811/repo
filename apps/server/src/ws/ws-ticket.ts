import { createHash, randomBytes } from 'node:crypto';

import type { AuthContext } from '@runa/types';

export type WebSocketTicketPath = '/ws' | '/ws/desktop-agent';

export interface IssueWebSocketTicketInput {
	readonly auth: AuthContext;
	readonly path: WebSocketTicketPath;
	readonly request_id?: string;
}

export interface WebSocketTicketIssued {
	readonly expires_at: string;
	readonly expires_in_seconds: number;
	readonly path: WebSocketTicketPath;
	readonly ws_ticket: string;
}

export interface ConsumeWebSocketTicketInput {
	readonly path: WebSocketTicketPath;
	readonly request_id?: string;
	readonly ticket: string;
}

export class WebSocketTicketError extends Error {
	readonly code:
		| 'WS_TICKET_EXPIRED'
		| 'WS_TICKET_INVALID'
		| 'WS_TICKET_PATH_MISMATCH'
		| 'WS_TICKET_REUSED';

	constructor(
		code:
			| 'WS_TICKET_EXPIRED'
			| 'WS_TICKET_INVALID'
			| 'WS_TICKET_PATH_MISMATCH'
			| 'WS_TICKET_REUSED',
		message: string,
	) {
		super(message);
		this.code = code;
		this.name = 'WebSocketTicketError';
	}
}

interface StoredWebSocketTicket {
	readonly auth: AuthContext;
	readonly digest: string;
	readonly expires_at_unix_ms: number;
	readonly issued_at_unix_ms: number;
	readonly path: WebSocketTicketPath;
	readonly request_id?: string;
}

export interface WebSocketTicketService {
	consume(input: ConsumeWebSocketTicketInput): AuthContext;
	issue(input: IssueWebSocketTicketInput): WebSocketTicketIssued;
}

export interface CreateWebSocketTicketServiceInput {
	readonly now?: () => number;
	readonly ttl_seconds?: number;
}

const DEFAULT_TTL_SECONDS = 45;
const MAX_TTL_SECONDS = 60;
const MIN_TTL_SECONDS = 30;
const REUSED_DIGEST_RETENTION_MS = 2 * 60 * 1000;

function resolveTicketTtlSeconds(configuredValue: number | undefined): number {
	if (configuredValue === undefined || !Number.isFinite(configuredValue)) {
		return DEFAULT_TTL_SECONDS;
	}

	return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.trunc(configuredValue)));
}

function createTicketDigest(ticket: string): string {
	return createHash('sha256').update(ticket).digest('hex');
}

function createRawTicket(): string {
	return randomBytes(32).toString('base64url');
}

function createTicketRecord(input: {
	readonly auth: AuthContext;
	readonly now_unix_ms: number;
	readonly path: WebSocketTicketPath;
	readonly request_id?: string;
	readonly ticket: string;
	readonly ttl_seconds: number;
}): StoredWebSocketTicket {
	return {
		auth: input.auth,
		digest: createTicketDigest(input.ticket),
		expires_at_unix_ms: input.now_unix_ms + input.ttl_seconds * 1000,
		issued_at_unix_ms: input.now_unix_ms,
		path: input.path,
		request_id: input.request_id,
	};
}

export function createWebSocketTicketService(
	input: CreateWebSocketTicketServiceInput = {},
): WebSocketTicketService {
	const now = input.now ?? (() => Date.now());
	const ttl_seconds = resolveTicketTtlSeconds(input.ttl_seconds);
	const activeTicketsByDigest = new Map<string, StoredWebSocketTicket>();
	const reusedTicketDigests = new Map<string, number>();

	function sweepStaleRecords(now_unix_ms: number): void {
		for (const [digest, record] of activeTicketsByDigest) {
			if (record.expires_at_unix_ms + REUSED_DIGEST_RETENTION_MS <= now_unix_ms) {
				activeTicketsByDigest.delete(digest);
			}
		}

		for (const [digest, expires_at_unix_ms] of reusedTicketDigests) {
			if (expires_at_unix_ms <= now_unix_ms) {
				reusedTicketDigests.delete(digest);
			}
		}
	}

	return {
		issue(issueInput) {
			const now_unix_ms = now();
			sweepStaleRecords(now_unix_ms);

			const ws_ticket = createRawTicket();
			const ticketRecord = createTicketRecord({
				auth: issueInput.auth,
				now_unix_ms,
				path: issueInput.path,
				request_id: issueInput.request_id,
				ticket: ws_ticket,
				ttl_seconds,
			});

			activeTicketsByDigest.set(ticketRecord.digest, ticketRecord);

			return {
				expires_at: new Date(ticketRecord.expires_at_unix_ms).toISOString(),
				expires_in_seconds: ttl_seconds,
				path: issueInput.path,
				ws_ticket,
			};
		},
		consume(consumeInput) {
			const now_unix_ms = now();
			sweepStaleRecords(now_unix_ms);
			const digest = createTicketDigest(consumeInput.ticket);

			const reusedUntil = reusedTicketDigests.get(digest);

			if (reusedUntil !== undefined && reusedUntil > now_unix_ms) {
				throw new WebSocketTicketError(
					'WS_TICKET_REUSED',
					'WebSocket ticket was already consumed.',
				);
			}

			const record = activeTicketsByDigest.get(digest);

			if (!record) {
				throw new WebSocketTicketError('WS_TICKET_INVALID', 'WebSocket ticket is invalid.');
			}

			activeTicketsByDigest.delete(digest);
			reusedTicketDigests.set(digest, now_unix_ms + REUSED_DIGEST_RETENTION_MS);

			if (record.expires_at_unix_ms <= now_unix_ms) {
				throw new WebSocketTicketError(
					'WS_TICKET_EXPIRED',
					'WebSocket ticket has expired. Request a fresh ticket.',
				);
			}

			if (record.path !== consumeInput.path) {
				throw new WebSocketTicketError(
					'WS_TICKET_PATH_MISMATCH',
					'WebSocket ticket audience does not match this route.',
				);
			}

			return record.auth;
		},
	};
}
