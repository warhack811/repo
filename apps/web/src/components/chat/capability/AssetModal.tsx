import type { CSSProperties, DialogHTMLAttributes, MouseEvent, ReactElement } from 'react';
import { useId } from 'react';

import { designTokens } from '../../../lib/design-tokens.js';
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

const overlayStyle: CSSProperties = {
	alignItems: 'center',
	background: 'rgba(2, 6, 23, 0.74)',
	display: 'flex',
	inset: 0,
	justifyContent: 'center',
	padding: 'clamp(16px, 4vw, 32px)',
	position: 'fixed',
	zIndex: designTokens.zIndex.modal,
};

const dialogStyle: CSSProperties = {
	background: designTokens.color.background.panelStrong,
	border: `1px solid ${designTokens.color.border.strong}`,
	borderRadius: designTokens.radius.card,
	boxShadow: designTokens.shadow.panel,
	display: 'grid',
	gap: designTokens.spacing.lg,
	margin: 0,
	maxHeight: 'min(86vh, 820px)',
	maxWidth: 'min(920px, 100%)',
	minWidth: 'min(720px, 100%)',
	overflow: 'auto',
	padding: designTokens.spacing.panel,
};

const headerStyle: CSSProperties = {
	alignItems: 'flex-start',
	display: 'flex',
	gap: designTokens.spacing.md,
	justifyContent: 'space-between',
	minWidth: 0,
};

const titleStackStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.xs,
	minWidth: 0,
};

const titleStyle: CSSProperties = {
	color: designTokens.color.foreground.strong,
	fontSize: '18px',
	lineHeight: 1.35,
	margin: 0,
};

const subtitleStyle: CSSProperties = {
	color: designTokens.color.foreground.muted,
	fontSize: designTokens.typography.small.fontSize,
	lineHeight: designTokens.typography.small.lineHeight,
	margin: 0,
};

const previewFrameStyle: CSSProperties = {
	alignItems: 'center',
	aspectRatio: '16 / 10',
	background: 'rgba(3, 7, 18, 0.72)',
	border: `1px solid ${designTokens.color.border.soft}`,
	borderRadius: designTokens.radius.image,
	display: 'flex',
	justifyContent: 'center',
	minHeight: 'min(54vh, 360px)',
	overflow: 'hidden',
};

const imageStyle: CSSProperties = {
	display: 'block',
	height: '100%',
	objectFit: 'contain',
	width: '100%',
};

const placeholderStyle: CSSProperties = {
	color: designTokens.color.foreground.soft,
	fontSize: designTokens.typography.text.fontSize,
	lineHeight: designTokens.typography.text.lineHeight,
	padding: designTokens.spacing.xxl,
	textAlign: 'center',
};

const footerStyle: CSSProperties = {
	alignItems: 'center',
	display: 'flex',
	flexWrap: 'wrap',
	gap: designTokens.spacing.md,
	justifyContent: 'space-between',
};

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
			className="runa-asset-modal-overlay"
			onMouseDown={handleOverlayMouseDown}
			style={overlayStyle}
		>
			<dialog
				{...modalProps}
				aria-labelledby={titleId}
				aria-modal="true"
				className={['runa-asset-modal', className].filter(Boolean).join(' ')}
				open={true}
				style={{ ...dialogStyle, ...style }}
			>
				<div style={headerStyle}>
					<div style={titleStackStyle}>
						<h2 id={titleId} style={titleStyle}>
							{asset.title}
						</h2>
						{asset.subtitle ? <p style={subtitleStyle}>{asset.subtitle}</p> : null}
					</div>
					<RunaButton onClick={onClose} type="button" variant="ghost">
						Close
					</RunaButton>
				</div>
				<div style={previewFrameStyle}>
					{canRenderLargeImage(asset) ? (
						<img alt={asset.alt ?? ''} src={asset.previewUrl} style={imageStyle} />
					) : (
						<div style={placeholderStyle}>
							{asset.previewUrl
								? 'This asset can be opened from its source when wired to storage.'
								: 'Preview will appear here when an asset URL is available.'}
						</div>
					)}
				</div>
				<div style={footerStyle}>
					<RunaBadge tone="neutral">{asset.kind}</RunaBadge>
					<CapabilityResultActions actions={actions} />
				</div>
			</dialog>
		</div>
	);
}
