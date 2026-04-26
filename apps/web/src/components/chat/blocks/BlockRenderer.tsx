import type { ReactElement } from 'react';

import {
	eventCardStyle,
	presentationSubtleTextStyle,
	secondaryLabelStyle,
} from '../../../lib/chat-styles.js';
import type {
	ApprovalResolveDecision,
	InspectionTargetKind,
	RenderBlock,
} from '../../../ws-types.js';
import { ApprovalPanel } from '../../approval/ApprovalPanel.js';
import { MarkdownRenderer } from '../MarkdownRenderer.js';
import {
	renderDiffBlock,
	renderRunTimelineBlock,
	renderSearchResultBlock,
	renderToolResultBlock,
	renderTraceDebugBlock,
	renderWebSearchResultBlock,
	renderWorkspaceInspectionBlock,
	summarizeEventListBlock,
} from '../PresentationBlockRenderer.js';
import type { GetInspectionActionState } from '../PresentationBlockRenderer.js';
import { CapabilityCard } from '../capability/index.js';
import { CodeBlockCard } from './CodeBlockCard.js';

type InspectionDetailBlock = Extract<RenderBlock, { type: 'inspection_detail_block' }>;

export type BlockRendererProps = Readonly<{
	block: RenderBlock;
	isDeveloperMode?: boolean;
	onRequestInspection?: (targetKind: InspectionTargetKind, targetId?: string) => void;
	onResolveApproval?: (approvalId: string, decision: ApprovalResolveDecision) => void;
	presentationCorrelationLabel?: string | null;
	getInspectionActionState?: GetInspectionActionState;
	renderInspectionDetailBlock?: (block: InspectionDetailBlock) => ReactElement;
}>;

function renderTextBlock(block: Extract<RenderBlock, { type: 'text' }>): ReactElement {
	return (
		<article key={block.id} style={{ ...eventCardStyle, background: 'transparent' }}>
			<MarkdownRenderer content={block.payload.text} />
		</article>
	);
}

function renderStatusBlock(block: Extract<RenderBlock, { type: 'status' }>): ReactElement {
	return (
		<article key={block.id} style={eventCardStyle}>
			<strong style={{ display: 'block', marginBottom: '8px' }}>Status update</strong>
			<div style={{ color: '#fbbf24', fontSize: '12px', textTransform: 'uppercase' }}>
				{block.payload.level}
			</div>
			<div style={{ color: 'hsl(var(--color-text))', marginTop: '6px' }}>
				{block.payload.message}
			</div>
		</article>
	);
}

function renderEventListBlock(block: Extract<RenderBlock, { type: 'event_list' }>): ReactElement {
	return (
		<article key={block.id} style={eventCardStyle}>
			<strong style={{ display: 'block', marginBottom: '8px' }}>Runtime activity</strong>
			<div style={presentationSubtleTextStyle}>{summarizeEventListBlock(block)}</div>
			<div style={{ ...secondaryLabelStyle, marginTop: '8px' }}>
				Visible in Developer Mode because this is raw runtime context.
			</div>
		</article>
	);
}

function renderPlanBlock(block: Extract<RenderBlock, { type: 'plan' }>): ReactElement {
	return (
		<CapabilityCard
			as="article"
			key={block.id}
			eyebrow="structured plan"
			title={block.payload.title}
			tone="info"
		>
			<ol style={{ display: 'grid', gap: '8px', margin: 0, paddingLeft: '20px' }}>
				{block.payload.steps.map((step, index) => (
					<li key={`${block.id}:step:${index}`} style={{ color: 'hsl(var(--color-text))' }}>
						<span style={{ fontWeight: 700 }}>{step.status}</span>
						<span style={{ color: 'hsl(var(--color-text-muted))' }}> - {step.text}</span>
					</li>
				))}
			</ol>
		</CapabilityCard>
	);
}

