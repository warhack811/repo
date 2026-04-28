import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

import styles from './RunaIcon.module.css';
import { cx } from './ui-utils.js';

export type RunaIconProps = Readonly<{
	icon: LucideIcon;
	'aria-label'?: string;
	className?: string;
	size?: number;
}>;

export function RunaIcon({
	'aria-label': ariaLabel,
	className,
	icon: Icon,
	size = 18,
}: RunaIconProps): ReactElement {
	return (
		<Icon
			aria-hidden={ariaLabel ? undefined : true}
			aria-label={ariaLabel}
			className={cx(styles['icon'], className)}
			size={size}
		/>
	);
}
