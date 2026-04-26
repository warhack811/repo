import type { CSSProperties, ReactElement } from 'react';
import { useState } from 'react';

type ScreenshotCardProps = Readonly<{
	caption?: string;
	imageUrl: string;
	timestamp?: string;
}>;

const cardStyle: CSSProperties = {
	background: 'rgba(15, 23, 42, 0.62)',
	border: '1px solid rgba(148, 163, 184, 0.18)',
	borderRadius: '16px',
	display: 'grid',
	gap: '10px',
	overflow: 'hidden',
	padding: '12px',
};

const imageStyle: CSSProperties = {
	aspectRatio: '16 / 10',
	background: 'rgba(3, 7, 18, 0.7)',
	borderRadius: '12px',
	cursor: 'zoom-in',
	display: 'block',
	objectFit: 'cover',
	width: '100%',
};

const dialogStyle: CSSProperties = {
	background: '#020617',
	border: '1px solid rgba(148, 163, 184, 0.24)',
	borderRadius: '16px',
	color: '#f8fafc',
	maxWidth: 'min(960px, calc(100vw - 32px))',
	padding: '12px',
};

export function ScreenshotCard({
	caption,
	imageUrl,
	timestamp,
}: ScreenshotCardProps): ReactElement {
	const [isOpen, setIsOpen] = useState(false);
	const alt = caption ?? 'Screenshot preview';

	return (
		<article style={cardStyle}>
			<button
				type="button"
				onClick={() => setIsOpen(true)}
				style={{ background: 'transparent', border: 0, padding: 0 }}
			>
				<img alt={alt} loading="lazy" src={imageUrl} style={imageStyle} />
			</button>
			{caption || timestamp ? (
				<div style={{ color: '#cbd5e1', display: 'grid', fontSize: '13px', gap: '4px' }}>
					{caption ? <div>{caption}</div> : null}
					{timestamp ? <time dateTime={timestamp}>{timestamp}</time> : null}
				</div>
			) : null}
			{isOpen ? (
				<dialog open style={dialogStyle}>
					<img
						alt={alt}
						src={imageUrl}
						style={{ display: 'block', maxHeight: '78vh', maxWidth: '100%', objectFit: 'contain' }}
					/>
					<button type="button" onClick={() => setIsOpen(false)} style={{ marginTop: '10px' }}>
						Close
					</button>
				</dialog>
			) : null}
		</article>
	);
}
