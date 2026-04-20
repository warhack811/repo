import type { DiffBlock, ToolName, ToolResult } from '@runa/types';

import type { IngestedToolResult } from '../runtime/ingest-tool-result.js';

const DIFF_TITLE = 'Git Diff';

interface MapDiffResultInput {
	readonly call_id?: string;
	readonly changed_paths?: readonly string[];
	readonly created_at: string;
	readonly diff_text: string;
	readonly is_truncated?: boolean;
	readonly title?: string;
}

interface MapToolResultToDiffBlockInput {
	readonly call_id: string;
	readonly created_at: string;
	readonly result: IngestedToolResult | ToolResult;
	readonly tool_name: ToolName;
}

interface GitDiffLikeResult {
	readonly changed_paths: readonly string[];
	readonly diff_text: string;
	readonly is_truncated: boolean;
}

interface GitDiffLikeCandidate {
	readonly changed_paths?: unknown;
	readonly diff_text?: unknown;
	readonly is_truncated?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSuccessResult(
	result: IngestedToolResult | ToolResult,
): result is
	| Extract<IngestedToolResult, { result_status: 'success' }>
	| Extract<ToolResult<'git.diff'>, { status: 'success' }> {
	return (
		('status' in result && result.status === 'success') ||
		('result_status' in result && result.result_status === 'success')
	);
}

function isGitDiffLikeResult(value: unknown): value is GitDiffLikeResult {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as GitDiffLikeCandidate;

	return (
		Array.isArray(candidate.changed_paths) &&
		candidate.changed_paths.every((path) => typeof path === 'string') &&
		typeof candidate.diff_text === 'string' &&
		typeof candidate.is_truncated === 'boolean'
	);
}

function buildDiffSummary(changedPaths: readonly string[]): string {
	if (changedPaths.length === 0) {
		return 'Diff preview returned no changed paths.';
	}

	if (changedPaths.length === 1) {
		return 'Diff preview for 1 changed path.';
	}

	return `Diff preview for ${changedPaths.length} changed paths.`;
}

export function mapDiffResultToBlock(input: MapDiffResultInput): DiffBlock {
	const path = input.changed_paths?.length === 1 ? input.changed_paths[0] : undefined;
	const title = input.title ?? path ?? DIFF_TITLE;
	const idSuffix = input.call_id ?? input.created_at;

	return {
		created_at: input.created_at,
		id: `diff_block:${title}:${idSuffix}`,
		payload: {
			changed_paths: input.changed_paths?.length ? input.changed_paths : undefined,
			diff_text: input.diff_text,
			is_truncated: input.is_truncated || undefined,
			path,
			summary: buildDiffSummary(input.changed_paths ?? []),
			title,
		},
		schema_version: 1,
		type: 'diff_block',
	};
}

export function mapToolResultToDiffBlock(
	input: MapToolResultToDiffBlockInput,
): DiffBlock | undefined {
	if (input.tool_name !== 'git.diff' || !isSuccessResult(input.result)) {
		return undefined;
	}

	if (!isGitDiffLikeResult(input.result.output)) {
		return undefined;
	}

	return mapDiffResultToBlock({
		call_id: input.call_id,
		changed_paths: input.result.output.changed_paths,
		created_at: input.created_at,
		diff_text: input.result.output.diff_text,
		is_truncated: input.result.output.is_truncated,
	});
}
