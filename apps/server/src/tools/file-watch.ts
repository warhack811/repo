import { type FSWatcher, watch } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

const MAX_WATCH_DURATION_MS = 30_000;
const MAX_WATCH_EVENTS = 50;

export type FileWatchArguments = ToolArguments & {
	readonly duration_ms?: number;
	readonly path?: string;
	readonly recursive?: boolean;
};

export interface FileWatchEvent {
	readonly event_type: 'change' | 'rename';
	readonly filename?: string;
}

export interface FileWatchSuccessData {
	readonly duration_ms: number;
	readonly event_count: number;
	readonly events: readonly FileWatchEvent[];
	readonly is_truncated: boolean;
	readonly path: string;
	readonly recursive: boolean;
	readonly watched_path: string;
}

export type FileWatchInput = ToolCallInput<'file.watch', FileWatchArguments>;

export type FileWatchSuccessResult = ToolResultSuccess<'file.watch', FileWatchSuccessData>;

export type FileWatchErrorResult = ToolResultError<'file.watch'>;

export type FileWatchResult = ToolResult<'file.watch', FileWatchSuccessData>;

interface FileWatchDependencies {
	readonly clearTimeout: typeof clearTimeout;
	readonly realpath: typeof realpath;
	readonly setTimeout: typeof setTimeout;
	readonly stat: typeof stat;
	readonly watch: typeof watch;
}

interface ValidatedFileWatchParams {
	readonly duration_ms: number;
	readonly path: string;
	readonly recursive: boolean;
}

function createErrorResult(
	input: FileWatchInput,
	error_code: FileWatchErrorResult['error_code'],
	error_message: string,
	details?: FileWatchErrorResult['details'],
	retryable?: boolean,
): FileWatchErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'file.watch',
	};
}

function isFiniteInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
}

function validateFileWatchArguments(
	input: FileWatchInput,
): FileWatchErrorResult | ValidatedFileWatchParams {
	const allowedKeys = new Set(['duration_ms', 'path', 'recursive']);

	for (const key of Object.keys(input.arguments)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				`file.watch does not accept the "${key}" argument.`,
				{
					argument: key,
					reason: 'unexpected_argument',
				},
				false,
			);
		}
	}

	const { duration_ms: durationMs = 1_000, path, recursive = false } = input.arguments;

	if (typeof path !== 'string' || path.trim().length === 0) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'file.watch requires a non-empty path string.',
			{
				argument: 'path',
				reason: 'invalid_path',
			},
			false,
		);
	}

	if (!isFiniteInteger(durationMs) || durationMs < 1 || durationMs > MAX_WATCH_DURATION_MS) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'file.watch duration_ms must be an integer between 1 and 30000.',
			{
				argument: 'duration_ms',
				max_duration_ms: MAX_WATCH_DURATION_MS,
				reason: 'invalid_duration',
			},
			false,
		);
	}

	if (typeof recursive !== 'boolean') {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'file.watch recursive must be a boolean when provided.',
			{
				argument: 'recursive',
				reason: 'invalid_recursive',
			},
			false,
		);
	}

	return {
		duration_ms: durationMs,
		path: path.trim(),
		recursive,
	};
}

function isInsideWorkspace(workspaceRoot: string, targetPath: string): boolean {
	const relativePath = relative(workspaceRoot, targetPath);

	return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}

function filenameToString(filename: string | Buffer | null): string | undefined {
	if (typeof filename === 'string') {
		return filename;
	}

	if (Buffer.isBuffer(filename)) {
		return filename.toString('utf8');
	}

	return undefined;
}

