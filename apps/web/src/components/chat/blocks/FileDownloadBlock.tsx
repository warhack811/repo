import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import styles from './BlockRenderer.module.css';

type FileDownloadBlockProps = Readonly<{
	block: Extract<RenderBlock, { type: 'file_download' }>;
}>;

export function FileDownloadBlock({ block }: FileDownloadBlockProps): ReactElement {
	const sizeLabel =
		block.payload.size_bytes === undefined ? null : `${block.payload.size_bytes} bytes`;
	const expiresLabel =
		block.payload.expires_at === undefined ? null : `Expires ${block.payload.expires_at}`;

	return (
		<article className={styles['block']}>
			<div className={styles['header']}>
				<div className={styles['headerStack']}>
					<span className={styles['eyebrow']}>Download</span>
					<strong className={styles['title']}>{block.payload.filename}</strong>
				</div>
				<a className="runa-button runa-button--primary" download href={block.payload.url}>
					Download
				</a>
			</div>
			<p className={styles['summary']}>
				{[sizeLabel, expiresLabel].filter(Boolean).join(' - ') || 'Scoped download is ready.'}
			</p>
		</article>
	);
}
