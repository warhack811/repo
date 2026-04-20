import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';

import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

import {
	type ToolEffectIdempotencyStore,
	buildToolEffectIdempotencyKey,
	defaultToolEffectIdempotencyStore,
} from './tool-idempotency.js';

export type EditPatchArguments = ToolArguments & {
	readonly patch: string;
	readonly working_directory?: string;
};

export type EditPatchEffect = 'already_applied' | 'applied';

export interface EditPatchSuccessData {
	readonly affected_files: readonly string[];
	readonly effect: EditPatchEffect;
	readonly idempotency_key: string;
	readonly working_directory: string;
}

export type EditPatchInput = ToolCallInput<'edit.patch', EditPatchArguments>;

export type EditPatchSuccessResult = ToolResultSuccess<'edit.patch', EditPatchSuccessData>;

export type EditPatchErrorResult = ToolResultError<'edit.patch'>;

export type EditPatchResult = ToolResult<'edit.patch', EditPatchSuccessData>;

interface EditPatchDependencies {
	readonly execFile: typeof execFile;
	readonly idempotencyStore: ToolEffectIdempotencyStore;
	readonly mkdtemp: typeof mkdtemp;
	readonly rm: typeof rm;
	readonly stat: typeof stat;
	readonly writeFile: typeof writeFile;
}

interface PatchTargetsResult {
	readonly affected_files?: readonly string[];
	readonly error?: EditPatchErrorResult;
}

function resolveWorkingDirectory(input: EditPatchInput, context: ToolExecutionContext): string {
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
	input: EditPatchInput,
	error_code: EditPatchErrorResult['error_code'],
	error_message: string,
	workingDirectory: string,
	details?: EditPatchErrorResult['details'],
	retryable?: boolean,
): EditPatchErrorResult {
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
		tool_name: 'edit.patch',
	};
}

