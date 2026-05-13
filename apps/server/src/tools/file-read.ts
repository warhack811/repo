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
	readonly end_line?: number;
	readonly path: string;
	readonly start_line?: number;
};

export interface FileReadSuccessData {
	readonly content: string;
	readonly encoding: BufferEncoding;
	readonly line_range?: {
		readonly end: number;
		readonly start: number;
		readonly total_lines: number;
	};
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

function validateLineBoundary(
	input: FileReadInput,
	path: string,
	fieldName: 'end_line' | 'start_line',
	value: number | undefined,
): FileReadErrorResult | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (!Number.isInteger(value) || value <= 0) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			`${fieldName} must be a positive 1-indexed integer.`,
			path,
			false,
		);
	}

	return undefined;
}

function validateRequestedLineRange(
	input: FileReadInput,
	path: string,
): FileReadErrorResult | undefined {
	const startBoundaryError = validateLineBoundary(
		input,
		path,
		'start_line',
		input.arguments.start_line,
	);

	if (startBoundaryError) {
		return startBoundaryError;
	}

	const endBoundaryError = validateLineBoundary(input, path, 'end_line', input.arguments.end_line);

	if (endBoundaryError) {
		return endBoundaryError;
	}

	if (
		input.arguments.start_line !== undefined &&
		input.arguments.end_line !== undefined &&
		input.arguments.start_line > input.arguments.end_line
	) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'start_line must be less than or equal to end_line.',
			path,
			false,
		);
	}

	return undefined;
}

function splitLinesPreservingEndings(content: string): readonly string[] {
	const matches = content.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) ?? [];
	const trailingEmptyIndex = matches.length - 1;

	if (matches[trailingEmptyIndex] === '') {
		return matches.slice(0, trailingEmptyIndex);
	}

	return matches;
}

function applyLineRange(
	input: FileReadInput,
	path: string,
	content: string,
): Readonly<
	| {
			readonly status: 'error';
			readonly result: FileReadErrorResult;
	  }
	| {
			readonly content: string;
			readonly line_range?: FileReadSuccessData['line_range'];
			readonly status: 'success';
	  }
> {
	const requestedStartLine = input.arguments.start_line;
	const requestedEndLine = input.arguments.end_line;

	if (requestedStartLine === undefined && requestedEndLine === undefined) {
		return {
			content,
			status: 'success',
		};
	}

	const lines = splitLinesPreservingEndings(content);
	const totalLines = lines.length;
	const startLine = requestedStartLine ?? 1;

	if (startLine > totalLines) {
		return {
			result: createErrorResult(
				input,
				'INVALID_INPUT',
				`start_line ${startLine} is outside the file line range (total_lines: ${totalLines}).`,
				path,
				false,
			),
			status: 'error',
		};
	}

	const endLine = Math.min(requestedEndLine ?? totalLines, totalLines);
	const selectedContent = lines.slice(startLine - 1, endLine).join('');

	return {
		content: selectedContent,
		line_range: {
			end: endLine,
			start: startLine,
			total_lines: totalLines,
		},
		status: 'success',
	};
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
				start_line: {
					description:
						'Optional 1-indexed inclusive start line. Use with end_line to read a smaller section of a large file.',
					type: 'number',
				},
				end_line: {
					description:
						'Optional 1-indexed inclusive end line. If omitted while start_line is provided, reads through the end of the file.',
					type: 'number',
				},
			},
		},
		description: 'Reads a text file from the local workspace and returns its contents.',
		async execute(input, context): Promise<FileReadResult> {
			const filePath = resolveFilePath(input, context);
			const encoding = input.arguments.encoding ?? 'utf8';
			const workspaceRoot = resolve(context.working_directory ?? process.cwd());
			const lineRangeValidationError = validateRequestedLineRange(input, filePath);

			if (lineRangeValidationError) {
				return lineRangeValidationError;
			}

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
				const rangedContent = applyLineRange(input, filePath, content);

				if (rangedContent.status === 'error') {
					return rangedContent.result;
				}

				const sanitizedContent = sanitizePromptContent(rangedContent.content);

				return {
					call_id: input.call_id,
					output: {
						content: sanitizedContent,
						encoding,
						...(rangedContent.line_range === undefined
							? {}
							: { line_range: rangedContent.line_range }),
						path: filePath,
						size_bytes: Buffer.byteLength(sanitizedContent, encoding),
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
			narration_policy: 'optional',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			tags: ['file', 'read', 'workspace'],
		},
		name: 'file.read',
		user_label_tr: 'Dosya okuma',
		user_summary_tr: 'Belirtilen dosyanin icerigi guvenli sinirlar icinde okunur.',
	};
}

export const fileReadTool = createFileReadTool();
