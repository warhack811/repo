import type { FileDownloadBlock, ToolName, ToolResult } from '@runa/types';

import type { IngestedToolResult } from '../runtime/ingest-tool-result.js';

interface MapFileDownloadInput {
	readonly call_id: string;
	readonly created_at: string;
	readonly result: IngestedToolResult | ToolResult;
	readonly tool_name: ToolName;
}

interface FileDownloadOutput {
	readonly filename: string;
	readonly url: string;
	readonly expires_at?: string;
	readonly size_bytes?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSuccessResult(result: IngestedToolResult | ToolResult): boolean {
	return (
		('status' in result && result.status === 'success') ||
		('result_status' in result && result.result_status === 'success')
	);
}

function getOutput(result: IngestedToolResult | ToolResult): unknown {
	return isSuccessResult(result) && 'output' in result ? result.output : undefined;
}

function parseFileDownloadOutput(output: unknown): FileDownloadOutput | undefined {
	if (!isRecord(output)) {
		return undefined;
	}

	const { expires_at: expiresAt, filename, size_bytes: sizeBytes, url } = output;

	if (
		typeof filename !== 'string' ||
		typeof url !== 'string' ||
		(expiresAt !== undefined && typeof expiresAt !== 'string') ||
		(sizeBytes !== undefined && typeof sizeBytes !== 'number')
	) {
		return undefined;
	}

	return {
		expires_at: expiresAt,
		filename,
		size_bytes: sizeBytes,
		url,
	};
}

export function mapToolResultToFileDownloadBlock(
	input: MapFileDownloadInput,
): FileDownloadBlock | undefined {
	if (input.tool_name !== 'file.share') {
		return undefined;
	}

	const output = parseFileDownloadOutput(getOutput(input.result));

	if (!output) {
		return undefined;
	}

	return {
		created_at: input.created_at,
		id: `file_download:${input.tool_name}:${input.call_id}`,
		payload: output,
		schema_version: 1,
		type: 'file_download',
	};
}
