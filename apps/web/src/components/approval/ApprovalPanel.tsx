import type { CSSProperties, ReactElement } from 'react';
import { useState } from 'react';

import { uiCopy } from '../../localization/copy.js';
import type { ApprovalResolveDecision, RenderBlock } from '../../ws-types.js';
import { ApprovalSummaryCard } from './ApprovalSummaryCard.js';

type ApprovalBlock = Extract<RenderBlock, { type: 'approval_block' }>;

type ApprovalPanelProps = Readonly<{
	block: ApprovalBlock;
	onResolveApproval?: (approvalId: string, decision: ApprovalResolveDecision) => void;
}>;

const secondaryButtonStyle: CSSProperties = {
	padding: '12px 16px',
	borderRadius: '14px',
	border: '1px solid rgba(148, 163, 184, 0.28)',
	background: 'rgba(10, 16, 28, 0.84)',
	color: 'hsl(var(--color-text))',
	fontWeight: 600,
	cursor: 'pointer',
	display: 'inline-flex',
	alignItems: 'center',
	gap: '10px',
	transition:
		'transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease',
};

export function ApprovalPanel({ block, onResolveApproval }: ApprovalPanelProps): ReactElement {
	const [hoveredAction, setHoveredAction] = useState<ApprovalResolveDecision | null>(null);

	return (
		<ApprovalSummaryCard
			block={block}
			eyebrow={uiCopy.approval.pending}
			emphasis={block.payload.status === 'pending' ? uiCopy.approval.pendingEmphasis : undefined}
		>
			{block.payload.status === 'pending' && onResolveApproval ? (
				<div
					style={{
						display: 'flex',
						gap: '10px',
						flexWrap: 'wrap',
					}}
				>
					<button
						type="button"
						onClick={() => onResolveApproval(block.payload.approval_id, 'approved')}
						onMouseEnter={() => setHoveredAction('approved')}
						onMouseLeave={() => setHoveredAction(null)}
						aria-label={`Approve ${block.payload.title}`}
						style={{
							...secondaryButtonStyle,
							borderColor: 'rgba(34, 197, 94, 0.36)',
							color: '#86efac',
							background:
								hoveredAction === 'approved' ? 'rgba(10, 51, 33, 0.86)' : 'rgba(8, 20, 18, 0.82)',
							boxShadow:
								hoveredAction === 'approved' ? '0 16px 28px rgba(34, 197, 94, 0.12)' : 'none',
							transform: hoveredAction === 'approved' ? 'translateY(-1px)' : 'translateY(0)',
						}}
					>
						<span
							aria-hidden="true"
							style={{
								width: '20px',
								height: '20px',
								borderRadius: '999px',
								display: 'inline-flex',
								alignItems: 'center',
								justifyContent: 'center',
								background: 'rgba(34, 197, 94, 0.16)',
								fontSize: '12px',
							}}
						>
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
						style={{
							...secondaryButtonStyle,
							borderColor: 'rgba(248, 113, 113, 0.36)',
							color: '#fca5a5',
							background:
								hoveredAction === 'rejected' ? 'rgba(58, 17, 17, 0.84)' : 'rgba(25, 10, 12, 0.84)',
							boxShadow:
								hoveredAction === 'rejected' ? '0 16px 28px rgba(248, 113, 113, 0.12)' : 'none',
							transform: hoveredAction === 'rejected' ? 'translateY(-1px)' : 'translateY(0)',
						}}
					>
						<span
							aria-hidden="true"
							style={{
								width: '20px',
								height: '20px',
								borderRadius: '999px',
								display: 'inline-flex',
								alignItems: 'center',
								justifyContent: 'center',
								background: 'rgba(248, 113, 113, 0.16)',
								fontSize: '12px',
							}}
						>
							-
						</span>
						{uiCopy.approval.reject}
					</button>
				</div>
			) : null}
		</ApprovalSummaryCard>
	);
}
