import { ChevronDown } from 'lucide-react';
import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import { RunaDisclosure } from '../../ui/index.js';
import { cx } from '../../ui/ui-utils.js';
import styles from './BlockRenderer.module.css';

type ToolResultBlockProps = Readonly<{
	block: Extract<RenderBlock, { type: 'tool_result' }>;
}>;

export function ToolResultBlock({ block }: ToolResultBlockProps): ReactElement {
	const isSuccess = block.payload.status === 'success';

	return (
		<article
			className={cx(styles['block'], isSuccess ? styles['blockSuccess'] : styles['blockDanger'])}
		>
			<div className={styles['resultHeader']}>
				<div className={styles['headerStack']}>
					<span className={styles['eyebrow']}>Tool result</span>
					<strong className={styles['title']}>{block.payload.tool_name}</strong>
				</div>
				<div className={styles['chipRow']}>
					<span className={styles['chip']}>{block.payload.status}</span>
					<code className={styles['chip']}>{block.payload.call_id}</code>
				</div>
			</div>
			<p className={styles['summary']}>{block.payload.summary}</p>
			<RunaDisclosure
				title={
					<span className={styles['chipRow']}>
						<ChevronDown size={16} />
						Show tool payload
					</span>
				}
			>
				<div className={styles['grid']}>
					{block.payload.error_code ? (
						<div className={styles['metaBox']}>
							<span className={styles['metaLabel']}>Error code</span>
							<code>{block.payload.error_code}</code>
						</div>
					) : null}
					{block.payload.result_preview ? (
						<div className={styles['metaBox']}>
							<span className={styles['metaLabel']}>
								Preview / {block.payload.result_preview.kind}
							</span>
							<span>{block.payload.result_preview.summary_text}</span>
						</div>
					) : null}
				</div>
			</RunaDisclosure>
		</article>
	);
}
