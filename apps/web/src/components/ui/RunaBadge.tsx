import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from 'react';

import { designTokens } from '../../lib/design-tokens.js';

export type RunaBadgeTone = 'danger' | 'info' | 'neutral' | 'success' | 'warning';

export type RunaBadgeProps = Readonly<
	HTMLAttributes<HTMLSpanElement> & {
		children: ReactNode;
		tone?: RunaBadgeTone;
	}
>;

const baseBadgeStyle: CSSProperties = {
	alignItems: 'center',
	borderRadius: designTokens.radius.pill,
	display: 'inline-flex',
	fontSize: designTokens.typography.small.fontSize,
	fontWeight: 700,
	gap: designTokens.spacing.xs,
	letterSpacing: designTokens.typography.label.letterSpacing,
	lineHeight: 1.4,
	maxWidth: '100%',
	overflowWrap: 'anywhere',
	padding: '8px 12px',
	textTransform: 'uppercase',
};

const badgeToneStyles: Record<RunaBadgeTone, CSSProperties> = {
	danger: {
		background: designTokens.color.status.dangerBackground,
		border: `1px solid ${designTokens.color.border.danger}`,
		color: designTokens.color.foreground.danger,
	},
	info: {
		background: designTokens.color.status.infoBackground,
		border: `1px solid ${designTokens.color.border.info}`,
		color: designTokens.color.foreground.info,
	},
	neutral: {
		background: designTokens.color.status.neutralBackground,
		border: `1px solid ${designTokens.color.border.strong}`,
		color: designTokens.color.foreground.muted,
	},
	success: {
		background: designTokens.color.status.successBackground,
		border: `1px solid ${designTokens.color.border.success}`,
		color: designTokens.color.foreground.success,
	},
	warning: {
		background: designTokens.color.status.warningBackground,
		border: `1px solid ${designTokens.color.border.warning}`,
		color: designTokens.color.foreground.warning,
	},
};

export function RunaBadge({
	children,
	className,
	style,
	tone = 'neutral',
	...badgeProps
}: RunaBadgeProps): ReactElement {
	const mergedClassName = ['runa-ui-badge', `runa-ui-badge--${tone}`, className]
		.filter(Boolean)
		.join(' ');

	return (
		<span
			{...badgeProps}
			className={mergedClassName}
			style={{ ...baseBadgeStyle, ...badgeToneStyles[tone], ...style }}
		>
			{children}
		</span>
	);
}
