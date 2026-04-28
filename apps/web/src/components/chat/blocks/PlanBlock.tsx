import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import styles from './BlockRenderer.module.css';

type PlanBlockProps = Readonly<{
	block: Extract<RenderBlock, { type: 'plan' }>;
}>;

export function PlanBlock({ block }: PlanBlockProps): ReactElement {
	return (
		<article className={styles['block']}>
			<div className={styles['headerStack']}>
				<span className={styles['eyebrow']}>Structured plan</span>
				<strong className={styles['title']}>{block.payload.title}</strong>
			</div>
			<ol className={styles['list']}>
				{block.payload.steps.map((step, index) => (
					<li key={`${block.id}:step:${index}`}>
						<span className={styles['chip']}>{step.status}</span> {step.text}
					</li>
				))}
			</ol>
		</article>
	);
}
