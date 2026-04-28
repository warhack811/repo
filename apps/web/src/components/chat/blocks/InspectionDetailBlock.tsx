import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import type { InspectionDetailRelation } from '../chat-presentation/types.js';
import styles from './BlockRenderer.module.css';
import {
	formatInspectionTargetLabel,
	getInspectionRelationDomId,
	getInspectionSummaryLabel,
	getPresentationBlockDomId,
	getPresentationBlockSummaryDomId,
	getPresentationBlockTitleDomId,
} from './block-utils.js';

type InspectionDetailBlockProps = Readonly<{
	block: Extract<RenderBlock, { type: 'inspection_detail_block' }>;
	relation?: InspectionDetailRelation;
}>;

function scrollToPresentationBlock(blockId: string): void {
	const blockElement = document.getElementById(getPresentationBlockDomId(blockId));

	if (!blockElement) {
		return;
	}

	blockElement.scrollIntoView({
		behavior: 'smooth',
		block: 'center',
	});
	blockElement.focus({
		preventScroll: true,
	});
}

export function InspectionDetailBlock({
	block,
	relation,
}: InspectionDetailBlockProps): ReactElement {
	const anchorId = relation?.anchor_id;

	return (
		<article
			aria-describedby={`${getPresentationBlockSummaryDomId(block.id)} ${getInspectionRelationDomId(block.id)}`}
			aria-labelledby={getPresentationBlockTitleDomId(block.id)}
			className={styles['block']}
			id={getPresentationBlockDomId(block.id)}
			tabIndex={-1}
		>
			<div className={styles['header']}>
				<div className={styles['headerStack']}>
					<span className={styles['eyebrow']}>Detail card</span>
					<h3 className={styles['title']} id={getPresentationBlockTitleDomId(block.id)}>
						{block.payload.title}
					</h3>
				</div>
				<code className={styles['chip']}>
					{getInspectionSummaryLabel(block.payload.target_kind)}
				</code>
			</div>
			<p className={styles['summary']} id={getPresentationBlockSummaryDomId(block.id)}>
				{block.payload.summary}
			</p>
			<div className={styles['metaBox']} id={getInspectionRelationDomId(block.id)}>
				<span className={styles['metaLabel']}>Summary source</span>
				<strong>
					{relation?.summary_title ?? formatInspectionTargetLabel(block.payload.target_kind)}
				</strong>
				<span className={styles['muted']}>
					Opened from the{' '}
					{relation?.summary_label ?? getInspectionSummaryLabel(block.payload.target_kind)}.
				</span>
				{anchorId ? (
					<button
						aria-controls={getPresentationBlockDomId(anchorId)}
						aria-label={`Back to summary: ${relation.summary_title}`}
						className={styles['smallButton']}
						onClick={() => scrollToPresentationBlock(anchorId)}
						type="button"
					>
						Back to summary
					</button>
				) : null}
			</div>
			<dl className={styles['grid']}>
				{block.payload.detail_items.map((item) => (
					<div className={styles['metaBox']} key={`${block.id}:${item.label}`}>
						<dt className={styles['metaLabel']}>{item.label}</dt>
						<dd>{item.value}</dd>
					</div>
				))}
			</dl>
		</article>
	);
}
