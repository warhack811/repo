import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import styles from './BlockRenderer.module.css';
import {
	getPresentationBlockDomId,
	getPresentationBlockSummaryDomId,
	getPresentationBlockTitleDomId,
} from './block-utils.js';

type WebSearchResultBlockProps = Readonly<{
	block: Extract<RenderBlock, { type: 'web_search_result_block' }>;
}>;

export function WebSearchResultBlock({ block }: WebSearchResultBlockProps): ReactElement {
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
					<span className={styles['eyebrow']}>Web search</span>
					<h3 className={styles['title']} id={getPresentationBlockTitleDomId(block.id)}>
						{block.payload.title}
					</h3>
				</div>
				<div className={styles['chipRow']}>
					<code className={styles['chip']}>{block.payload.search_provider}</code>
					{block.payload.is_truncated ? <span className={styles['chip']}>truncated</span> : null}
				</div>
			</div>
			<p className={styles['summary']} id={getPresentationBlockSummaryDomId(block.id)}>
				{block.payload.summary}
			</p>
			<div className={styles['grid']}>
				{block.payload.results.length === 0 ? (
					<p className={styles['summary']}>No authority-ranked public results were kept.</p>
				) : (
					block.payload.results.map((result) => (
						<div className={styles['metaBox']} key={`${block.id}:${result.url}`}>
							<div className={styles['headerStack']}>
								<a href={result.url} rel="noreferrer" target="_blank">
									<strong>{result.title}</strong>
								</a>
								<div className={styles['chipRow']}>
									<code className={styles['chip']}>{result.trust_tier}</code>
									<code className={styles['chip']}>{result.source}</code>
								</div>
							</div>
							<p className={styles['summary']}>{result.snippet}</p>
							<p className={styles['muted']}>{result.url}</p>
						</div>
					))
				)}
			</div>
		</article>
	);
}
