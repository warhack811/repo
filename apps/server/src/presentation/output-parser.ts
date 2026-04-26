export type ParsedOutputConfidence = 'high' | 'low' | 'medium';

export interface ParsedTextNode {
	readonly kind: 'text';
	readonly text: string;
}

export interface ParsedCodeNode {
	readonly content: string;
	readonly is_truncated: boolean;
	readonly kind: 'code';
	readonly language: string;
	readonly line_count: number;
	readonly filename?: string;
}

export interface ParsedTableNode {
	readonly headers: readonly string[];
	readonly kind: 'table';
	readonly rows: readonly (readonly string[])[];
}

export type ParsedPlanStepStatus = 'done' | 'pending' | 'skipped';

export interface ParsedPlanStep {
	readonly status: ParsedPlanStepStatus;
	readonly text: string;
}

export interface ParsedPlanNode {
	readonly is_ordered: boolean;
	readonly kind: 'plan';
	readonly steps: readonly ParsedPlanStep[];
}

export interface ParsedFileReferenceNode {
	readonly kind: 'file_reference';
	readonly path: string;
	readonly line_end?: number;
	readonly line_start?: number;
}

export type ParsedOutputNode =
	| ParsedCodeNode
	| ParsedFileReferenceNode
	| ParsedPlanNode
	| ParsedTableNode
	| ParsedTextNode;

export interface ParseOutputOptions {
	readonly inline_content_limit?: number;
}

export interface ParseOutputResult {
	readonly confidence: ParsedOutputConfidence;
	readonly kind: 'raw_text' | 'structured';
	readonly nodes: readonly ParsedOutputNode[];
	readonly raw_text: string;
}

const DEFAULT_INLINE_CONTENT_LIMIT = 4000;
const CODE_FENCE_MARKER = '```';

function truncateInlineContent(
	value: string,
	limit: number,
): Pick<ParsedCodeNode, 'content' | 'is_truncated'> {
	if (value.length <= limit) {
		return {
			content: value,
			is_truncated: false,
		};
	}

	return {
		content: `${value.slice(0, Math.max(0, limit - 4)).trimEnd()}\n...`,
		is_truncated: true,
	};
}

