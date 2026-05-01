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

type WebSearchSourceView = Readonly<{
	canonicalUrl?: string;
	domain: string;
	href: string;
	publishedAt?: string | null;
	snippet: string;
	title: string;
	trustScore?: number;
	trustTier?: string;
}>;

function formatPublishedDate(value: string | null | undefined): string | null {
	if (!value) {
		return null;
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return null;
	}

	return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(date);
}

function toPercentTrustScore(score: number | undefined): number | null {
	if (score === undefined || !Number.isFinite(score)) {
		return null;
	}

	return Math.max(0, Math.min(100, Math.round(score * 100)));
}

function getEvidenceSources(
	block: Extract<RenderBlock, { type: 'web_search_result_block' }>,
): readonly WebSearchSourceView[] {
	const evidenceSources = block.payload.evidence?.sources ?? block.payload.sources;

	if (evidenceSources && evidenceSources.length > 0) {
		return evidenceSources.map((source) => ({
			canonicalUrl: source.canonical_url,
			domain: source.domain,
			href: source.url,
			publishedAt: source.published_at,
			snippet: source.snippet,
			title: source.title,
			trustScore: source.trust_score,
		}));
	}

	return block.payload.results.map((result) => ({
		canonicalUrl: result.canonical_url,
		domain: result.domain ?? result.source,
		href: result.url,
		publishedAt: result.published_at,
		snippet: result.snippet,
		title: result.title,
		trustScore: result.trust_score,
		trustTier: result.trust_tier,
	}));
}

export function WebSearchResultBlock({ block }: WebSearchResultBlockProps): ReactElement {
	const evidenceSources = getEvidenceSources(block);
	const searchCount = block.payload.evidence?.searches ?? block.payload.searches ?? 1;
	const resultCount =
		block.payload.evidence?.results ?? block.payload.result_count ?? block.payload.results.length;
	const sourceCount = evidenceSources.length;
	const isTruncated =
		block.payload.evidence?.truncated ?? block.payload.truncated ?? block.payload.is_truncated;
	const isUnreliable = block.payload.evidence?.unreliable ?? block.payload.unreliable ?? false;

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
						{uiText.sources.webSearchResults}
					</h3>
				</div>
				<div className={styles['chipRow']}>
					<code className={styles['chip']}>{uiText.evidence.searches(searchCount)}</code>
					<code className={styles['chip']}>{uiText.evidence.results(resultCount)}</code>
					{isTruncated ? <span className={styles['chip']}>{uiText.evidence.truncated}</span> : null}
					{isUnreliable ? (
						<span className={styles['chip']}>{uiText.evidence.unreliable}</span>
					) : null}
				</div>
			</div>
			<p className={styles['summary']} id={getPresentationBlockSummaryDomId(block.id)}>
				{uiText.sources.showingWebResults(resultCount)}
			</p>
			<Sources defaultOpen={false}>
				<SourcesTrigger count={sourceCount} />
				<SourcesContent>
					{evidenceSources.length === 0 ? (
						<p className={styles['summary']}>{uiText.evidence.noReliableSourcesFound}</p>
					) : (
						evidenceSources.map((source) => {
							const publishedDate = formatPublishedDate(source.publishedAt);
							const trustScore = toPercentTrustScore(source.trustScore);

							return (
								<Source href={source.href} key={`${block.id}:${source.href}`} title={source.title}>
									<div className={styles['metaBox']}>
										<div className={styles['headerStack']}>
											<strong>{source.title}</strong>
											<div className={styles['chipRow']}>
												{source.trustTier ? (
													<code className={styles['chip']}>{source.trustTier}</code>
												) : null}
												<code className={styles['chip']}>{source.domain}</code>
												{trustScore === null ? null : (
													<code className={styles['chip']}>
														{uiText.evidence.trustScore(trustScore)}
													</code>
												)}
												{publishedDate ? (
													<code className={styles['chip']}>
														{uiText.evidence.published(publishedDate)}
													</code>
												) : null}
											</div>
										</div>
										<p className={styles['summary']}>{source.snippet}</p>
										<p className={styles['muted']}>{source.canonicalUrl ?? source.href}</p>
									</div>
								</Source>
							);
						})
					)}
				</SourcesContent>
			</Sources>
		</article>
	);
}
