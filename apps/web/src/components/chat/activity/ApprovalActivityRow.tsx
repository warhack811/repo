import { ChevronRight } from 'lucide-react';
import { type ReactElement, useState } from 'react';

import type { ApprovalResolveDecision } from '../../../ws-types.js';
import { RunaButton } from '../../ui/RunaButton.js';
import styles from './RunActivityFeed.module.css';
import type { RunActivityRow } from './runActivityAdapter.js';

type ApprovalActivityRowProps = Readonly<{
	onResolveApproval?: (approvalId: string, decision: ApprovalResolveDecision) => void;
	row: Extract<RunActivityRow, { kind: 'approval' }>;
}>;

function getResolvedLabel(status: RunActivityRow['status']): string {
	switch (status) {
		case 'approved':
			return 'İzin verildi';
		case 'rejected':
			return 'Reddedildi';
		case 'expired':
			return 'Süresi doldu';
		case 'cancelled':
			return 'Vazgeçildi';
		default:
			return 'Onay bekliyor';
	}
}

export function ApprovalActivityRow({
	onResolveApproval,
	row,
}: ApprovalActivityRowProps): ReactElement {
	const [open, setOpen] = useState(false);
	const isPending = row.status === 'pending';
	const canResolve = isPending && row.canResolve && Boolean(onResolveApproval);
	const hasDetails =
		Boolean(row.detail) ||
		Boolean(row.summary) ||
		Boolean(row.targetLabel) ||
		Boolean(row.developerDetail);

	return (
		<li
			className={styles['row']}
			data-activity-kind="approval"
			data-activity-status={row.status}
			data-risk-level={row.riskLevel}
		>
			<div className={styles['rowLead']}>
				<span className={styles['rowDot']} aria-hidden />
			</div>
			<div className={styles['rowBody']}>
				<header className={styles['rowHeader']}>
					<strong className={styles['rowTitle']}>
						{isPending ? 'İzin gerekiyor' : getResolvedLabel(row.status)}
					</strong>
					{row.riskLabel ? <span className={styles['riskChip']}>{row.riskLabel}</span> : null}
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
				{row.targetLabel ? <code className={styles['targetChip']}>{row.targetLabel}</code> : null}
				{canResolve ? (
					<div className={styles['approvalActions']}>
						<RunaButton
							onClick={() => onResolveApproval?.(row.approvalId, 'rejected')}
							variant="secondary"
						>
							Reddet
						</RunaButton>
						<RunaButton
							onClick={() => onResolveApproval?.(row.approvalId, 'approved')}
							variant={row.riskLevel === 'high' ? 'danger' : 'primary'}
						>
							{row.riskLevel === 'high' ? 'Yine de devam et' : 'Onayla'}
						</RunaButton>
					</div>
				) : null}
				{open ? (
					<div className={styles['rowExpanded']}>
						{row.summary ? <p className={styles['rowDetail']}>{row.summary}</p> : null}
						{row.developerDetail ? (
							<pre className={styles['developerMeta']}>{row.developerDetail}</pre>
						) : null}
					</div>
				) : null}
			</div>
		</li>
	);
}
