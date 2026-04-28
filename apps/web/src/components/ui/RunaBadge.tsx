import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

import styles from './RunaBadge.module.css';
import { cx } from './ui-utils.js';

export type RunaBadgeTone = 'danger' | 'info' | 'neutral' | 'success' | 'warning';

export type RunaBadgeProps = Readonly<
	Omit<HTMLAttributes<HTMLSpanElement>, 'style'> & {
		children: ReactNode;
		tone?: RunaBadgeTone;
	}
>;

export function RunaBadge({
	children,
	className,
	tone = 'neutral',
	...badgeProps
}: RunaBadgeProps): ReactElement {
	const mergedClassName = cx('runa-ui-badge', styles['badge'], styles[tone], className);

	return (
		<span {...badgeProps} className={mergedClassName}>
			{children}
		</span>
	);
}
