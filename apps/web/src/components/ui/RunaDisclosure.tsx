import { type ReactElement, type ReactNode, useId, useState } from 'react';

import styles from './RunaDisclosure.module.css';
import { cx } from './ui-utils.js';

export type RunaDisclosureProps = Readonly<{
	children: ReactNode;
	title: ReactNode;
	className?: string;
	defaultOpen?: boolean;
}>;

export function RunaDisclosure({
	children,
	className,
	defaultOpen = false,
	title,
}: RunaDisclosureProps): ReactElement {
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const contentId = useId();

	return (
		<section className={cx(styles['disclosure'], className)}>
			<button
				aria-controls={contentId}
				aria-expanded={isOpen}
				className={styles['trigger']}
				onClick={() => setIsOpen((current) => !current)}
				type="button"
			>
				<span>{title}</span>
				<span aria-hidden="true">{isOpen ? 'Hide' : 'Show'}</span>
			</button>
			{isOpen ? (
				<div className={styles['content']} id={contentId}>
					{children}
				</div>
			) : null}
		</section>
	);
}
