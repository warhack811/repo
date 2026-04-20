import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

const DEFAULT_MAX_DIFF_BYTES = 16_384;
const GIT_COMMAND_MAX_BUFFER = 131_072;

export type GitDiffArguments = ToolArguments & {
	readonly cached?: boolean;
	readonly path?: string;
	readonly working_directory?: string;
};

export interface GitDiffSuccessData {
	readonly changed_paths: readonly string[];
	readonly diff_text: string;
	readonly is_truncated: boolean;
	readonly working_directory: string;
}

export type GitDiffInput = ToolCallInput<'git.diff', GitDiffArguments>;

export type GitDiffSuccessResult = ToolResultSuccess<'git.diff', GitDiffSuccessData>;

export type GitDiffErrorResult = ToolResultError<'git.diff'>;

export type GitDiffResult = ToolResult<'git.diff', GitDiffSuccessData>;

interface GitCommandResult {
	readonly stderr: string;
	readonly stdout: string;
}

interface GitDiffDependencies {
	readonly execFile: typeof execFile;
	readonly max_diff_bytes: number;
	readonly stat: typeof stat;
}

function resolveWorkingDirectory(input: GitDiffInput, context: ToolExecutionContext): string {
	const basePath = input.arguments.working_directory ?? context.working_directory ?? process.cwd();

	return resolve(basePath);
}

function buildSafeEnvironment(): NodeJS.ProcessEnv {
	const allowedKeys = [
		'COMSPEC',
		'HOME',
		'LANG',
		'LC_ALL',
		'PATH',
		'PATHEXT',
		'SYSTEMROOT',
		'TEMP',
		'TMP',
		'USERPROFILE',
		'WINDIR',
	] as const;
	const safeEnvironment: NodeJS.ProcessEnv = {};

	for (const key of allowedKeys) {
		const value = process.env[key];

		if (value !== undefined) {
			safeEnvironment[key] = value;
		}
	}

	return safeEnvironment;
}

function createErrorResult(
	input: GitDiffInput,
	error_code: GitDiffErrorResult['error_code'],
	error_message: string,
	workingDirectory: string,
	details?: GitDiffErrorResult['details'],
	retryable?: boolean,
): GitDiffErrorResult {
	return {
		call_id: input.call_id,
		details: {
			working_directory: workingDirectory,
			...details,
		},
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'git.diff',
	};
}

function toText(value: unknown): string {
	if (typeof value === 'string') {
		return value;
	}

	if (Buffer.isBuffer(value)) {
		return value.toString('utf8');
	}

	return '';
}

function extractErrorCode(error: unknown): string | number | undefined {
	if (
		error &&
		typeof error === 'object' &&
		'code' in error &&
		(typeof error.code === 'number' || typeof error.code === 'string')
	) {
		return error.code;
	}

	return undefined;
}

function extractStderr(error: unknown): string {
	if (error && typeof error === 'object' && 'stderr' in error) {
		return toText(error.stderr);
	}

	return '';
}

function executeGitCommand(
	dependencies: GitDiffDependencies,
	args: readonly string[],
	workingDirectory: string,
): Promise<GitCommandResult> {
	return new Promise((resolvePromise, rejectPromise) => {
		dependencies.execFile(
			'git',
			[...args],
			{
				cwd: workingDirectory,
				encoding: 'utf8',
				env: buildSafeEnvironment(),
				maxBuffer: GIT_COMMAND_MAX_BUFFER,
				windowsHide: true,
			},
			(error, stdout, stderr) => {
				if (error) {
					const enrichedError = error as NodeJS.ErrnoException & {
						stderr?: string | Buffer;
						stdout?: string | Buffer;
					};
					enrichedError.stdout = stdout;
					enrichedError.stderr = stderr;
					rejectPromise(enrichedError);
					return;
				}

				resolvePromise({
					stderr: toText(stderr),
					stdout: toText(stdout),
				});
			},
		);
	});
}

function normalizeRelativePath(pathValue: string): string {
	return pathValue.split(sep).join('/');
}

function resolvePathFilter(
	input: GitDiffInput,
	workingDirectory: string,
): { readonly error?: GitDiffErrorResult; readonly path_filter?: string } {
	const rawPath = input.arguments.path;

	if (rawPath === undefined) {
		return {};
	}

	if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
		return {
			error: createErrorResult(
				input,
				'INVALID_INPUT',
				'path must be a non-empty string when provided.',
				workingDirectory,
				{
					reason: 'invalid_path_filter',
				},
				false,
			),
		};
	}

	const resolvedPath = resolve(workingDirectory, rawPath);
	const relativePath = relative(workingDirectory, resolvedPath);

	if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
		return {
			error: createErrorResult(
				input,
				'PERMISSION_DENIED',
				`Path filter escapes the working directory: ${rawPath}`,
				workingDirectory,
				{
					path: rawPath,
					reason: 'path_outside_working_directory',
				},
				false,
			),
		};
	}

	return {
		path_filter: normalizeRelativePath(relativePath || '.'),
	};
}

async function validateWorkingDirectory(
	input: GitDiffInput,
	workingDirectory: string,
	dependencies: GitDiffDependencies,
): Promise<GitDiffErrorResult | undefined> {
	try {
		const workingDirectoryStats = await dependencies.stat(workingDirectory);

		if (!workingDirectoryStats.isDirectory()) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				`Working directory is not a directory: ${workingDirectory}`,
				workingDirectory,
				{
					reason: 'working_directory_not_directory',
				},
				false,
			);
		}

		return undefined;
	} catch (error: unknown) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			return createErrorResult(
				input,
				'NOT_FOUND',
				`Working directory not found: ${workingDirectory}`,
				workingDirectory,
				{
					reason: 'working_directory_missing',
				},
				false,
			);
		}

		if (error instanceof Error) {
			return createErrorResult(
				input,
				'EXECUTION_FAILED',
				`Failed to validate working directory: ${error.message}`,
				workingDirectory,
				undefined,
				false,
			);
		}

		return createErrorResult(
			input,
			'UNKNOWN',
			`Failed to validate working directory: ${workingDirectory}`,
			workingDirectory,
			undefined,
			false,
		);
	}
}

