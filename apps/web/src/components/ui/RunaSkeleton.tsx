import type { HTMLAttributes, ReactElement } from 'react';

import styles from './RunaSkeleton.module.css';
import { cx } from './ui-utils.js';

export type RunaSkeletonVariant = 'circle' | 'rect' | 'text';

export type RunaSkeletonProps = Readonly<
	Omit<HTMLAttributes<HTMLSpanElement>, 'style'> & {
		variant?: RunaSkeletonVariant;
	}
>;

export function RunaSkeleton({
	className,
	variant = 'text',
	...props
}: RunaSkeletonProps): ReactElement {
	return (
		<span
			{...props}
			aria-hidden={props['aria-hidden'] ?? true}
			className={cx(styles['skeleton'], styles[variant], className)}
		/>
	);
}
