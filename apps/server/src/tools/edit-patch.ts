import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
	canonicalPathIdentity,
	extractEditPatchTargetPath,
	parsePatchHeaderTargets,
	resolvePathWithinWorkingDirectory,
} from './edit-patch-targeting.js';
import {
	type ToolEffectIdempotencyStore,
	buildToolEffectIdempotencyKey,
	defaultToolEffectIdempotencyStore,
} from './tool-idempotency.js';

export type EditPatchArguments = ToolArguments & {
	readonly patch: string;
	readonly target_path?: string;
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

interface ExplicitTargetIdentity {
	readonly expected_target?: string;
	readonly resolved_target?: string;
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

function collectPatchTargets(input: EditPatchInput, workingDirectory: string): PatchTargetsResult {
	const patchText = typeof input.arguments.patch === 'string' ? input.arguments.patch : '';
	const parseResult = parsePatchHeaderTargets(patchText);

	if (parseResult.status === 'error') {
		const errorMessages: Record<string, string> = {
			empty_patch: 'patch must be a non-empty unified diff string.',
			invalid_patch_format: 'patch must contain paired --- and +++ file headers.',
			invalid_patch_target: 'patch contains an invalid target file path.',
			missing_patch_targets: 'patch does not describe any file modifications.',
			unsupported_patch_mode:
				'edit.patch foundation only supports modifications to existing files.',
		};

		return {
			error: createErrorResult(
				input,
				'INVALID_INPUT',
				errorMessages[parseResult.reason] ?? 'patch contains invalid file headers.',
				workingDirectory,
				{
					reason: parseResult.reason,
					validation_stage: 'parse_patch_headers',
				},
				false,
			),
		};
	}

	return {
		affected_files: parseResult.header_paths,
	};
}

function buildTargetIdentityDetails(
	identity: ExplicitTargetIdentity,
	patchHeaderPaths: readonly string[],
	reason: string,
	validationStage: string,
): Readonly<Record<string, unknown>> {
	return {
		expected_target: identity.expected_target,
		patch_header_paths: patchHeaderPaths,
		reason,
		resolved_target: identity.resolved_target,
		validation_stage: validationStage,
	};
}

function validateExplicitTargetIdentity(
	input: EditPatchInput,
	workingDirectory: string,
	affectedFiles: readonly string[],
): {
	readonly error?: EditPatchErrorResult;
	readonly target_identity: ExplicitTargetIdentity;
} {
	const targetPath = extractEditPatchTargetPath(input.arguments);

	if (!targetPath) {
		return {
			target_identity: {},
		};
	}

	const resolvedTarget = resolvePathWithinWorkingDirectory(workingDirectory, targetPath);
	const targetIdentity: ExplicitTargetIdentity = {
		expected_target: targetPath,
		resolved_target: resolvedTarget.resolved_path,
	};

	if (resolvedTarget.escapes_workspace) {
		return {
			error: createErrorResult(
				input,
				'PERMISSION_DENIED',
				`target_path escapes the working directory: ${targetPath}`,
				workingDirectory,
				buildTargetIdentityDetails(
					targetIdentity,
					affectedFiles,
					'target_path_outside_workspace',
					'resolve_target_path',
				),
				false,
			),
			target_identity: targetIdentity,
		};
	}

	if (affectedFiles.length !== 1) {
		return {
			error: createErrorResult(
				input,
				'INVALID_INPUT',
				'target_path requires a single-file patch header target.',
				workingDirectory,
				buildTargetIdentityDetails(
					targetIdentity,
					affectedFiles,
					'ambiguous_patch_target',
					'validate_target_identity',
				),
				false,
			),
			target_identity: targetIdentity,
		};
	}

	const onlyHeaderPath = affectedFiles[0];

	if (!onlyHeaderPath) {
		return {
			error: createErrorResult(
				input,
				'INVALID_INPUT',
				'patch header target is missing.',
				workingDirectory,
				buildTargetIdentityDetails(
					targetIdentity,
					affectedFiles,
					'missing_patch_targets',
					'validate_target_identity',
				),
				false,
			),
			target_identity: targetIdentity,
		};
	}

	const resolvedHeaderTarget = resolvePathWithinWorkingDirectory(workingDirectory, onlyHeaderPath);

	if (resolvedHeaderTarget.escapes_workspace) {
		return {
			error: createErrorResult(
				input,
				'PERMISSION_DENIED',
				`Patch header target escapes the working directory: ${onlyHeaderPath}`,
				workingDirectory,
				buildTargetIdentityDetails(
					targetIdentity,
					affectedFiles,
					'patch_header_path_outside_workspace',
					'validate_target_identity',
				),
				false,
			),
			target_identity: targetIdentity,
		};
	}

	if (
		canonicalPathIdentity(resolvedHeaderTarget.resolved_path) !==
		canonicalPathIdentity(resolvedTarget.resolved_path)
	) {
		return {
			error: createErrorResult(
				input,
				'INVALID_INPUT',
				'target_path does not match the patch header target.',
				workingDirectory,
				buildTargetIdentityDetails(
					targetIdentity,
					affectedFiles,
					'target_path_mismatch',
					'validate_target_identity',
				),
				false,
			),
			target_identity: targetIdentity,
		};
	}

	return {
		target_identity: targetIdentity,
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
	targetIdentity: ExplicitTargetIdentity,
): Promise<EditPatchErrorResult | undefined> {
	for (const affectedFile of affectedFiles) {
		const resolvedTargetPath = resolvePathWithinWorkingDirectory(workingDirectory, affectedFile);

		if (resolvedTargetPath.escapes_workspace) {
			return createErrorResult(
				input,
				'PERMISSION_DENIED',
				`Patch target escapes the working directory: ${affectedFile}`,
				workingDirectory,
				buildTargetIdentityDetails(
					targetIdentity,
					affectedFiles,
					'patch_header_path_outside_workspace',
					'validate_patch_targets',
				),
				false,
			);
		}

		try {
			const targetStats = await dependencies.stat(resolvedTargetPath.resolved_path);

			if (!targetStats.isFile()) {
				return createErrorResult(
					input,
					'INVALID_INPUT',
					`Patch target is not a file: ${affectedFile}`,
					workingDirectory,
					{
						path: affectedFile,
						reason: 'patch_target_not_file',
						...buildTargetIdentityDetails(
							targetIdentity,
							affectedFiles,
							'patch_target_not_file',
							'validate_patch_targets',
						),
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
						...buildTargetIdentityDetails(
							targetIdentity,
							affectedFiles,
							'patch_target_missing',
							'validate_patch_targets',
						),
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
						...buildTargetIdentityDetails(
							targetIdentity,
							affectedFiles,
							'patch_target_validation_failed',
							'validate_patch_targets',
						),
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
					...buildTargetIdentityDetails(
						targetIdentity,
						affectedFiles,
						'patch_target_validation_failed',
						'validate_patch_targets',
					),
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
	targetIdentity: ExplicitTargetIdentity,
	patchHeaderPaths: readonly string[],
): EditPatchErrorResult {
	const stderr = extractStderr(error).trim();
	const errorCode = extractErrorCode(error);

	if (errorCode === 'ENOENT') {
		return createErrorResult(
			input,
			'NOT_FOUND',
			'Git executable not found.',
			workingDirectory,
			buildTargetIdentityDetails(
				targetIdentity,
				patchHeaderPaths,
				'git_not_installed',
				'patch_apply',
			),
			false,
		);
	}

	if (stderr.includes('Permission denied')) {
		return createErrorResult(
			input,
			'PERMISSION_DENIED',
			`Permission denied while applying patch: ${workingDirectory}`,
			workingDirectory,
			buildTargetIdentityDetails(
				targetIdentity,
				patchHeaderPaths,
				'patch_apply_permission_denied',
				'patch_apply',
			),
			false,
		);
	}

	if (stderr.length > 0) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			`Patch could not be applied: ${stderr}`,
			workingDirectory,
			buildTargetIdentityDetails(
				targetIdentity,
				patchHeaderPaths,
				'patch_apply_failed',
				'patch_apply',
			),
			false,
		);
	}

	if (error instanceof Error) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Patch could not be applied: ${error.message}`,
			workingDirectory,
			buildTargetIdentityDetails(
				targetIdentity,
				patchHeaderPaths,
				'patch_apply_failed',
				'patch_apply',
			),
			false,
		);
	}

	return createErrorResult(
		input,
		'UNKNOWN',
		`Patch could not be applied in ${workingDirectory}`,
		workingDirectory,
		buildTargetIdentityDetails(
			targetIdentity,
			patchHeaderPaths,
			'patch_apply_failed',
			'patch_apply',
		),
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
				target_path: {
					description:
						'Strongly recommended explicit target file path. Must resolve to the same file as patch headers when provided.',
					type: 'string',
				},
				working_directory: {
					description: 'Optional working directory override.',
					type: 'string',
				},
			},
		},
		description:
			'Applies a narrow unified diff patch to existing files inside the current workspace. Prefer providing target_path to harden file-target identity.',
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
			const targetIdentityResult = validateExplicitTargetIdentity(
				input,
				workingDirectory,
				affectedFiles,
			);

			if (targetIdentityResult.error) {
				return targetIdentityResult.error;
			}

			const targetIdentity = targetIdentityResult.target_identity;
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
				targetIdentity,
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
				return toEditPatchErrorResult(
					input,
					workingDirectory,
					error,
					targetIdentity,
					affectedFiles,
				);
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
			narration_policy: 'required',
			requires_approval: true,
			risk_level: 'medium',
			side_effect_level: 'write',
			tags: ['diff', 'edit', 'patch', 'workspace'],
		},
		name: 'edit.patch',
		user_label_tr: 'Kod degisikligi',
		user_summary_tr: 'Bir dosyaya yamayla degisiklik uygulanir.',
	};
}

export const editPatchTool = createEditPatchTool();
