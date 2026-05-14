import type { InputHTMLAttributes, ReactElement, ReactNode } from 'react';

import styles from './RunaInput.module.css';
import { cx } from './ui-utils.js';

export type RunaInputSize = 'lg' | 'md' | 'sm';

export type RunaInputProps = Readonly<
	Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'style'> & {
		error?: string;
		helperText?: string;
		label?: string;
		leftIcon?: ReactNode;
		rightIcon?: ReactNode;
		size?: RunaInputSize;
	}
>;

export function RunaInput({
	className,
	error,
	helperText,
	id,
	label,
	leftIcon,
	rightIcon,
	size = 'md',
	...inputProps
}: RunaInputProps): ReactElement {
	const helperId = id ? `${id}-helper` : undefined;
	const helperCopy = error ?? helperText;

	return (
		<label className={cx(styles['field'], className)}>
			{label ? <span className={styles['label']}>{label}</span> : null}
			<span className={cx(styles['control'], styles[size], error ? styles['error'] : undefined)}>
				{leftIcon ? <span className={styles['icon']}>{leftIcon}</span> : null}
				<input
					{...inputProps}
					aria-describedby={helperCopy ? helperId : undefined}
					aria-invalid={error ? true : undefined}
					className={styles['input']}
					id={id}
				/>
				{rightIcon ? <span className={styles['icon']}>{rightIcon}</span> : null}
			</span>
			{helperCopy ? (
				<span
					className={cx(styles['helper'], error ? styles['helperError'] : undefined)}
					id={helperId}
				>
					{helperCopy}
				</span>
			) : null}
		</label>
	);
}
