import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import { cx } from '../../ui/ui-utils.js';
import styles from './BlockRenderer.module.css';

type StatusBlockProps = Readonly<{
	block: Extract<RenderBlock, { type: 'status' }>;
}>;

function getToneClass(level: StatusBlockProps['block']['payload']['level']): string | undefined {
	switch (level) {
		case 'error':
			return styles['blockDanger'];
		case 'success':
			return styles['blockSuccess'];
		case 'warning':
			return styles['blockWarning'];
		case 'info':
			return styles['blockMuted'];
	}
}

export function StatusBlock({ block }: StatusBlockProps): ReactElement {
	return (
		<article className={cx(styles['block'], getToneClass(block.payload.level))}>
			<div className={styles['header']}>
				<div className={styles['headerStack']}>
					<span className={styles['eyebrow']}>Status update</span>
					<strong className={styles['title']}>{block.payload.message}</strong>
				</div>
				<span className={styles['chip']}>{block.payload.level}</span>
			</div>
		</article>
	);
}
