import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from 'react';

import { designTokens } from '../../../lib/design-tokens.js';
import { RunaBadge, RunaCard } from '../../ui/index.js';
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

const previewFrameStyle: CSSProperties = {
	alignItems: 'center',
	aspectRatio: '16 / 10',
	background: 'rgba(3, 7, 18, 0.62)',
	border: `1px solid ${designTokens.color.border.soft}`,
	borderRadius: designTokens.radius.image,
	display: 'flex',
	justifyContent: 'center',
	minHeight: '140px',
	overflow: 'hidden',
};

const imageStyle: CSSProperties = {
	display: 'block',
	height: '100%',
	objectFit: 'cover',
	width: '100%',
};

const placeholderStyle: CSSProperties = {
	color: designTokens.color.foreground.soft,
	fontSize: designTokens.typography.small.fontSize,
	padding: designTokens.spacing.lg,
	textAlign: 'center',
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
	fontSize: '15px',
	fontWeight: 700,
	lineHeight: 1.4,
};

const subtitleStyle: CSSProperties = {
	color: designTokens.color.foreground.muted,
	fontSize: designTokens.typography.small.fontSize,
	lineHeight: designTokens.typography.small.lineHeight,
};

const metaStyle: CSSProperties = {
	color: designTokens.color.foreground.soft,
	fontSize: designTokens.typography.small.fontSize,
	lineHeight: designTokens.typography.small.lineHeight,
};

const selectedStyle: CSSProperties = {
	borderColor: designTokens.color.border.accent,
	boxShadow: designTokens.shadow.glow,
};

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
			className={['runa-asset-preview-card', className].filter(Boolean).join(' ')}
			style={{ ...(isSelected ? selectedStyle : undefined), ...style }}
			tone="subtle"
		>
			<div style={previewFrameStyle}>
				{shouldRenderImage(kind, previewUrl) ? (
					<img alt={alt ?? ''} src={previewUrl} style={imageStyle} />
				) : (
					<div style={placeholderStyle}>
						{previewUrl ? 'Preview is available for this asset.' : 'Preview will appear here.'}
					</div>
				)}
			</div>
			<div style={headerStyle}>
				<div style={titleStackStyle}>
					<div style={titleStyle}>{title}</div>
					{subtitle ? <div style={subtitleStyle}>{subtitle}</div> : null}
				</div>
				<RunaBadge tone="neutral">{formatKindLabel(kind)}</RunaBadge>
			</div>
			{metaSlot ? <div style={metaStyle}>{metaSlot}</div> : null}
			{actionSlot}
			{children}
		</RunaCard>
	);
}
