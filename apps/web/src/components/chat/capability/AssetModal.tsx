import type { DialogHTMLAttributes, MouseEvent, ReactElement } from 'react';
import { useId } from 'react';
import { RunaBadge, RunaButton } from '../../ui/index.js';
import { CapabilityResultActions } from './CapabilityResultActions.js';
import type { AssetPreviewItem, CapabilityResultAction } from './types.js';

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
			className="runa-asset-modal-overlay runa-migrated-components-chat-capability-assetmodal-1"
			onMouseDown={handleOverlayMouseDown}
		>
			<dialog
				{...modalProps}
				aria-labelledby={titleId}
				aria-modal="true"
				className={[
					['runa-asset-modal', className].filter(Boolean).join(' '),
					'runa-migrated-components-chat-capability-assetmodal-2',
				]
					.filter(Boolean)
					.join(' ')}
				open={true}
			>
				<div className="runa-migrated-components-chat-capability-assetmodal-3">
					<div className="runa-migrated-components-chat-capability-assetmodal-4">
						<h2 id={titleId} className="runa-migrated-components-chat-capability-assetmodal-5">
							{asset.title}
						</h2>
						{asset.subtitle ? (
							<p className="runa-migrated-components-chat-capability-assetmodal-6">
								{asset.subtitle}
							</p>
						) : null}
					</div>
					<RunaButton onClick={onClose} type="button" variant="ghost">
						Close
					</RunaButton>
				</div>
				<div className="runa-migrated-components-chat-capability-assetmodal-7">
					{canRenderLargeImage(asset) ? (
						<img
							alt={asset.alt ?? ''}
							src={asset.previewUrl}
							className="runa-migrated-components-chat-capability-assetmodal-8"
						/>
					) : (
						<div className="runa-migrated-components-chat-capability-assetmodal-9">
							{asset.previewUrl
								? 'This asset can be opened from its source when wired to storage.'
								: 'Preview will appear here when an asset URL is available.'}
						</div>
					)}
				</div>
				<div className="runa-migrated-components-chat-capability-assetmodal-10">
					<RunaBadge tone="neutral">{asset.kind}</RunaBadge>
					<CapabilityResultActions actions={actions} />
				</div>
			</dialog>
		</div>
	);
}
