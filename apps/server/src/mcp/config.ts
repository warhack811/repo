import type { McpServerConfig } from '@runa/types';

const MCP_ENV_KEY = 'RUNA_MCP_SERVERS';

export class McpConfigurationError extends Error {
	constructor(
		message: string,
		override readonly cause?: unknown,
	) {
		super(message);
		this.name = 'McpConfigurationError';
	}
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toStringArray(value: unknown, fieldName: string): readonly string[] | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
		throw new McpConfigurationError(`${fieldName} must be an array of strings.`);
	}

	return value;
}

function toEnvRecord(value: unknown): Readonly<Record<string, string>> | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (!isStringRecord(value)) {
		throw new McpConfigurationError('env must be an object of string values.');
	}

	const entries = Object.entries(value);

	for (const [, entryValue] of entries) {
		if (typeof entryValue !== 'string') {
			throw new McpConfigurationError('env must be an object of string values.');
		}
	}

	return Object.fromEntries(entries) as Readonly<Record<string, string>>;
}

function parseServerConfig(value: unknown, index: number): McpServerConfig {
	if (!isStringRecord(value)) {
		throw new McpConfigurationError(`Server config at index ${index} must be an object.`);
	}

	const typedValue = value as {
		readonly args?: unknown;
		readonly command?: unknown;
		readonly cwd?: unknown;
		readonly env?: unknown;
		readonly id?: unknown;
		readonly timeout_ms?: unknown;
	};
	const id = typedValue.id;
	const command = typedValue.command;
	const cwd = typedValue.cwd;
	const timeoutMs = typedValue.timeout_ms;

	if (typeof id !== 'string' || id.length === 0) {
		throw new McpConfigurationError(`Server config at index ${index} must include a non-empty id.`);
	}

	if (typeof command !== 'string' || command.length === 0) {
		throw new McpConfigurationError(
			`Server config at index ${index} must include a non-empty command.`,
		);
	}

	if (cwd !== undefined && typeof cwd !== 'string') {
		throw new McpConfigurationError(`cwd for MCP server ${id} must be a string.`);
	}

	if (
		timeoutMs !== undefined &&
		(typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0)
	) {
		throw new McpConfigurationError(`timeout_ms for MCP server ${id} must be a positive number.`);
	}

	return {
		args: toStringArray(typedValue.args, `args for MCP server ${id}`),
		command,
		cwd,
		env: toEnvRecord(typedValue.env),
		id,
		timeout_ms: timeoutMs,
	};
}

export function readMcpServerConfigsFromEnvironment(
	env: NodeJS.ProcessEnv = process.env,
): readonly McpServerConfig[] {
	const rawValue = env[MCP_ENV_KEY];

	if (!rawValue) {
		return [];
	}

	let parsedValue: unknown;

	try {
		parsedValue = JSON.parse(rawValue);
	} catch (error: unknown) {
		throw new McpConfigurationError(
			`${MCP_ENV_KEY} must be valid JSON containing an array of MCP server configs.`,
			error,
		);
	}

	if (!Array.isArray(parsedValue)) {
		throw new McpConfigurationError(`${MCP_ENV_KEY} must be a JSON array.`);
	}

	return parsedValue.map((entry, index) => parseServerConfig(entry, index));
}