function renderTableBlock(block: Extract<RenderBlock, { type: 'table' }>): ReactElement {
	return (
		<CapabilityCard
			as="article"
			key={block.id}
			eyebrow="structured table"
			title={block.payload.caption ?? 'Table'}
			tone="neutral"
		>
			<div style={{ overflowX: 'auto' }}>
				<table style={{ borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'auto' }}>
					<thead>
						<tr>
							{block.payload.headers.map((header) => (
								<th
									key={`${block.id}:header:${header}`}
									scope="col"
									style={{
										borderBottom: '1px solid rgba(148, 163, 184, 0.24)',
										color: '#f8fafc',
										padding: '8px',
										textAlign: 'left',
										whiteSpace: 'nowrap',
									}}
								>
									{header}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{block.payload.rows.map((row, rowIndex) => (
							<tr key={`${block.id}:row:${rowIndex}`}>
								{row.map((cell, cellIndex) => (
									<td
										key={`${block.id}:cell:${rowIndex}:${cellIndex}`}
										style={{
											borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
											color: 'hsl(var(--color-text-muted))',
											padding: '8px',
											verticalAlign: 'top',
										}}
									>
										{cell}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</CapabilityCard>
	);
}

function renderFileReferenceBlock(
	block: Extract<RenderBlock, { type: 'file_reference' }>,
): ReactElement {
	const lineLabel =
		block.payload.line_start === undefined
			? null
			: block.payload.line_end === undefined
				? `line ${block.payload.line_start}`
				: `lines ${block.payload.line_start}-${block.payload.line_end}`;

	return (
		<CapabilityCard
			as="article"
			key={block.id}
			eyebrow="file reference"
			headerAside={lineLabel ? <code style={secondaryLabelStyle}>{lineLabel}</code> : null}
			title={block.payload.path}
			tone="neutral"
		>
			{block.payload.snippet ? <MarkdownRenderer content={block.payload.snippet} /> : null}
		</CapabilityCard>
	);
}

function renderFileDownloadBlock(
	block: Extract<RenderBlock, { type: 'file_download' }>,
): ReactElement {
	const sizeLabel =
		block.payload.size_bytes === undefined ? null : `${block.payload.size_bytes} bytes`;
	const expiresLabel =
		block.payload.expires_at === undefined ? null : `Expires ${block.payload.expires_at}`;

	return (
		<CapabilityCard
			as="article"
			key={block.id}
			eyebrow="download"
			title={block.payload.filename}
			tone="success"
		>
			<div style={{ display: 'grid', gap: '10px' }}>
				<div style={presentationSubtleTextStyle}>
					{[sizeLabel, expiresLabel].filter(Boolean).join(' - ') || 'Scoped download is ready.'}
				</div>
				<a className="runa-button runa-button--primary" download href={block.payload.url}>
					Download
				</a>
			</div>
		</CapabilityCard>
	);
}

function renderMissingInspectionDetailBlock(block: InspectionDetailBlock): ReactElement {
	return (
		<article key={block.id} style={eventCardStyle}>
			<strong style={{ display: 'block', marginBottom: '8px' }}>{block.payload.title}</strong>
			<div style={presentationSubtleTextStyle}>{block.payload.summary}</div>
		</article>
	);
}

function renderImpossibleBlock(block: never): ReactElement {
	return (
		<article style={eventCardStyle}>
			<strong style={{ display: 'block', marginBottom: '8px' }}>Unsupported block</strong>
			<div style={presentationSubtleTextStyle}>This presentation block is not yet supported.</div>
			<code style={secondaryLabelStyle}>{String(block)}</code>
		</article>
	);
}

export function BlockRenderer({
	block,
	isDeveloperMode = false,
	onRequestInspection,
	onResolveApproval,
	presentationCorrelationLabel,
	getInspectionActionState,
	renderInspectionDetailBlock,
}: BlockRendererProps): ReactElement | null {
	switch (block.type) {
		case 'text':
			return renderTextBlock(block);
		case 'status':
			return renderStatusBlock(block);
		case 'event_list':
			return isDeveloperMode ? renderEventListBlock(block) : null;
		case 'code_block':
			return <CodeBlockCard block={block} />;
		case 'code_artifact':
			return <CodeBlockCard block={block} />;
		case 'diff_block':
			return renderDiffBlock(block, onRequestInspection, getInspectionActionState);
		case 'file_download':
			return renderFileDownloadBlock(block);
		case 'file_reference':
			return renderFileReferenceBlock(block);
		case 'inspection_detail_block':
			return renderInspectionDetailBlock
				? renderInspectionDetailBlock(block)
				: renderMissingInspectionDetailBlock(block);
		case 'plan':
			return renderPlanBlock(block);
		case 'run_timeline_block':
			return renderRunTimelineBlock(
				block,
				onRequestInspection,
				getInspectionActionState,
				presentationCorrelationLabel,
			);
		case 'search_result_block':
			return renderSearchResultBlock(block, onRequestInspection, getInspectionActionState);
		case 'table':
			return renderTableBlock(block);
		case 'web_search_result_block':
			return renderWebSearchResultBlock(block);
		case 'trace_debug_block':
			return isDeveloperMode
				? renderTraceDebugBlock(
						block,
						onRequestInspection,
						getInspectionActionState,
						presentationCorrelationLabel,
					)
				: null;
		case 'workspace_inspection_block':
			return renderWorkspaceInspectionBlock(block, onRequestInspection, getInspectionActionState);
		case 'approval_block':
			return <ApprovalPanel key={block.id} block={block} onResolveApproval={onResolveApproval} />;
		case 'tool_result':
			return renderToolResultBlock(block);
		default:
			return renderImpossibleBlock(block);
	}
}
