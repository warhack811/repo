import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import { cx } from '../../ui/ui-utils.js';
import styles from './BlockRenderer.module.css';
import type { BlockComponentProps } from './block-types.js';
import {
	getPresentationBlockDomId,
	getPresentationBlockSummaryDomId,
	getPresentationBlockTitleDomId,
	renderInspectionAction,
	renderInspectionCorrelationContext,
} from './block-utils.js';

type TraceDebugBlockProps = BlockComponentProps<
	Extract<RenderBlock, { type: 'trace_debug_block' }>
>;

export function TraceDebugBlock({
	block,
	getInspectionActionState,
	onRequestInspection,
	presentationCorrelationLabel,
}: TraceDebugBlockProps): ReactElement {
	return (
		<article
			aria-describedby={getPresentationBlockSummaryDomId(block.id)}
			aria-labelledby={getPresentationBlockTitleDomId(block.id)}
			className={cx(styles['block'], styles['blockMuted'])}
			id={getPresentationBlockDomId(block.id)}
			tabIndex={-1}
		>
			<div className={styles['header']}>
				<div className={styles['headerStack']}>
					<span className={styles['eyebrow']}>Trace / debug summary</span>
					<h3 className={styles['title']} id={getPresentationBlockTitleDomId(block.id)}>
						{block.payload.title}
					</h3>
				</div>
				<div className={styles['chipRow']}>
					<span className={styles['chip']}>{block.payload.run_state}</span>
					{renderInspectionAction(
						block,
						'trace_debug',
						onRequestInspection,
						getInspectionActionState,
					)}
				</div>
			</div>
			<p className={styles['summary']} id={getPresentationBlockSummaryDomId(block.id)}>
				{block.payload.summary}
			</p>
			{renderInspectionCorrelationContext(
				block.payload.trace_label ?? presentationCorrelationLabel ?? null,
			)}
			{block.payload.tool_chain_summary ? (
				<p className={styles['summary']}>{block.payload.tool_chain_summary}</p>
			) : null}
			{block.payload.warning_notes?.map((note) => (
				<p className={styles['summary']} key={`${block.id}:warning:${note}`}>
					{note}
				</p>
			))}
		</article>
	);
}
