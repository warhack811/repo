import type { ReactElement } from 'react';

import type { ApprovalResolveDecision } from '../../../ws-types.js';
import { ApprovalActivityRow } from './ApprovalActivityRow.js';
import styles from './RunActivityFeed.module.css';
import { RunActivityRow } from './RunActivityRow.js';
import type { RunActivityRow as RunActivityRowModel } from './runActivityAdapter.js';

type RunActivityFeedProps = Readonly<{
	onResolveApproval?: (approvalId: string, decision: ApprovalResolveDecision) => void;
	rows: readonly RunActivityRowModel[];
}>;

export function RunActivityFeed({ onResolveApproval, rows }: RunActivityFeedProps): ReactElement {
	return (
		<ul className={styles['feed']} aria-label="Çalışma etkinlik akışı">
			{rows.map((row) =>
				row.kind === 'approval' ? (
					<ApprovalActivityRow key={row.id} onResolveApproval={onResolveApproval} row={row} />
				) : (
					<RunActivityRow key={row.id} row={row} />
				),
			)}
		</ul>
	);
}
