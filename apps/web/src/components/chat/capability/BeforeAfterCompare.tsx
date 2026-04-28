import type { HTMLAttributes, ReactElement } from 'react';
import { RunaBadge } from '../../ui/index.js';
import { AssetPreviewCard } from './AssetPreviewCard.js';
import type { AssetPreviewItem } from './types.js';

export type BeforeAfterCompareProps = Readonly<
	Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
		before: AssetPreviewItem;
		after: AssetPreviewItem;
	}
>;

function renderAssetPanel(label: 'After' | 'Before', asset: AssetPreviewItem): ReactElement {
	return (
		<div className="runa-migrated-components-chat-capability-beforeaftercompare-1">
			<RunaBadge tone={label === 'After' ? 'success' : 'neutral'}>{label}</RunaBadge>
			<AssetPreviewCard
				alt={asset.alt}
				isSelected={asset.isSelected}
				kind={asset.kind}
				previewUrl={asset.previewUrl}
				subtitle={asset.subtitle}
				title={asset.title}
			/>
		</div>
	);
}

export function BeforeAfterCompare({
	after,
	before,
	className,
	style,
	...compareProps
}: BeforeAfterCompareProps): ReactElement {
	return (
		<div
			{...compareProps}
			className={[
				['runa-before-after-compare', className].filter(Boolean).join(' '),
				'runa-migrated-components-chat-capability-beforeaftercompare-2',
			]
				.filter(Boolean)
				.join(' ')}
		>
			{renderAssetPanel('Before', before)}
			{renderAssetPanel('After', after)}
		</div>
	);
}
