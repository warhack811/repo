import type { ReactElement } from 'react';

import { renderMarkdownBlock } from './markdown/blocks.js';
import { renderInlineMarkdown } from './markdown/inline.js';
import { parseMarkdownBlocks } from './markdown/parser.js';

interface MarkdownRendererProps {
	readonly className?: string;
	readonly content: string;
	readonly isStreaming?: boolean;
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
				? blocks.map((block, index) => renderMarkdownBlock(block, index, renderInlineMarkdown))
				: renderInlineMarkdown(content)}
		</div>
	);
}
