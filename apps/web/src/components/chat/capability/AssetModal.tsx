import type { DialogHTMLAttributes, MouseEvent, ReactElement } from 'react';
import { useId } from 'react';
import { RunaBadge } from '../../ui/RunaBadge.js';
import { RunaButton } from '../../ui/RunaButton.js';
import { CapabilityResultActions } from './CapabilityResultActions.js';
import type { AssetPreviewItem, CapabilityResultAction } from './types.js';
import styles from './AssetModal.module.css';

export type AssetModalProps = Readonly<
	Omit<DialogHTMLAttributes<HTMLDialogElement>, 'children' | 'open'> & {
		asset: AssetPreviewItem | null;
		isOpen: boolean;
		onClose: () => void;
		actions?: readonly CapabilityResultAction[];
	}
>;

function canRenderLargeImage(asset: AssetPreviewItem): boolean {
	return Boolean(asset.previewUrl) && (asset.kind === 'image' || asset.kind === 'screenshot');
}

export function AssetModal({
	actions = [],
	asset,
	className,
	isOpen,
	onClose,
	style,
	...modalProps
}: AssetModalProps): ReactElement | null {
	const titleId = useId();

	if (!isOpen || !asset) {
		return null;
	}

	function handleOverlayMouseDown(event: MouseEvent<HTMLDivElement>): void {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	return (
		<div
			className={`runa-asset-modal-overlay ${styles['overlay']}`}
			onMouseDown={handleOverlayMouseDown}
		>
			<dialog
				{...modalProps}
				aria-labelledby={titleId}
				aria-modal="true"
				className={[
					['runa-asset-modal', className].filter(Boolean).join(' '),
					styles['dialog'],
				]
					.filter(Boolean)
					.join(' ')}
				open={true}
			>
				<div className={styles['header']}>
					<div className={styles['headerContent']}>
						<h2 id={titleId} className={styles['title']}>
							{asset.title}
						</h2>
						{asset.subtitle ? (
							<p className={styles['subtitle']}>
								{asset.subtitle}
							</p>
						) : null}
					</div>
					<RunaButton onClick={onClose} type="button" variant="ghost">
						Close
					</RunaButton>
				</div>
				<div className={styles['body']}>
					{canRenderLargeImage(asset) ? (
						<img
							alt={asset.alt ?? ''}
							src={asset.previewUrl}
							className={styles['previewImage']}
						/>
					) : (
						<div className={styles['previewPlaceholder']}>
							{asset.previewUrl
								? 'This asset can be opened from its source when wired to storage.'
								: 'Preview will appear here when an asset URL is available.'}
						</div>
					)}
				</div>
				<div className={styles['footer']}>
					<RunaBadge tone="neutral">{asset.kind}</RunaBadge>
					<CapabilityResultActions actions={actions} />
				</div>
			</dialog>
		</div>
	);
}
