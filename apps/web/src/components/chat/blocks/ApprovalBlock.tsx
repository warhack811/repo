import type { ReactElement } from 'react';

import type { ApprovalResolveDecision, RenderBlock } from '../../../ws-types.js';
import { RunActivityFeed } from '../activity/RunActivityFeed.js';
import { adaptApprovalBlock } from '../activity/runActivityAdapter.js';

type ApprovalRenderBlock = Extract<RenderBlock, { type: 'approval_block' }>;

type ApprovalBlockProps = Readonly<{
	block: ApprovalRenderBlock;
	isDeveloperMode?: boolean;
	onResolveApproval?: (approvalId: string, decision: ApprovalResolveDecision) => void;
}>;

export function ApprovalBlock({
	block,
	isDeveloperMode = false,
	onResolveApproval,
}: ApprovalBlockProps): ReactElement {
	const row = adaptApprovalBlock(
		block,
		isDeveloperMode,
		block.payload.status === 'pending' && Boolean(onResolveApproval),
	);

	return <RunActivityFeed onResolveApproval={onResolveApproval} rows={[row]} />;
}
