import type { ReactElement } from 'react';

import type { PresentationRunSurface, RunTransportSummary } from '../../lib/chat-runtime/types.js';
import {
	inspectionChipListStyle,
	inspectionChipStyle,
	presentationRunBodyStyle,
	presentationRunGroupStyle,
	presentationRunHeaderStyle,
	presentationRunSummaryStyle,
	secondaryLabelStyle,
} from '../../lib/chat-styles.js';
import type { ApprovalResolveDecision, InspectionTargetKind, RenderBlock } from '../../ws-types.js';
import { createStatusChipStyle } from './PresentationBlockRenderer.js';
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
		<div style={presentationRunBodyStyle}>
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
			<div style={inspectionChipListStyle}>
				{surfaceStatusChip ? (
					<code style={createStatusChipStyle(surfaceStatusChip.tone)}>
						{surfaceStatusChip.label}
					</code>
				) : null}
				{surfacePendingDetailCount > 0 ? (
					<code style={inspectionChipStyle}>
						{createPendingDetailLabel(surfacePendingDetailCount)}
					</code>
				) : null}
				{surfaceMeta && isDeveloperMode ? (
					<>
						<code style={inspectionChipStyle}>
							{createInspectionCountLabel(
								surfaceMeta.summary_count,
								'summary card',
								'summary cards',
							)}
						</code>
						<code style={inspectionChipStyle}>
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
				style={{
					...presentationRunGroupStyle,
					transition:
						'opacity 220ms ease, transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease',
				}}
			>
				<div style={presentationRunHeaderStyle}>
					<div style={{ display: 'grid', gap: '8px', maxWidth: 'min(720px, 100%)' }}>
						<div style={{ ...secondaryLabelStyle, color: '#93c5fd' }}>mevcut calisma</div>
						<div
							style={{
								display: 'flex',
								gap: '8px',
								alignItems: 'center',
								flexWrap: 'wrap',
							}}
						>
							<strong style={{ fontSize: '16px', color: 'hsl(var(--color-text))' }}>
								Canli calisma yuzeyi
							</strong>
							<code style={inspectionChipStyle}>ana akis</code>
						</div>
						<div style={{ color: 'hsl(var(--color-text-muted))', lineHeight: 1.6 }}>
							Runa'nin gorunur sonucu ve gereken onaylar sohbetten kopmadan burada kalir.
						</div>
						{visibleCorrelationLabel ? (
							<code style={inspectionChipStyle}>{visibleCorrelationLabel}</code>
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
			style={{
				...presentationRunGroupStyle,
				transition:
					'opacity 220ms ease, transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease',
			}}
		>
			<summary style={presentationRunSummaryStyle}>
				<div style={presentationRunHeaderStyle}>
					<div style={{ display: 'grid', gap: '8px', maxWidth: 'min(720px, 100%)' }}>
						<div style={secondaryLabelStyle}>gecmis calisma</div>
						<div
							style={{
								display: 'flex',
								gap: '8px',
								alignItems: 'center',
								flexWrap: 'wrap',
							}}
						>
							<strong style={{ fontSize: '15px', color: 'hsl(var(--color-text))' }}>
								Onceki calisma ozeti
							</strong>
							{visibleCorrelationLabel ? (
								<code style={inspectionChipStyle}>{visibleCorrelationLabel}</code>
							) : null}
						</div>
						<div style={{ color: 'hsl(var(--color-text-soft))', lineHeight: 1.6 }}>
							Canli akis onde kalir. Eski ozetleri incelemek istediginde buradan acabilirsin.
						</div>
					</div>
					{metaChips}
				</div>
			</summary>
			{blockList}
		</details>
	);
}
