import type { ReactElement } from 'react';
import { useState } from 'react';

import styles from './ScreenshotCard.module.css';

type ScreenshotCardProps = Readonly<{
	caption?: string;
	imageUrl: string;
	timestamp?: string;
}>;

export function ScreenshotCard({
	caption,
	imageUrl,
	timestamp,
}: ScreenshotCardProps): ReactElement {
	const [isOpen, setIsOpen] = useState(false);
	const alt = caption ?? 'Screenshot preview';

	return (
		<article className={styles['root']}>
			<button type="button" onClick={() => setIsOpen(true)} className={styles['thumbnail']}>
				<img alt={alt} loading="lazy" src={imageUrl} className={styles['image']} />
			</button>
			{caption || timestamp ? (
				<div className={styles['caption']}>
					{caption ? <div>{caption}</div> : null}
					{timestamp ? <time dateTime={timestamp}>{timestamp}</time> : null}
				</div>
			) : null}
			{isOpen ? (
				<dialog open className={styles['modal']}>
					<img alt={alt} src={imageUrl} className={styles['modalImage']} />
					<button type="button" onClick={() => setIsOpen(false)} className={styles['closeButton']}>
						Close
					</button>
				</dialog>
			) : null}
		</article>
	);
}
