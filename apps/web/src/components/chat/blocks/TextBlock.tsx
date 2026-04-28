import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import { MarkdownRenderer } from '../MarkdownRenderer.js';
import styles from './BlockRenderer.module.css';

type TextBlockProps = Readonly<{
	block: Extract<RenderBlock, { type: 'text' }>;
}>;

export function TextBlock({ block }: TextBlockProps): ReactElement {
	return (
		<article className={styles['block']}>
			<MarkdownRenderer content={block.payload.text} />
		</article>
	);
}
