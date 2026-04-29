import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { RunaBadge } from '../../ui/RunaBadge.js';
import { RunaCard } from '../../ui/RunaCard.js';
import type { AssetPreviewKind } from './types.js';

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
				'runa-migrated-components-chat-capability-assetpreviewcard-1',
			]
				.filter(Boolean)
				.join(' ')}
			tone="subtle"
		>
			<div className="runa-migrated-components-chat-capability-assetpreviewcard-2">
				{shouldRenderImage(kind, previewUrl) ? (
					<img
						alt={alt ?? ''}
						src={previewUrl}
						className="runa-migrated-components-chat-capability-assetpreviewcard-3"
					/>
				) : (
					<div className="runa-migrated-components-chat-capability-assetpreviewcard-4">
						{previewUrl ? 'Preview is available for this asset.' : 'Preview will appear here.'}
					</div>
				)}
			</div>
			<div className="runa-migrated-components-chat-capability-assetpreviewcard-5">
				<div className="runa-migrated-components-chat-capability-assetpreviewcard-6">
					<div className="runa-migrated-components-chat-capability-assetpreviewcard-7">{title}</div>
					{subtitle ? (
						<div className="runa-migrated-components-chat-capability-assetpreviewcard-8">
							{subtitle}
						</div>
					) : null}
				</div>
				<RunaBadge tone="neutral">{formatKindLabel(kind)}</RunaBadge>
			</div>
			{metaSlot ? (
				<div className="runa-migrated-components-chat-capability-assetpreviewcard-9">
					{metaSlot}
				</div>
			) : null}
			{actionSlot}
			{children}
		</RunaCard>
	);
}
