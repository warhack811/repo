import { type ReactElement, type ReactNode, useId } from 'react';

import styles from './RunaTooltip.module.css';
import { cx } from './ui-utils.js';

export type RunaTooltipProps = Readonly<{
	children: ReactNode;
	content: ReactNode;
	className?: string;
}>;

export function RunaTooltip({ children, className, content }: RunaTooltipProps): ReactElement {
	const tooltipId = useId();

	return (
		<span aria-describedby={tooltipId} className={cx(styles['wrap'], className)}>
			{children}
			<span className={styles['tooltip']} id={tooltipId} role="tooltip">
				{content}
			</span>
		</span>
	);
}
