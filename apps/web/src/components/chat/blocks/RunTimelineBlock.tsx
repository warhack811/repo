import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import styles from './BlockRenderer.module.css';
import type { BlockComponentProps } from './block-types.js';
import {
	getPresentationBlockDomId,
	getPresentationBlockSummaryDomId,
	getPresentationBlockTitleDomId,
	renderInspectionAction,
	renderInspectionCorrelationContext,
} from './block-utils.js';

type RunTimelineBlockProps = BlockComponentProps<
	Extract<RenderBlock, { type: 'run_timeline_block' }>
>;

export function RunTimelineBlock({
	block,
	getInspectionActionState,
	onRequestInspection,
	presentationCorrelationLabel,
}: RunTimelineBlockProps): ReactElement {
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
					<span className={styles['eyebrow']}>Timeline summary</span>
					<h3 className={styles['title']} id={getPresentationBlockTitleDomId(block.id)}>
						{block.payload.title}
					</h3>
				</div>
				{renderInspectionAction(block, 'timeline', onRequestInspection, getInspectionActionState)}
			</div>
			<p className={styles['summary']} id={getPresentationBlockSummaryDomId(block.id)}>
				{block.payload.summary}
			</p>
			{renderInspectionCorrelationContext(presentationCorrelationLabel ?? null)}
			<div className={styles['grid']}>
				{block.payload.items.map((item, index) => (
					<div className={styles['metaBox']} key={`${block.id}:${index}:${item.kind}`}>
						<div className={styles['header']}>
							<strong>{item.label}</strong>
							{item.state ? <span className={styles['chip']}>{item.state}</span> : null}
						</div>
						{item.detail ? <p className={styles['summary']}>{item.detail}</p> : null}
						<div className={styles['chipRow']}>
							{item.tool_name ? <code className={styles['chip']}>{item.tool_name}</code> : null}
							{item.call_id ? <code className={styles['chip']}>{item.call_id}</code> : null}
						</div>
					</div>
				))}
			</div>
		</article>
	);
}
