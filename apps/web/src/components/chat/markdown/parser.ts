import type { InlineToken, MarkdownBlock } from './types.js';

function isFenceLine(line: string): boolean {
	return /^```/.test(line.trim());
}

function parseFenceLanguage(line: string): string | undefined {
	const match = /^```([a-z0-9_-]+)?/i.exec(line.trim());
	const language = match?.[1]?.trim();
	return language && language.length > 0 ? language : undefined;
}

function isTableSeparator(line: string): boolean {
	return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/u.test(line);
}

function splitTableRow(line: string): readonly string[] {
	const trimmedLine = line.trim();
	const normalizedLine =
		trimmedLine.startsWith('|') && trimmedLine.endsWith('|')
			? trimmedLine.slice(1, -1)
			: trimmedLine.startsWith('|')
				? trimmedLine.slice(1)
				: trimmedLine.endsWith('|')
					? trimmedLine.slice(0, -1)
					: trimmedLine;

	return normalizedLine.split('|').map((cell) => cell.trim());
}

function parseFenceBlock(
	lines: readonly string[],
	startIndex: number,
): {
	readonly block: MarkdownBlock;
	readonly nextIndex: number;
} {
	const language = parseFenceLanguage(lines[startIndex] ?? '');
	const codeLines: string[] = [];
	let index = startIndex + 1;

	while (index < lines.length && !isFenceLine(lines[index] ?? '')) {
		codeLines.push(lines[index] ?? '');
		index += 1;
	}

	return {
		block: { code: codeLines.join('\n'), language, type: 'code' },
		nextIndex: index < lines.length ? index + 1 : index,
	};
}

function parseListBlock(
	lines: readonly string[],
	startIndex: number,
	ordered: boolean,
): {
	readonly block: MarkdownBlock;
	readonly nextIndex: number;
} {
	const items: string[] = [];
	let index = startIndex;

	while (index < lines.length) {
		const currentLine = (lines[index] ?? '').trim();
		const orderedMatch = /^(\d+)\.\s+(.+)$/u.exec(currentLine);
		const unorderedMatch = /^[-*+]\s+(.+)$/u.exec(currentLine);

		if ((ordered && !orderedMatch) || (!ordered && !unorderedMatch)) {
			break;
		}

		items.push((orderedMatch?.[2] ?? unorderedMatch?.[1] ?? '').trim());
		index += 1;
	}

	return { block: { items, ordered, type: 'list' }, nextIndex: index };
}

export function parseMarkdownBlocks(content: string): readonly MarkdownBlock[] {
	const lines = content.replace(/\r\n/gu, '\n').split('\n');
	const blocks: MarkdownBlock[] = [];
	let index = 0;

	while (index < lines.length) {
		const trimmedLine = (lines[index] ?? '').trim();

		if (trimmedLine.length === 0) {
			index += 1;
			continue;
		}

		if (isFenceLine(trimmedLine)) {
			const parsed = parseFenceBlock(lines, index);
			blocks.push(parsed.block);
			index = parsed.nextIndex;
			continue;
		}

		const headingMatch = /^(#{1,3})\s+(.+)$/u.exec(trimmedLine);

		if (headingMatch) {
			blocks.push({
				level: (headingMatch[1] ?? '#').length as 1 | 2 | 3,
				text: (headingMatch[2] ?? trimmedLine).trim(),
				type: 'heading',
			});
			index += 1;
			continue;
		}

		if (
			trimmedLine.includes('|') &&
			index + 1 < lines.length &&
			isTableSeparator(lines[index + 1] ?? '')
		) {
			const rows: string[][] = [[...splitTableRow(trimmedLine)]];
			index += 2;

			while (index < lines.length && (lines[index] ?? '').trim().includes('|')) {
				rows.push([...splitTableRow(lines[index] ?? '')]);
				index += 1;
			}

			blocks.push({ rows, type: 'table' });
			continue;
		}

		const orderedListMatch = /^(\d+)\.\s+(.+)$/u.exec(trimmedLine);
		const unorderedListMatch = /^[-*+]\s+(.+)$/u.exec(trimmedLine);

		if (orderedListMatch || unorderedListMatch) {
			const parsed = parseListBlock(lines, index, Boolean(orderedListMatch));
			blocks.push(parsed.block);
			index = parsed.nextIndex;
			continue;
		}

		const paragraphLines: string[] = [trimmedLine];
		index += 1;

		while (index < lines.length) {
			const nextTrimmedLine = (lines[index] ?? '').trim();

			if (
				nextTrimmedLine.length === 0 ||
				isFenceLine(nextTrimmedLine) ||
				/^(#{1,3})\s+(.+)$/u.test(nextTrimmedLine) ||
				/^(\d+)\.\s+(.+)$/u.test(nextTrimmedLine) ||
				/^[-*+]\s+(.+)$/u.test(nextTrimmedLine) ||
				(nextTrimmedLine.includes('|') &&
					index + 1 < lines.length &&
					isTableSeparator(lines[index + 1] ?? ''))
			) {
				break;
			}

			paragraphLines.push(nextTrimmedLine);
			index += 1;
		}

		blocks.push({ text: paragraphLines.join(' '), type: 'paragraph' });
	}

	return blocks;
}

export function parseInlineMarkdown(content: string): readonly InlineToken[] {
	const tokens: InlineToken[] = [];
	let cursor = 0;

	while (cursor < content.length) {
		const linkStart = content.indexOf('[', cursor);
		const codeStart = content.indexOf('`', cursor);
		const isCodeNext = codeStart !== -1 && (linkStart === -1 || codeStart < linkStart);
		const nextSpecialIndex = isCodeNext ? codeStart : linkStart;

		if (nextSpecialIndex === -1) {
			tokens.push({ text: content.slice(cursor), type: 'text' });
			break;
		}

		if (nextSpecialIndex > cursor) {
			tokens.push({ text: content.slice(cursor, nextSpecialIndex), type: 'text' });
		}

		if (isCodeNext) {
			const codeEnd = content.indexOf('`', nextSpecialIndex + 1);

			if (codeEnd === -1) {
				tokens.push({ text: content.slice(nextSpecialIndex), type: 'text' });
				break;
			}

			tokens.push({ text: content.slice(nextSpecialIndex + 1, codeEnd), type: 'code' });
			cursor = codeEnd + 1;
			continue;
		}

		const labelEnd = content.indexOf(']', nextSpecialIndex + 1);
		const hrefStart = labelEnd === -1 ? -1 : content.indexOf('(', labelEnd + 1);
		const hrefEnd = hrefStart === -1 ? -1 : content.indexOf(')', hrefStart + 1);

		if (labelEnd === -1 || hrefStart !== labelEnd + 1 || hrefEnd === -1) {
			tokens.push({ text: content.slice(nextSpecialIndex, nextSpecialIndex + 1), type: 'text' });
			cursor = nextSpecialIndex + 1;
			continue;
		}

		tokens.push({
			href: content.slice(hrefStart + 1, hrefEnd).trim(),
			label: content.slice(nextSpecialIndex + 1, labelEnd).trim(),
			type: 'link',
		});
		cursor = hrefEnd + 1;
	}

	return tokens;
}
