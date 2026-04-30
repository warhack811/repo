import type { ReactElement } from 'react';

import type { PresentationRunSurface, RunTransportSummary } from '../../lib/chat-runtime/types.js';
import type { ApprovalResolveDecision, InspectionTargetKind, RenderBlock } from '../../ws-types.js';
import type {
	GetInspectionActionState,
	InspectionActionState,
} from './PresentationBlockRenderer.js';
import {
	buildInspectionCorrelationLabel,
	buildInspectionDetailRelations,
	buildInspectionSurfaceMeta,
	countInspectionRequestsForRun,
	createInspectionCountLabel,
	createPendingDetailLabel,
	getRunSurfaceStatusChip,
	renderPresentationBlock,
} from './chat-presentation.js';

type PresentationRunSurfaceCardProps = Readonly<{
	expanded: boolean;
	inspectionAnchorIdsByDetailId: ReadonlyMap<string, string | undefined>;
	isCurrent: boolean;
	isDeveloperMode?: boolean;
	onRequestInspection: (runId: string, targetKind: InspectionTargetKind, targetId?: string) => void;
	onResolveApproval?: (approvalId: string, decision: ApprovalResolveDecision) => void;
	onToggleExpanded?: (runId: string, nextOpen: boolean) => void;
	pendingInspectionRequestKeys: readonly string[];
	runTransportSummaries: ReadonlyMap<string, RunTransportSummary>;
	surface: PresentationRunSurface;
	getInspectionActionState: (
		runId: string,
		runBlocks: readonly RenderBlock[],
		targetKind: InspectionTargetKind,
		targetId?: string,
	) => InspectionActionState;
}>;

export function PresentationRunSurfaceCard({
	expanded,
	inspectionAnchorIdsByDetailId,
	isCurrent,
	isDeveloperMode = false,
	onRequestInspection,
	onResolveApproval,
	onToggleExpanded,
	pendingInspectionRequestKeys,
	runTransportSummaries,
	surface,
	getInspectionActionState,
}: PresentationRunSurfaceCardProps): ReactElement {
	const surfaceMeta = buildInspectionSurfaceMeta(surface.blocks);
	const surfaceCorrelationLabel = buildInspectionCorrelationLabel(surface.run_id, surface.trace_id);
	const visibleCorrelationLabel = isDeveloperMode ? surfaceCorrelationLabel : null;
	const surfaceRunSummary = runTransportSummaries.get(surface.run_id);
	const surfacePendingDetailCount = countInspectionRequestsForRun(
		pendingInspectionRequestKeys,
		surface.run_id,
	);
	const surfaceStatusChip = getRunSurfaceStatusChip(surfaceRunSummary);
	const inspectionDetailRelations = buildInspectionDetailRelations(
		surface.blocks,
		inspectionAnchorIdsByDetailId,
	);
	const getInspectionActionStateForRun: GetInspectionActionState = (targetKind, targetId) =>
		getInspectionActionState(surface.run_id, surface.blocks, targetKind, targetId);
	const blockList = (
		<div className="runa-migrated-components-chat-presentationrunsurfacecard-1">
			{surface.blocks.map((block) =>
				renderPresentationBlock(
					block,
					onResolveApproval,
					(targetKind, targetId) => onRequestInspection(surface.run_id, targetKind, targetId),
					getInspectionActionStateForRun,
					inspectionDetailRelations,
					surfaceCorrelationLabel,
					isDeveloperMode,
				),
			)}
		</div>
	);

	const metaChips =
		surfaceMeta || surfaceStatusChip || surfacePendingDetailCount > 0 ? (
			<div className="runa-migrated-components-chat-presentationrunsurfacecard-2">
				{surfaceStatusChip ? (
					<code className="runa-migrated-components-chat-presentationrunsurfacecard-3">
						{surfaceStatusChip.label}
					</code>
				) : null}
				{surfacePendingDetailCount > 0 ? (
					<code className="runa-migrated-components-chat-presentationrunsurfacecard-4">
						{createPendingDetailLabel(surfacePendingDetailCount)}
					</code>
				) : null}
				{surfaceMeta && isDeveloperMode ? (
					<>
						<code className="runa-migrated-components-chat-presentationrunsurfacecard-5">
							{createInspectionCountLabel(
								surfaceMeta.summary_count,
								'summary card',
								'summary cards',
							)}
						</code>
						<code className="runa-migrated-components-chat-presentationrunsurfacecard-6">
							{createInspectionCountLabel(surfaceMeta.detail_count, 'detail card', 'detail cards')}
						</code>
					</>
				) : null}
			</div>
		) : null;

	if (isCurrent) {
		return (
			<div
				key={surface.run_id}
				className="runa-migrated-components-chat-presentationrunsurfacecard-7"
			>
				<div className="runa-migrated-components-chat-presentationrunsurfacecard-8">
					<div className="runa-migrated-components-chat-presentationrunsurfacecard-9">
						<div className="runa-migrated-components-chat-presentationrunsurfacecard-10">
							mevcut çalışma
						</div>
						<div className="runa-migrated-components-chat-presentationrunsurfacecard-11">
							<strong className="runa-migrated-components-chat-presentationrunsurfacecard-12">
								Canlı çalışma
							</strong>
							<code className="runa-migrated-components-chat-presentationrunsurfacecard-13">
								ana akış
							</code>
						</div>
						<div className="runa-migrated-components-chat-presentationrunsurfacecard-14">
							Sonuçlar ve gereken onaylar sohbetten kopmadan ilerler.
						</div>
						{visibleCorrelationLabel ? (
							<code className="runa-migrated-components-chat-presentationrunsurfacecard-15">
								{visibleCorrelationLabel}
							</code>
						) : null}
					</div>
					{metaChips}
				</div>
				{blockList}
			</div>
		);
	}

	return (
		<details
			key={surface.run_id}
			open={expanded}
			onToggle={(event) => onToggleExpanded?.(surface.run_id, event.currentTarget.open)}
			className="runa-migrated-components-chat-presentationrunsurfacecard-16"
		>
			<summary className="runa-migrated-components-chat-presentationrunsurfacecard-17">
				<div className="runa-migrated-components-chat-presentationrunsurfacecard-18">
					<div className="runa-migrated-components-chat-presentationrunsurfacecard-19">
						<div className="runa-migrated-components-chat-presentationrunsurfacecard-20">
							geçmiş çalışma
						</div>
						<div className="runa-migrated-components-chat-presentationrunsurfacecard-21">
							<strong className="runa-migrated-components-chat-presentationrunsurfacecard-22">
								Önceki çalışma özeti
							</strong>
							{visibleCorrelationLabel ? (
								<code className="runa-migrated-components-chat-presentationrunsurfacecard-23">
									{visibleCorrelationLabel}
								</code>
							) : null}
						</div>
						<div className="runa-migrated-components-chat-presentationrunsurfacecard-24">
							Canlı akış önde kalır. Eski özetleri gerektiğinde açabilirsin.
						</div>
					</div>
					{metaChips}
				</div>
			</summary>
			{blockList}
		</details>
	);
}
