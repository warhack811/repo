import type { ReactElement } from 'react';

import type {
	ApprovalResolveDecision,
	InspectionTargetKind,
	RenderBlock,
} from '../../../ws-types.js';
import { BlockRenderer } from '../blocks/BlockRenderer.js';
import { InspectionDetailBlock } from '../blocks/InspectionDetailBlock.js';
import type { GetInspectionActionState } from '../blocks/block-types.js';
import type { InspectionDetailRelation } from './types.js';

export function renderPresentationBlock(
	block: RenderBlock,
	onResolveApproval?: (approvalId: string, decision: ApprovalResolveDecision) => void,
	onRequestInspection?: (targetKind: InspectionTargetKind, targetId?: string) => void,
	getInspectionActionState?: GetInspectionActionState,
	inspectionDetailRelations?: ReadonlyMap<string, InspectionDetailRelation>,
	presentationCorrelationLabel?: string | null,
	isDeveloperMode = false,
	replayMode = false,
): ReactElement | null {
	return (
		<BlockRenderer
			key={block.id}
			block={block}
			getInspectionActionState={getInspectionActionState}
			isDeveloperMode={isDeveloperMode}
			onRequestInspection={onRequestInspection}
			onResolveApproval={onResolveApproval}
			presentationCorrelationLabel={presentationCorrelationLabel}
			replayMode={replayMode}
			renderInspectionDetailBlock={(detailBlock) => (
				<InspectionDetailBlock
					block={detailBlock}
					relation={inspectionDetailRelations?.get(detailBlock.id)}
				/>
			)}
		/>
	);
}
