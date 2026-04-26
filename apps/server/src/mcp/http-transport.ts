import { isIP } from 'node:net';

import type { McpHttpServerConfig } from '@runa/types';

import { McpTransportError } from './stdio-transport.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_STREAM_TIMEOUT_MS = 60_000;
const REDACTED_HEADER_VALUE = '[REDACTED]';

interface JsonRpcResponseShape {
	readonly error?: {
		readonly code?: unknown;
		readonly data?: unknown;
		readonly message?: unknown;
	};
	readonly id?: number | string;
	readonly result?: unknown;
}

export interface McpHttpSessionResult {
	readonly responses: readonly JsonRpcResponseShape[];
	readonly stderr: string;
}

export interface McpHttpSessionOptions {
	readonly signal?: AbortSignal;
}

function isSecretHeaderName(headerName: string): boolean {
	const normalizedName = headerName.toLowerCase();
	return (
		normalizedName === 'authorization' ||
		normalizedName === 'cookie' ||
		normalizedName === 'set-cookie' ||
		normalizedName.includes('api-key') ||
		normalizedName.includes('apikey') ||
		normalizedName.includes('secret') ||
		normalizedName.includes('token')
	);
}

export function redactMcpHttpHeaders(
	headers: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> {
	if (!headers) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(headers).map(([name, value]) => [
			name,
			isSecretHeaderName(name) ? REDACTED_HEADER_VALUE : value,
		]),
	);
}

function parseIpv4Address(value: string): readonly [number, number, number, number] | undefined {
	const parts = value.split('.');

	if (parts.length !== 4) {
		return undefined;
	}

	const octets: number[] = [];

	for (const part of parts) {
		if (!/^\d{1,3}$/u.test(part)) {
			return undefined;
		}

		const parsed = Number.parseInt(part, 10);

		if (parsed < 0 || parsed > 255) {
			return undefined;
		}

		octets.push(parsed);
	}

	const [first, second, third, fourth] = octets;

	if (first === undefined || second === undefined || third === undefined || fourth === undefined) {
		return undefined;
	}

	return [first, second, third, fourth];
}

function isPrivateIpv4Address(value: string): boolean {
	const octets = parseIpv4Address(value);

	if (!octets) {
		return false;
	}

	const [first, second] = octets;
	return (
		first === 0 ||
		first === 10 ||
		first === 127 ||
		(first === 169 && second === 254) ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 168) ||
		(first === 100 && second >= 64 && second <= 127)
	);
}

function normalizeHostname(hostname: string): string {
	return hostname.replace(/^\[(.*)\]$/u, '$1').toLowerCase();
}

function isBlockedHostname(hostname: string): boolean {
	const normalizedHostname = normalizeHostname(hostname);

	if (
		normalizedHostname === 'localhost' ||
		normalizedHostname.endsWith('.localhost') ||
		normalizedHostname === 'metadata.google.internal'
	) {
		return true;
	}

	if (normalizedHostname === '::' || normalizedHostname === '::1') {
		return true;
	}

	if (normalizedHostname.startsWith('fc') || normalizedHostname.startsWith('fd')) {
		return true;
	}

	if (normalizedHostname.startsWith('fe80:')) {
		return true;
	}

	return isIP(normalizedHostname) === 4 && isPrivateIpv4Address(normalizedHostname);
}

function parseAllowedHttpUrl(config: McpHttpServerConfig): URL {
	let parsedUrl: URL;

	try {
		parsedUrl = new URL(config.url);
	} catch (error: unknown) {
		throw new McpTransportError(
			`MCP server ${config.id} has an invalid HTTP url.`,
			{
				server_id: config.id,
			},
			error,
		);
	}

	if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
		throw new McpTransportError(`MCP server ${config.id} HTTP transport requires http/https url.`, {
			protocol: parsedUrl.protocol,
			server_id: config.id,
		});
	}

	if (parsedUrl.username.length > 0 || parsedUrl.password.length > 0) {
		throw new McpTransportError(`MCP server ${config.id} HTTP url must not include credentials.`, {
			server_id: config.id,
		});
	}

	if (isBlockedHostname(parsedUrl.hostname)) {
		throw new McpTransportError(
			`MCP server ${config.id} HTTP url targets a blocked local or private host.`,
			{
				hostname: parsedUrl.hostname,
				server_id: config.id,
			},
		);
	}

	return parsedUrl;
}

function toRequestHeaders(config: McpHttpServerConfig): Readonly<Record<string, string>> {
	return {
		...config.headers,
		Accept: 'application/json, text/event-stream',
		'Content-Type': 'application/json',
	};
}

function normalizeJsonRpcResponses(
	value: unknown,
	config: McpHttpServerConfig,
): JsonRpcResponseShape[] {
	if (Array.isArray(value)) {
		return value.filter((entry): entry is JsonRpcResponseShape => {
			return entry !== null && typeof entry === 'object' && !Array.isArray(entry);
		});
	}

	if (value !== null && typeof value === 'object') {
		return [value as JsonRpcResponseShape];
	}

	throw new McpTransportError(`MCP server ${config.id} returned an invalid JSON-RPC response.`, {
		server_id: config.id,
	});
}

