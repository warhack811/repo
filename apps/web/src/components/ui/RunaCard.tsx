import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

import styles from './RunaCard.module.css';
import { cx } from './ui-utils.js';

export type RunaCardTone = 'default' | 'hero' | 'strong' | 'subtle';

export type RunaCardProps = Readonly<
	Omit<HTMLAttributes<HTMLDivElement>, 'style'> & {
		children: ReactNode;
		tone?: RunaCardTone;
	}
>;

export function RunaCard({
	children,
	className,
	tone = 'default',
	...cardProps
}: RunaCardProps): ReactElement {
	const mergedClassName = cx('runa-ui-card', styles['card'], styles[tone], className);

	return (
		<div {...cardProps} className={mergedClassName}>
			{children}
		</div>
	);
}
