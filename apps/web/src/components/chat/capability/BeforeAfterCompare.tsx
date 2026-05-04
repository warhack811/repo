import type { HTMLAttributes, ReactElement } from 'react';
import { RunaBadge } from '../../ui/RunaBadge.js';
import { AssetPreviewCard } from './AssetPreviewCard.js';
import type { AssetPreviewItem } from './types.js';
import styles from './BeforeAfterCompare.module.css';

export type BeforeAfterCompareProps = Readonly<
	Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
		before: AssetPreviewItem;
		after: AssetPreviewItem;
	}
>;

function renderAssetPanel(label: 'After' | 'Before', asset: AssetPreviewItem): ReactElement {
	return (
		<div className={styles['panel']}>
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
				styles['container'],
			]
				.filter(Boolean)
				.join(' ')}
		>
			{renderAssetPanel('Before', before)}
			{renderAssetPanel('After', after)}
		</div>
	);
}
