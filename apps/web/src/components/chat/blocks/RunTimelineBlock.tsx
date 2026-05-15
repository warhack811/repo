import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import { RunActivityFeed } from '../activity/RunActivityFeed.js';
import { adaptRunTimelineBlock } from '../activity/runActivityAdapter.js';
import { formatWorkSummary } from '../workNarrationFormat.js';
import styles from './BlockRenderer.module.css';
import type { BlockComponentProps } from './block-types.js';
import {
	getPresentationBlockDomId,
	getPresentationBlockSummaryDomId,
	getPresentationBlockTitleDomId,
	renderInspectionAction,
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
}: RunTimelineBlockProps): ReactElement {
	const rows = adaptRunTimelineBlock(block, isDeveloperMode);

	return (
		<article
			aria-describedby={getPresentationBlockSummaryDomId(block.id)}
			aria-labelledby={getPresentationBlockTitleDomId(block.id)}
			className={styles['details']}
			id={getPresentationBlockDomId(block.id)}
			tabIndex={-1}
		>
			<div className={styles['header']}>
				<div className={styles['headerStack']}>
					<span className={styles['eyebrow']}>Çalışma etkinlikleri</span>
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
			<RunActivityFeed rows={rows} />
		</article>
	);
}
