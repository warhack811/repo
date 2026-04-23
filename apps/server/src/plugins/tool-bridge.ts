import { spawn } from 'node:child_process';

import type {
	ToolArtifactRef,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
} from '@runa/types';

import type { PluginManifest, PluginToolManifest } from './manifest.js';

interface PluginWorkerSuccessResponse {
	readonly artifact_ref?: ToolArtifactRef;
	readonly metadata?: Readonly<Record<string, unknown>>;
	readonly output: unknown;
	readonly status: 'success';
}

interface PluginWorkerErrorResponse {
	readonly details?: Readonly<Record<string, unknown>>;
	readonly error_code: ToolResultError['error_code'];
	readonly error_message: string;
	readonly retryable?: boolean;
	readonly status: 'error';
}

type PluginWorkerResponse = PluginWorkerErrorResponse | PluginWorkerSuccessResponse;

interface PluginWorkerRequest {
	readonly context: {
		readonly run_id: string;
		readonly trace_id: string;
		readonly working_directory?: string;
	};
	readonly plugin: {
		readonly plugin_id: string;
		readonly tool_name: string;
	};
	readonly tool_call: {
		readonly arguments: Readonly<Record<string, unknown>>;
		readonly call_id: string;
		readonly tool_name: string;
	};
}

export class PluginExecutionError extends Error {
	constructor(
		message: string,
		override readonly cause?: unknown,
	) {
		super(message);
		this.name = 'PluginExecutionError';
	}
}

function createSandboxEnvironment(pluginRoot: string): NodeJS.ProcessEnv {
	const allowedKeys = ['ComSpec', 'PATH', 'PATHEXT', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE'];
	const baseEntries = allowedKeys
		.map((key) => [key, process.env[key]] as const)
		.filter((entry): entry is readonly [string, string] => typeof entry[1] === 'string');

	return {
		...Object.fromEntries(baseEntries),
		RUNA_PLUGIN_ROOT: pluginRoot,
	};
}

function toExecutionFailedResult(
	toolName: PluginToolManifest['name'],
	callId: string,
	errorMessage: string,
	details?: Readonly<Record<string, unknown>>,
): ToolResult {
	return {
		call_id: callId,
		details,
		error_code: 'EXECUTION_FAILED',
		error_message: errorMessage,
		status: 'error',
		tool_name: toolName,
	};
}

function mapWorkerResponse(
	tool: PluginToolManifest,
	callId: string,
	response: PluginWorkerResponse,
): ToolResult {
	if (response.status === 'error') {
		return {
			call_id: callId,
			details: response.details,
			error_code: response.error_code,
			error_message: response.error_message,
			retryable: response.retryable,
			status: 'error',
			tool_name: tool.name,
		};
	}

	return {
		artifact_ref: response.artifact_ref,
		call_id: callId,
		metadata: response.metadata,
		output: response.output,
		status: 'success',
		tool_name: tool.name,
	};
}

async function executePluginWorker(
	manifest: PluginManifest,
	tool: PluginToolManifest,
	request: PluginWorkerRequest,
	signal: ToolExecutionContext['signal'],
): Promise<PluginWorkerResponse> {
	if (signal?.aborted === true) {
		throw new PluginExecutionError('Plugin execution aborted before start.');
	}

	return await new Promise<PluginWorkerResponse>((resolve, reject) => {
		const child = spawn(process.execPath, [tool.entry], {
			cwd: manifest.plugin_root,
			env: createSandboxEnvironment(manifest.plugin_root),
			shell: false,
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		const timeoutMs = tool.timeout_ms ?? 10_000;
		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];
		let settled = false;

		const settle = (callback: () => void): void => {
			if (settled) {
				return;
			}

			settled = true;
			clearTimeout(timeoutId);
			callback();
		};

		const timeoutId = setTimeout(() => {
			child.kill();
			settle(() =>
				reject(
					new PluginExecutionError(
						`Plugin tool ${tool.name} timed out after ${String(timeoutMs)}ms.`,
					),
				),
			);
		}, timeoutMs);

		child.stdout.on('data', (chunk: Buffer) => {
			stdoutChunks.push(chunk);
		});

		child.stderr.on('data', (chunk: Buffer) => {
			stderrChunks.push(chunk);
		});

		child.once('error', (error) => {
			settle(() =>
				reject(new PluginExecutionError(`Plugin tool ${tool.name} failed to start.`, error)),
			);
		});

		child.once('close', (code) => {
			const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
			const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();

			if (code !== 0) {
				settle(() =>
					reject(
						new PluginExecutionError(
							`Plugin tool ${tool.name} exited with code ${String(code)}.`,
							stderr.length > 0 ? stderr : undefined,
						),
					),
				);
				return;
			}

			if (stdout.length === 0) {
				settle(() =>
					reject(new PluginExecutionError(`Plugin tool ${tool.name} returned no stdout payload.`)),
				);
				return;
			}

			let parsedResponse: unknown;

			try {
				parsedResponse = JSON.parse(stdout);
			} catch (error: unknown) {
				settle(() =>
					reject(
						new PluginExecutionError(`Plugin tool ${tool.name} returned invalid JSON.`, error),
					),
				);
				return;
			}

			settle(() => resolve(parsedResponse as PluginWorkerResponse));
		});

		child.stdin.write(JSON.stringify(request));
		child.stdin.end();
	});
}

export function createPluginToolDefinition(
	manifest: PluginManifest,
	tool: PluginToolManifest,
): ToolDefinition {
	return {
		callable_schema: tool.callable_schema,
		description: tool.description,
		async execute(input, context) {
			try {
				const workerResponse = await executePluginWorker(
					manifest,
					tool,
					{
						context: {
							run_id: context.run_id,
							trace_id: context.trace_id,
							working_directory: context.working_directory,
						},
						plugin: {
							plugin_id: manifest.plugin_id,
							tool_name: tool.name,
						},
						tool_call: {
							arguments: input.arguments,
							call_id: input.call_id,
							tool_name: input.tool_name,
						},
					},
					context.signal,
				);

				return mapWorkerResponse(tool, input.call_id, workerResponse);
			} catch (error: unknown) {
				if (error instanceof PluginExecutionError) {
					return toExecutionFailedResult(tool.name, input.call_id, error.message, {
						cause: error.cause,
						plugin_id: manifest.plugin_id,
					});
				}

				return toExecutionFailedResult(
					tool.name,
					input.call_id,
					`Plugin tool ${tool.name} failed unexpectedly.`,
					{
						plugin_id: manifest.plugin_id,
					},
				);
			}
		},
		metadata: {
			capability_class: 'external',
			requires_approval: tool.requires_approval ?? true,
			risk_level: tool.risk_level ?? 'high',
			side_effect_level: tool.side_effect_level ?? 'execute',
			tags: ['external', 'plugin', manifest.plugin_id, ...(tool.tags ?? [])],
		},
		name: tool.name,
	};
}
