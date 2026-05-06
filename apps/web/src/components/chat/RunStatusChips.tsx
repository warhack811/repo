import type { ReactElement } from 'react';

import type { RunStatusChipItem } from '../../lib/chat-runtime/current-run-progress.js';
import styles from './RunStatusChips.module.css';

type RunStatusChipsProps = Readonly<{
	ariaLabel?: string;
	items: readonly RunStatusChipItem[];
}>;

export function RunStatusChips({
	ariaLabel = 'Run status chips',
	items,
}: RunStatusChipsProps): ReactElement | null {
	if (items.length === 0) {
		return null;
	}

	return (
		<ul aria-label={ariaLabel} className={styles['list']}>
			{items.map((item) => {
				return (
					<li key={`${item.label}:${item.value}`} className={styles['chip']} data-tone={item.tone}>
						<span className={styles['label']}>{item.label}</span>
						<span className={styles['value']}>{item.value}</span>
					</li>
				);
			})}
		</ul>
	);
}
