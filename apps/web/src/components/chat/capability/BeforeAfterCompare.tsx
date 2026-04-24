import type { CSSProperties, HTMLAttributes, ReactElement } from 'react';

import { designTokens } from '../../../lib/design-tokens.js';
import { RunaBadge } from '../../ui/index.js';
import { AssetPreviewCard } from './AssetPreviewCard.js';
import type { AssetPreviewItem } from './types.js';

export type BeforeAfterCompareProps = Readonly<
	Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
		before: AssetPreviewItem;
		after: AssetPreviewItem;
	}
>;

const compareGridStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.md,
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
	minWidth: 0,
};

const panelStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.sm,
	minWidth: 0,
};

function renderAssetPanel(label: 'After' | 'Before', asset: AssetPreviewItem): ReactElement {
	return (
		<div style={panelStyle}>
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
			className={['runa-before-after-compare', className].filter(Boolean).join(' ')}
			style={{ ...compareGridStyle, ...style }}
		>
			{renderAssetPanel('Before', before)}
			{renderAssetPanel('After', after)}
		</div>
	);
}
