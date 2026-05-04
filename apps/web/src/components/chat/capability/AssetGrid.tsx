import type { HTMLAttributes, KeyboardEvent, ReactElement } from 'react';
import { AssetPreviewCard } from './AssetPreviewCard.js';
import type { AssetPreviewItem } from './types.js';
import styles from './AssetGrid.module.css';

export type AssetGridProps = Readonly<
	Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> & {
		items: readonly AssetPreviewItem[];
		onSelect?: (item: AssetPreviewItem) => void;
		emptyLabel?: string;
	}
>;

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
		return emptyLabel ? (
			<div className={styles['empty']}>{emptyLabel}</div>
		) : null;
	}

	return (
		<div
			{...gridProps}
			className={[
				['runa-asset-grid', className].filter(Boolean).join(' '),
				styles['grid'],
			]
				.filter(Boolean)
				.join(' ')}
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
						className={styles['gridItem']}
						subtitle={item.subtitle}
						tabIndex={isSelectable ? 0 : undefined}
						title={item.title}
					/>
				);
			})}
		</div>
	);
}