function createSuccessResult(
	input: EditPatchInput,
	output: EditPatchSuccessData,
): EditPatchSuccessResult {
	return {
		call_id: input.call_id,
		output,
		status: 'success',
		tool_name: 'edit.patch',
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
	dependencies: EditPatchDependencies,
	args: readonly string[],
	workingDirectory: string,
): Promise<void> {
	return new Promise((resolvePromise, rejectPromise) => {
		dependencies.execFile(
			'git',
			[...args],
			{
				cwd: workingDirectory,
				encoding: 'utf8',
				env: buildSafeEnvironment(),
				maxBuffer: 131_072,
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

				resolvePromise();
			},
		);
	});
}

function normalizePatchPath(rawPath: string): string | undefined {
	const trimmedPath = rawPath.split('\t')[0]?.trim();

	if (!trimmedPath || trimmedPath === '/dev/null') {
		return undefined;
	}

	let normalizedPath = trimmedPath;

	if (normalizedPath.startsWith('"') && normalizedPath.endsWith('"')) {
		normalizedPath = normalizedPath.slice(1, -1);
	}

	if (normalizedPath.startsWith('a/') || normalizedPath.startsWith('b/')) {
		normalizedPath = normalizedPath.slice(2);
	}

	if (normalizedPath.startsWith('./')) {
		normalizedPath = normalizedPath.slice(2);
	}

	return normalizedPath.trim().length > 0 ? normalizedPath.trim() : undefined;
}

function collectPatchTargets(input: EditPatchInput, workingDirectory: string): PatchTargetsResult {
	const patchText = input.arguments.patch;

	if (typeof patchText !== 'string' || patchText.trim().length === 0) {
		return {
			error: createErrorResult(
				input,
				'INVALID_INPUT',
				'patch must be a non-empty unified diff string.',
				workingDirectory,
				{
					reason: 'empty_patch',
				},
				false,
			),
		};
	}

	const lines = patchText.split(/\r?\n/u);
	const affectedFiles: string[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? '';

		if (!line.startsWith('--- ')) {
			continue;
		}

		const nextLine = lines[index + 1] ?? '';

		if (!nextLine.startsWith('+++ ')) {
			return {
				error: createErrorResult(
					input,
					'INVALID_INPUT',
					'patch must contain paired --- and +++ file headers.',
					workingDirectory,
					{
						reason: 'invalid_patch_format',
					},
					false,
				),
			};
		}

		const oldPath = line.slice(4).trim();
		const newPath = nextLine.slice(4).trim();

		if (oldPath === '/dev/null' || newPath === '/dev/null') {
			return {
				error: createErrorResult(
					input,
					'INVALID_INPUT',
					'edit.patch foundation only supports modifications to existing files.',
					workingDirectory,
					{
						reason: 'unsupported_patch_mode',
					},
					false,
				),
			};
		}

		const normalizedNewPath = normalizePatchPath(newPath);

		if (!normalizedNewPath) {
			return {
				error: createErrorResult(
					input,
					'INVALID_INPUT',
					'patch contains an invalid target file path.',
					workingDirectory,
					{
						reason: 'invalid_patch_target',
					},
					false,
				),
			};
		}

		affectedFiles.push(normalizedNewPath);
	}

	if (affectedFiles.length === 0) {
		return {
			error: createErrorResult(
				input,
				'INVALID_INPUT',
				'patch does not describe any file modifications.',
				workingDirectory,
				{
					reason: 'missing_patch_targets',
				},
				false,
			),
		};
	}

	return {
		affected_files: [...new Set(affectedFiles)].sort((left, right) => left.localeCompare(right)),
	};
}

async function validateWorkingDirectory(
	input: EditPatchInput,
	workingDirectory: string,
	dependencies: EditPatchDependencies,
): Promise<EditPatchErrorResult | undefined> {
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

async function validateAffectedFiles(
	input: EditPatchInput,
	workingDirectory: string,
	affectedFiles: readonly string[],
	dependencies: EditPatchDependencies,
): Promise<EditPatchErrorResult | undefined> {
	for (const affectedFile of affectedFiles) {
		const resolvedTargetPath = resolve(workingDirectory, affectedFile);
		const relativeTargetPath = relative(workingDirectory, resolvedTargetPath);

		if (relativeTargetPath.startsWith('..') || isAbsolute(relativeTargetPath)) {
			return createErrorResult(
				input,
				'PERMISSION_DENIED',
				`Patch target escapes the working directory: ${affectedFile}`,
				workingDirectory,
				{
					path: affectedFile,
					reason: 'path_outside_working_directory',
				},
				false,
			);
		}

		try {
			const targetStats = await dependencies.stat(resolvedTargetPath);

			if (!targetStats.isFile()) {
				return createErrorResult(
					input,
					'INVALID_INPUT',
					`Patch target is not a file: ${affectedFile}`,
					workingDirectory,
					{
						path: affectedFile,
						reason: 'patch_target_not_file',
					},
					false,
				);
			}
		} catch (error: unknown) {
			if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
				return createErrorResult(
					input,
					'NOT_FOUND',
					`Patch target not found: ${affectedFile}`,
					workingDirectory,
					{
						path: affectedFile,
						reason: 'patch_target_missing',
					},
					false,
				);
			}

			if (error instanceof Error) {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					`Failed to validate patch target: ${error.message}`,
					workingDirectory,
					{
						path: affectedFile,
					},
					false,
				);
			}

			return createErrorResult(
				input,
				'UNKNOWN',
				`Failed to validate patch target: ${affectedFile}`,
				workingDirectory,
				{
					path: affectedFile,
				},
				false,
			);
		}
	}

	return undefined;
}

async function writePatchFile(
	dependencies: EditPatchDependencies,
	patchText: string,
): Promise<{ readonly patch_directory: string; readonly patch_path: string }> {
	const patchDirectory = await dependencies.mkdtemp(join(tmpdir(), 'runa-edit-patch-'));
	const patchPath = join(patchDirectory, 'input.patch');

	await dependencies.writeFile(patchPath, patchText, 'utf8');

	return {
		patch_directory: patchDirectory,
		patch_path: patchPath,
	};
}

async function isPatchAlreadyApplied(
	dependencies: EditPatchDependencies,
	patchPath: string,
	workingDirectory: string,
): Promise<boolean> {
	try {
		await executeGitCommand(
			dependencies,
			['apply', '--check', '--reverse', '--whitespace=nowarn', patchPath],
			workingDirectory,
		);
		return true;
	} catch {
		return false;
	}
}

