import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

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

export type FileWriteArguments = ToolArguments & {
	readonly content: string;
	readonly encoding?: BufferEncoding;
	readonly overwrite?: boolean;
	readonly path: string;
};

export type FileWriteEffect = 'already_applied' | 'applied';

export interface FileWriteSuccessData {
	readonly bytes_written: number;
	readonly created: boolean;
	readonly encoding: BufferEncoding;
	readonly effect: FileWriteEffect;
	readonly idempotency_key: string;
	readonly overwritten: boolean;
	readonly path: string;
}

export type FileWriteInput = ToolCallInput<'file.write', FileWriteArguments>;

export type FileWriteSuccessResult = ToolResultSuccess<'file.write', FileWriteSuccessData>;

export type FileWriteErrorResult = ToolResultError<'file.write'>;

export type FileWriteResult = ToolResult<'file.write', FileWriteSuccessData>;

interface FileWriteDependencies {
	readonly idempotencyStore: ToolEffectIdempotencyStore;
	readonly readFile: typeof readFile;
	readonly stat: typeof stat;
	readonly writeFile: typeof writeFile;
}

function resolveFilePath(input: FileWriteInput, context: ToolExecutionContext): string {
	const basePath = context.working_directory ?? process.cwd();

	return resolve(basePath, input.arguments.path);
}

function createErrorResult(
	input: FileWriteInput,
	error_code: FileWriteErrorResult['error_code'],
	error_message: string,
	path: string,
	details?: FileWriteErrorResult['details'],
	retryable?: boolean,
): FileWriteErrorResult {
	return {
		call_id: input.call_id,
		details: {
			path,
			...details,
		},
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'file.write',
	};
}

function createSuccessResult(
	input: FileWriteInput,
	output: FileWriteSuccessData,
): FileWriteSuccessResult {
	return {
		call_id: input.call_id,
		output,
		status: 'success',
		tool_name: 'file.write',
	};
}

function toErrorResult(input: FileWriteInput, path: string, error: unknown): FileWriteErrorResult {
	if (error && typeof error === 'object' && 'code' in error) {
		const errorCode = error.code;

		if (errorCode === 'ENOENT') {
			return createErrorResult(
				input,
				'NOT_FOUND',
				`Parent directory not found for file write: ${path}`,
				path,
				{
					reason: 'parent_directory_missing',
				},
				false,
			);
		}

		if (errorCode === 'EISDIR') {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				`Expected a file path but received a directory: ${path}`,
				path,
				{
					reason: 'target_is_directory',
				},
				false,
			);
		}

		if (errorCode === 'EEXIST') {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				`File already exists and overwrite is disabled: ${path}`,
				path,
				{
					reason: 'target_exists',
				},
				false,
			);
		}

		if (errorCode === 'EACCES' || errorCode === 'EPERM') {
			return createErrorResult(
				input,
				'PERMISSION_DENIED',
				`Permission denied while writing file: ${path}`,
				path,
				undefined,
				false,
			);
		}
	}

	if (error instanceof Error) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Failed to write file: ${error.message}`,
			path,
			undefined,
			false,
		);
	}

	return createErrorResult(
		input,
		'UNKNOWN',
		`Failed to write file: ${path}`,
		path,
		undefined,
		false,
	);
}

function isMissingPathError(error: unknown): boolean {
	return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

export function createFileWriteTool(
	dependencies: FileWriteDependencies = {
		idempotencyStore: defaultToolEffectIdempotencyStore,
		readFile,
		stat,
		writeFile,
	},
): ToolDefinition<FileWriteInput, FileWriteResult> {
	return {
		callable_schema: {
			parameters: {
				content: {
					description: 'Text content to write.',
					required: true,
					type: 'string',
				},
				encoding: {
					description: 'Optional text encoding.',
					type: 'string',
				},
				overwrite: {
					description: 'Whether an existing file may be overwritten.',
					type: 'boolean',
				},
				path: {
					description: 'Target file path.',
					required: true,
					type: 'string',
				},
			},
		},
		description:
			'Writes text content to a local workspace file using an explicit overwrite policy.',
		async execute(input, context): Promise<FileWriteResult> {
			const filePath = resolveFilePath(input, context);
			const parentPath = dirname(filePath);
			const encoding = input.arguments.encoding ?? 'utf8';
			const overwrite = input.arguments.overwrite ?? false;
			const idempotencyKey = buildToolEffectIdempotencyKey({
				payload: {
					content: input.arguments.content,
					encoding,
					overwrite,
				},
				run_id: context.run_id,
				target: filePath,
				tool_name: 'file.write',
			});

			try {
				const parentStats = await dependencies.stat(parentPath);

				if (!parentStats.isDirectory()) {
					return createErrorResult(
						input,
						'INVALID_INPUT',
						`Parent path is not a directory: ${parentPath}`,
						filePath,
						{
							parent_path: parentPath,
							reason: 'parent_not_directory',
						},
						false,
					);
				}

				let targetExists = false;
				const existingIdempotentEffect = dependencies.idempotencyStore.get(idempotencyKey);

				try {
					const targetStats = await dependencies.stat(filePath);
					targetExists = true;

					if (targetStats.isDirectory()) {
						return createErrorResult(
							input,
							'INVALID_INPUT',
							`Expected a file path but received a directory: ${filePath}`,
							filePath,
							{
								reason: 'target_is_directory',
							},
							false,
						);
					}

					if (existingIdempotentEffect) {
						const existingContent = await dependencies.readFile(filePath, {
							encoding,
						});

						if (existingContent === input.arguments.content) {
							return createSuccessResult(input, {
								bytes_written: 0,
								created: false,
								effect: 'already_applied',
								encoding,
								idempotency_key: idempotencyKey,
								overwritten: false,
								path: filePath,
							});
						}
					}

					if (!overwrite) {
						return createErrorResult(
							input,
							'INVALID_INPUT',
							`File already exists and overwrite is disabled: ${filePath}`,
							filePath,
							{
								reason: 'target_exists',
							},
							false,
						);
					}
				} catch (error: unknown) {
					if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
						return toErrorResult(input, filePath, error);
					}
				}

				await dependencies.writeFile(filePath, input.arguments.content, {
					encoding,
					flag: overwrite ? 'w' : 'wx',
				});
				dependencies.idempotencyStore.markApplied({
					applied_at: new Date().toISOString(),
					key: idempotencyKey,
					run_id: context.run_id,
					tool_name: 'file.write',
				});

				return createSuccessResult(input, {
					bytes_written: Buffer.byteLength(input.arguments.content, encoding),
					created: !targetExists,
					effect: 'applied',
					encoding,
					idempotency_key: idempotencyKey,
					overwritten: targetExists,
					path: filePath,
				});
			} catch (error: unknown) {
				if (isMissingPathError(error)) {
					return createErrorResult(
						input,
						'NOT_FOUND',
						`Parent directory not found for file write: ${filePath}`,
						filePath,
						{
							reason: 'parent_directory_missing',
						},
						false,
					);
				}

				return toErrorResult(input, filePath, error);
			}
		},
		metadata: {
			capability_class: 'file_system',
			requires_approval: true,
			risk_level: 'medium',
			side_effect_level: 'write',
			tags: ['file', 'write', 'workspace'],
		},
		name: 'file.write',
	};
}

export const fileWriteTool = createFileWriteTool();
