import type { ReactElement } from 'react';

import type {
	ApprovalResolveDecision,
	InspectionTargetKind,
	RenderBlock,
} from '../../../ws-types.js';
import {
	ApprovalBlock,
	CodeBlock,
	DiffBlock,
	EventListBlock,
	FileDownloadBlock,
	FileReferenceBlock,
	InspectionDetailBlock,
	PlanBlock,
	RunTimelineBlock,
	SearchResultBlock,
	StatusBlock,
	TableBlock,
	TextBlock,
	ToolResultBlock,
	TraceDebugBlock,
	WebSearchResultBlock,
	WorkspaceInspectionBlock,
} from './index.js';
import type { GetInspectionActionState } from './index.js';

type InspectionDetailRenderBlock = Extract<RenderBlock, { type: 'inspection_detail_block' }>;

export type BlockRendererProps = Readonly<{
	block: RenderBlock;
	isDeveloperMode?: boolean;
	onRequestInspection?: (targetKind: InspectionTargetKind, targetId?: string) => void;
	onResolveApproval?: (approvalId: string, decision: ApprovalResolveDecision) => void;
	presentationCorrelationLabel?: string | null;
	getInspectionActionState?: GetInspectionActionState;
	renderInspectionDetailBlock?: (block: InspectionDetailRenderBlock) => ReactElement;
}>;

function renderImpossibleBlock(block: never): ReactElement {
	return (
		<article>
			<strong>Unsupported block</strong>
			<code>{String(block)}</code>
		</article>
	);
}

export function BlockRenderer({
	block,
	getInspectionActionState,
	isDeveloperMode = false,
	onRequestInspection,
	onResolveApproval,
	presentationCorrelationLabel,
	renderInspectionDetailBlock,
}: BlockRendererProps): ReactElement | null {
	switch (block.type) {
		case 'text':
			return <TextBlock block={block} />;
		case 'status':
			return <StatusBlock block={block} />;
		case 'event_list':
			return isDeveloperMode ? <EventListBlock block={block} /> : null;
		case 'code_block':
		case 'code_artifact':
			return <CodeBlock block={block} />;
		case 'diff_block':
			return (
				<DiffBlock
					block={block}
					getInspectionActionState={getInspectionActionState}
					onRequestInspection={onRequestInspection}
				/>
			);
		case 'file_download':
			return <FileDownloadBlock block={block} />;
		case 'file_reference':
			return <FileReferenceBlock block={block} />;
		case 'inspection_detail_block':
			return renderInspectionDetailBlock ? (
				renderInspectionDetailBlock(block)
			) : (
				<InspectionDetailBlock block={block} />
			);
		case 'plan':
			return <PlanBlock block={block} />;
		case 'run_timeline_block':
			return (
				<RunTimelineBlock
					block={block}
					getInspectionActionState={getInspectionActionState}
					onRequestInspection={onRequestInspection}
					presentationCorrelationLabel={presentationCorrelationLabel}
				/>
			);
		case 'search_result_block':
			return (
				<SearchResultBlock
					block={block}
					getInspectionActionState={getInspectionActionState}
					onRequestInspection={onRequestInspection}
				/>
			);
		case 'table':
			return <TableBlock block={block} />;
		case 'web_search_result_block':
			return <WebSearchResultBlock block={block} />;
		case 'trace_debug_block':
			return isDeveloperMode ? (
				<TraceDebugBlock
					block={block}
					getInspectionActionState={getInspectionActionState}
					onRequestInspection={onRequestInspection}
					presentationCorrelationLabel={presentationCorrelationLabel}
				/>
			) : null;
		case 'workspace_inspection_block':
			return (
				<WorkspaceInspectionBlock
					block={block}
					getInspectionActionState={getInspectionActionState}
					onRequestInspection={onRequestInspection}
				/>
			);
		case 'approval_block':
			return <ApprovalBlock block={block} onResolveApproval={onResolveApproval} />;
		case 'tool_result':
			return <ToolResultBlock block={block} />;
		default:
			return renderImpossibleBlock(block);
	}
}
