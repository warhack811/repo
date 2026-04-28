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

type SearchResultBlockProps = BlockComponentProps<
	Extract<RenderBlock, { type: 'search_result_block' }>
>;

export function SearchResultBlock({
	block,
	getInspectionActionState,
	onRequestInspection,
}: SearchResultBlockProps): ReactElement {
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
					<span className={styles['eyebrow']}>Search summary</span>
					<h3 className={styles['title']} id={getPresentationBlockTitleDomId(block.id)}>
						{block.payload.title}
					</h3>
				</div>
				<div className={styles['chipRow']}>
					{block.payload.is_truncated ? <span className={styles['chip']}>truncated</span> : null}
					{renderInspectionAction(
						block,
						'search_result',
						onRequestInspection,
						getInspectionActionState,
					)}
				</div>
			</div>
			<p className={styles['summary']} id={getPresentationBlockSummaryDomId(block.id)}>
				{block.payload.summary}
			</p>
			<div className={styles['metaGrid']}>
				<div className={styles['metaBox']}>
					<span className={styles['metaLabel']}>Query</span>
					<code>{block.payload.query}</code>
				</div>
				<div className={styles['metaBox']}>
					<span className={styles['metaLabel']}>Search root</span>
					<span>{block.payload.searched_root}</span>
				</div>
				<div className={styles['metaBox']}>
					<span className={styles['metaLabel']}>Visible window</span>
					<span>{block.payload.total_matches ?? block.payload.matches.length}</span>
				</div>
			</div>
			<div className={styles['grid']}>
				{block.payload.matches.length === 0 ? (
					<p className={styles['summary']}>No visible matches returned.</p>
				) : (
					block.payload.matches.map((match) => (
						<div
							className={styles['metaBox']}
							key={`${block.id}:${match.path}:${match.line_number}`}
						>
							<div className={styles['header']}>
								<strong>{match.path}</strong>
								<code className={styles['chip']}>line {match.line_number}</code>
							</div>
							<pre className={styles['payload']}>{match.line_text}</pre>
						</div>
					))
				)}
			</div>
		</article>
	);
}
