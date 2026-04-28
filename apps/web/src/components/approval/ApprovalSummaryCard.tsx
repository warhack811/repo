import type { ReactElement, ReactNode } from 'react';

import { uiCopy } from '../../localization/copy.js';
import type { RenderBlock } from '../../ws-types.js';

type ApprovalBlock = Extract<RenderBlock, { type: 'approval_block' }>;

export type ApprovalSummaryCardProps = Readonly<{
	block: ApprovalBlock;
	children?: ReactNode;
	emphasis?: string;
	eyebrow?: string;
}>;

function getApprovalAccent(status: ApprovalBlock['payload']['status']): {
	readonly borderColor: string;
	readonly chipBackground: string;
	readonly chipColor: string;
	readonly emphasisBackground: string;
	readonly emphasisColor: string;
} {
	switch (status) {
		case 'approved':
			return {
				borderColor: 'rgba(34, 197, 94, 0.36)',
				chipBackground: 'rgba(20, 83, 45, 0.45)',
				chipColor: '#86efac',
				emphasisBackground: 'rgba(8, 34, 23, 0.72)',
				emphasisColor: '#dcfce7',
			};
		case 'rejected':
			return {
				borderColor: 'rgba(248, 113, 113, 0.36)',
				chipBackground: 'rgba(127, 29, 29, 0.42)',
				chipColor: '#fca5a5',
				emphasisBackground: 'rgba(58, 17, 17, 0.72)',
				emphasisColor: '#fee2e2',
			};
		case 'cancelled':
		case 'expired':
			return {
				borderColor: 'rgba(148, 163, 184, 0.28)',
				chipBackground: 'rgba(51, 65, 85, 0.38)',
				chipColor: '#cbd5e1',
				emphasisBackground: 'rgba(15, 23, 42, 0.68)',
				emphasisColor: '#e2e8f0',
			};
		default:
			return {
				borderColor: 'rgba(245, 158, 11, 0.38)',
				chipBackground: 'rgba(120, 53, 15, 0.44)',
				chipColor: '#fcd34d',
				emphasisBackground: 'rgba(56, 37, 7, 0.72)',
				emphasisColor: '#fef3c7',
			};
	}
}

function formatActionKind(actionKind: ApprovalBlock['payload']['action_kind']): string {
	switch (actionKind) {
		case 'file_write':
			return 'Dosya yazma';
		case 'shell_execution':
			return 'Kabuk komutu';
		case 'tool_execution':
			return 'Araç çalıştırma';
	}
}

function formatStatusLabel(status: ApprovalBlock['payload']['status']): string {
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

function getDefaultEmphasis(block: ApprovalBlock): string {
	switch (block.payload.status) {
		case 'approved':
			return 'Karar kaydedildi ve çalışma kabul edilen yol üzerinden devam edebilir.';
		case 'rejected':
			return 'Karar kaydedildi ve bu yol reddedildiği için çalışma buradan devam edemez.';
		case 'cancelled':
			return 'Bu onay artık aktif değil.';
		case 'expired':
			return 'Bu onayın süresi doldu.';
		default:
			return uiCopy.approval.pendingEmphasis;
	}
}

export function ApprovalSummaryCard({
	block,
	children,
	emphasis,
	eyebrow = uiCopy.approval.pending,
}: ApprovalSummaryCardProps): ReactElement {
	const accent = getApprovalAccent(block.payload.status);

	return (
		<article className="runa-migrated-components-approval-approvalsummarycard-1">
			<div className="runa-migrated-components-approval-approvalsummarycard-2">
				<div className="runa-migrated-components-approval-approvalsummarycard-3">
					<span lang="tr" className="runa-migrated-components-approval-approvalsummarycard-4">
						{eyebrow}
					</span>
					<strong className="runa-migrated-components-approval-approvalsummarycard-5">
						{block.payload.title}
					</strong>
				</div>
				<span className="runa-migrated-components-approval-approvalsummarycard-6" lang="tr">
					{formatStatusLabel(block.payload.status)}
				</span>
			</div>

			<div className="runa-migrated-components-approval-approvalsummarycard-7">
				{block.payload.summary}
			</div>

			{block.payload.target_label ? (
				<div className="runa-migrated-components-approval-approvalsummarycard-8">
					<div lang="tr" className="runa-migrated-components-approval-approvalsummarycard-9">
						Hedef cihaz
					</div>
					<div className="runa-migrated-components-approval-approvalsummarycard-10">
						{block.payload.target_label}
					</div>
				</div>
			) : null}

			<div className="runa-migrated-components-approval-approvalsummarycard-11">
				{emphasis ?? getDefaultEmphasis(block)}
			</div>

			<details className="runa-migrated-components-approval-approvalsummarycard-12">
				<summary className="runa-migrated-components-approval-approvalsummarycard-13">
					{uiCopy.approval.details}
				</summary>
				<div className="runa-migrated-components-approval-approvalsummarycard-14">
					<div>
						<div lang="tr" className="runa-migrated-components-approval-approvalsummarycard-15">
							{uiCopy.approval.action}
						</div>
						<div className="runa-migrated-components-approval-approvalsummarycard-16">
							{formatActionKind(block.payload.action_kind)}
						</div>
					</div>
					{block.payload.tool_name ? (
						<div>
							<div lang="tr" className="runa-migrated-components-approval-approvalsummarycard-17">
								{uiCopy.approval.tool}
							</div>
							<code className="runa-migrated-components-approval-approvalsummarycard-18">
								{block.payload.tool_name}
							</code>
						</div>
					) : null}
					{block.payload.call_id ? (
						<div>
							<div className="runa-migrated-components-approval-approvalsummarycard-19">
								{uiCopy.approval.callId}
							</div>
							<code className="runa-migrated-components-approval-approvalsummarycard-20">
								{block.payload.call_id}
							</code>
						</div>
					) : null}
					{block.payload.note ? (
						<div>
							<div lang="tr" className="runa-migrated-components-approval-approvalsummarycard-21">
								{uiCopy.approval.note}
							</div>
							<div className="runa-migrated-components-approval-approvalsummarycard-22">
								{block.payload.note}
							</div>
						</div>
					) : null}
				</div>
			</details>

			{children}
		</article>
	);
}
