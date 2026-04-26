import { basename } from 'node:path';

import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

const MAX_SHARED_FILE_BYTES = 5_000_000;

export type FileShareArguments = ToolArguments & {
	readonly filename: string;
	readonly mime_type: string;
	readonly content?: string;
};

export interface FileShareSuccessData {
	readonly blob_id: string;
	readonly expires_at: string;
	readonly filename: string;
	readonly mime_type: string;
	readonly size_bytes: number;
	readonly storage_ref: string;
	readonly url: string;
}

export type FileShareInput = ToolCallInput<'file.share', FileShareArguments>;

export type FileShareSuccessResult = ToolResultSuccess<'file.share', FileShareSuccessData>;

export type FileShareErrorResult = ToolResultError<'file.share'>;

export type FileShareResult = ToolResult<'file.share', FileShareSuccessData>;

function createErrorResult(
	input: FileShareInput,
	error_code: FileShareErrorResult['error_code'],
	error_message: string,
	details?: FileShareErrorResult['details'],
	retryable = false,
): FileShareErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'file.share',
	};
}

function normalizeFilename(filename: string): string | null {
	const normalizedFilename = basename(filename.trim());

	return normalizedFilename.length > 0 ? normalizedFilename : null;
}

function normalizeMimeType(mimeType: string): string | null {
	const normalizedMimeType = mimeType.trim().toLowerCase();

	return normalizedMimeType.length > 0 ? normalizedMimeType : null;
}

export function createFileShareTool(): ToolDefinition<FileShareInput, FileShareResult> {
	return {
		callable_schema: {
			parameters: {
				content: {
					description: 'Text content to store and expose through a scoped signed download URL.',
					type: 'string',
				},
				filename: {
					description: 'Download filename shown to the user.',
					required: true,
					type: 'string',
				},
				mime_type: {
					description: 'MIME type for the downloadable file.',
					required: true,
					type: 'string',
				},
			},
		},
		description: 'Stores generated file content and returns a scoped, expiring download link.',
		async execute(input, context: ToolExecutionContext): Promise<FileShareResult> {
			const filename = normalizeFilename(input.arguments.filename);
			const mimeType = normalizeMimeType(input.arguments.mime_type);
			const content = input.arguments.content;

			if (filename === null || mimeType === null) {
				return createErrorResult(input, 'INVALID_INPUT', 'filename and mime_type are required.');
			}

			if (typeof content !== 'string' || content.length === 0) {
				return createErrorResult(
					input,
					'INVALID_INPUT',
					'file.share requires non-empty string content in this phase.',
				);
			}

			if (context.auth_context === undefined || context.storage_service === undefined) {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					'file.share requires authenticated storage context.',
					undefined,
					true,
				);
			}

			if (context.create_storage_download_url === undefined) {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					'file.share requires a signed download URL factory.',
					undefined,
					true,
				);
			}

			const contentBuffer = Buffer.from(content, 'utf8');

			if (contentBuffer.byteLength > MAX_SHARED_FILE_BYTES) {
				return createErrorResult(input, 'INVALID_INPUT', 'file.share content is limited to 5 MB.', {
					max_bytes: MAX_SHARED_FILE_BYTES,
					size_bytes: contentBuffer.byteLength,
				});
			}

			const storedBlob = await context.storage_service.upload_blob({
				auth: context.auth_context,
				content_base64: contentBuffer.toString('base64'),
				content_type: mimeType,
				filename,
				kind: 'tool_output',
				run_id: context.run_id,
				trace_id: context.trace_id,
			});
			const signedDownload = context.create_storage_download_url({
				blob_id: storedBlob.blob_id,
				filename,
			});

			return {
				artifact_ref: {
					artifact_id: storedBlob.blob_id,
					kind: 'external',
				},
				call_id: input.call_id,
				output: {
					blob_id: storedBlob.blob_id,
					expires_at: signedDownload.expires_at,
					filename,
					mime_type: mimeType,
					size_bytes: storedBlob.size_bytes,
					storage_ref: storedBlob.blob_id,
					url: signedDownload.url,
				},
				status: 'success',
				tool_name: 'file.share',
			};
		},
		metadata: {
			capability_class: 'file_system',
			requires_approval: true,
			risk_level: 'medium',
			side_effect_level: 'write',
			tags: ['file', 'share', 'download'],
		},
		name: 'file.share',
	};
}

export const fileShareTool = createFileShareTool();
