import type { InspectionTargetKind, RenderBlock } from '../../../ws-types.js';

export interface InspectionActionState {
	readonly detail_block_id?: string;
	readonly is_pending: boolean;
	readonly is_open: boolean;
	readonly is_stale: boolean;
	readonly label: string;
	readonly note?: string;
	readonly title: string;
}

export type GetInspectionActionState = (
	targetKind: InspectionTargetKind,
	targetId?: string,
) => InspectionActionState;

export type InspectionSummaryRenderBlock = Extract<
	RenderBlock,
	{
		type:
			| 'diff_block'
			| 'run_timeline_block'
			| 'search_result_block'
			| 'trace_debug_block'
			| 'workspace_inspection_block';
	}
>;

export type BlockComponentProps<TBlock extends RenderBlock> = Readonly<{
	block: TBlock;
	getInspectionActionState?: GetInspectionActionState;
	onRequestInspection?: (targetKind: InspectionTargetKind, targetId?: string) => void;
	presentationCorrelationLabel?: string | null;
}>;
