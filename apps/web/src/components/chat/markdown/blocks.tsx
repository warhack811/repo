import type { ReactElement } from 'react';

import type { InlineRenderer, MarkdownBlock } from './types.js';

function renderHeadingBlock(
	block: Extract<MarkdownBlock, { type: 'heading' }>,
	index: number,
	renderInline: InlineRenderer,
): ReactElement {
	const HeadingTag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4';

	return (
		<HeadingTag className="runa-markdown__heading" key={`block:${index}`}>
			{renderInline(block.text)}
		</HeadingTag>
	);
}

function renderListBlock(
	block: Extract<MarkdownBlock, { type: 'list' }>,
	index: number,
	renderInline: InlineRenderer,
): ReactElement {
	const ListTag = block.ordered ? 'ol' : 'ul';
	const seenItems = new Map<string, number>();

	return (
		<ListTag className="runa-markdown__list" key={`block:${index}`}>
			{block.items.map((item) => {
				const occurrence = (seenItems.get(item) ?? 0) + 1;
				seenItems.set(item, occurrence);

				return <li key={`list-item:${item}:${occurrence}`}>{renderInline(item)}</li>;
			})}
		</ListTag>
	);
}

function renderTableBlock(
	block: Extract<MarkdownBlock, { type: 'table' }>,
	index: number,
	renderInline: InlineRenderer,
): ReactElement {
	const [headerRow, ...bodyRows] = block.rows;
	const seenHeaderCells = new Map<string, number>();
	const seenRows = new Map<string, number>();

	return (
		<div className="runa-markdown__table-wrap" key={`block:${index}`}>
			<table className="runa-markdown__table">
				<thead>
					<tr>
						{headerRow?.map((cell) => {
							const occurrence = (seenHeaderCells.get(cell) ?? 0) + 1;
							seenHeaderCells.set(cell, occurrence);

							return <th key={`table-head:${cell}:${occurrence}`}>{renderInline(cell)}</th>;
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
											{renderInline(cell)}
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

export function renderMarkdownBlock(
	block: MarkdownBlock,
	index: number,
	renderInline: InlineRenderer,
): ReactElement {
	switch (block.type) {
		case 'heading':
			return renderHeadingBlock(block, index, renderInline);
		case 'code':
			return (
				<pre className="runa-markdown__code-block" key={`block:${index}`}>
					{block.language ? (
						<div className="runa-markdown__code-label">{block.language}</div>
					) : null}
					<code>{block.code}</code>
				</pre>
			);
		case 'list':
			return renderListBlock(block, index, renderInline);
		case 'table':
			return renderTableBlock(block, index, renderInline);
		case 'paragraph':
			return (
				<p className="runa-markdown__paragraph" key={`block:${index}`}>
					{renderInline(block.text)}
				</p>
			);
	}
}
