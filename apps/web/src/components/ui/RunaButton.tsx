import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

import styles from './RunaButton.module.css';
import { cx } from './ui-utils.js';

export type RunaButtonVariant = 'danger' | 'ghost' | 'primary' | 'secondary';

export type RunaButtonProps = Readonly<
	Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> & {
		children: ReactNode;
		variant?: RunaButtonVariant;
	}
>;

export function RunaButton({
	children,
	className,
	disabled,
	type = 'button',
	variant = 'secondary',
	...buttonProps
}: RunaButtonProps): ReactElement {
	const mergedClassName = cx('runa-ui-button', styles['button'], styles[variant], className);

	return (
		<button {...buttonProps} className={mergedClassName} disabled={disabled} type={type}>
			{children}
		</button>
	);
}
