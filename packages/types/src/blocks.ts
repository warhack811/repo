import type { RuntimeEvent } from './events.js';
import type {
	ApprovalActionKind,
	ApprovalDecisionKind,
	ApprovalStatus,
	ApprovalTargetKind,
} from './policy.js';
import type { RuntimeState } from './state.js';
import type { ToolErrorCode, ToolName } from './tools.js';

export type BlockSchemaVersion = 1;

export type RenderBlockType =
	| 'approval_block'
	| 'code_artifact'
	| 'code_block'
	| 'diff_block'
	| 'event_list'
	| 'file_download'
	| 'file_reference'
	| 'inspection_detail_block'
	| 'plan'
	| 'run_timeline_block'
	| 'search_result_block'
	| 'status'
	| 'table'
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

export interface CodeArtifactBlockPayload {
	readonly content: string;
	readonly is_truncated: boolean;
	readonly language: string;
	readonly line_count: number;
	readonly filename?: string;
}

export interface PlanBlockStep {
	readonly status: 'done' | 'pending' | 'skipped';
	readonly text: string;
}

export interface PlanBlockPayload {
	readonly steps: readonly PlanBlockStep[];
	readonly title: string;
}

export interface TableBlockPayload {
	readonly headers: readonly string[];
	readonly rows: readonly (readonly string[])[];
	readonly caption?: string;
}

export interface FileReferenceBlockPayload {
	readonly path: string;
	readonly line_end?: number;
	readonly line_start?: number;
	readonly snippet?: string;
}

export interface FileDownloadBlockPayload {
	readonly filename: string;
	readonly url: string;
	readonly expires_at?: string;
	readonly size_bytes?: number;
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
	readonly target_kind?: ApprovalTargetKind;
	readonly target_label?: string;
	readonly tool_name?: ToolName;
}

export interface RenderBlockMap {
	readonly approval_block: ApprovalBlockPayload;
	readonly code_artifact: CodeArtifactBlockPayload;
	readonly code_block: CodeBlockPayload;
	readonly diff_block: DiffBlockPayload;
	readonly file_download: FileDownloadBlockPayload;
	readonly file_reference: FileReferenceBlockPayload;
	readonly inspection_detail_block: InspectionDetailBlockPayload;
	readonly plan: PlanBlockPayload;
	readonly text: TextBlockPayload;
	readonly status: StatusBlockPayload;
	readonly table: TableBlockPayload;
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

export type CodeArtifactBlock = RenderBlockOf<'code_artifact'>;

export type DiffBlock = RenderBlockOf<'diff_block'>;

export type FileDownloadBlock = RenderBlockOf<'file_download'>;

export type FileReferenceBlock = RenderBlockOf<'file_reference'>;

export type InspectionDetailBlock = RenderBlockOf<'inspection_detail_block'>;

export type PlanBlock = RenderBlockOf<'plan'>;

export type RunTimelineBlock = RenderBlockOf<'run_timeline_block'>;

export type SearchResultBlock = RenderBlockOf<'search_result_block'>;

export type TableBlock = RenderBlockOf<'table'>;

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
	| CodeArtifactBlock
	| DiffBlock
	| FileDownloadBlock
	| FileReferenceBlock
	| InspectionDetailBlock
	| PlanBlock
	| RunTimelineBlock
	| SearchResultBlock
	| TableBlock
	| TraceDebugBlock
	| ToolResultBlock
	| WebSearchResultBlock
	| WorkspaceInspectionBlock
	| ApprovalBlock;
