import type {
	CodeArtifactBlock,
	FileReferenceBlock,
	PlanBlock,
	RenderBlock,
	TableBlock,
	TextBlock,
} from '@runa/types';

import { type ParsedOutputNode, parseOutputToStructuredNodes } from './output-parser.js';

interface StructuredOutputContext {
	readonly created_at: string;
	readonly run_id: string;
	readonly trace_id: string;
}

function createTextBlock(context: StructuredOutputContext, text: string, index: number): TextBlock {
	return {
		created_at: context.created_at,
		id: `text:${context.run_id}:${context.trace_id}:structured:${index}`,
		payload: {
			text,
		},
		schema_version: 1,
		type: 'text',
	};
}

function createCodeArtifactBlock(
	context: StructuredOutputContext,
	node: Extract<ParsedOutputNode, { kind: 'code' }>,
	index: number,
): CodeArtifactBlock {
	return {
		created_at: context.created_at,
		id: `code_artifact:${context.run_id}:${context.trace_id}:${index}`,
		payload: {
			content: node.content,
			filename: node.filename,
			is_truncated: node.is_truncated,
			language: node.language,
			line_count: node.line_count,
		},
		schema_version: 1,
		type: 'code_artifact',
	};
}

function createPlanBlock(
	context: StructuredOutputContext,
	node: Extract<ParsedOutputNode, { kind: 'plan' }>,
	index: number,
): PlanBlock {
	return {
		created_at: context.created_at,
		id: `plan:${context.run_id}:${context.trace_id}:${index}`,
		payload: {
			steps: node.steps,
			title: node.is_ordered ? 'Plan' : 'Checklist',
		},
		schema_version: 1,
		type: 'plan',
	};
}

function createTableBlock(
	context: StructuredOutputContext,
	node: Extract<ParsedOutputNode, { kind: 'table' }>,
	index: number,
): TableBlock {
	return {
		created_at: context.created_at,
		id: `table:${context.run_id}:${context.trace_id}:${index}`,
		payload: {
			headers: node.headers,
			rows: node.rows,
		},
		schema_version: 1,
		type: 'table',
	};
}

function createFileReferenceBlock(
	context: StructuredOutputContext,
	node: Extract<ParsedOutputNode, { kind: 'file_reference' }>,
	index: number,
): FileReferenceBlock {
	return {
		created_at: context.created_at,
		id: `file_reference:${context.run_id}:${context.trace_id}:${index}`,
		payload: {
			line_end: node.line_end,
			line_start: node.line_start,
			path: node.path,
		},
		schema_version: 1,
		type: 'file_reference',
	};
}

function mapStructuredNode(
	context: StructuredOutputContext,
	node: ParsedOutputNode,
	index: number,
): RenderBlock {
	switch (node.kind) {
		case 'text':
			return createTextBlock(context, node.text, index);
		case 'code':
			return createCodeArtifactBlock(context, node, index);
		case 'table':
			return createTableBlock(context, node, index);
		case 'plan':
			return createPlanBlock(context, node, index);
		case 'file_reference':
			return createFileReferenceBlock(context, node, index);
	}
}

export function mapAssistantTextToStructuredBlocks(
	context: StructuredOutputContext,
	assistantText: string,
): readonly RenderBlock[] {
	const parsed = parseOutputToStructuredNodes(assistantText);

	if (parsed.kind === 'raw_text' || parsed.nodes.length === 0) {
		return [createTextBlock(context, parsed.raw_text, 0)];
	}

	return parsed.nodes.map((node, index) => mapStructuredNode(context, node, index));
}
