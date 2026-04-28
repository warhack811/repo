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

type WorkspaceInspectionBlockProps = BlockComponentProps<
	Extract<RenderBlock, { type: 'workspace_inspection_block' }>
>;

export function WorkspaceInspectionBlock({
	block,
	getInspectionActionState,
	onRequestInspection,
}: WorkspaceInspectionBlockProps): ReactElement {
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
					<span className={styles['eyebrow']}>Workspace summary</span>
					<h3 className={styles['title']} id={getPresentationBlockTitleDomId(block.id)}>
						{block.payload.title}
					</h3>
				</div>
				{renderInspectionAction(block, 'workspace', onRequestInspection, getInspectionActionState)}
			</div>
			<p className={styles['summary']} id={getPresentationBlockSummaryDomId(block.id)}>
				{block.payload.summary}
			</p>
			<div className={styles['chipRow']}>
				{block.payload.project_name ? (
					<code className={styles['chip']}>{block.payload.project_name}</code>
				) : null}
				{block.payload.project_type_hints.map((hint) => (
					<code className={styles['chip']} key={`${block.id}:hint:${hint}`}>
						{hint}
					</code>
				))}
				{block.payload.top_level_signals.map((signal) => (
					<code className={styles['chip']} key={`${block.id}:signal:${signal}`}>
						{signal}
					</code>
				))}
			</div>
			{block.payload.last_search_summary ? (
				<p className={styles['summary']}>{block.payload.last_search_summary}</p>
			) : null}
		</article>
	);
}
