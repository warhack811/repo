import type { CodeBlock, ToolName, ToolResult } from '@runa/types';

import type { IngestedToolResult } from '../runtime/ingest-tool-result.js';

const CODE_CONTENT_PREVIEW_LIMIT = 800;

interface MapCodeResultInput {
	readonly content: string;
	readonly created_at: string;
	readonly diff_kind?: CodeBlock['payload']['diff_kind'];
	readonly language?: string;
	readonly path?: string;
	readonly summary?: string;
	readonly title?: string;
}

interface MapToolResultToCodeBlockInput {
	readonly call_id: string;
	readonly created_at: string;
	readonly result: IngestedToolResult | ToolResult;
	readonly tool_name: ToolName;
}

interface FileContentLikeResult {
	readonly content: string;
	readonly path?: string;
}

interface FileContentLikeCandidate {
	readonly content?: unknown;
	readonly path?: unknown;
}

function truncateContent(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, maxLength - 4)}\n...`;
}

function getLanguageFromPath(path: string | undefined): string {
	if (!path) {
		return 'text';
	}

	const normalizedPath = path.toLowerCase();

	if (normalizedPath.endsWith('.ts') || normalizedPath.endsWith('.tsx')) {
		return 'typescript';
	}

	if (
		normalizedPath.endsWith('.js') ||
		normalizedPath.endsWith('.jsx') ||
		normalizedPath.endsWith('.mjs')
	) {
		return 'javascript';
	}

	if (normalizedPath.endsWith('.json')) {
		return 'json';
	}

	if (normalizedPath.endsWith('.md')) {
		return 'markdown';
	}

	if (normalizedPath.endsWith('.sh') || normalizedPath.endsWith('.bash')) {
		return 'bash';
	}

	if (normalizedPath.endsWith('.css')) {
		return 'css';
	}

	if (normalizedPath.endsWith('.html')) {
		return 'html';
	}

	return 'text';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFileContentLikeResult(value: unknown): value is FileContentLikeResult {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as FileContentLikeCandidate;

	return (
		typeof candidate.content === 'string' &&
		(candidate.path === undefined || typeof candidate.path === 'string')
	);
}

function getCodeBlockSummary(input: {
	readonly path?: string;
	readonly summary?: string;
	readonly tool_name?: ToolName;
}): string | undefined {
	if (input.summary) {
		return input.summary;
	}

	if (input.tool_name === 'file.read') {
		return input.path ? `Code preview from ${input.path}` : 'Code preview from file.read';
	}

	return undefined;
}

export function mapCodeResultToBlock(input: MapCodeResultInput): CodeBlock {
	const language = input.language ?? getLanguageFromPath(input.path);
	const content = truncateContent(input.content, CODE_CONTENT_PREVIEW_LIMIT);
	const title = input.title ?? input.path;

	return {
		created_at: input.created_at,
		id: `code_block:${title ?? 'inline'}:${input.created_at}`,
		payload: {
			content,
			diff_kind: input.diff_kind,
			language,
			path: input.path,
			summary: input.summary,
			title,
		},
		schema_version: 1,
		type: 'code_block',
	};
}

export function mapToolResultToCodeBlock(
	input: MapToolResultToCodeBlockInput,
): CodeBlock | undefined {
	if (
		input.tool_name !== 'file.read' ||
		('status' in input.result && input.result.status === 'error') ||
		('result_status' in input.result && input.result.result_status === 'error')
	) {
		return undefined;
	}

	if (!isFileContentLikeResult(input.result.output)) {
		return undefined;
	}

	return mapCodeResultToBlock({
		content: input.result.output.content,
		created_at: input.created_at,
		diff_kind: 'after',
		path: input.result.output.path,
		summary: getCodeBlockSummary({
			path: input.result.output.path,
			tool_name: input.tool_name,
		}),
		title: input.result.output.path ?? `${input.tool_name}:${input.call_id}`,
	});
}
