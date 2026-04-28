import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import styles from './BlockRenderer.module.css';
import { summarizeEventListBlock } from './block-utils.js';

type EventListBlockProps = Readonly<{
	block: Extract<RenderBlock, { type: 'event_list' }>;
}>;

export function EventListBlock({ block }: EventListBlockProps): ReactElement {
	return (
		<article className={styles['block']}>
			<div className={styles['header']}>
				<div className={styles['headerStack']}>
					<span className={styles['eyebrow']}>Runtime activity</span>
					<strong className={styles['title']}>{summarizeEventListBlock(block)}</strong>
				</div>
				<span className={styles['chip']}>Developer Mode</span>
			</div>
			<p className={styles['summary']}>
				Visible in Developer Mode because this is raw runtime context.
			</p>
		</article>
	);
}
