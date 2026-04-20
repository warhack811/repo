import type { RuntimeEvent } from './events.js';
import type { ApprovalActionKind, ApprovalDecisionKind, ApprovalStatus } from './policy.js';
import type { RuntimeState } from './state.js';
import type { ToolErrorCode, ToolName } from './tools.js';

export type BlockSchemaVersion = 1;

export type RenderBlockType =
	| 'approval_block'
	| 'code_block'
	| 'diff_block'
	| 'event_list'
	| 'inspection_detail_block'
	| 'run_timeline_block'
	| 'search_result_block'
	| 'status'
	| 'text'
	| 'trace_debug_block'
	| 'tool_result'
	| 'web_search_result_block'
	| 'workspace_inspection_block';

export interface RenderBlockBase<TType extends RenderBlockType> {
	readonly id: string;
	readonly type: TType;
	readonly schema_version: BlockSchemaVersion;
	readonly created_at: string;
}

export interface TextBlockPayload {
	readonly text: string;
}

export interface StatusBlockPayload {
	readonly level: 'error' | 'info' | 'success' | 'warning';
	readonly message: string;
}

export interface EventListBlockPayload {
	readonly events: readonly RuntimeEvent[];
	readonly run_id: string;
	readonly trace_id: string;
}

export type CodeBlockDiffKind = 'after' | 'before' | 'unified';

export interface CodeBlockPayload {
	readonly content: string;
	readonly diff_kind?: CodeBlockDiffKind;
	readonly language: string;
	readonly path?: string;
	readonly summary?: string;
	readonly title?: string;
}

export interface DiffBlockPayload {
	readonly changed_paths?: readonly string[];
	readonly diff_text: string;
	readonly is_truncated?: boolean;
	readonly path?: string;
	readonly summary: string;
	readonly title?: string;
}

export interface SearchResultBlockMatch {
	readonly line_number: number;
	readonly line_text: string;
	readonly path: string;
}

export interface SearchResultBlockPayload {
	readonly conflict_note?: string;
	readonly is_truncated: boolean;
	readonly matches: readonly SearchResultBlockMatch[];
	readonly query: string;
	readonly searched_root: string;
	readonly source_priority_note?: string;
	readonly summary: string;
	readonly title: string;
	readonly total_matches?: number;
}

export type WebSearchTrustTier = 'general' | 'official' | 'reputable' | 'vendor';

export interface WebSearchResultBlockItem {
	readonly authority_note?: string;
	readonly freshness_hint?: string;
	readonly snippet: string;
	readonly source: string;
	readonly title: string;
	readonly trust_tier: WebSearchTrustTier;
	readonly url: string;
}

export interface WebSearchResultBlockPayload {
	readonly authority_note?: string;
	readonly conflict_note?: string;
	readonly freshness_note?: string;
	readonly is_truncated: boolean;
	readonly query: string;
	readonly results: readonly WebSearchResultBlockItem[];
	readonly search_provider: string;
	readonly source_priority_note?: string;
	readonly summary: string;
	readonly title: string;
}

export type InspectionTargetKind =
	| 'diff'
	| 'search_result'
	| 'timeline'
	| 'trace_debug'
	| 'workspace';

export type InspectionDetailLevel = 'expanded' | 'standard';

export interface InspectionDetailItem {
	readonly label: string;
	readonly value: string;
}

export interface InspectionDetailBlockPayload {
	readonly detail_items: readonly InspectionDetailItem[];
	readonly summary: string;
	readonly target_kind: InspectionTargetKind;
	readonly title: string;
}

export interface WorkspaceInspectionBlockPayload {
	readonly inspection_notes?: readonly string[];
	readonly last_search_summary?: string;
	readonly project_name?: string;
	readonly project_type_hints: readonly string[];
	readonly summary: string;
	readonly title: string;
	readonly top_level_signals: readonly string[];
}

export type RunTimelineBlockItemKind =
	| 'approval_requested'
	| 'approval_resolved'
	| 'assistant_completed'
	| 'model_completed'
	| 'model_thinking'
	| 'run_failed'
	| 'run_started'
	| 'tool_completed'
	| 'tool_failed'
	| 'tool_requested';

