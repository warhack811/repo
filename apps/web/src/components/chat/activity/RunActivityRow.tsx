import { ChevronRight } from 'lucide-react';
import { type ReactElement, useState } from 'react';

import styles from './RunActivityFeed.module.css';
import { TerminalDetails } from './TerminalDetails.js';
import type { RunActivityRow as RunActivityRowModel } from './runActivityAdapter.js';

type RunActivityRowProps = Readonly<{
	row: Extract<RunActivityRowModel, { kind: 'timeline' | 'tool' }>;
}>;

function getStatusLabel(status: RunActivityRowModel['status']): string {
	switch (status) {
		case 'running':
			return 'Sürüyor';
		case 'success':
			return 'Tamamlandı';
		case 'error':
			return 'Hata';
		case 'warning':
			return 'Dikkat';
		case 'pending':
			return 'Bekliyor';
		case 'approved':
			return 'Onaylandı';
		case 'rejected':
			return 'Reddedildi';
		case 'expired':
			return 'Süresi doldu';
		case 'cancelled':
			return 'Vazgeçildi';
	}
}

export function RunActivityRow({ row }: RunActivityRowProps): ReactElement {
	const [open, setOpen] = useState(false);
	const hasDetails = row.kind === 'tool' || Boolean(row.developerDetail);

	return (
		<li className={styles['row']} data-activity-kind={row.kind} data-activity-status={row.status}>
			<div className={styles['rowLead']}>
				<span className={styles['rowDot']} aria-hidden />
			</div>
			<div className={styles['rowBody']}>
				<header className={styles['rowHeader']}>
					<strong className={styles['rowTitle']}>{row.title}</strong>
					<span className={styles['rowStatus']}>{getStatusLabel(row.status)}</span>
					{hasDetails ? (
						<button
							aria-expanded={open}
							aria-label={open ? 'Ayrıntıları gizle' : 'Ayrıntıları göster'}
							className={styles['rowToggle']}
							onClick={() => setOpen((value) => !value)}
							type="button"
						>
							Ayrıntılar
							<ChevronRight className={styles['rowToggleIcon']} size={14} />
						</button>
					) : null}
				</header>
				{row.detail ? <p className={styles['rowDetail']}>{row.detail}</p> : null}
				{open ? (
					<div className={styles['rowExpanded']}>
						{row.kind === 'tool' ? <TerminalDetails row={row} /> : null}
						{row.developerDetail ? (
							<pre className={styles['developerMeta']}>{row.developerDetail}</pre>
						) : null}
					</div>
				) : null}
			</div>
		</li>
	);
}
