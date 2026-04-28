import type { ReactElement } from 'react';
import { useState } from 'react';

import { uiCopy } from '../../localization/copy.js';
import type { ApprovalResolveDecision, RenderBlock } from '../../ws-types.js';
import { ApprovalSummaryCard } from './ApprovalSummaryCard.js';

type ApprovalBlock = Extract<RenderBlock, { type: 'approval_block' }>;

type ApprovalPanelProps = Readonly<{
	block: ApprovalBlock;
	onResolveApproval?: (approvalId: string, decision: ApprovalResolveDecision) => void;
}>;

export function ApprovalPanel({ block, onResolveApproval }: ApprovalPanelProps): ReactElement {
	const [hoveredAction, setHoveredAction] = useState<ApprovalResolveDecision | null>(null);

	return (
		<ApprovalSummaryCard
			block={block}
			eyebrow={uiCopy.approval.pending}
			emphasis={block.payload.status === 'pending' ? uiCopy.approval.pendingEmphasis : undefined}
		>
			{block.payload.status === 'pending' && onResolveApproval ? (
				<div className="runa-migrated-components-approval-approvalpanel-1">
					<button
						type="button"
						onClick={() => onResolveApproval(block.payload.approval_id, 'approved')}
						onMouseEnter={() => setHoveredAction('approved')}
						onMouseLeave={() => setHoveredAction(null)}
						aria-label={`Approve ${block.payload.title}`}
						className="runa-migrated-components-approval-approvalpanel-2"
					>
						<span aria-hidden="true" className="runa-migrated-components-approval-approvalpanel-3">
							+
						</span>
						{uiCopy.approval.approve}
					</button>
					<button
						type="button"
						onClick={() => onResolveApproval(block.payload.approval_id, 'rejected')}
						onMouseEnter={() => setHoveredAction('rejected')}
						onMouseLeave={() => setHoveredAction(null)}
						aria-label={`Reject ${block.payload.title}`}
						className="runa-migrated-components-approval-approvalpanel-4"
					>
						<span aria-hidden="true" className="runa-migrated-components-approval-approvalpanel-5">
							-
						</span>
						{uiCopy.approval.reject}
					</button>
				</div>
			) : null}
		</ApprovalSummaryCard>
	);
}