export interface RunTimelineBlockItem {
	readonly kind: RunTimelineBlockItemKind;
	readonly label: string;
	readonly call_id?: string;
	readonly detail?: string;
	readonly state?: string;
	readonly tool_name?: ToolName;
}

export interface RunTimelineBlockPayload {
	readonly items: readonly RunTimelineBlockItem[];
	readonly summary: string;
	readonly title: string;
}

export interface TraceDebugBlockPayload {
	readonly approval_summary?: string;
	readonly debug_notes?: readonly string[];
	readonly run_state: RuntimeState;
	readonly summary: string;
	readonly title: string;
	readonly tool_chain_summary?: string;
	readonly trace_label?: string;
	readonly warning_notes?: readonly string[];
}

export type ToolResultBlockStatus = 'error' | 'success';

export interface ToolResultBlockPreview {
	readonly kind: 'array' | 'boolean' | 'null' | 'number' | 'object' | 'string';
	readonly summary_text: string;
}

export interface ToolResultBlockPayload {
	readonly call_id: string;
	readonly error_code?: ToolErrorCode;
	readonly result_preview?: ToolResultBlockPreview;
	readonly status: ToolResultBlockStatus;
	readonly summary: string;
	readonly tool_name: ToolName;
}

export interface ApprovalBlockPayload {
	readonly action_kind: ApprovalActionKind;
	readonly approval_id: string;
	readonly status: ApprovalStatus;
	readonly summary: string;
	readonly title: string;
	readonly call_id?: string;
	readonly decision?: ApprovalDecisionKind;
	readonly note?: string;
	readonly tool_name?: ToolName;
}

export interface RenderBlockMap {
	readonly approval_block: ApprovalBlockPayload;
	readonly code_block: CodeBlockPayload;
	readonly diff_block: DiffBlockPayload;
	readonly inspection_detail_block: InspectionDetailBlockPayload;
	readonly text: TextBlockPayload;
	readonly status: StatusBlockPayload;
	readonly event_list: EventListBlockPayload;
	readonly run_timeline_block: RunTimelineBlockPayload;
	readonly search_result_block: SearchResultBlockPayload;
	readonly trace_debug_block: TraceDebugBlockPayload;
	readonly tool_result: ToolResultBlockPayload;
	readonly web_search_result_block: WebSearchResultBlockPayload;
	readonly workspace_inspection_block: WorkspaceInspectionBlockPayload;
}

export type RenderBlockPayload<TType extends RenderBlockType = RenderBlockType> =
	RenderBlockMap[TType];

export type RenderBlockOf<TType extends RenderBlockType> = RenderBlockBase<TType> & {
	readonly payload: RenderBlockPayload<TType>;
};

export type TextBlock = RenderBlockOf<'text'>;

export type StatusBlock = RenderBlockOf<'status'>;

export type EventListBlock = RenderBlockOf<'event_list'>;

export type CodeBlock = RenderBlockOf<'code_block'>;

export type DiffBlock = RenderBlockOf<'diff_block'>;

export type InspectionDetailBlock = RenderBlockOf<'inspection_detail_block'>;

export type RunTimelineBlock = RenderBlockOf<'run_timeline_block'>;

export type SearchResultBlock = RenderBlockOf<'search_result_block'>;

export type TraceDebugBlock = RenderBlockOf<'trace_debug_block'>;

export type ToolResultBlock = RenderBlockOf<'tool_result'>;

export type WebSearchResultBlock = RenderBlockOf<'web_search_result_block'>;

export type WorkspaceInspectionBlock = RenderBlockOf<'workspace_inspection_block'>;

export type ApprovalBlock = RenderBlockOf<'approval_block'>;

export type RenderBlock =
	| TextBlock
	| StatusBlock
	| EventListBlock
	| CodeBlock
	| DiffBlock
	| InspectionDetailBlock
	| RunTimelineBlock
	| SearchResultBlock
	| TraceDebugBlock
	| ToolResultBlock
	| WebSearchResultBlock
	| WorkspaceInspectionBlock
	| ApprovalBlock;
