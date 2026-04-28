import type { ReactElement } from 'react';

import styles from './RunaSpinner.module.css';
import { cx } from './ui-utils.js';

export type RunaSpinnerSize = 'lg' | 'md' | 'sm';

export type RunaSpinnerProps = Readonly<{
	label: string;
	className?: string;
	size?: RunaSpinnerSize;
}>;

export function RunaSpinner({ className, label, size = 'md' }: RunaSpinnerProps): ReactElement {
	return (
		<span
			aria-label={label}
			className={cx(styles['spinner'], styles[size], className)}
			role="status"
		/>
	);
}
