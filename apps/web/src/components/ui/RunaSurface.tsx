import { createElement } from 'react';
import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from 'react';

import { designTokens } from '../../lib/design-tokens.js';

export type RunaSurfaceDensity = 'compact' | 'comfortable';
export type RunaSurfaceElement = 'div' | 'header' | 'main' | 'section';
export type RunaSurfaceTone = 'hero' | 'page' | 'panel' | 'plain';

export type RunaSurfaceProps = Readonly<
	HTMLAttributes<HTMLElement> & {
		as?: RunaSurfaceElement;
		children: ReactNode;
		density?: RunaSurfaceDensity;
		tone?: RunaSurfaceTone;
	}
>;

const surfaceToneStyles: Record<RunaSurfaceTone, CSSProperties> = {
	hero: {
		background:
			'radial-gradient(circle at top right, rgba(245, 158, 11, 0.16), transparent 28%), linear-gradient(180deg, rgba(20, 26, 40, 0.92) 0%, rgba(15, 23, 42, 0.82) 100%)',
		border: `1px solid ${designTokens.color.border.accent}`,
		borderRadius: designTokens.radius.card,
		boxShadow: designTokens.shadow.panel,
		padding: designTokens.spacing.panel,
	},
	page: {
		background: designTokens.color.background.page,
		color: designTokens.color.foreground.text,
		fontFamily: designTokens.typography.bodyFamily,
		minHeight: '100dvh',
		padding: `${designTokens.spacing.pageY} ${designTokens.spacing.pageX}`,
	},
	panel: {
		background: designTokens.color.background.panel,
		border: `1px solid ${designTokens.color.border.subtle}`,
		borderRadius: designTokens.radius.card,
		boxShadow: designTokens.shadow.panel,
		padding: designTokens.spacing.panel,
	},
	plain: {},
};

const densityStyles: Record<RunaSurfaceDensity, CSSProperties> = {
	comfortable: {
		gap: designTokens.spacing.shellGap,
	},
	compact: {
		gap: designTokens.spacing.xl,
	},
};

export function RunaSurface({
	as = 'div',
	children,
	className,
	density = 'comfortable',
	style,
	tone = 'plain',
	...surfaceProps
}: RunaSurfaceProps): ReactElement {
	const mergedClassName = ['runa-ui-surface', `runa-ui-surface--${tone}`, className]
		.filter(Boolean)
		.join(' ');
	const mergedStyle: CSSProperties = {
		display: 'grid',
		minWidth: 0,
		...densityStyles[density],
		...surfaceToneStyles[tone],
		...style,
	};

	return createElement(
		as,
		{
			...surfaceProps,
			className: mergedClassName,
			style: mergedStyle,
		},
		children,
	);
}