function normalizeNewlines(value: string): string {
	return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseFenceInfo(info: string): Pick<ParsedCodeNode, 'filename' | 'language'> {
	const parts = info.trim().split(/\s+/).filter(Boolean);
	const language = parts[0] ?? 'text';
	const filename = parts.find((part) => isFilePathToken(part));

	return {
		filename,
		language,
	};
}

function parseCodeFenceAt(
	lines: readonly string[],
	startIndex: number,
	inlineContentLimit: number,
): { readonly nextIndex: number; readonly node?: ParsedCodeNode } {
	const openingLine = lines[startIndex];

	if (openingLine === undefined || !openingLine.trimStart().startsWith(CODE_FENCE_MARKER)) {
		return { nextIndex: startIndex };
	}

	const fenceInfo = openingLine.trimStart().slice(CODE_FENCE_MARKER.length);
	const contentLines: string[] = [];
	let closingIndex: number | undefined;

	for (let index = startIndex + 1; index < lines.length; index += 1) {
		const line = lines[index];

		if (line?.trimStart().startsWith(CODE_FENCE_MARKER)) {
			closingIndex = index;
			break;
		}

		contentLines.push(line ?? '');
	}

	if (closingIndex === undefined) {
		return { nextIndex: startIndex };
	}

	const content = contentLines.join('\n');
	const truncated = truncateInlineContent(content, inlineContentLimit);
	const fenceInfoParts = parseFenceInfo(fenceInfo);

	return {
		nextIndex: closingIndex + 1,
		node: {
			...fenceInfoParts,
			content: truncated.content,
			is_truncated: truncated.is_truncated,
			kind: 'code',
			line_count: contentLines.length,
		},
	};
}

function splitTableCells(line: string): string[] {
	const trimmed = line.trim();
	const withoutLeadingPipe = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
	const withoutOuterPipes = withoutLeadingPipe.endsWith('|')
		? withoutLeadingPipe.slice(0, -1)
		: withoutLeadingPipe;

	return withoutOuterPipes.split('|').map((cell) => cell.trim());
}

function isTableSeparatorCell(cell: string): boolean {
	return /^:?-{3,}:?$/.test(cell.trim());
}

function parseTableAt(
	lines: readonly string[],
	startIndex: number,
): { readonly nextIndex: number; readonly node?: ParsedTableNode } {
	const headerLine = lines[startIndex];
	const separatorLine = lines[startIndex + 1];

	if (
		headerLine === undefined ||
		separatorLine === undefined ||
		!headerLine.includes('|') ||
		!separatorLine.includes('|')
	) {
		return { nextIndex: startIndex };
	}

	const headers = splitTableCells(headerLine);
	const separatorCells = splitTableCells(separatorLine);

	if (
		headers.length === 0 ||
		headers.some((header) => header.length === 0) ||
		separatorCells.length !== headers.length ||
		!separatorCells.every(isTableSeparatorCell)
	) {
		return { nextIndex: startIndex };
	}

	const rows: string[][] = [];
	let nextIndex = startIndex + 2;

	for (; nextIndex < lines.length; nextIndex += 1) {
		const line = lines[nextIndex];

		if (line === undefined || !line.includes('|') || line.trim().length === 0) {
			break;
		}

		const cells = splitTableCells(line);

		if (cells.length !== headers.length) {
			break;
		}

		rows.push(cells);
	}

	if (rows.length === 0) {
		return { nextIndex: startIndex };
	}

	return {
		nextIndex,
		node: {
			headers,
			kind: 'table',
			rows,
		},
	};
}

function parsePlanLine(
	line: string,
): { readonly is_ordered: boolean; readonly step: ParsedPlanStep } | undefined {
	const checklistMatch = line.match(/^\s*[-*]\s+\[([ xX~-])\]\s+(.+?)\s*$/);

	if (checklistMatch) {
		const marker = checklistMatch[1];
		const text = checklistMatch[2];

		if (marker === undefined || text === undefined) {
			return undefined;
		}

		const status: ParsedPlanStepStatus =
			marker === 'x' || marker === 'X'
				? 'done'
				: marker === '-' || marker === '~'
					? 'skipped'
					: 'pending';

		return {
			is_ordered: false,
			step: {
				status,
				text,
			},
		};
	}

	const numberedMatch = line.match(/^\s*\d+[.)]\s+(.+?)\s*$/);

	if (numberedMatch?.[1]) {
		return {
			is_ordered: true,
			step: {
				status: 'pending',
				text: numberedMatch[1],
			},
		};
	}

	return undefined;
}

function parsePlanAt(
	lines: readonly string[],
	startIndex: number,
): { readonly nextIndex: number; readonly node?: ParsedPlanNode } {
	const firstLine = parsePlanLine(lines[startIndex] ?? '');

	if (!firstLine) {
		return { nextIndex: startIndex };
	}

	const steps: ParsedPlanStep[] = [firstLine.step];
	let nextIndex = startIndex + 1;

	for (; nextIndex < lines.length; nextIndex += 1) {
		const parsed = parsePlanLine(lines[nextIndex] ?? '');

		if (!parsed || parsed.is_ordered !== firstLine.is_ordered) {
			break;
		}

		steps.push(parsed.step);
	}

	if (steps.length < 2) {
		return { nextIndex: startIndex };
	}

	return {
		nextIndex,
		node: {
			is_ordered: firstLine.is_ordered,
			kind: 'plan',
			steps,
		},
	};
}

function isFilePathToken(value: string): boolean {
	const normalized = value
		.trim()
		.replace(/^`|`$/g, '')
		.replace(/[),.;\]]+$/g, '');

	if (normalized.includes('://') || normalized.includes('@')) {
		return false;
	}

	return (
		/^(?:\.{1,2}[\\/]|[A-Za-z]:[\\/]|apps[\\/]|packages[\\/]|docs[\\/]|src[\\/]|test[\\/])/.test(
			normalized,
		) || /^[\w.-]+(?:[\\/][\w .-]+)+\.[A-Za-z0-9]{1,12}(?::\d+(?:-\d+)?)?$/.test(normalized)
	);
}

