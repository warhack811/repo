import type { ReactElement, ReactNode } from 'react';

interface MarkdownRendererProps {
	readonly className?: string;
	readonly content: string;
	readonly isStreaming?: boolean;
}

type MarkdownBlock =
	| {
			readonly type: 'code';
			readonly code: string;
			readonly language?: string;
	  }
	| {
			readonly level: 1 | 2 | 3;
			readonly text: string;
			readonly type: 'heading';
	  }
	| {
			readonly ordered: boolean;
			readonly items: readonly string[];
			readonly type: 'list';
	  }
	| {
			readonly rows: readonly (readonly string[])[];
			readonly type: 'table';
	  }
	| {
			readonly text: string;
			readonly type: 'paragraph';
	  };

type InlineToken =
	| {
			readonly text: string;
			readonly type: 'text';
	  }
	| {
			readonly text: string;
			readonly type: 'code';
	  }
	| {
			readonly href: string;
			readonly label: string;
			readonly type: 'link';
	  };

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

function parseMarkdownBlocks(content: string): readonly MarkdownBlock[] {
	const normalizedContent = content.replace(/\r\n/gu, '\n');
	const lines = normalizedContent.split('\n');
	const blocks: MarkdownBlock[] = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index] ?? '';
		const trimmedLine = line.trim();

		if (trimmedLine.length === 0) {
			index += 1;
			continue;
		}

		if (isFenceLine(trimmedLine)) {
			const language = parseFenceLanguage(trimmedLine);
			const codeLines: string[] = [];

			index += 1;

			while (index < lines.length && !isFenceLine(lines[index] ?? '')) {
				codeLines.push(lines[index] ?? '');
				index += 1;
			}

			if (index < lines.length && isFenceLine(lines[index] ?? '')) {
				index += 1;
			}

			blocks.push({
				code: codeLines.join('\n'),
				language,
				type: 'code',
			});
			continue;
		}

		const headingMatch = /^(#{1,3})\s+(.+)$/u.exec(trimmedLine);

		if (headingMatch) {
			const hashes = headingMatch[1] ?? '#';
			const text = headingMatch[2] ?? trimmedLine;
			const level = hashes.length as 1 | 2 | 3;
			blocks.push({
				level,
				text: text.trim(),
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

			while (index < lines.length) {
				const rowLine = (lines[index] ?? '').trim();

				if (rowLine.length === 0 || !rowLine.includes('|')) {
					break;
				}

				rows.push([...splitTableRow(rowLine)]);
				index += 1;
			}

			blocks.push({
				rows,
				type: 'table',
			});
			continue;
		}

		const orderedListMatch = /^(\d+)\.\s+(.+)$/u.exec(trimmedLine);
		const unorderedListMatch = /^[-*+]\s+(.+)$/u.exec(trimmedLine);

		if (orderedListMatch || unorderedListMatch) {
			const ordered = Boolean(orderedListMatch);
			const items: string[] = [];

			while (index < lines.length) {
				const currentLine = (lines[index] ?? '').trim();
				const currentOrderedMatch = /^(\d+)\.\s+(.+)$/u.exec(currentLine);
				const currentUnorderedMatch = /^[-*+]\s+(.+)$/u.exec(currentLine);

				if ((ordered && !currentOrderedMatch) || (!ordered && !currentUnorderedMatch)) {
					break;
				}

				items.push((currentOrderedMatch?.[2] ?? currentUnorderedMatch?.[1] ?? '').trim());
				index += 1;
			}

			blocks.push({
				items,
				ordered,
				type: 'list',
			});
			continue;
		}

		const paragraphLines: string[] = [trimmedLine];
		index += 1;

		while (index < lines.length) {
			const nextLine = lines[index] ?? '';
			const nextTrimmedLine = nextLine.trim();

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

		blocks.push({
			text: paragraphLines.join(' '),
			type: 'paragraph',
		});
	}

	return blocks;
}

function parseInlineMarkdown(content: string): readonly InlineToken[] {
	const tokens: InlineToken[] = [];
	let cursor = 0;

	while (cursor < content.length) {
		const linkStart = content.indexOf('[', cursor);
		const codeStart = content.indexOf('`', cursor);
		let nextSpecialIndex = -1;
		let nextSpecialType: 'code' | 'link' | null = null;

		if (codeStart !== -1 && (linkStart === -1 || codeStart < linkStart)) {
			nextSpecialIndex = codeStart;
			nextSpecialType = 'code';
		} else if (linkStart !== -1) {
			nextSpecialIndex = linkStart;
			nextSpecialType = 'link';
		}

		if (nextSpecialIndex === -1 || nextSpecialType === null) {
			tokens.push({
				text: content.slice(cursor),
				type: 'text',
			});
			break;
		}

		if (nextSpecialIndex > cursor) {
			tokens.push({
				text: content.slice(cursor, nextSpecialIndex),
				type: 'text',
			});
		}

		if (nextSpecialType === 'code') {
			const codeEnd = content.indexOf('`', nextSpecialIndex + 1);

			if (codeEnd === -1) {
				tokens.push({
					text: content.slice(nextSpecialIndex),
					type: 'text',
				});
				break;
			}

			tokens.push({
				text: content.slice(nextSpecialIndex + 1, codeEnd),
				type: 'code',
			});
			cursor = codeEnd + 1;
			continue;
		}

		const labelEnd = content.indexOf(']', nextSpecialIndex + 1);
		const hrefStart = labelEnd === -1 ? -1 : content.indexOf('(', labelEnd + 1);
		const hrefEnd = hrefStart === -1 ? -1 : content.indexOf(')', hrefStart + 1);

		if (
			labelEnd === -1 ||
			hrefStart !== labelEnd + 1 ||
			hrefEnd === -1 ||
			hrefEnd <= hrefStart + 1
		) {
			tokens.push({
				text: content.slice(nextSpecialIndex, nextSpecialIndex + 1),
				type: 'text',
			});
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

function renderInlineMarkdown(content: string): ReactNode {
	return parseInlineMarkdown(content).map((token, index) => {
		const key = `inline:${index}:${token.type}`;

		if (token.type === 'code') {
			return (
				<code key={key} className="runa-markdown__inline-code">
					{token.text}
				</code>
			);
		}

		if (token.type === 'link') {
			const href = token.href.trim();
			const isSafeHref = /^https?:\/\//iu.test(href) || href.startsWith('mailto:');

			if (!isSafeHref) {
				return token.label.length > 0 ? token.label : href;
			}

			return (
				<a key={key} className="runa-markdown__link" href={href} rel="noreferrer" target="_blank">
					{token.label.length > 0 ? token.label : href}
				</a>
			);
		}

		return token.text;
	});
}

function renderMarkdownBlock(block: MarkdownBlock, index: number): ReactElement {
	if (block.type === 'heading') {
		const HeadingTag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4';

		return (
			<HeadingTag key={`block:${index}`} className="runa-markdown__heading">
				{renderInlineMarkdown(block.text)}
			</HeadingTag>
		);
	}

	if (block.type === 'code') {
		return (
			<pre key={`block:${index}`} className="runa-markdown__code-block">
				{block.language ? <div className="runa-markdown__code-label">{block.language}</div> : null}
				<code>{block.code}</code>
			</pre>
		);
	}

	if (block.type === 'list') {
		const ListTag = block.ordered ? 'ol' : 'ul';
		const seenItems = new Map<string, number>();

		return (
			<ListTag key={`block:${index}`} className="runa-markdown__list">
				{block.items.map((item) => {
					const occurrence = (seenItems.get(item) ?? 0) + 1;

					seenItems.set(item, occurrence);

					return <li key={`list-item:${item}:${occurrence}`}>{renderInlineMarkdown(item)}</li>;
				})}
			</ListTag>
		);
	}

	if (block.type === 'table') {
		const [headerRow, ...bodyRows] = block.rows;
		const seenHeaderCells = new Map<string, number>();
		const seenRows = new Map<string, number>();

		return (
			<div key={`block:${index}`} className="runa-markdown__table-wrap">
				<table className="runa-markdown__table">
					<thead>
						<tr>
							{headerRow?.map((cell) => {
								const occurrence = (seenHeaderCells.get(cell) ?? 0) + 1;

								seenHeaderCells.set(cell, occurrence);

								return (
									<th key={`table-head:${cell}:${occurrence}`}>{renderInlineMarkdown(cell)}</th>
								);
							})}
						</tr>
					</thead>
					<tbody>
						{bodyRows.map((row) => {
							const rowKey = row.join('|');
							const rowOccurrence = (seenRows.get(rowKey) ?? 0) + 1;
							const seenCells = new Map<string, number>();

							seenRows.set(rowKey, rowOccurrence);

							return (
								<tr key={`table-row:${rowKey}:${rowOccurrence}`}>
									{row.map((cell) => {
										const cellOccurrence = (seenCells.get(cell) ?? 0) + 1;

										seenCells.set(cell, cellOccurrence);

										return (
											<td key={`table-cell:${rowKey}:${cell}:${cellOccurrence}`}>
												{renderInlineMarkdown(cell)}
											</td>
										);
									})}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		);
	}

	return (
		<p key={`block:${index}`} className="runa-markdown__paragraph">
			{renderInlineMarkdown(block.text)}
		</p>
	);
}

export function MarkdownRenderer({
	className,
	content,
	isStreaming = false,
}: MarkdownRendererProps): ReactElement {
	const blocks = parseMarkdownBlocks(content.trim());
	const resolvedClassName = [
		'runa-markdown',
		isStreaming ? 'runa-markdown--streaming' : null,
		className ?? null,
	]
		.filter((value) => typeof value === 'string' && value.length > 0)
		.join(' ');

	return (
		<div className={resolvedClassName}>
			{blocks.length > 0
				? blocks.map((block, index) => renderMarkdownBlock(block, index))
				: renderInlineMarkdown(content)}
		</div>
	);
}
