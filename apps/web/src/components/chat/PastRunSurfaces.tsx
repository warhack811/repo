import type { ReactElement } from 'react';

import type { PresentationRunSurface, RunTransportSummary } from '../../lib/chat-runtime/types.js';
import type { ApprovalResolveDecision, InspectionTargetKind, RenderBlock } from '../../ws-types.js';
import type { InspectionActionState } from './PresentationBlockRenderer.js';
import { PresentationRunSurfaceCard } from './PresentationRunSurfaceCard.js';

type PastRunSurfacesProps = Readonly<{
	expandedPastRunIds: readonly string[];
	inspectionAnchorIdsByDetailId: ReadonlyMap<string, string | undefined>;
	onRequestInspection: (runId: string, targetKind: InspectionTargetKind, targetId?: string) => void;
	onResolveApproval: (approvalId: string, decision: ApprovalResolveDecision) => void;
	onToggleExpanded: (runId: string, nextOpen: boolean) => void;
	pastPresentationSurfaces: readonly PresentationRunSurface[];
	pendingInspectionRequestKeys: readonly string[];
	runTransportSummaries: ReadonlyMap<string, RunTransportSummary>;
	getInspectionActionState: (
		runId: string,
		runBlocks: readonly RenderBlock[],
		targetKind: InspectionTargetKind,
		targetId?: string,
	) => InspectionActionState;
}>;

export function PastRunSurfaces({
	expandedPastRunIds,
	inspectionAnchorIdsByDetailId,
	onRequestInspection,
	onResolveApproval,
	onToggleExpanded,
	pastPresentationSurfaces,
	pendingInspectionRequestKeys,
	runTransportSummaries,
	getInspectionActionState,
}: PastRunSurfacesProps): ReactElement {
	return (
		<>
			{pastPresentationSurfaces.map((surface) => (
				<PresentationRunSurfaceCard
					key={surface.run_id}
					expanded={expandedPastRunIds.includes(surface.run_id)}
					inspectionAnchorIdsByDetailId={inspectionAnchorIdsByDetailId}
					isCurrent={false}
					onRequestInspection={onRequestInspection}
					onResolveApproval={onResolveApproval}
					onToggleExpanded={onToggleExpanded}
					pendingInspectionRequestKeys={pendingInspectionRequestKeys}
					runTransportSummaries={runTransportSummaries}
					surface={surface}
					getInspectionActionState={getInspectionActionState}
				/>
			))}
		</>
	);
}
