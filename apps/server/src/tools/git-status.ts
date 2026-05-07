import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

const MAX_GIT_OUTPUT_BYTES = 32_768;

export type GitStatusArguments = ToolArguments & {
	readonly working_directory?: string;
};

export interface GitStatusSuccessData {
	readonly branch: string;
	readonly is_clean: boolean;
	readonly modified_files: readonly string[];
	readonly staged_files: readonly string[];
	readonly untracked_files: readonly string[];
	readonly working_directory: string;
}

export type GitStatusInput = ToolCallInput<'git.status', GitStatusArguments>;

export type GitStatusSuccessResult = ToolResultSuccess<'git.status', GitStatusSuccessData>;

export type GitStatusErrorResult = ToolResultError<'git.status'>;

export type GitStatusResult = ToolResult<'git.status', GitStatusSuccessData>;

interface GitCommandResult {
	readonly stderr: string;
	readonly stdout: string;
}

interface GitStatusDependencies {
	readonly execFile: typeof execFile;
	readonly stat: typeof stat;
}

interface GitStatusSummary {
	readonly branch: string;
	readonly modified_files: readonly string[];
	readonly staged_files: readonly string[];
	readonly untracked_files: readonly string[];
}

function resolveWorkingDirectory(input: GitStatusInput, context: ToolExecutionContext): string {
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
	input: GitStatusInput,
	error_code: GitStatusErrorResult['error_code'],
	error_message: string,
	workingDirectory: string,
	details?: GitStatusErrorResult['details'],
	retryable?: boolean,
): GitStatusErrorResult {
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
		tool_name: 'git.status',
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
	dependencies: GitStatusDependencies,
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
				maxBuffer: MAX_GIT_OUTPUT_BYTES,
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

function normalizeBranch(branchLine: string): string {
	if (branchLine.startsWith('No commits yet on ')) {
		return branchLine.slice('No commits yet on '.length).trim();
	}

	const branchSegment = branchLine.split('...')[0]?.trim();

	return branchSegment && branchSegment.length > 0 ? branchSegment : branchLine.trim();
}

function toDeterministicPaths(paths: readonly string[]): readonly string[] {
	return [...new Set(paths)].sort((left, right) => left.localeCompare(right));
}

function parseStatusOutput(stdout: string): GitStatusSummary {
	const stagedFiles: string[] = [];
	const modifiedFiles: string[] = [];
	const untrackedFiles: string[] = [];
	const lines = stdout.split(/\r?\n/u).filter((line) => line.trim().length > 0);

	let branch = 'HEAD';

	for (const line of lines) {
		if (line.startsWith('## ')) {
			branch = normalizeBranch(line.slice(3));
			continue;
		}

		if (line.startsWith('?? ')) {
			untrackedFiles.push(line.slice(3).trim());
			continue;
		}

		const stagedMarker = line[0] ?? ' ';
		const modifiedMarker = line[1] ?? ' ';
		const path = line.slice(3).trim();

		if (!path) {
			continue;
		}

		if (stagedMarker !== ' ' && stagedMarker !== '?') {
			stagedFiles.push(path);
		}

		if (modifiedMarker !== ' ' && modifiedMarker !== '?') {
			modifiedFiles.push(path);
		}
	}

	return {
		branch,
		modified_files: toDeterministicPaths(modifiedFiles),
		staged_files: toDeterministicPaths(stagedFiles),
		untracked_files: toDeterministicPaths(untrackedFiles),
	};
}

async function validateWorkingDirectory(
	input: GitStatusInput,
	workingDirectory: string,
	dependencies: GitStatusDependencies,
): Promise<GitStatusErrorResult | undefined> {
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

function toGitStatusErrorResult(
	input: GitStatusInput,
	workingDirectory: string,
	error: unknown,
): GitStatusErrorResult {
	const stderr = extractStderr(error).trim();
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

	if (stderr.includes('not a git repository')) {
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
			`Permission denied while reading git status: ${workingDirectory}`,
			workingDirectory,
			undefined,
			false,
		);
	}

	if (error instanceof Error) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Failed to read git status: ${stderr || error.message}`,
			workingDirectory,
			undefined,
			false,
		);
	}

	return createErrorResult(
		input,
		'UNKNOWN',
		`Failed to read git status: ${workingDirectory}`,
		workingDirectory,
		undefined,
		false,
	);
}

export function createGitStatusTool(
	dependencies: GitStatusDependencies = {
		execFile,
		stat,
	},
): ToolDefinition<GitStatusInput, GitStatusResult> {
	return {
		callable_schema: {
			parameters: {
				working_directory: {
					description: 'Optional git working directory override.',
					type: 'string',
				},
			},
		},
		description:
			'Returns a deterministic git status summary for the current workspace or an explicit working directory.',
		async execute(input, context): Promise<GitStatusResult> {
			const workingDirectory = resolveWorkingDirectory(input, context);
			const workingDirectoryError = await validateWorkingDirectory(
				input,
				workingDirectory,
				dependencies,
			);

			if (workingDirectoryError) {
				return workingDirectoryError;
			}

			try {
				const commandResult = await executeGitCommand(
					dependencies,
					['status', '--porcelain=v1', '--branch', '--untracked-files=all'],
					workingDirectory,
				);
				const summary = parseStatusOutput(commandResult.stdout);

				return {
					call_id: input.call_id,
					output: {
						branch: summary.branch,
						is_clean:
							summary.staged_files.length === 0 &&
							summary.modified_files.length === 0 &&
							summary.untracked_files.length === 0,
						modified_files: summary.modified_files,
						staged_files: summary.staged_files,
						untracked_files: summary.untracked_files,
						working_directory: workingDirectory,
					},
					status: 'success',
					tool_name: 'git.status',
				};
			} catch (error: unknown) {
				return toGitStatusErrorResult(input, workingDirectory, error);
			}
		},
		metadata: {
			capability_class: 'file_system',
			narration_policy: 'optional',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			tags: ['git', 'repository', 'status', 'workspace'],
		},
		name: 'git.status',
	};
}

export const gitStatusTool = createGitStatusTool();