function toGitDiffErrorResult(
	input: GitDiffInput,
	workingDirectory: string,
	error: unknown,
): GitDiffErrorResult {
	const stderr = extractStderr(error).trim();
	const normalizedStderr = stderr.toLocaleLowerCase();
	const errorCode = extractErrorCode(error);

	if (errorCode === 'ENOENT') {
		return createErrorResult(
			input,
			'NOT_FOUND',
			'Git executable not found.',
			workingDirectory,
			{
				reason: 'git_not_installed',
			},
			false,
		);
	}

	if (
		normalizedStderr.includes('not a git repository') ||
		normalizedStderr.includes('use --no-index to compare two paths outside a working tree')
	) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			`Working directory is not a git repository: ${workingDirectory}`,
			workingDirectory,
			{
				reason: 'not_git_repository',
			},
			false,
		);
	}

	if (stderr.includes('Permission denied')) {
		return createErrorResult(
			input,
			'PERMISSION_DENIED',
			`Permission denied while reading git diff: ${workingDirectory}`,
			workingDirectory,
			undefined,
			false,
		);
	}

	if (error instanceof Error) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Failed to read git diff: ${stderr || error.message}`,
			workingDirectory,
			undefined,
			false,
		);
	}

	return createErrorResult(
		input,
		'UNKNOWN',
		`Failed to read git diff: ${workingDirectory}`,
		workingDirectory,
		undefined,
		false,
	);
}

function toDeterministicChangedPaths(stdout: string): readonly string[] {
	return stdout
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.sort((left, right) => left.localeCompare(right));
}

function truncateDiffText(
	diffText: string,
	maxBytes: number,
): { readonly diff_text: string; readonly is_truncated: boolean } {
	if (Buffer.byteLength(diffText, 'utf8') <= maxBytes) {
		return {
			diff_text: diffText,
			is_truncated: false,
		};
	}

	const marker = '\n... [truncated]';
	const markerBytes = Buffer.byteLength(marker, 'utf8');
	const maxContentBytes = Math.max(0, maxBytes - markerBytes);
	const truncatedBuffer = Buffer.from(diffText, 'utf8').subarray(0, maxContentBytes);

	return {
		diff_text: `${truncatedBuffer.toString('utf8')}${marker}`,
		is_truncated: true,
	};
}

export function createGitDiffTool(
	dependencies: Partial<GitDiffDependencies> = {},
): ToolDefinition<GitDiffInput, GitDiffResult> {
	const resolvedDependencies: GitDiffDependencies = {
		execFile: dependencies.execFile ?? execFile,
		max_diff_bytes: dependencies.max_diff_bytes ?? DEFAULT_MAX_DIFF_BYTES,
		stat: dependencies.stat ?? stat,
	};

	return {
		callable_schema: {
			parameters: {
				cached: {
					description: 'Whether to diff staged changes instead of the working tree.',
					type: 'boolean',
				},
				path: {
					description: 'Optional file or directory path filter inside the working directory.',
					type: 'string',
				},
				working_directory: {
					description: 'Optional git working directory override.',
					type: 'string',
				},
			},
		},
		description:
			'Returns a deterministic git diff preview for the current workspace or an explicit working directory.',
		async execute(input, context): Promise<GitDiffResult> {
			const workingDirectory = resolveWorkingDirectory(input, context);
			const workingDirectoryError = await validateWorkingDirectory(
				input,
				workingDirectory,
				resolvedDependencies,
			);

			if (workingDirectoryError) {
				return workingDirectoryError;
			}

			const pathFilterResult = resolvePathFilter(input, workingDirectory);

			if (pathFilterResult.error) {
				return pathFilterResult.error;
			}

			const baseArgs = ['diff', '--no-color', '--no-ext-diff'];

			if (input.arguments.cached) {
				baseArgs.push('--cached');
			}

			try {
				const diffArgs = [...baseArgs];
				const nameOnlyArgs = [...baseArgs, '--name-only'];

				if (pathFilterResult.path_filter && pathFilterResult.path_filter !== '.') {
					diffArgs.push('--', pathFilterResult.path_filter);
					nameOnlyArgs.push('--', pathFilterResult.path_filter);
				}

				const [diffResult, changedPathsResult] = await Promise.all([
					executeGitCommand(resolvedDependencies, diffArgs, workingDirectory),
					executeGitCommand(resolvedDependencies, nameOnlyArgs, workingDirectory),
				]);
				const truncatedDiff = truncateDiffText(
					diffResult.stdout,
					resolvedDependencies.max_diff_bytes,
				);

				return {
					call_id: input.call_id,
					output: {
						changed_paths: toDeterministicChangedPaths(changedPathsResult.stdout),
						diff_text: truncatedDiff.diff_text,
						is_truncated: truncatedDiff.is_truncated,
						working_directory: workingDirectory,
					},
					status: 'success',
					tool_name: 'git.diff',
				};
			} catch (error: unknown) {
				return toGitDiffErrorResult(input, workingDirectory, error);
			}
		},
		metadata: {
			capability_class: 'file_system',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			tags: ['diff', 'git', 'patch', 'repository'],
		},
		name: 'git.diff',
	};
}

export const gitDiffTool = createGitDiffTool();
