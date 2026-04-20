import type {
	GatewayProvider,
	InspectionDetailLevel,
	RenderBlock,
	RunFinishedServerMessage,
	RuntimeEventServerMessage,
} from '../../ws-types.js';

export type RuntimeEventType = RuntimeEventServerMessage['payload']['event']['event_type'];

export type RunFeedbackTone = 'error' | 'info' | 'success' | 'warning';

export type InspectionDetailRenderBlock = Extract<RenderBlock, { type: 'inspection_detail_block' }>;

export interface PresentationRunSurface {
	readonly blocks: readonly RenderBlock[];
	readonly run_id: string;
	readonly trace_id: string;
}

export interface RunTransportSummary {
	readonly final_state?: RunFinishedServerMessage['payload']['final_state'];
	readonly has_accepted: boolean;
	readonly has_presentation_blocks: boolean;
	readonly has_runtime_event: boolean;
	readonly latest_runtime_state?: string;
	readonly last_runtime_event_type?: RuntimeEventType;
	readonly provider?: GatewayProvider;
	readonly run_id: string;
	readonly trace_id?: string;
}

export interface RunFeedbackState {
	readonly chip_label: string;
	readonly detail: string;
	readonly pending_detail_count: number;
	readonly run_id: string;
	readonly title: string;
	readonly tone: RunFeedbackTone;
	readonly trace_id?: string;
}

export interface PresentationBlockGroups {
	readonly detailBlocks: readonly InspectionDetailRenderBlock[];
	readonly nonDetailBlocks: readonly RenderBlock[];
}

export const DEFAULT_INSPECTION_DETAIL_LEVEL: InspectionDetailLevel = 'standard';
export const MAX_VISIBLE_PRESENTATION_RUNS = 6;
