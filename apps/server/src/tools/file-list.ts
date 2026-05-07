import { readdir, stat } from 'node:fs/promises';
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

export type FileListArguments = ToolArguments & {
	readonly include_hidden?: boolean;
	readonly path: string;
};

export type FileListEntryKind = 'directory' | 'file' | 'other';

export interface FileListEntry {
	readonly kind: FileListEntryKind;
	readonly name: string;
	readonly path: string;
}

export interface FileListSuccessData {
	readonly entries: readonly FileListEntry[];
	readonly path: string;
}

export type FileListInput = ToolCallInput<'file.list', FileListArguments>;

export type FileListSuccessResult = ToolResultSuccess<'file.list', FileListSuccessData>;

export type FileListErrorResult = ToolResultError<'file.list'>;

export type FileListResult = ToolResult<'file.list', FileListSuccessData>;

interface FileListDependencies {
	readonly readdir: typeof readdir;
	readonly stat: typeof stat;
}

function resolveDirectoryPath(input: FileListInput, context: ToolExecutionContext): string {
	const basePath = context.working_directory ?? process.cwd();

	return resolve(basePath, input.arguments.path);
}

function createErrorResult(
	input: FileListInput,
	error_code: FileListErrorResult['error_code'],
	error_message: string,
	path: string,
	retryable?: boolean,
): FileListErrorResult {
	return {
		call_id: input.call_id,
		details: {
			path,
		},
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'file.list',
	};
}

function toEntryKind(entry: { isDirectory(): boolean; isFile(): boolean }): FileListEntryKind {
	if (entry.isDirectory()) {
		return 'directory';
	}

	if (entry.isFile()) {
		return 'file';
	}

	return 'other';
}

function toErrorResult(input: FileListInput, path: string, error: unknown): FileListErrorResult {
	if (error && typeof error === 'object' && 'code' in error) {
		const errorCode = error.code;

		if (errorCode === 'ENOENT') {
			return createErrorResult(input, 'NOT_FOUND', `Directory not found: ${path}`, path, false);
		}

		if (errorCode === 'EACCES' || errorCode === 'EPERM') {
			return createErrorResult(
				input,
				'PERMISSION_DENIED',
				`Permission denied while listing directory: ${path}`,
				path,
				false,
			);
		}
	}

	if (error instanceof Error) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Failed to list directory: ${error.message}`,
			path,
			false,
		);
	}

	return createErrorResult(input, 'UNKNOWN', `Failed to list directory: ${path}`, path, false);
}

export function createFileListTool(
	dependencies: FileListDependencies = {
		readdir,
		stat,
	},
): ToolDefinition<FileListInput, FileListResult> {
	return {
		callable_schema: {
			parameters: {
				include_hidden: {
					description: 'Whether hidden files and directories should be listed.',
					type: 'boolean',
				},
				path: {
					description: 'Directory path to list.',
					required: true,
					type: 'string',
				},
			},
		},
		description: 'Lists the entries in a local workspace directory with deterministic ordering.',
		async execute(input, context): Promise<FileListResult> {
			const directoryPath = resolveDirectoryPath(input, context);
			const includeHidden = input.arguments.include_hidden ?? false;

			try {
				const directoryStats = await dependencies.stat(directoryPath);

				if (!directoryStats.isDirectory()) {
					return createErrorResult(
						input,
						'INVALID_INPUT',
						`Expected a directory path but received a file: ${directoryPath}`,
						directoryPath,
						false,
					);
				}

				const rawEntries = await dependencies.readdir(directoryPath, {
					withFileTypes: true,
				});
				const visibleEntries = rawEntries
					.filter((entry) => includeHidden || !entry.name.startsWith('.'))
					.sort((left, right) => left.name.localeCompare(right.name))
					.map((entry) => ({
						kind: toEntryKind(entry),
						name: entry.name,
						path: join(directoryPath, entry.name),
					}));

				return {
					call_id: input.call_id,
					output: {
						entries: visibleEntries,
						path: directoryPath,
					},
					status: 'success',
					tool_name: 'file.list',
				};
			} catch (error: unknown) {
				return toErrorResult(input, directoryPath, error);
			}
		},
		metadata: {
			capability_class: 'file_system',
			narration_policy: 'optional',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			tags: ['directory', 'file', 'list', 'workspace'],
		},
		name: 'file.list',
	};
}

export const fileListTool = createFileListTool();
