import { spawn, spawnSync } from 'node:child_process';

import type { McpServerConfig } from '@runa/types';

const DEFAULT_TIMEOUT_MS = 10_000;

interface JsonRpcErrorShape {
	readonly code?: unknown;
	readonly data?: unknown;
	readonly message?: unknown;
}

interface JsonRpcResponseShape {
	readonly error?: JsonRpcErrorShape;
	readonly id?: number | string;
	readonly result?: unknown;
}

interface McpTransportResult {
	readonly responses: readonly JsonRpcResponseShape[];
	readonly stderr: string;
}

export class McpTransportError extends Error {
	constructor(
		message: string,
		readonly details: Readonly<Record<string, unknown>> = {},
		override readonly cause?: unknown,
	) {
		super(message);
		this.name = 'McpTransportError';
	}
}

function buildEnvironment(config: McpServerConfig): NodeJS.ProcessEnv {
	return {
		...process.env,
		...config.env,
	};
}

function toStdinPayload(messages: readonly unknown[]): string {
	return `${messages.map((message) => JSON.stringify(message)).join('\n')}\n`;
}

function parseResponseLines(
	rawStdout: string,
	config: McpServerConfig,
): readonly JsonRpcResponseShape[] {
	const lines = rawStdout
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	const parsedMessages: JsonRpcResponseShape[] = [];

	for (const line of lines) {
		let parsedLine: unknown;

		try {
			parsedLine = JSON.parse(line);
		} catch (error: unknown) {
			throw new McpTransportError(
				`MCP server ${config.id} emitted invalid JSON on stdout.`,
				{
					line,
				},
				error,
			);
		}

		if (Array.isArray(parsedLine)) {
			for (const entry of parsedLine) {
				if (entry && typeof entry === 'object') {
					parsedMessages.push(entry as JsonRpcResponseShape);
				}
			}

			continue;
		}

		if (parsedLine && typeof parsedLine === 'object') {
			parsedMessages.push(parsedLine as JsonRpcResponseShape);
		}
	}

	return parsedMessages;
}

function normalizeTransportResult(
	config: McpServerConfig,
	stdout: string,
	stderr: string,
	status: number | null,
	error: Error | undefined,
): McpTransportResult {
	if (error) {
		throw new McpTransportError(
			`Failed to start MCP server ${config.id}.`,
			{
				command: config.command,
				stderr,
			},
			error,
		);
	}

	if (status !== 0 && status !== null) {
		throw new McpTransportError(`MCP server ${config.id} exited with code ${status}.`, {
			command: config.command,
			stderr,
		});
	}

	return {
		responses: parseResponseLines(stdout, config),
		stderr,
	};
}

export function executeMcpStdioSessionSync(
	config: McpServerConfig,
	messages: readonly unknown[],
): McpTransportResult {
	const result = spawnSync(config.command, config.args ?? [], {
		cwd: config.cwd,
		encoding: 'utf8',
		env: buildEnvironment(config),
		input: toStdinPayload(messages),
		timeout: config.timeout_ms ?? DEFAULT_TIMEOUT_MS,
		windowsHide: true,
	});

	return normalizeTransportResult(
		config,
		result.stdout ?? '',
		result.stderr ?? '',
		result.status,
		result.error,
	);
}

export async function executeMcpStdioSession(
	config: McpServerConfig,
	messages: readonly unknown[],
): Promise<McpTransportResult> {
	return await new Promise<McpTransportResult>((resolve, reject) => {
		const child = spawn(config.command, config.args ?? [], {
			cwd: config.cwd,
			env: buildEnvironment(config),
			stdio: ['pipe', 'pipe', 'pipe'],
			windowsHide: true,
		});

		const stdoutChunks: string[] = [];
		const stderrChunks: string[] = [];
		const timeoutMs = config.timeout_ms ?? DEFAULT_TIMEOUT_MS;
		let settled = false;

		const timeout = setTimeout(() => {
			if (settled) {
				return;
			}

			settled = true;
			child.kill();
			reject(
				new McpTransportError(`MCP server ${config.id} timed out after ${timeoutMs}ms.`, {
					command: config.command,
				}),
			);
		}, timeoutMs);

		child.once('error', (error) => {
			if (settled) {
				return;
			}

			settled = true;
			clearTimeout(timeout);
			reject(
				new McpTransportError(
					`Failed to start MCP server ${config.id}.`,
					{
						command: config.command,
					},
					error,
				),
			);
		});

		child.stdout.setEncoding('utf8');
		child.stdout.on('data', (chunk: string) => {
			stdoutChunks.push(chunk);
		});

		child.stderr.setEncoding('utf8');
		child.stderr.on('data', (chunk: string) => {
			stderrChunks.push(chunk);
		});

		child.once('close', (code) => {
			if (settled) {
				return;
			}

			settled = true;
			clearTimeout(timeout);

			try {
				resolve(
					normalizeTransportResult(
						config,
						stdoutChunks.join(''),
						stderrChunks.join(''),
						code,
						undefined,
					),
				);
			} catch (error: unknown) {
				reject(error);
			}
		});

		child.stdin.end(toStdinPayload(messages), 'utf8');
	});
}