function parseFileReferenceToken(value: string): ParsedFileReferenceNode | undefined {
	const normalized = value
		.trim()
		.replace(/^`|`$/g, '')
		.replace(/[),.;\]]+$/g, '');

	if (!isFilePathToken(normalized)) {
		return undefined;
	}

	const match = normalized.match(/^(.+?)(?::(\d+)(?:-(\d+))?)?$/);
	const path = match?.[1];

	if (!match || !path) {
		return undefined;
	}

	const lineStart = match[2] ? Number.parseInt(match[2], 10) : undefined;
	const lineEnd = match[3] ? Number.parseInt(match[3], 10) : undefined;

	return {
		kind: 'file_reference',
		line_end: lineEnd,
		line_start: lineStart,
		path,
	};
}

function collectFileReferences(line: string): readonly ParsedFileReferenceNode[] {
	const tokens = line.split(/\s+/);
	const references: ParsedFileReferenceNode[] = [];
	const seen = new Set<string>();

	for (const token of tokens) {
		const reference = parseFileReferenceToken(token);

		if (!reference) {
			continue;
		}

		const key = `${reference.path}:${reference.line_start ?? ''}:${reference.line_end ?? ''}`;

		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		references.push(reference);
	}

	return references;
}

function flushTextBuffer(nodes: ParsedOutputNode[], textBuffer: string[]): void {
	const text = textBuffer.join('\n').trim();

	if (text.length > 0) {
		nodes.push({
			kind: 'text',
			text,
		});
	}

	textBuffer.length = 0;
}

function getConfidence(nodes: readonly ParsedOutputNode[]): ParsedOutputConfidence {
	const structuredCount = nodes.filter((node) => node.kind !== 'text').length;
	const hasStrongStructure = nodes.some((node) => node.kind === 'code' || node.kind === 'table');
	const nonFileReferenceStructuredCount = nodes.filter(
		(node) => node.kind !== 'text' && node.kind !== 'file_reference',
	).length;

	if (structuredCount === 0) {
		return 'low';
	}

	if (hasStrongStructure || nonFileReferenceStructuredCount >= 2) {
		return 'high';
	}

	return 'medium';
}

export function parseOutputToStructuredNodes(
	rawOutput: string,
	options: ParseOutputOptions = {},
): ParseOutputResult {
	const rawText = normalizeNewlines(rawOutput);
	const inlineContentLimit = options.inline_content_limit ?? DEFAULT_INLINE_CONTENT_LIMIT;
	const lines = rawText.split('\n');
	const nodes: ParsedOutputNode[] = [];
	const textBuffer: string[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const codeFence = parseCodeFenceAt(lines, index, inlineContentLimit);

		if (codeFence.node) {
			flushTextBuffer(nodes, textBuffer);
			nodes.push(codeFence.node);
			index = codeFence.nextIndex - 1;
			continue;
		}

		const table = parseTableAt(lines, index);

		if (table.node) {
			flushTextBuffer(nodes, textBuffer);
			nodes.push(table.node);
			index = table.nextIndex - 1;
			continue;
		}

		const plan = parsePlanAt(lines, index);

		if (plan.node) {
			flushTextBuffer(nodes, textBuffer);
			nodes.push(plan.node);
			index = plan.nextIndex - 1;
			continue;
		}

		const references = collectFileReferences(lines[index] ?? '');

		if (references.length > 0) {
			flushTextBuffer(nodes, textBuffer);
			nodes.push(...references);
		}

		textBuffer.push(lines[index] ?? '');
	}

	flushTextBuffer(nodes, textBuffer);

	const confidence = getConfidence(nodes);

	if (confidence === 'low') {
		return {
			confidence,
			kind: 'raw_text',
			nodes: [],
			raw_text: rawText,
		};
	}

	return {
		confidence,
		kind: 'structured',
		nodes,
		raw_text: rawText,
	};
}
