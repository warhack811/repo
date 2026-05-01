import type { ReactElement } from 'react';

import { StreamdownMessage } from '../../../lib/streamdown/StreamdownMessage.js';
import type { RenderBlock } from '../../../ws-types.js';
import styles from './BlockRenderer.module.css';

type FileReferenceBlockProps = Readonly<{
	block: Extract<RenderBlock, { type: 'file_reference' }>;
}>;

function getLineLabel(block: FileReferenceBlockProps['block']): string | null {
	if (block.payload.line_start === undefined) {
		return null;
	}

	return block.payload.line_end === undefined
		? `line ${block.payload.line_start}`
		: `lines ${block.payload.line_start}-${block.payload.line_end}`;
}

export function FileReferenceBlock({ block }: FileReferenceBlockProps): ReactElement {
	const lineLabel = getLineLabel(block);

	return (
		<article className={styles['block']}>
			<div className={styles['header']}>
				<div className={styles['headerStack']}>
					<span className={styles['eyebrow']}>File reference</span>
					<strong className={styles['title']}>{block.payload.path}</strong>
				</div>
				{lineLabel ? <code className={styles['chip']}>{lineLabel}</code> : null}
			</div>
			{block.payload.snippet ? (
				<StreamdownMessage>{block.payload.snippet}</StreamdownMessage>
			) : null}
		</article>
	);
}
