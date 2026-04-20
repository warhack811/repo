import { readFile, stat } from 'node:fs/promises';
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

import { loadRunaIgnoreMatcher } from '../utils/runa-ignore.js';
import { sanitizePromptContent } from '../utils/sanitize-prompt-content.js';

export type FileReadArguments = ToolArguments & {
	readonly encoding?: BufferEncoding;
	readonly path: string;
};

export interface FileReadSuccessData {
	readonly content: string;
	readonly encoding: BufferEncoding;
	readonly path: string;
	readonly size_bytes: number;
}

export type FileReadInput = ToolCallInput<'file.read', FileReadArguments>;

export type FileReadSuccessResult = ToolResultSuccess<'file.read', FileReadSuccessData>;

export type FileReadErrorResult = ToolResultError<'file.read'>;

export type FileReadResult = ToolResult<'file.read', FileReadSuccessData>;

interface FileReadDependencies {
	readonly readFile: typeof readFile;
	readonly stat: typeof stat;
}

function resolveFilePath(input: FileReadInput, context: ToolExecutionContext): string {
	const basePath = context.working_directory ?? process.cwd();

	return resolve(basePath, input.arguments.path);
}

function createErrorResult(
	input: FileReadInput,
	error_code: FileReadErrorResult['error_code'],
	error_message: string,
	path: string,
	retryable?: boolean,
): FileReadErrorResult {
	return {
		call_id: input.call_id,
		details: {
			path,
		},
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'file.read',
	};
}

function toErrorResult(input: FileReadInput, path: string, error: unknown): FileReadErrorResult {
	if (error && typeof error === 'object' && 'code' in error) {
		const errorCode = error.code;

		if (errorCode === 'ENOENT') {
			return createErrorResult(input, 'NOT_FOUND', `File not found: ${path}`, path, false);
		}

		if (errorCode === 'EACCES' || errorCode === 'EPERM') {
			return createErrorResult(
				input,
				'PERMISSION_DENIED',
				`Permission denied while reading file: ${path}`,
				path,
				false,
			);
		}
	}

	if (error instanceof Error) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Failed to read file: ${error.message}`,
			path,
			false,
		);
	}

	return createErrorResult(input, 'UNKNOWN', `Failed to read file: ${path}`, path, false);
}

export function createFileReadTool(
	dependencies: FileReadDependencies = {
		readFile,
		stat,
	},
): ToolDefinition<FileReadInput, FileReadResult> {
	return {
		callable_schema: {
			parameters: {
				encoding: {
					description: 'Optional text encoding.',
					type: 'string',
				},
				path: {
					description: 'Path to read.',
					required: true,
					type: 'string',
				},
			},
		},
		description: 'Reads a text file from the local workspace and returns its contents.',
		async execute(input, context): Promise<FileReadResult> {
			const filePath = resolveFilePath(input, context);
			const encoding = input.arguments.encoding ?? 'utf8';
			const workspaceRoot = resolve(context.working_directory ?? process.cwd());

			try {
				const runaIgnoreMatcher = await loadRunaIgnoreMatcher(workspaceRoot);

				if (
					runaIgnoreMatcher.isIgnoredAbsolutePath(filePath, {
						is_directory: false,
					})
				) {
					return createErrorResult(
						input,
						'PERMISSION_DENIED',
						`Permission denied while reading file: ${filePath}. Ignored by .runaignore.`,
						filePath,
						false,
					);
				}

				const fileStats = await dependencies.stat(filePath);

				if (fileStats.isDirectory()) {
					return createErrorResult(
						input,
						'INVALID_INPUT',
						`Expected a file path but received a directory: ${filePath}`,
						filePath,
						false,
					);
				}

				const content = await dependencies.readFile(filePath, { encoding });

				return {
					call_id: input.call_id,
					output: {
						content: sanitizePromptContent(content),
						encoding,
						path: filePath,
						size_bytes: fileStats.size,
					},
					status: 'success',
					tool_name: 'file.read',
				};
			} catch (error: unknown) {
				return toErrorResult(input, filePath, error);
			}
		},
		metadata: {
			capability_class: 'file_system',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			tags: ['file', 'read', 'workspace'],
		},
		name: 'file.read',
	};
}

export const fileReadTool = createFileReadTool();
