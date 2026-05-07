import type { ReactElement } from 'react';

import type { PresentationRunSurface, RunTransportSummary } from '../../lib/chat-runtime/types.js';
import type { ApprovalResolveDecision, InspectionTargetKind, RenderBlock } from '../../ws-types.js';
import type {
	GetInspectionActionState,
	InspectionActionState,
} from './PresentationBlockRenderer.js';
import styles from './PresentationRunSurfaceCard.module.css';
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
		<div className={styles['blockList']}>
			{surface.blocks.map((block) =>
				renderPresentationBlock(
					block,
					onResolveApproval,
					(targetKind, targetId) => onRequestInspection(surface.run_id, targetKind, targetId),
					getInspectionActionStateForRun,
					inspectionDetailRelations,
					surfaceCorrelationLabel,
					isDeveloperMode,
					surface.replayMode === true,
				),
			)}
		</div>
	);

	const metaChips =
		surfaceMeta || surfaceStatusChip || surfacePendingDetailCount > 0 ? (
			<div className={styles['metaChips']}>
				{surfaceStatusChip ? (
					<code className={styles['statusChip']}>{surfaceStatusChip.label}</code>
				) : null}
				{surfacePendingDetailCount > 0 ? (
					<code className={styles['pendingChip']}>
						{createPendingDetailLabel(surfacePendingDetailCount)}
					</code>
				) : null}
				{surfaceMeta && isDeveloperMode ? (
					<>
						<code className={styles['summaryChip']}>
							{createInspectionCountLabel(
								surfaceMeta.summary_count,
								'summary card',
								'summary cards',
							)}
						</code>
						<code className={styles['detailChip']}>
							{createInspectionCountLabel(surfaceMeta.detail_count, 'detail card', 'detail cards')}
						</code>
					</>
				) : null}
			</div>
		) : null;

	if (isCurrent) {
		if (!isDeveloperMode) {
			return (
				<div
					key={surface.run_id}
					className={`runa-presentation-run-surface runa-presentation-run-surface--current ${styles['card']}`}
				>
					{blockList}
				</div>
			);
		}

		return (
			<div key={surface.run_id} className={styles['card']}>
				<div className={styles['summary']}>
					<div className={styles['summaryContent']}>
						<div className={styles['eyebrow']}>mevcut çalışma</div>
						<div className={styles['row']}>
							<strong className={styles['title']}>Canlı çalışma</strong>
							<code className={styles['correlationChip']}>ana akış</code>
						</div>
						<div className={styles['description']}>
							Sonuçlar ve gereken onaylar sohbetten kopmadan ilerler.
						</div>
						{visibleCorrelationLabel ? (
							<code className={styles['correlationChip']}>{visibleCorrelationLabel}</code>
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
			className={styles['pastCard']}
		>
			<summary className={styles['summary']}>
				<div className={styles['summaryContent']}>
					<div className={styles['pastCardContent']}>
						<div className={styles['pastEyebrow']}>geçmiş çalışma</div>
						<div className={styles['pastRow']}>
							<strong className={styles['pastTitle']}>Önceki çalışma özeti</strong>
							{visibleCorrelationLabel ? (
								<code className={styles['pastCorrelationChip']}>{visibleCorrelationLabel}</code>
							) : null}
						</div>
						<div className={styles['pastDescription']}>
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