function toErrorResult(input: FileWatchInput, path: string, error: unknown): FileWatchErrorResult {
	if (error && typeof error === 'object' && 'code' in error) {
		const errorCode = error.code;

		if (errorCode === 'ENOENT') {
			return createErrorResult(input, 'NOT_FOUND', `Watch path not found: ${path}`, {
				path,
				reason: 'path_not_found',
			});
		}

		if (errorCode === 'EACCES' || errorCode === 'EPERM') {
			return createErrorResult(
				input,
				'PERMISSION_DENIED',
				`Permission denied while watching path: ${path}`,
				{
					path,
					reason: 'watch_permission_denied',
				},
				false,
			);
		}
	}

	if (error instanceof Error) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Failed to watch path: ${error.message}`,
			{
				path,
				reason: 'watch_failed',
			},
			false,
		);
	}

	return createErrorResult(input, 'UNKNOWN', `Failed to watch path: ${path}`, {
		path,
		reason: 'watch_unknown_failure',
	});
}

async function resolveWatchPath(
	input: FileWatchInput,
	context: ToolExecutionContext,
	dependencies: FileWatchDependencies,
	params: ValidatedFileWatchParams,
): Promise<FileWatchErrorResult | string> {
	const workspaceRoot = resolve(context.working_directory ?? process.cwd());
	const requestedPath = resolve(workspaceRoot, params.path);

	if (!isInsideWorkspace(workspaceRoot, requestedPath)) {
		return createErrorResult(
			input,
			'PERMISSION_DENIED',
			'file.watch can only watch paths inside the current workspace.',
			{
				path: requestedPath,
				reason: 'outside_workspace',
				workspace_root: workspaceRoot,
			},
			false,
		);
	}

	try {
		const [realWorkspaceRoot, realRequestedPath] = await Promise.all([
			dependencies.realpath(workspaceRoot),
			dependencies.realpath(requestedPath),
		]);

		if (!isInsideWorkspace(realWorkspaceRoot, realRequestedPath)) {
			return createErrorResult(
				input,
				'PERMISSION_DENIED',
				'file.watch resolved outside the current workspace.',
				{
					path: realRequestedPath,
					reason: 'resolved_outside_workspace',
					workspace_root: realWorkspaceRoot,
				},
				false,
			);
		}

		await dependencies.stat(realRequestedPath);

		return realRequestedPath;
	} catch (error: unknown) {
		return toErrorResult(input, requestedPath, error);
	}
}

function watchPath(
	input: FileWatchInput,
	dependencies: FileWatchDependencies,
	params: ValidatedFileWatchParams,
	watchedPath: string,
): Promise<FileWatchResult> {
	return new Promise((resolvePromise) => {
		const startedAt = Date.now();
		const events: FileWatchEvent[] = [];
		let settled = false;
		let watcher: FSWatcher | undefined;

		const finish = (result: FileWatchResult) => {
			if (settled) {
				return;
			}

			settled = true;
			dependencies.clearTimeout(timeout);

			if (watcher) {
				watcher.close();
			}

			resolvePromise(result);
		};

		const timeout = dependencies.setTimeout(() => {
			finish({
				call_id: input.call_id,
				output: {
					duration_ms: Date.now() - startedAt,
					event_count: events.length,
					events,
					is_truncated: false,
					path: params.path,
					recursive: params.recursive,
					watched_path: watchedPath,
				},
				status: 'success',
				tool_name: 'file.watch',
			});
		}, params.duration_ms);

		try {
			watcher = dependencies.watch(
				watchedPath,
				{
					persistent: false,
					recursive: params.recursive,
				},
				(eventType, filename) => {
					if (eventType !== 'change' && eventType !== 'rename') {
						return;
					}

					events.push({
						event_type: eventType,
						filename: filenameToString(filename),
					});

					if (events.length >= MAX_WATCH_EVENTS) {
						finish({
							call_id: input.call_id,
							output: {
								duration_ms: Date.now() - startedAt,
								event_count: events.length,
								events,
								is_truncated: true,
								path: params.path,
								recursive: params.recursive,
								watched_path: watchedPath,
							},
							status: 'success',
							tool_name: 'file.watch',
						});
					}
				},
			);

			watcher.on('error', (error) => {
				finish(toErrorResult(input, watchedPath, error));
			});
		} catch (error: unknown) {
			finish(toErrorResult(input, watchedPath, error));
		}
	});
}

export function createFileWatchTool(
	dependencies: Partial<FileWatchDependencies> = {},
): ToolDefinition<FileWatchInput, FileWatchResult> {
	const resolvedDependencies: FileWatchDependencies = {
		clearTimeout: dependencies.clearTimeout ?? clearTimeout,
		realpath: dependencies.realpath ?? realpath,
		setTimeout: dependencies.setTimeout ?? setTimeout,
		stat: dependencies.stat ?? stat,
		watch: dependencies.watch ?? watch,
	};

	return {
		callable_schema: {
			parameters: {
				duration_ms: {
					description: 'How long to watch in milliseconds. Allowed range: 1-30000.',
					type: 'number',
				},
				path: {
					description: 'Workspace-relative path to watch.',
					required: true,
					type: 'string',
				},
				recursive: {
					description: 'Whether to request recursive watching where the host supports it.',
					type: 'boolean',
				},
			},
		},
		description:
			'Watches a workspace path for a bounded duration and returns at most 50 native filesystem events.',
		async execute(input, context): Promise<FileWatchResult> {
			const params = validateFileWatchArguments(input);

			if ('status' in params) {
				return params;
			}

			if (context.signal?.aborted) {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					'File watch was aborted before execution.',
					{
						reason: 'aborted',
					},
					true,
				);
			}

			const watchedPath = await resolveWatchPath(input, context, resolvedDependencies, params);

			if (typeof watchedPath !== 'string') {
				return watchedPath;
			}

			return await watchPath(input, resolvedDependencies, params, watchedPath);
		},
		metadata: {
			capability_class: 'file_system',
			narration_policy: 'optional',
			requires_approval: false,
			risk_level: 'medium',
			side_effect_level: 'read',
			tags: ['file', 'watch', 'workspace'],
		},
		name: 'file.watch',
		user_label_tr: 'Dosya takibi',
		user_summary_tr: 'Bir dosyanin degisimi izlenir.',
	};
}

export const fileWatchTool = createFileWatchTool();
