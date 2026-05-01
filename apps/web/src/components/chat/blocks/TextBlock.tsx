import type { ReactElement } from 'react';

import { StreamdownMessage } from '../../../lib/streamdown/StreamdownMessage.js';
import type { RenderBlock } from '../../../ws-types.js';
import styles from './BlockRenderer.module.css';

type TextBlockProps = Readonly<{
	block: Extract<RenderBlock, { type: 'text' }>;
}>;

export function TextBlock({ block }: TextBlockProps): ReactElement {
	return (
		<article className={styles['block']}>
			<StreamdownMessage>{block.payload.text}</StreamdownMessage>
		</article>
	);
}
