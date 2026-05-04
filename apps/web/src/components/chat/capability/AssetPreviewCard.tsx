import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { RunaBadge } from '../../ui/RunaBadge.js';
import { RunaCard } from '../../ui/RunaCard.js';
import type { AssetPreviewKind } from './types.js';
import styles from './AssetPreviewCard.module.css';

export type AssetPreviewCardProps = Readonly<
	Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title'> & {
		actionSlot?: ReactNode;
		alt?: string;
		children?: ReactNode;
		isSelected?: boolean;
		kind: AssetPreviewKind;
		metaSlot?: ReactNode;
		previewUrl?: string;
		subtitle?: ReactNode;
		title: ReactNode;
	}
>;

function shouldRenderImage(
	kind: AssetPreviewKind,
	previewUrl: string | undefined,
): previewUrl is string {
	return Boolean(previewUrl) && (kind === 'image' || kind === 'screenshot');
}

function formatKindLabel(kind: AssetPreviewKind): string {
	return kind;
}

export function AssetPreviewCard({
	actionSlot,
	alt,
	children,
	className,
	isSelected,
	kind,
	metaSlot,
	previewUrl,
	style,
	subtitle,
	title,
	...cardProps
}: AssetPreviewCardProps): ReactElement {
	return (
		<RunaCard
			{...cardProps}
			className={[
				['runa-asset-preview-card', className].filter(Boolean).join(' '),
				styles['root'],
			]
				.filter(Boolean)
				.join(' ')}
			tone="subtle"
		>
			<div className={styles['previewArea']}>
				{shouldRenderImage(kind, previewUrl) ? (
					<img
						alt={alt ?? ''}
						src={previewUrl}
						className={styles['previewImage']}
					/>
				) : (
					<div className={styles['previewPlaceholder']}>
						{previewUrl ? 'Preview is available for this asset.' : 'Preview will appear here.'}
					</div>
				)}
			</div>
			<div className={styles['infoRow']}>
				<div className={styles['titleGroup']}>
					<div className={styles['title']}>{title}</div>
					{subtitle ? (
						<div className={styles['subtitle']}>
							{subtitle}
						</div>
					) : null}
				</div>
				<RunaBadge tone="neutral">{formatKindLabel(kind)}</RunaBadge>
			</div>
			{metaSlot ? (
				<div className={styles['metaSlot']}>
					{metaSlot}
				</div>
			) : null}
			{actionSlot}
			{children}
		</RunaCard>
	);
}