function parseJsonResponse(
	rawBody: string,
	config: McpHttpServerConfig,
): readonly JsonRpcResponseShape[] {
	let parsedBody: unknown;

	try {
		parsedBody = JSON.parse(rawBody);
	} catch (error: unknown) {
		throw new McpTransportError(
			`MCP server ${config.id} returned invalid JSON over HTTP.`,
			{
				server_id: config.id,
			},
			error,
		);
	}

	return normalizeJsonRpcResponses(parsedBody, config);
}

function parseServerSentEvents(
	rawBody: string,
	config: McpHttpServerConfig,
): readonly JsonRpcResponseShape[] {
	const responses: JsonRpcResponseShape[] = [];
	const events = rawBody.split(/\r?\n\r?\n/u);

	for (const event of events) {
		const dataLines = event
			.split(/\r?\n/u)
			.map((line) => line.trimEnd())
			.filter((line) => line.startsWith('data:'))
			.map((line) => line.slice(5).trimStart());
		const data = dataLines.join('\n').trim();

		if (data.length === 0 || data === '[DONE]') {
			continue;
		}

		let parsedEvent: unknown;

		try {
			parsedEvent = JSON.parse(data);
		} catch (error: unknown) {
			throw new McpTransportError(
				`MCP server ${config.id} returned invalid JSON in an event-stream frame.`,
				{
					server_id: config.id,
				},
				error,
			);
		}

		responses.push(...normalizeJsonRpcResponses(parsedEvent, config));
	}

	return responses;
}

function composeAbortSignals(
	timeoutMs: number,
	externalSignal: AbortSignal | undefined,
	timeoutReason: string,
): readonly [AbortSignal, () => void] {
	const controller = new AbortController();
	const timeout = setTimeout(() => {
		controller.abort(new Error(timeoutReason));
	}, timeoutMs);
	const externalAbortHandler = () => {
		controller.abort(externalSignal?.reason);
	};

	if (externalSignal?.aborted === true) {
		controller.abort(externalSignal.reason);
	} else {
		externalSignal?.addEventListener('abort', externalAbortHandler, { once: true });
	}

	return [
		controller.signal,
		() => {
			clearTimeout(timeout);
			externalSignal?.removeEventListener('abort', externalAbortHandler);
		},
	];
}

async function readResponseBody(
	response: Response,
	config: McpHttpServerConfig,
	externalSignal: AbortSignal | undefined,
): Promise<string> {
	const [signal, cleanup] = composeAbortSignals(
		DEFAULT_STREAM_TIMEOUT_MS,
		externalSignal,
		`MCP server ${config.id} HTTP stream timed out after ${DEFAULT_STREAM_TIMEOUT_MS}ms.`,
	);

	try {
		if (signal.aborted) {
			throw signal.reason;
		}

		const bodyPromise = response.text();
		const abortPromise = new Promise<string>((_, reject) => {
			signal.addEventListener('abort', () => reject(signal.reason), { once: true });
		});

		return await Promise.race([bodyPromise, abortPromise]);
	} finally {
		cleanup();
	}
}

export async function executeMcpHttpSession(
	config: McpHttpServerConfig,
	messages: readonly unknown[],
	options: McpHttpSessionOptions = {},
): Promise<McpHttpSessionResult> {
	const parsedUrl = parseAllowedHttpUrl(config);
	const requestTimeoutMs = config.timeout_ms ?? DEFAULT_REQUEST_TIMEOUT_MS;
	const [requestSignal, cleanupRequestSignal] = composeAbortSignals(
		requestTimeoutMs,
		options.signal,
		`MCP server ${config.id} HTTP request timed out after ${requestTimeoutMs}ms.`,
	);

	let response: Response;

	try {
		response = await fetch(parsedUrl, {
			body: JSON.stringify(messages),
			headers: toRequestHeaders(config),
			method: 'POST',
			signal: requestSignal,
		});
	} catch (error: unknown) {
		throw new McpTransportError(
			`MCP server ${config.id} HTTP request failed.`,
			{
				headers: redactMcpHttpHeaders(config.headers),
				server_id: config.id,
				url: parsedUrl.toString(),
			},
			error,
		);
	} finally {
		cleanupRequestSignal();
	}

	const rawBody = await readResponseBody(response, config, options.signal);

	if (!response.ok) {
		throw new McpTransportError(
			`MCP server ${config.id} HTTP request returned ${response.status}.`,
			{
				headers: redactMcpHttpHeaders(config.headers),
				response_preview: rawBody.slice(0, 500),
				server_id: config.id,
				status: response.status,
				url: parsedUrl.toString(),
			},
		);
	}

	const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
	const responses = contentType.includes('text/event-stream')
		? parseServerSentEvents(rawBody, config)
		: parseJsonResponse(rawBody, config);

	return {
		responses,
		stderr: '',
	};
}
