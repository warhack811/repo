import type { ReactElement, ReactNode } from 'react';

import { ActionRiskBadge } from './ActionRiskBadge.js';
import { CapabilityCard } from './CapabilityCard.js';
import { CapabilityResultActions } from './CapabilityResultActions.js';
import type { ActionRiskLevel, CapabilityResultAction } from './types.js';

export type ApprovalDecisionCardProps = Readonly<{
	children?: ReactNode;
	description?: ReactNode;
	disabled?: boolean;
	isApproving?: boolean;
	isRejecting?: boolean;
	onApprove: () => void;
	onReject: () => void;
	riskLevel?: ActionRiskLevel;
	title: ReactNode;
}>;

export function ApprovalDecisionCard({
	children,
	description,
	disabled = false,
	isApproving = false,
	isRejecting = false,
	onApprove,
	onReject,
	riskLevel = 'medium',
	title,
}: ApprovalDecisionCardProps): ReactElement {
	const actions: readonly CapabilityResultAction[] = [
		{
			disabled: disabled || isRejecting || isApproving,
			id: 'reject',
			label: isRejecting ? 'Rejecting...' : 'Reject',
			onClick: onReject,
			tone: 'secondary',
		},
		{
			disabled: disabled || isApproving || isRejecting,
			id: 'approve',
			label: isApproving ? 'Approving...' : 'Approve',
			onClick: onApprove,
			tone: 'primary',
		},
	];

	return (
		<CapabilityCard
			description={description}
			eyebrow="Approval"
			headerAside={<ActionRiskBadge riskLevel={riskLevel} />}
			title={title}
			tone={riskLevel === 'high' ? 'warning' : 'neutral'}
		>
			{children}
			<CapabilityResultActions actions={actions} />
		</CapabilityCard>
	);
}
