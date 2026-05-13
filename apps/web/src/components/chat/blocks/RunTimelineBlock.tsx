import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import {
	formatWorkDetail,
	formatWorkStateLabel,
	formatWorkSummary,
	formatWorkTimelineLabel,
	formatWorkToolLabel,
} from '../workNarrationFormat.js';
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
> &
	Readonly<{
		isDeveloperMode?: boolean;
	}>;

export function RunTimelineBlock({
	block,
	getInspectionActionState,
	isDeveloperMode = false,
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
					<span className={styles['eyebrow']}>Canlı çalışma notları</span>
					<h3 className={styles['title']} id={getPresentationBlockTitleDomId(block.id)}>
						{block.payload.title === 'Run Timeline' ? 'Çalışma akışı' : block.payload.title}
					</h3>
				</div>
				{isDeveloperMode
					? renderInspectionAction(block, 'timeline', onRequestInspection, getInspectionActionState)
					: null}
			</div>
			<p className={styles['summary']} id={getPresentationBlockSummaryDomId(block.id)}>
				{formatWorkSummary(block.payload.summary)}
			</p>
			{isDeveloperMode
				? renderInspectionCorrelationContext(presentationCorrelationLabel ?? null)
				: null}
			<div className={styles['grid']}>
				{block.payload.items.map((item, index) => (
					<div className={styles['metaBox']} key={`${block.id}:${index}:${item.kind}`}>
						<div className={styles['header']}>
							<strong>{formatWorkTimelineLabel(item.label)}</strong>
							{item.state ? (
								<span className={styles['chip']}>{formatWorkStateLabel(item.state)}</span>
							) : null}
						</div>
						{(() => {
							const formattedDetail = formatWorkDetail(item.detail);
							return formattedDetail ? (
								<p className={styles['summary']}>{formattedDetail}</p>
							) : null;
						})()}
						<div className={styles['chipRow']}>
							{item.tool_name ? (
								<span className={styles['chip']}>
									{item.user_label_tr ?? formatWorkToolLabel(item.tool_name)}
								</span>
							) : null}
							{isDeveloperMode && item.call_id ? (
								<code className={styles['chip']}>{item.call_id}</code>
							) : null}
						</div>
					</div>
				))}
			</div>
		</article>
	);
}
