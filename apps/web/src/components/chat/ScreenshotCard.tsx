import type { ReactElement } from 'react';
import { useState } from 'react';

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
		<article className="runa-migrated-components-chat-screenshotcard-1">
			<button
				type="button"
				onClick={() => setIsOpen(true)}
				className="runa-migrated-components-chat-screenshotcard-2"
			>
				<img
					alt={alt}
					loading="lazy"
					src={imageUrl}
					className="runa-migrated-components-chat-screenshotcard-3"
				/>
			</button>
			{caption || timestamp ? (
				<div className="runa-migrated-components-chat-screenshotcard-4">
					{caption ? <div>{caption}</div> : null}
					{timestamp ? <time dateTime={timestamp}>{timestamp}</time> : null}
				</div>
			) : null}
			{isOpen ? (
				<dialog open className="runa-migrated-components-chat-screenshotcard-5">
					<img
						alt={alt}
						src={imageUrl}
						className="runa-migrated-components-chat-screenshotcard-6"
					/>
					<button
						type="button"
						onClick={() => setIsOpen(false)}
						className="runa-migrated-components-chat-screenshotcard-7"
					>
						Close
					</button>
				</dialog>
			) : null}
		</article>
	);
}
