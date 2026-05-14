import { randomUUID } from 'node:crypto';

type LogLevel = 'debug' | 'error' | 'info' | 'warn';

type LogContextValue =
	| boolean
	| number
	| string
	| null
	| readonly LogContextValue[]
	| { readonly [key: string]: LogContextValue | undefined };

export interface LogContext {
	readonly [key: string]: unknown;
}

interface SanitizedLogContext {
	readonly [key: string]: LogContextValue | undefined;
}

interface StructuredLogEntry extends SanitizedLogContext {
	readonly level: LogLevel;
	readonly message: string;
	readonly timestamp: string;
}

type LogSink = (level: LogLevel, entry: StructuredLogEntry) => void;

interface LoggerOptions {
	readonly context?: LogContext;
	readonly sink?: LogSink;
}

export interface Logger {
	child(context: LogContext): Logger;
	debug(message: string, context?: LogContext): void;
	error(message: string, context?: LogContext): void;
	info(message: string, context?: LogContext): void;
	warn(message: string, context?: LogContext): void;
}

export interface LogSpan {
	end(context?: LogContext): void;
	fail(error: unknown, context?: LogContext): void;
	readonly logger: Logger;
	readonly span_id: string;
}

const sensitiveKeys = new Set([
	'apikey',
	'authorization',
	'cookie',
	'credential',
	'credentials',
	'internalreasoning',
	'password',
	'refreshtoken',
	'reasoningcontent',
	'secret',
	'servicekey',
	'setcookie',
	'token',
	'workspaceid',
	'wsticket',
]);

const bearerTokenPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu;
const jwtPattern = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu;
const sensitiveQueryTokenPattern =
	/([?#&](?:access_token|refresh_token|authorization|api_key|apikey|secret|token|ws_ticket|workspace_id)=)[^&#\s"]+/giu;
const sensitiveFragmentTokenPattern =
	/(#(?:access_token|refresh_token|authorization|api_key|apikey|secret|token|ws_ticket|workspace_id)=)[^&#\s"]+/giu;

function isSensitiveKey(key: string): boolean {
	const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, '');

	if (sensitiveKeys.has(normalizedKey)) {
		return true;
	}

	return normalizedKey.endsWith('accesstoken') || normalizedKey.endsWith('idtoken');
}

function serializeError(error: Error): LogContextValue {
	return {
		error_message: sanitizeString(error.message),
		error_name: error.name,
	};
}

function sanitizeString(value: string): string {
	return value
		.replace(bearerTokenPattern, 'Bearer [REDACTED]')
		.replace(jwtPattern, '[REDACTED_JWT]')
		.replace(sensitiveQueryTokenPattern, '$1[REDACTED]')
		.replace(sensitiveFragmentTokenPattern, '$1[REDACTED]');
}

function sanitizeValue(
	value: unknown,
	key?: string,
	visited?: WeakSet<object>,
): LogContextValue | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (key && isSensitiveKey(key)) {
		return '[REDACTED]';
	}

	if (value === null || typeof value === 'boolean' || typeof value === 'number') {
		return value;
	}

	if (typeof value === 'string') {
		return sanitizeString(value);
	}

	if (value instanceof Error) {
		return serializeError(value);
	}

	if (Array.isArray(value)) {
		return value
			.map((entry) => sanitizeValue(entry, undefined, visited))
			.filter((entry): entry is LogContextValue => entry !== undefined);
	}

	if (typeof value === 'object') {
		const nextVisited = visited ?? new WeakSet<object>();

		if (nextVisited.has(value)) {
			return '[Circular]';
		}

		nextVisited.add(value);
		const sanitizedEntries = Object.entries(value as Record<string, unknown>)
			.map(
				([entryKey, entryValue]) =>
					[entryKey, sanitizeValue(entryValue, entryKey, nextVisited)] as const,
			)
			.filter(([, entryValue]) => entryValue !== undefined);

		return Object.fromEntries(sanitizedEntries);
	}

	return String(value);
}

function sanitizeContext(context?: LogContext): SanitizedLogContext {
	if (!context) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(context)
			.map(([key, value]) => [key, sanitizeValue(value, key)] as const)
			.filter(([, value]) => value !== undefined),
	);
}

function safeStringify(value: unknown): string {
	return JSON.stringify(sanitizeValue(value)) ?? 'undefined';
}

function defaultSink(level: LogLevel, entry: StructuredLogEntry): void {
	const serializedEntry = safeStringify(entry);

	switch (level) {
		case 'debug':
			console.debug(serializedEntry);
			return;
		case 'error':
			console.error(serializedEntry);
			return;
		case 'warn':
			console.warn(serializedEntry);
			return;
		default:
			console.info(serializedEntry);
	}
}

class StructuredLogger implements Logger {
	readonly #context: LogContext;
	readonly #sink: LogSink;

	constructor(options: LoggerOptions = {}) {
		this.#context = sanitizeContext(options.context);
		this.#sink = options.sink ?? defaultSink;
	}

	child(context: LogContext): Logger {
		return new StructuredLogger({
			context: {
				...this.#context,
				...sanitizeContext(context),
			},
			sink: this.#sink,
		});
	}

	debug(message: string, context?: LogContext): void {
		this.#write('debug', message, context);
	}

	error(message: string, context?: LogContext): void {
		this.#write('error', message, context);
	}

	info(message: string, context?: LogContext): void {
		this.#write('info', message, context);
	}

	warn(message: string, context?: LogContext): void {
		this.#write('warn', message, context);
	}

	#write(level: LogLevel, message: string, context?: LogContext): void {
		this.#sink(level, {
			...this.#context,
			...sanitizeContext(context),
			level,
			message,
			timestamp: new Date().toISOString(),
		});
	}
}

export function createLogger(options?: LoggerOptions): Logger {
	return new StructuredLogger(options);
}

function buildErrorContext(error: unknown): LogContext {
	if (error instanceof Error) {
		return {
			error_message: error.message,
			error_name: error.name,
		};
	}

	return {
		error_value: sanitizeValue(error),
	};
}

export function startLogSpan(logger: Logger, name: string, context?: LogContext): LogSpan {
	const span_id = randomUUID();
	const spanLogger = logger.child({
		...context,
		span_id,
		span_name: name,
	});

	spanLogger.info('span.started');

	return {
		end(additionalContext) {
			spanLogger.info('span.completed', additionalContext);
		},
		fail(error, additionalContext) {
			spanLogger.error('span.failed', {
				...additionalContext,
				...buildErrorContext(error),
			});
		},
		logger: spanLogger,
		span_id,
	};
}
