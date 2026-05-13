import type { ReactElement } from 'react';

import styles from './PersistedTranscript.module.css';

type DayDividerProps = Readonly<{
	label: string;
}>;

export function DayDivider({ label }: DayDividerProps): ReactElement {
	return (
		<div className={styles['dayDivider']} role="presentation">
			<span>{label}</span>
		</div>
	);
}
