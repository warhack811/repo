import { Check, X } from 'lucide-react';
import type { ReactElement } from 'react';

import { uiCopy } from '../../../localization/copy.js';
import type { ApprovalResolveDecision, RenderBlock } from '../../../ws-types.js';
import { RunaButton, RunaDisclosure } from '../../ui/index.js';
import { cx } from '../../ui/ui-utils.js';
import styles from './BlockRenderer.module.css';

type ApprovalRenderBlock = Extract<RenderBlock, { type: 'approval_block' }>;

type ApprovalBlockProps = Readonly<{
	block: ApprovalRenderBlock;
	onResolveApproval?: (approvalId: string, decision: ApprovalResolveDecision) => void;
}>;

function formatActionKind(actionKind: ApprovalRenderBlock['payload']['action_kind']): string {
	switch (actionKind) {
		case 'file_write':
			return 'Dosya yazma';
		case 'shell_execution':
			return 'Kabuk komutu';
		case 'tool_execution':
			return 'Arac calistirma';
	}
}

function formatStatusLabel(status: ApprovalRenderBlock['payload']['status']): string {
	switch (status) {
		case 'approved':
			return uiCopy.approval.approved;
		case 'cancelled':
			return uiCopy.approval.cancelled;
		case 'expired':
			return uiCopy.approval.expired;
		case 'pending':
			return uiCopy.approval.pending;
		case 'rejected':
			return uiCopy.approval.rejected;
	}
}

export function ApprovalBlock({ block, onResolveApproval }: ApprovalBlockProps): ReactElement {
	const isPending = block.payload.status === 'pending';
	const createdAtLabel = new Date(block.created_at).toLocaleString('tr-TR');

	return (
		<article
			aria-busy={isPending}
			className={cx(
				styles['block'],
				styles['blockWarning'],
				isPending ? styles['approvalPending'] : undefined,
			)}
		>
			<div className={styles['header']}>
				<div className={styles['headerStack']}>
					<span className={styles['eyebrow']}>
						{isPending ? uiCopy.approval.pending : 'Onay karari'}
					</span>
					<strong className={styles['title']}>{block.payload.title}</strong>
				</div>
				<span className={styles['chip']}>{formatStatusLabel(block.payload.status)}</span>
			</div>
			<p className={styles['summary']}>{block.payload.summary}</p>
			{block.payload.target_label ? (
				<div className={styles['metaBox']}>
					<span className={styles['metaLabel']}>Hedef</span>
					<span>{block.payload.target_label}</span>
				</div>
			) : null}
			{isPending && onResolveApproval ? (
				<div className={styles['approvalActions']}>
					<RunaButton
						aria-label={`Approve ${block.payload.title}`}
						onClick={() => onResolveApproval(block.payload.approval_id, 'approved')}
						variant="primary"
					>
						<Check size={18} />
						{uiCopy.approval.approve}
					</RunaButton>
					<RunaButton
						aria-label={`Reject ${block.payload.title}`}
						onClick={() => onResolveApproval(block.payload.approval_id, 'rejected')}
						variant="secondary"
					>
						<X size={18} />
						{uiCopy.approval.reject}
					</RunaButton>
				</div>
			) : (
				<p className={styles['muted']}>
					{createdAtLabel} tarihinde{' '}
					{formatStatusLabel(block.payload.status).toLocaleLowerCase('tr-TR')}.
				</p>
			)}
			<RunaDisclosure title={uiCopy.approval.details}>
				<div className={styles['metaGrid']}>
					<div className={styles['metaBox']}>
						<span className={styles['metaLabel']}>{uiCopy.approval.action}</span>
						<span>{formatActionKind(block.payload.action_kind)}</span>
					</div>
					{block.payload.tool_name ? (
						<div className={styles['metaBox']}>
							<span className={styles['metaLabel']}>{uiCopy.approval.tool}</span>
							<code>{block.payload.tool_name}</code>
						</div>
					) : null}
					{block.payload.call_id ? (
						<div className={styles['metaBox']}>
							<span className={styles['metaLabel']}>{uiCopy.approval.callId}</span>
							<code>{block.payload.call_id}</code>
						</div>
					) : null}
					{block.payload.note ? (
						<div className={styles['metaBox']}>
							<span className={styles['metaLabel']}>{uiCopy.approval.note}</span>
							<span>{block.payload.note}</span>
						</div>
					) : null}
				</div>
			</RunaDisclosure>
		</article>
	);
}
