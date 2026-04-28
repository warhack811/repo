import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import styles from './BlockRenderer.module.css';
import type { BlockComponentProps } from './block-types.js';
import {
	getPresentationBlockDomId,
	getPresentationBlockSummaryDomId,
	getPresentationBlockTitleDomId,
	renderInspectionAction,
} from './block-utils.js';

type DiffBlockProps = BlockComponentProps<Extract<RenderBlock, { type: 'diff_block' }>>;

export function DiffBlock({
	block,
	getInspectionActionState,
	onRequestInspection,
}: DiffBlockProps): ReactElement {
	return (
		<article
			aria-describedby={getPresentationBlockSummaryDomId(block.id)}
			aria-labelledby={getPresentationBlockTitleDomId(block.id)}
			className={styles['block']}
			id={getPresentationBlockDomId(block.id)}
			tabIndex={-1}
		>
			<div className={styles['header']}>
				<div className={styles['headerStack']}>
					<span className={styles['eyebrow']}>Diff summary</span>
					<h3 className={styles['title']} id={getPresentationBlockTitleDomId(block.id)}>
						{block.payload.title ?? block.payload.path ?? 'Git Diff'}
					</h3>
				</div>
				<div className={styles['chipRow']}>
					{block.payload.is_truncated ? <span className={styles['chip']}>truncated</span> : null}
					{renderInspectionAction(block, 'diff', onRequestInspection, getInspectionActionState)}
				</div>
			</div>
			<p className={styles['summary']} id={getPresentationBlockSummaryDomId(block.id)}>
				{block.payload.summary}
			</p>
			{block.payload.changed_paths && block.payload.changed_paths.length > 0 ? (
				<div className={styles['chipRow']}>
					{block.payload.changed_paths.map((path) => (
						<code className={styles['chip']} key={`${block.id}:${path}`}>
							{path}
						</code>
					))}
				</div>
			) : null}
			<details className={styles['details']}>
				<summary>View diff</summary>
				<pre className={styles['payload']}>{block.payload.diff_text}</pre>
			</details>
		</article>
	);
}
