import { existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';

import electronLog from 'electron-log';

const REDACTED_KEYS = new Set([
	'access_token',
	'refreshtoken',
	'refresh_token',
	'accesstoken',
	'password',
	'code',
	'pairing_code',
	'authorization',
	'cookie',
	'set-cookie',
	'email',
	'refresh',
	'secret',
	'api_key',
	'apikey',
	'workspace_id',
	'ws_ticket',
]);

const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu;
const SENSITIVE_QUERY_PARAM_PATTERN =
	/([?#&](?:access_token|refresh_token|authorization|api_key|apikey|secret|token|ws_ticket|workspace_id)=)[^&#\s"]+/giu;

export interface DesktopAgentLogger {
	debug(message: string, ...data: readonly unknown[]): void;
	error(message: string, ...data: readonly unknown[]): void;
	info(message: string, ...data: readonly unknown[]): void;
	warn(message: string, ...data: readonly unknown[]): void;
}

export interface DesktopAgentLoggerOptions {
	readonly channels?: readonly string[];
	readonly userDataDirectory: string;
}

function rotateLogFiles(logFilePath: string): void {
	const oldestPath = `${logFilePath}.5`;
	if (existsSync(oldestPath)) {
		unlinkSync(oldestPath);
	}

	for (let index = 4; index >= 1; index -= 1) {
		const sourcePath = `${logFilePath}.${index}`;
		if (existsSync(sourcePath)) {
			renameSync(sourcePath, `${logFilePath}.${index + 1}`);
		}
	}

	if (existsSync(logFilePath)) {
		renameSync(logFilePath, `${logFilePath}.1`);
	}
}

function normalizeRedactionKey(key: string): string {
	return key.toLowerCase();
}

function shouldRedactKey(key: string): boolean {
	return REDACTED_KEYS.has(normalizeRedactionKey(key));
}

export function redactPii(value: unknown): unknown {
	if (typeof value === 'string') {
		return value
			.replace(BEARER_TOKEN_PATTERN, 'Bearer [REDACTED]')
			.replace(JWT_PATTERN, '[REDACTED_JWT]')
			.replace(SENSITIVE_QUERY_PARAM_PATTERN, '$1[REDACTED]');
	}

	if (Array.isArray(value)) {
		return value.map((item) => redactPii(item));
	}

	if (typeof value !== 'object' || value === null) {
		return value;
	}

	const redactedRecord: Record<string, unknown> = {};

	for (const [key, nestedValue] of Object.entries(value)) {
		redactedRecord[key] = shouldRedactKey(key) ? '[REDACTED]' : redactPii(nestedValue);
	}

	return redactedRecord;
}

export function createDesktopAgentLogger(options: DesktopAgentLoggerOptions): DesktopAgentLogger {
	const logger = electronLog;
	const logFilePath = join(options.userDataDirectory, 'logs', 'main.log');

	mkdirSync(dirname(logFilePath), { recursive: true });
	logger.transports.file.resolvePathFn = () => logFilePath;
	logger.transports.file.archiveLogFn = () => {
		rotateLogFiles(logFilePath);
	};
	logger.transports.file.level = 'info';
	logger.transports.file.maxSize = 5 * 1024 * 1024;
	logger.transports.console.level = process.env['NODE_ENV'] === 'production' ? 'warn' : 'debug';
	logger.hooks.push((message) => {
		message.data = message.data.map((item) => redactPii(item));
		return message;
	});

	return logger;
}