function toEditPatchErrorResult(
	input: EditPatchInput,
	workingDirectory: string,
	error: unknown,
): EditPatchErrorResult {
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

	if (stderr.includes('Permission denied')) {
		return createErrorResult(
			input,
			'PERMISSION_DENIED',
			`Permission denied while applying patch: ${workingDirectory}`,
			workingDirectory,
			undefined,
			false,
		);
	}

	if (stderr.length > 0) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			`Patch could not be applied: ${stderr}`,
			workingDirectory,
			{
				reason: 'patch_apply_failed',
			},
			false,
		);
	}

	if (error instanceof Error) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Patch could not be applied: ${error.message}`,
			workingDirectory,
			{
				reason: 'patch_apply_failed',
			},
			false,
		);
	}

	return createErrorResult(
		input,
		'UNKNOWN',
		`Patch could not be applied in ${workingDirectory}`,
		workingDirectory,
		{
			reason: 'patch_apply_failed',
		},
		false,
	);
}

export function createEditPatchTool(
	dependencies: EditPatchDependencies = {
		execFile,
		idempotencyStore: defaultToolEffectIdempotencyStore,
		mkdtemp,
		rm,
		stat,
		writeFile,
	},
): ToolDefinition<EditPatchInput, EditPatchResult> {
	return {
		callable_schema: {
			parameters: {
				patch: {
					description: 'Unified diff patch text to apply inside the working directory.',
					required: true,
					type: 'string',
				},
				working_directory: {
					description: 'Optional working directory override.',
					type: 'string',
				},
			},
		},
		description:
			'Applies a narrow unified diff patch to existing files inside the current workspace.',
		async execute(input, context): Promise<EditPatchResult> {
			const workingDirectory = resolveWorkingDirectory(input, context);
			const workingDirectoryError = await validateWorkingDirectory(
				input,
				workingDirectory,
				dependencies,
			);

			if (workingDirectoryError) {
				return workingDirectoryError;
			}

			const patchTargetsResult = collectPatchTargets(input, workingDirectory);

			if (patchTargetsResult.error) {
				return patchTargetsResult.error;
			}

			const affectedFiles = patchTargetsResult.affected_files ?? [];
			const idempotencyKey = buildToolEffectIdempotencyKey({
				payload: {
					affected_files: affectedFiles,
					patch: input.arguments.patch,
				},
				run_id: context.run_id,
				target: workingDirectory,
				tool_name: 'edit.patch',
			});
			const affectedFilesError = await validateAffectedFiles(
				input,
				workingDirectory,
				affectedFiles,
				dependencies,
			);

			if (affectedFilesError) {
				return affectedFilesError;
			}

			let patchDirectory: string | undefined;

			try {
				const patchFile = await writePatchFile(dependencies, input.arguments.patch);
				patchDirectory = patchFile.patch_directory;

				if (
					dependencies.idempotencyStore.get(idempotencyKey) &&
					(await isPatchAlreadyApplied(dependencies, patchFile.patch_path, workingDirectory))
				) {
					return createSuccessResult(input, {
						affected_files: affectedFiles,
						effect: 'already_applied',
						idempotency_key: idempotencyKey,
						working_directory: workingDirectory,
					});
				}

				await executeGitCommand(
					dependencies,
					['apply', '--check', '--whitespace=nowarn', patchFile.patch_path],
					workingDirectory,
				);
				await executeGitCommand(
					dependencies,
					['apply', '--whitespace=nowarn', patchFile.patch_path],
					workingDirectory,
				);
				dependencies.idempotencyStore.markApplied({
					applied_at: new Date().toISOString(),
					key: idempotencyKey,
					run_id: context.run_id,
					tool_name: 'edit.patch',
				});

				return createSuccessResult(input, {
					affected_files: affectedFiles,
					effect: 'applied',
					idempotency_key: idempotencyKey,
					working_directory: workingDirectory,
				});
			} catch (error: unknown) {
				return toEditPatchErrorResult(input, workingDirectory, error);
			} finally {
				if (patchDirectory) {
					await dependencies.rm(patchDirectory, {
						force: true,
						recursive: true,
					});
				}
			}
		},
		metadata: {
			capability_class: 'file_system',
			requires_approval: true,
			risk_level: 'medium',
			side_effect_level: 'write',
			tags: ['diff', 'edit', 'patch', 'workspace'],
		},
		name: 'edit.patch',
	};
}

export const editPatchTool = createEditPatchTool();
