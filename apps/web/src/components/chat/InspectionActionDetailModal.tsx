import type { ReactElement } from 'react';

import type { InspectionTargetKind } from '../../ws-types.js';
import type { InspectionActionState } from './PresentationBlockRenderer.js';
import { ActionDetailModal } from './capability/index.js';
import type { ActionDetailItem, CapabilityTone } from './capability/index.js';

type InspectionActionDetailModalProps = Readonly<{
	actionState: InspectionActionState;
	anchorId: string | undefined;
	isOpen: boolean;
	onClose: () => void;
	runId: string;
	targetId: string | undefined;
	targetKind: InspectionTargetKind;
}>;

function formatTargetKindLabel(targetKind: InspectionTargetKind): string {
	switch (targetKind) {
		case 'workspace':
			return 'Workspace summary';
		case 'timeline':
			return 'Timeline summary';
		case 'trace_debug':
			return 'Trace / debug summary';
		case 'search_result':
			return 'Search summary';
		case 'diff':
			return 'Diff summary';
		default: {
			const exhaustiveTargetKind: never = targetKind;
			return exhaustiveTargetKind;
		}
	}
}

function getStatusDetail(actionState: InspectionActionState): Readonly<{
	tone: CapabilityTone;
	value: string;
}> {
	if (actionState.is_pending) {
		return {
			tone: 'warning',
			value: actionState.is_open
				? 'Detail request pending; existing detail card will refresh.'
				: 'Detail request pending; detail card is being prepared.',
		};
	}

	if (actionState.is_stale) {
		return {
			tone: 'warning',
			value: 'Existing detail may be stale; a refresh is available.',
		};
	}

	if (actionState.is_open) {
		return {
			tone: 'success',
			value: 'Detail card already exists in the visible run surface.',
		};
	}

	return {
		tone: 'neutral',
		value: 'Detail card has not been opened yet.',
	};
}

function createInspectionDetailItems(
	props: Pick<
		InspectionActionDetailModalProps,
		'actionState' | 'anchorId' | 'runId' | 'targetId' | 'targetKind'
	>,
): readonly ActionDetailItem[] {
	const statusDetail = getStatusDetail(props.actionState);

	return [
		{
			id: 'status',
			label: 'Status',
			tone: statusDetail.tone,
			value: statusDetail.value,
		},
		{
			id: 'run-id',
			label: 'Run id',
			value: props.runId,
		},
		{
			id: 'target-kind',
			label: 'Target kind',
			value: formatTargetKindLabel(props.targetKind),
		},
		{
			id: 'target-id',
			label: 'Target block id',
			value: props.targetId ?? 'Latest visible target',
		},
		{
			id: 'detail-block-id',
			label: 'Detail block id',
			value: props.actionState.detail_block_id ?? 'Not created yet',
		},
		{
			id: 'anchor-id',
			label: 'Anchor id',
			value: props.anchorId ?? 'Not linked yet',
		},
	];
}

export function InspectionActionDetailModal({
	actionState,
	anchorId,
	isOpen,
	onClose,
	runId,
	targetId,
	targetKind,
}: InspectionActionDetailModalProps): ReactElement | null {
	return (
		<ActionDetailModal
			description="Bu detay, Runa'nın görünür kartını nasıl ürettiğini anlamana yardımcı olur."
			details={createInspectionDetailItems({
				actionState,
				anchorId,
				runId,
				targetId,
				targetKind,
			})}
			isOpen={isOpen}
			onClose={onClose}
			riskLevel="low"
			title="Inspection detail"
		/>
	);
}
