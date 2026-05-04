import type { ReactElement } from 'react';

import type {
	RunStatusChipItem,
	RunStatusChipTone,
} from '../../lib/chat-runtime/current-run-progress.js';
import styles from './RunStatusChips.module.css';

type RunStatusChipsProps = Readonly<{
	ariaLabel?: string;
	items: readonly RunStatusChipItem[];
}>;

function getChipPalette(tone: RunStatusChipTone): Readonly<{
	readonly background: string;
	readonly borderColor: string;
	readonly labelColor: string;
	readonly valueColor: string;
}> {
	switch (tone) {
		case 'success':
			return {
				background: 'rgba(9, 34, 25, 0.66)',
				borderColor: 'rgba(34, 197, 94, 0.28)',
				labelColor: '#86efac',
				valueColor: '#dcfce7',
			};
		case 'warning':
			return {
				background: 'rgba(56, 37, 7, 0.62)',
				borderColor: 'rgba(250, 204, 21, 0.28)',
				labelColor: '#fde68a',
				valueColor: '#fef3c7',
			};
		case 'error':
			return {
				background: 'rgba(58, 17, 17, 0.62)',
				borderColor: 'rgba(248, 113, 113, 0.28)',
				labelColor: '#fca5a5',
				valueColor: '#fee2e2',
			};
		case 'info':
			return {
				background: 'rgba(8, 23, 45, 0.66)',
				borderColor: 'rgba(96, 165, 250, 0.28)',
				labelColor: '#93c5fd',
				valueColor: '#eff6ff',
			};
		default:
			return {
				background: 'rgba(15, 23, 42, 0.62)',
				borderColor: 'rgba(148, 163, 184, 0.2)',
				labelColor: '#94a3b8',
				valueColor: '#e2e8f0',
			};
	}
}

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
				const palette = getChipPalette(item.tone);

				return (
					<li
						key={`${item.label}:${item.value}`}
						className={styles['chip']}
					>
						<span className={styles['label']}>{item.label}</span>
						<span className={styles['value']}>{item.value}</span>
					</li>
				);
			})}
		</ul>
	);
}
