import type { ReactElement } from 'react';

import type { InspectionTargetKind, RenderBlock } from '../../../ws-types.js';
import styles from './BlockRenderer.module.css';
import type { GetInspectionActionState, InspectionSummaryRenderBlock } from './block-types.js';

export function shortenCorrelationIdentifier(value: string): string {
	const normalizedValue = value.trim().replace(/\s+/gu, ' ');
	return normalizedValue.length <= 20
		? normalizedValue
		: `${normalizedValue.slice(0, 8)}...${normalizedValue.slice(-6)}`;
}

export function buildInspectionCorrelationLabel(
	runId: string | null | undefined,
	traceId: string | null | undefined,
): string | null {
	const normalizedRunId = runId?.trim();

	if (!normalizedRunId) {
		return null;
	}

	const runLabel = `run ${shortenCorrelationIdentifier(normalizedRunId)}`;
	const normalizedTraceId = traceId?.trim();

	return normalizedTraceId
		? `${runLabel} / trace ${shortenCorrelationIdentifier(normalizedTraceId)}`
		: runLabel;
}

export function getPresentationBlockDomId(blockId: string): string {
	return `presentation-block:${encodeURIComponent(blockId)}`;
}

export function getPresentationBlockSummaryDomId(blockId: string): string {
	return `presentation-block-summary:${encodeURIComponent(blockId)}`;
}

export function getPresentationBlockTitleDomId(blockId: string): string {
	return `presentation-block-title:${encodeURIComponent(blockId)}`;
}

export function getInspectionRelationDomId(blockId: string): string {
	return `inspection-relation:${encodeURIComponent(blockId)}`;
}

function getInspectionActionNoteDomId(blockId: string): string {
	return `inspection-action-note:${encodeURIComponent(blockId)}`;
}

export function formatInspectionTargetLabel(targetKind: InspectionTargetKind): string {
	switch (targetKind) {
		case 'workspace':
			return 'workspace';
		case 'timeline':
			return 'timeline';
		case 'trace_debug':
			return 'trace / debug';
		case 'search_result':
			return 'search result';
		case 'diff':
			return 'diff';
	}
}

export function getInspectionSummaryLabel(targetKind: InspectionTargetKind): string {
	switch (targetKind) {
		case 'workspace':
			return 'workspace summary';
		case 'timeline':
			return 'timeline summary';
		case 'trace_debug':
			return 'trace / debug summary';
		case 'search_result':
			return 'search summary';
		case 'diff':
			return 'diff summary';
	}
}

export function isInspectionSummaryBlock(
	block: RenderBlock,
): block is InspectionSummaryRenderBlock {
	return (
		block.type === 'diff_block' ||
		block.type === 'run_timeline_block' ||
		block.type === 'search_result_block' ||
		block.type === 'trace_debug_block' ||
		block.type === 'workspace_inspection_block'
	);
}

export function getInspectionTargetKindForSummaryBlock(
	block: InspectionSummaryRenderBlock,
): InspectionTargetKind {
	switch (block.type) {
		case 'workspace_inspection_block':
			return 'workspace';
		case 'run_timeline_block':
			return 'timeline';
		case 'search_result_block':
			return 'search_result';
		case 'trace_debug_block':
			return 'trace_debug';
		case 'diff_block':
			return 'diff';
	}
}

export function getInspectionSummaryTitle(block: InspectionSummaryRenderBlock): string {
	switch (block.type) {
		case 'workspace_inspection_block':
		case 'run_timeline_block':
		case 'search_result_block':
		case 'trace_debug_block':
			return block.payload.title;
		case 'diff_block':
			return block.payload.title ?? block.payload.path ?? 'Git Diff';
	}
}

export function summarizeEventListBlock(
	block: Extract<RenderBlock, { type: 'event_list' }>,
): string {
	const eventTypes = [...new Set(block.payload.events.map((event) => event.event_type))];
	return `${block.payload.events.length} runtime events${
		eventTypes.length > 0 ? ` (${eventTypes.join(', ')})` : ''
	}`;
}

function getInspectionActionSubjectLabel(
	block: RenderBlock,
	targetKind: InspectionTargetKind,
): string {
	return isInspectionSummaryBlock(block)
		? getInspectionSummaryTitle(block)
		: formatInspectionTargetLabel(targetKind);
}

export function renderInspectionCorrelationContext(
	correlationLabel: string | null,
): ReactElement | null {
	if (!correlationLabel) {
		return null;
	}

	return (
		<div
			className={styles['correlation']}
			aria-label={`Run and trace correlation: ${correlationLabel}`}
		>
			<span>correlation</span>
			<code>{correlationLabel}</code>
		</div>
	);
}

export function renderInspectionAction(
	block: RenderBlock,
	targetKind: InspectionTargetKind,
	onRequestInspection?: (targetKind: InspectionTargetKind, targetId?: string) => void,
	getInspectionActionState?: GetInspectionActionState,
): ReactElement | null {
	if (!onRequestInspection) {
		return null;
	}

	const actionState = getInspectionActionState?.(targetKind, block.id);
	const isPending = actionState?.is_pending ?? false;
	const actionNoteId = actionState?.note ? getInspectionActionNoteDomId(block.id) : undefined;
	const subjectLabel = getInspectionActionSubjectLabel(block, targetKind);

	return (
		<div className={styles['inspectionAction']}>
			<button
				aria-busy={isPending}
				aria-controls={
					actionState?.detail_block_id
						? getPresentationBlockDomId(actionState.detail_block_id)
						: undefined
				}
				aria-describedby={actionNoteId}
				aria-expanded={actionState?.is_open ?? false}
				aria-label={`${actionState?.label ?? 'Open detail'} for ${subjectLabel}`}
				className={styles['smallButton']}
				disabled={isPending}
				onClick={() => onRequestInspection(targetKind, block.id)}
				title={actionState?.title}
				type="button"
			>
				{actionState?.label ?? 'Open detail'}
			</button>
			{actionState?.note ? (
				<span className={styles['muted']} id={actionNoteId}>
					{actionState.note}
				</span>
			) : null}
		</div>
	);
}
