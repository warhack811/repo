import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from 'react';

import { designTokens } from '../../lib/design-tokens.js';

export type RunaCardTone = 'default' | 'hero' | 'strong' | 'subtle';

export type RunaCardProps = Readonly<
	HTMLAttributes<HTMLDivElement> & {
		children: ReactNode;
		tone?: RunaCardTone;
	}
>;

const baseCardStyle: CSSProperties = {
	backdropFilter: 'blur(12px)',
	border: `1px solid ${designTokens.color.border.subtle}`,
	borderRadius: designTokens.radius.card,
	boxShadow: designTokens.shadow.panel,
	display: 'grid',
	gap: designTokens.spacing.lg,
	minWidth: 0,
	overflow: 'hidden',
	padding: designTokens.spacing.panel,
	position: 'relative',
	transition: designTokens.motion.transition.surface,
};

const cardToneStyles: Record<RunaCardTone, CSSProperties> = {
	default: {
		background: designTokens.color.background.panel,
	},
	hero: {
		background:
			'radial-gradient(circle at top right, rgba(245, 158, 11, 0.16), transparent 28%), linear-gradient(180deg, rgba(20, 26, 40, 0.92) 0%, rgba(15, 23, 42, 0.82) 100%)',
		border: `1px solid ${designTokens.color.border.accent}`,
	},
	strong: {
		background: designTokens.color.background.panelStrong,
	},
	subtle: {
		background: designTokens.color.background.subtle,
		border: `1px solid ${designTokens.color.border.soft}`,
		borderRadius: designTokens.radius.soft,
		boxShadow: designTokens.shadow.panelSoft,
		padding: designTokens.spacing.subcard,
	},
};

export function RunaCard({
	children,
	className,
	style,
	tone = 'default',
	...cardProps
}: RunaCardProps): ReactElement {
	const mergedClassName = ['runa-ui-card', `runa-ui-card--${tone}`, className]
		.filter(Boolean)
		.join(' ');

	return (
		<div
			{...cardProps}
			className={mergedClassName}
			style={{ ...baseCardStyle, ...cardToneStyles[tone], ...style }}
		>
			{children}
		</div>
	);
}
