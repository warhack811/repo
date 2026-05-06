import { Check, Loader2, XCircle } from 'lucide-react';
import type { ReactElement } from 'react';

import styles from './ToolActivityIndicator.module.css';

export type ToolActivityItem = Readonly<{
	detail?: string;
	id: string;
	label: string;
	status: 'active' | 'completed' | 'failed';
}>;

type ToolActivityIndicatorProps = Readonly<{
	items: readonly ToolActivityItem[];
}>;

function getStatusIcon(status: ToolActivityItem['status']): ReactElement {
	switch (status) {
		case 'active':
			return (
				<Loader2
					aria-hidden="true"
					className="runa-tool-activity-icon runa-tool-activity-icon--spin"
					size={13}
				/>
			);
		case 'completed':
			return (
				<Check
					aria-hidden="true"
					className="runa-tool-activity-icon runa-tool-activity-icon--done"
					size={13}
				/>
			);
		case 'failed':
			return (
				<XCircle
					aria-hidden="true"
					className="runa-tool-activity-icon runa-tool-activity-icon--fail"
					size={13}
				/>
			);
	}
}

function getStatusLabel(status: ToolActivityItem['status']): string {
	switch (status) {
		case 'active':
			return 'Çalışıyor';
		case 'completed':
			return 'Tamamlandı';
		case 'failed':
			return 'Başarısız';
	}
}

export function ToolActivityIndicator({ items }: ToolActivityIndicatorProps): ReactElement | null {
	if (items.length === 0) {
		return null;
	}

	return (
		<div aria-label="Araç etkinliği" className={styles['container']}>
			{items.map((item) => (
				<div key={item.id} title={item.detail} className={styles['item']}>
					<span className={styles['statusLabel']}>
						{getStatusIcon(item.status)}
						<span>{getStatusLabel(item.status)}</span>
					</span>
					<span className={styles['toolLabel']}>{item.label}</span>
				</div>
			))}
		</div>
	);
}
