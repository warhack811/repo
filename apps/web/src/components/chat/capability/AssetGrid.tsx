import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactElement } from 'react';

import { emptyStateCardStyle } from '../../../lib/chat-styles.js';
import { designTokens } from '../../../lib/design-tokens.js';
import { AssetPreviewCard } from './AssetPreviewCard.js';
import type { AssetPreviewItem } from './types.js';

export type AssetGridProps = Readonly<
	Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> & {
		items: readonly AssetPreviewItem[];
		onSelect?: (item: AssetPreviewItem) => void;
		emptyLabel?: string;
	}
>;

const gridStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.md,
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
	minWidth: 0,
};

const selectableCardStyle: CSSProperties = {
	cursor: 'pointer',
};

function handleSelectableKeyDown(
	event: KeyboardEvent<HTMLDivElement>,
	item: AssetPreviewItem,
	onSelect: (item: AssetPreviewItem) => void,
): void {
	if (event.key !== 'Enter' && event.key !== ' ') {
		return;
	}

	event.preventDefault();
	onSelect(item);
}

export function AssetGrid({
	className,
	emptyLabel,
	items,
	onSelect,
	style,
	...gridProps
}: AssetGridProps): ReactElement | null {
	if (items.length === 0) {
		return emptyLabel ? <div style={emptyStateCardStyle}>{emptyLabel}</div> : null;
	}

	return (
		<div
			{...gridProps}
			className={['runa-asset-grid', className].filter(Boolean).join(' ')}
			style={{ ...gridStyle, ...style }}
		>
			{items.map((item) => {
				const isSelectable = Boolean(onSelect);

				return (
					<AssetPreviewCard
						alt={item.alt}
						aria-pressed={isSelectable ? Boolean(item.isSelected) : undefined}
						isSelected={item.isSelected}
						key={item.id}
						kind={item.kind}
						onClick={onSelect ? () => onSelect(item) : undefined}
						onKeyDown={
							onSelect ? (event) => handleSelectableKeyDown(event, item, onSelect) : undefined
						}
						previewUrl={item.previewUrl}
						role={isSelectable ? 'button' : undefined}
						style={isSelectable ? selectableCardStyle : undefined}
						subtitle={item.subtitle}
						tabIndex={isSelectable ? 0 : undefined}
						title={item.title}
					/>
				);
			})}
		</div>
	);
}
