import { createElement } from 'react';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

import styles from './RunaSurface.module.css';
import { cx } from './ui-utils.js';

export type RunaSurfaceDensity = 'compact' | 'comfortable';
export type RunaSurfaceElement = 'div' | 'header' | 'main' | 'section';
export type RunaSurfaceTone = 'hero' | 'page' | 'panel' | 'plain';

export type RunaSurfaceProps = Readonly<
	Omit<HTMLAttributes<HTMLElement>, 'style'> & {
		as?: RunaSurfaceElement;
		children: ReactNode;
		density?: RunaSurfaceDensity;
		tone?: RunaSurfaceTone;
	}
>;

export function RunaSurface({
	as = 'div',
	children,
	className,
	density = 'comfortable',
	tone = 'plain',
	...surfaceProps
}: RunaSurfaceProps): ReactElement {
	const mergedClassName = cx(
		'runa-ui-surface',
		styles['surface'],
		styles[density],
		styles[tone],
		className,
	);

	return createElement(as, { ...surfaceProps, className: mergedClassName }, children);
}
