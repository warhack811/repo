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

const technicalToolLabels = new Map<string, string>([
	['desktop.screenshot', 'Ekran goruntusu'],
	['file.read', 'Dosya okuma'],
	['file.write', 'Dosya yazma'],
	['search.codebase', 'Kod arama'],
	['web.search', 'Web arama'],
]);

function formatTimelineToolLabel(toolName: string): string {
	return technicalToolLabels.get(toolName) ?? toolName.replace(/\./gu, ' ');
}

function formatTimelineDetail(detail: string): string {
	let formattedDetail = detail;

	for (const [technicalLabel, friendlyLabel] of technicalToolLabels) {
		formattedDetail = formattedDetail.replaceAll(technicalLabel, friendlyLabel);
	}

	return formattedDetail;
}

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
						{item.detail ? (
							<p className={styles['summary']}>{formatTimelineDetail(item.detail)}</p>
						) : null}
						<div className={styles['chipRow']}>
							{item.tool_name ? (
								<span className={styles['chip']}>{formatTimelineToolLabel(item.tool_name)}</span>
							) : null}
							{item.call_id ? <code className={styles['chip']}>{item.call_id}</code> : null}
						</div>
					</div>
				))}
			</div>
		</article>
	);
}
