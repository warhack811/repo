import type { ReactElement } from 'react';

import {
	Source,
	Sources,
	SourcesContent,
	SourcesTrigger,
} from '../../../components/ai-elements/sources.js';
import { uiText } from '../../../lib/i18n/strings.js';
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
	const keptResultCount = block.payload.results.length;

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
					<span className={styles['eyebrow']}>{uiText.sources.title}</span>
					<h3 className={styles['title']} id={getPresentationBlockTitleDomId(block.id)}>
						{block.payload.title}
					</h3>
				</div>
				<div className={styles['chipRow']}>
					<code className={styles['chip']}>{uiText.evidence.searches(1)}</code>
					<code className={styles['chip']}>{uiText.evidence.results(keptResultCount)}</code>
					{block.payload.is_truncated ? (
						<span className={styles['chip']}>{uiText.evidence.truncated}</span>
					) : null}
				</div>
			</div>
			<p className={styles['summary']} id={getPresentationBlockSummaryDomId(block.id)}>
				{block.payload.summary}
			</p>
			<Sources defaultOpen={false}>
				<SourcesTrigger count={keptResultCount} />
				<SourcesContent>
					{block.payload.results.length === 0 ? (
						<p className={styles['summary']}>{uiText.evidence.noReliableSourcesFound}</p>
					) : (
						block.payload.results.map((result) => (
							<Source href={result.url} key={`${block.id}:${result.url}`} title={result.title}>
								<div className={styles['metaBox']}>
									<div className={styles['headerStack']}>
										<strong>{result.title}</strong>
										<div className={styles['chipRow']}>
											<code className={styles['chip']}>{result.trust_tier}</code>
											<code className={styles['chip']}>{result.source}</code>
										</div>
									</div>
									<p className={styles['summary']}>{result.snippet}</p>
									<p className={styles['muted']}>{result.url}</p>
								</div>
							</Source>
						))
					)}
				</SourcesContent>
			</Sources>
		</article>
	);
}
