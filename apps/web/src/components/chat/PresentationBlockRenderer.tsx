import type { CSSProperties, ReactElement } from 'react';

import {
	codeBlockContainerStyle,
	eventCardStyle,
	inspectionActionButtonStyle,
	inspectionChipListStyle,
	inspectionChipStyle,
	inspectionCorrelationChipStyle,
	inspectionCorrelationMetaStyle,
	inspectionDetailItemStyle,
	inspectionDetailListStyle,
	preStyle,
	presentationBlockCardStyle,
	presentationSubtleTextStyle,
	runFeedbackBannerStyle,
	runFeedbackCopyStyle,
	runFeedbackHeaderStyle,
	runFeedbackMetaStyle,
	searchMatchCardStyle,
	searchMatchListStyle,
	searchMetaGridStyle,
	secondaryLabelStyle,
	toolResultPreviewStyle,
	webSearchCardStyle,
	webSearchResultListStyle,
} from '../../lib/chat-styles.js';
import type { InspectionTargetKind, RenderBlock } from '../../ws-types.js';
import { CapabilityCard } from './capability/index.js';
import type { CapabilityStatus, CapabilityTone } from './capability/index.js';

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

export type RunFeedbackTone = 'error' | 'info' | 'success' | 'warning';

interface RunFeedbackStateInput {
	readonly chip_label: string;
	readonly detail: string;
	readonly pending_detail_count: number;
	readonly run_id: string;
	readonly title: string;
	readonly tone: RunFeedbackTone;
	readonly trace_id?: string;
}

function shortenCorrelationIdentifier(value: string): string {
	const normalizedValue = value.trim().replace(/\s+/gu, ' ');

	if (normalizedValue.length <= 20) {
		return normalizedValue;
	}

	return `${normalizedValue.slice(0, 8)}...${normalizedValue.slice(-6)}`;
}

function buildInspectionCorrelationLabel(
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

function createPendingDetailLabel(count: number): string {
	return `${count} ${count === 1 ? 'detail pending' : 'details pending'}`;
}

function getPresentationBlockDomId(blockId: string): string {
	return `presentation-block:${encodeURIComponent(blockId)}`;
}

function getPresentationBlockSummaryDomId(blockId: string): string {
	return `presentation-block-summary:${encodeURIComponent(blockId)}`;
}

function getPresentationBlockTitleDomId(blockId: string): string {
	return `presentation-block-title:${encodeURIComponent(blockId)}`;
}

function getInspectionActionNoteDomId(blockId: string): string {
	return `inspection-action-note:${encodeURIComponent(blockId)}`;
}

function formatInspectionTargetLabel(targetKind: InspectionTargetKind): string {
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
		default: {
			const exhaustiveTargetKind: never = targetKind;
			return exhaustiveTargetKind;
		}
	}
}

function isInspectionSummaryBlock(block: RenderBlock): block is InspectionSummaryRenderBlock {
	return (
		block.type === 'diff_block' ||
		block.type === 'run_timeline_block' ||
		block.type === 'search_result_block' ||
		block.type === 'trace_debug_block' ||
		block.type === 'workspace_inspection_block'
	);
}

function getInspectionSummaryTitle(block: InspectionSummaryRenderBlock): string {
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

function getInspectionActionSubjectLabel(
	block: RenderBlock,
	targetKind: InspectionTargetKind,
): string {
	return isInspectionSummaryBlock(block)
		? getInspectionSummaryTitle(block)
		: formatInspectionTargetLabel(targetKind);
}

export function getRunFeedbackToneStyles(tone: RunFeedbackTone): {
	readonly background: string;
	readonly borderColor: string;
	readonly chipBackground: string;
	readonly chipColor: string;
} {
	switch (tone) {
		case 'success':
			return {
				background: 'rgba(9, 34, 25, 0.66)',
				borderColor: 'rgba(34, 197, 94, 0.32)',
				chipBackground: 'rgba(20, 83, 45, 0.4)',
				chipColor: '#86efac',
			};
		case 'warning':
			return {
				background: 'rgba(56, 37, 7, 0.62)',
				borderColor: 'rgba(250, 204, 21, 0.28)',
				chipBackground: 'rgba(113, 63, 18, 0.34)',
				chipColor: '#fde68a',
			};
		case 'error':
			return {
				background: 'rgba(58, 17, 17, 0.62)',
				borderColor: 'rgba(248, 113, 113, 0.3)',
				chipBackground: 'rgba(127, 29, 29, 0.36)',
				chipColor: '#fca5a5',
			};
		default:
			return {
				background: 'rgba(8, 23, 45, 0.66)',
				borderColor: 'rgba(96, 165, 250, 0.28)',
				chipBackground: 'rgba(30, 41, 59, 0.5)',
				chipColor: '#bfdbfe',
			};
	}
}

export function createStatusChipStyle(tone: RunFeedbackTone): CSSProperties {
	const palette = getRunFeedbackToneStyles(tone);

	return {
		...inspectionChipStyle,
		background: palette.chipBackground,
		border: `1px solid ${palette.borderColor}`,
		color: palette.chipColor,
	};
}

export function renderRunFeedbackBanner(feedback: RunFeedbackStateInput): ReactElement {
	const toneStyles = getRunFeedbackToneStyles(feedback.tone);
	const correlationLabel = buildInspectionCorrelationLabel(feedback.run_id, feedback.trace_id);

	return (
		<div
			aria-live="polite"
			style={{
				...runFeedbackBannerStyle,
				background: toneStyles.background,
				border: `1px solid ${toneStyles.borderColor}`,
			}}
		>
			<div style={runFeedbackHeaderStyle}>
				<div style={{ display: 'grid', gap: '6px', minWidth: 0 }}>
					<div style={{ ...secondaryLabelStyle, color: toneStyles.chipColor }}>run feedback</div>
					<div style={{ color: '#f8fafc', fontWeight: 700 }}>{feedback.title}</div>
				</div>
				<code style={createStatusChipStyle(feedback.tone)}>{feedback.chip_label}</code>
			</div>
			<div style={runFeedbackCopyStyle}>{feedback.detail}</div>
			<div style={runFeedbackMetaStyle}>
				{correlationLabel ? (
					<code style={inspectionCorrelationChipStyle}>{correlationLabel}</code>
				) : null}
				{feedback.pending_detail_count > 0 ? (
					<code style={inspectionChipStyle}>
						{createPendingDetailLabel(feedback.pending_detail_count)}
					</code>
				) : null}
			</div>
		</div>
	);
}

export function renderInspectionCorrelationContext(
	correlationLabel: string | null,
): ReactElement | null {
	if (!correlationLabel) {
		return null;
	}

	return (
		<div
			style={inspectionCorrelationMetaStyle}
			aria-label={`Run and trace correlation: ${correlationLabel}`}
		>
			<div style={secondaryLabelStyle}>correlation</div>
			<code style={inspectionCorrelationChipStyle}>{correlationLabel}</code>
		</div>
	);
}

export function summarizeEventListBlock(
	block: Extract<RenderBlock, { type: 'event_list' }>,
): string {
	const eventTypes = [...new Set(block.payload.events.map((event) => event.event_type))];
	return `${block.payload.events.length} runtime events${eventTypes.length > 0 ? ` (${eventTypes.join(', ')})` : ''}`;
}

export function getToolResultStyles(
	status: Extract<RenderBlock, { type: 'tool_result' }>['payload']['status'],
): {
	readonly borderColor: string;
	readonly statusBackground: string;
	readonly statusColor: string;
} {
	if (status === 'success') {
		return {
			borderColor: 'rgba(34, 197, 94, 0.34)',
			statusBackground: 'rgba(10, 51, 33, 0.74)',
			statusColor: '#86efac',
		};
	}

	return {
		borderColor: 'rgba(248, 113, 113, 0.34)',
		statusBackground: 'rgba(58, 17, 17, 0.72)',
		statusColor: '#fca5a5',
	};
}

export function getToolResultCapabilityStatus(
	status: Extract<RenderBlock, { type: 'tool_result' }>['payload']['status'],
): CapabilityStatus {
	return status === 'success' ? 'completed' : 'failed';
}

export function getToolResultCapabilityTone(
	status: Extract<RenderBlock, { type: 'tool_result' }>['payload']['status'],
): CapabilityTone {
	return status === 'success' ? 'success' : 'danger';
}

export function renderToolResultBlock(
	block: Extract<RenderBlock, { type: 'tool_result' }>,
): ReactElement {
	const toolResultStyles = getToolResultStyles(block.payload.status);

	return (
		<CapabilityCard
			as="article"
			key={block.id}
			eyebrow="tool result"
			title={block.payload.tool_name}
			status={getToolResultCapabilityStatus(block.payload.status)}
			tone={getToolResultCapabilityTone(block.payload.status)}
			headerAside={
				<span
					style={{
						...createStatusChipStyle(block.payload.status === 'success' ? 'success' : 'error'),
						background: toolResultStyles.statusBackground,
						color: toolResultStyles.statusColor,
					}}
				>
					{block.payload.status}
				</span>
			}
			style={{
				...presentationBlockCardStyle,
				borderColor: toolResultStyles.borderColor,
				background:
					block.payload.status === 'success'
						? 'linear-gradient(180deg, rgba(6, 18, 16, 0.92) 0%, rgba(2, 6, 23, 0.88) 100%)'
						: 'linear-gradient(180deg, rgba(30, 10, 10, 0.9) 0%, rgba(2, 6, 23, 0.88) 100%)',
			}}
		>
			<div style={presentationSubtleTextStyle}>{block.payload.summary}</div>

			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '10px',
					flexWrap: 'wrap',
					marginTop: '10px',
				}}
			>
				<span style={secondaryLabelStyle}>call_id</span>
				<code style={inspectionChipStyle}>{block.payload.call_id}</code>
				{block.payload.error_code ? (
					<span
						style={{
							...inspectionChipStyle,
							color: '#fca5a5',
							border: '1px solid rgba(248, 113, 113, 0.35)',
							background: 'rgba(127, 29, 29, 0.24)',
						}}
					>
						error_code: {block.payload.error_code}
					</span>
				) : null}
			</div>

			{block.payload.result_preview ? (
				<div style={toolResultPreviewStyle}>
					<div style={{ ...secondaryLabelStyle, marginBottom: '6px' }}>
						preview / {block.payload.result_preview.kind}
					</div>
					<div>{block.payload.result_preview.summary_text}</div>
				</div>
			) : null}
		</CapabilityCard>
	);
}

export function getCodeBlockAccent(
	diffKind: Extract<RenderBlock, { type: 'code_block' }>['payload']['diff_kind'],
): string {
	switch (diffKind) {
		case 'before':
			return '#fbbf24';
		case 'unified':
			return '#38bdf8';
		case 'after':
			return '#34d399';
		default:
			return '#94a3b8';
	}
}

export function getInspectionActionPalette(actionState: InspectionActionState | undefined): {
	readonly borderColor: string;
	readonly color: string;
} {
	if (actionState?.is_pending) {
		return {
			borderColor: 'rgba(96, 165, 250, 0.36)',
			color: '#bfdbfe',
		};
	}

	if (actionState?.is_stale) {
		return {
			borderColor: 'rgba(251, 191, 36, 0.36)',
			color: '#fde68a',
		};
	}

	return {
		borderColor: 'rgba(148, 163, 184, 0.28)',
		color: '#e5e7eb',
	};
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
	const actionPalette = getInspectionActionPalette(actionState);
	const actionNoteId = actionState?.note ? getInspectionActionNoteDomId(block.id) : undefined;
	const subjectLabel = getInspectionActionSubjectLabel(block, targetKind);

	return (
		<div style={{ display: 'grid', gap: '6px', justifyItems: 'end' }}>
			<button
				type="button"
				onClick={() => onRequestInspection(targetKind, block.id)}
				disabled={isPending}
				aria-busy={isPending}
				aria-controls={
					actionState?.detail_block_id
						? getPresentationBlockDomId(actionState.detail_block_id)
						: undefined
				}
				aria-describedby={actionNoteId}
				aria-expanded={actionState?.is_open ?? false}
				aria-label={`${actionState?.label ?? 'Open detail'} for ${subjectLabel}`}
				title={actionState?.title}
				style={{
					...inspectionActionButtonStyle,
					borderColor: actionPalette.borderColor,
					color: actionPalette.color,
					cursor: isPending ? 'progress' : inspectionActionButtonStyle.cursor,
					opacity: isPending ? 0.72 : 1,
				}}
			>
				{actionState?.label ?? 'Open detail'}
			</button>
			{actionState?.note ? (
				<span id={actionNoteId} style={{ ...secondaryLabelStyle, color: '#bfdbfe' }}>
					{actionState.note}
				</span>
			) : null}
		</div>
	);
}

export function renderCodeBlock(block: Extract<RenderBlock, { type: 'code_block' }>): ReactElement {
	const accent = getCodeBlockAccent(block.payload.diff_kind);

	return (
		<article
			key={block.id}
			style={{
				...presentationBlockCardStyle,
				borderColor: 'rgba(56, 189, 248, 0.28)',
				background: 'linear-gradient(180deg, rgba(7, 16, 32, 0.94) 0%, rgba(2, 6, 23, 0.88) 100%)',
			}}
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-start',
					gap: '12px',
					flexWrap: 'wrap',
					marginBottom: '10px',
				}}
			>
				<div style={{ display: 'grid', gap: '4px' }}>
					<span style={secondaryLabelStyle}>code block</span>
					<strong style={{ fontSize: '16px', color: '#f8fafc' }}>
						{block.payload.title ?? block.payload.path ?? 'inline preview'}
					</strong>
				</div>
				<div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
					<span
						style={{
							padding: '4px 10px',
							borderRadius: '999px',
							border: `1px solid ${accent}`,
							color: accent,
							fontSize: '11px',
							fontWeight: 700,
							letterSpacing: '0.08em',
							textTransform: 'uppercase',
						}}
					>
						{block.payload.language}
					</span>
					{block.payload.diff_kind ? (
						<span style={{ ...secondaryLabelStyle, color: accent }}>{block.payload.diff_kind}</span>
					) : null}
				</div>
			</div>
			{block.payload.summary ? (
				<div style={{ ...presentationSubtleTextStyle, marginBottom: '10px' }}>
					{block.payload.summary}
				</div>
			) : null}
			{block.payload.path ? (
				<div style={{ marginBottom: '10px' }}>
					<span style={secondaryLabelStyle}>path</span>
					<div
						style={{
							color: '#93c5fd',
							marginTop: '4px',
							wordBreak: 'break-word',
							lineHeight: 1.6,
						}}
					>
						{block.payload.path}
					</div>
				</div>
			) : null}
			<div style={codeBlockContainerStyle}>
				<pre style={preStyle}>{block.payload.content}</pre>
			</div>
		</article>
	);
}

export function renderDiffBlock(
	block: Extract<RenderBlock, { type: 'diff_block' }>,
	onRequestInspection?: (targetKind: InspectionTargetKind, targetId?: string) => void,
	getInspectionActionState?: GetInspectionActionState,
): ReactElement {
	return (
		<article
			key={block.id}
			id={getPresentationBlockDomId(block.id)}
			tabIndex={-1}
			aria-labelledby={getPresentationBlockTitleDomId(block.id)}
			aria-describedby={getPresentationBlockSummaryDomId(block.id)}
			style={{
				...presentationBlockCardStyle,
				borderColor: 'rgba(96, 165, 250, 0.28)',
				background: 'linear-gradient(180deg, rgba(8, 18, 36, 0.94) 0%, rgba(2, 6, 23, 0.88) 100%)',
			}}
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-start',
					gap: '12px',
					flexWrap: 'wrap',
					marginBottom: '10px',
				}}
			>
				<div style={{ display: 'grid', gap: '4px' }}>
					<span style={secondaryLabelStyle}>diff summary</span>
					<h3
						id={getPresentationBlockTitleDomId(block.id)}
						style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}
					>
						{block.payload.title ?? block.payload.path ?? 'Git Diff'}
					</h3>
				</div>
				<div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
					{block.payload.is_truncated ? (
						<span
							style={{
								padding: '4px 10px',
								borderRadius: '999px',
								border: '1px solid rgba(251, 191, 36, 0.35)',
								color: '#fcd34d',
								fontSize: '11px',
								fontWeight: 700,
								letterSpacing: '0.08em',
								textTransform: 'uppercase',
							}}
						>
							truncated
						</span>
					) : null}
					{renderInspectionAction(block, 'diff', onRequestInspection, getInspectionActionState)}
				</div>
			</div>
			<p
				id={getPresentationBlockSummaryDomId(block.id)}
				style={{ ...presentationSubtleTextStyle, margin: '0 0 10px' }}
			>
				{block.payload.summary}
			</p>
			{block.payload.path ? (
				<div style={{ marginBottom: '10px' }}>
					<span style={secondaryLabelStyle}>path</span>
					<div style={{ color: '#93c5fd', marginTop: '4px', wordBreak: 'break-word' }}>
						{block.payload.path}
					</div>
				</div>
			) : null}
			{block.payload.changed_paths && block.payload.changed_paths.length > 0 ? (
				<div style={{ marginBottom: '10px' }}>
					<div style={{ ...secondaryLabelStyle, marginBottom: '6px' }}>changed paths</div>
					<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
						{block.payload.changed_paths.map((path) => (
							<code
								key={`${block.id}:${path}`}
								style={{
									...inspectionChipStyle,
									padding: '3px 8px',
								}}
							>
								{path}
							</code>
						))}
					</div>
				</div>
			) : null}
			<details>
				<summary
					style={{
						...inspectionActionButtonStyle,
						display: 'inline-flex',
						marginBottom: '10px',
					}}
				>
					View diff
				</summary>
				<div style={codeBlockContainerStyle}>
					<pre style={preStyle}>{block.payload.diff_text}</pre>
				</div>
			</details>
		</article>
	);
}
export function renderSearchResultBlock(
	block: Extract<RenderBlock, { type: 'search_result_block' }>,
	onRequestInspection?: (targetKind: InspectionTargetKind, targetId?: string) => void,
	getInspectionActionState?: GetInspectionActionState,
): ReactElement {
	return (
		<CapabilityCard
			as="article"
			eyebrow="search summary"
			key={block.id}
			id={getPresentationBlockDomId(block.id)}
			title={block.payload.title}
			titleId={getPresentationBlockTitleDomId(block.id)}
			tone="warning"
			tabIndex={-1}
			aria-labelledby={getPresentationBlockTitleDomId(block.id)}
			aria-describedby={getPresentationBlockSummaryDomId(block.id)}
			headerAside={
				<div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
					{block.payload.is_truncated ? (
						<span
							style={{
								padding: '4px 10px',
								borderRadius: '999px',
								border: '1px solid rgba(251, 191, 36, 0.35)',
								color: '#fcd34d',
								fontSize: '11px',
								fontWeight: 700,
								letterSpacing: '0.08em',
								textTransform: 'uppercase',
							}}
						>
							truncated
						</span>
					) : null}
					{renderInspectionAction(
						block,
						'search_result',
						onRequestInspection,
						getInspectionActionState,
					)}
				</div>
			}
			style={{
				...presentationBlockCardStyle,
				borderColor: 'rgba(250, 204, 21, 0.28)',
				background: 'linear-gradient(180deg, rgba(32, 24, 8, 0.94) 0%, rgba(2, 6, 23, 0.88) 100%)',
			}}
		>
			<p
				id={getPresentationBlockSummaryDomId(block.id)}
				style={{ ...presentationSubtleTextStyle, margin: 0, color: 'hsl(var(--color-text))' }}
			>
				{block.payload.summary}
			</p>
			<div style={searchMetaGridStyle}>
				<div>
					<div style={secondaryLabelStyle}>query</div>
					<code
						style={{
							...inspectionChipStyle,
							display: 'inline-block',
							marginTop: '4px',
							color: '#fde68a',
						}}
					>
						{block.payload.query}
					</code>
				</div>
				<div>
					<div style={secondaryLabelStyle}>search root</div>
					<div style={{ color: '#93c5fd', marginTop: '4px', wordBreak: 'break-word' }}>
						{block.payload.searched_root}
					</div>
				</div>
				<div>
					<div style={secondaryLabelStyle}>visible window</div>
					<div style={{ color: '#e5e7eb', marginTop: '4px' }}>
						{block.payload.total_matches ?? block.payload.matches.length}
					</div>
				</div>
			</div>
			{block.payload.source_priority_note || block.payload.conflict_note ? (
				<div style={inspectionDetailListStyle}>
					{block.payload.source_priority_note ? (
						<div style={inspectionDetailItemStyle}>
							<div style={secondaryLabelStyle}>source priority</div>
							<div style={{ ...presentationSubtleTextStyle, marginTop: '6px' }}>
								{block.payload.source_priority_note}
							</div>
						</div>
					) : null}
					{block.payload.conflict_note ? (
						<div style={inspectionDetailItemStyle}>
							<div style={secondaryLabelStyle}>conflict note</div>
							<div style={{ ...presentationSubtleTextStyle, marginTop: '6px' }}>
								{block.payload.conflict_note}
							</div>
						</div>
					) : null}
				</div>
			) : null}
			<div style={searchMatchListStyle}>
				{block.payload.matches.length === 0 ? (
					<div style={searchMatchCardStyle}>
						<div style={{ color: '#94a3b8' }}>No visible matches returned.</div>
					</div>
				) : (
					block.payload.matches.map((match) => (
						<div
							key={`${block.id}:${match.path}:${match.line_number}`}
							style={searchMatchCardStyle}
						>
							<div
								style={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									gap: '10px',
									flexWrap: 'wrap',
									marginBottom: '8px',
								}}
							>
								<div style={{ color: '#f8fafc', wordBreak: 'break-word' }}>{match.path}</div>
								<code
									style={{
										...inspectionChipStyle,
										color: '#fde68a',
										padding: '3px 8px',
									}}
								>
									line {match.line_number}
								</code>
							</div>
							<div style={codeBlockContainerStyle}>
								<pre style={preStyle}>{match.line_text}</pre>
							</div>
						</div>
					))
				)}
			</div>
		</CapabilityCard>
	);
}

export function formatTrustTierLabel(
	trustTier: 'general' | 'official' | 'reputable' | 'vendor',
): string {
	switch (trustTier) {
		case 'official':
			return 'official';
		case 'vendor':
			return 'vendor';
		case 'reputable':
			return 'reputable';
		case 'general':
			return 'general';
	}
}

export function getTrustTierChipStyle(
	trustTier: 'general' | 'official' | 'reputable' | 'vendor',
): CSSProperties {
	switch (trustTier) {
		case 'official':
			return {
				...inspectionChipStyle,
				background: 'rgba(20, 83, 45, 0.42)',
				border: '1px solid rgba(34, 197, 94, 0.28)',
				color: '#86efac',
			};
		case 'vendor':
			return {
				...inspectionChipStyle,
				background: 'rgba(67, 56, 202, 0.28)',
				border: '1px solid rgba(129, 140, 248, 0.24)',
				color: '#c7d2fe',
			};
		case 'reputable':
			return {
				...inspectionChipStyle,
				background: 'rgba(8, 47, 73, 0.42)',
				border: '1px solid rgba(56, 189, 248, 0.24)',
				color: '#bae6fd',
			};
		case 'general':
			return {
				...inspectionChipStyle,
				background: 'rgba(71, 85, 105, 0.36)',
				border: '1px solid rgba(148, 163, 184, 0.2)',
				color: '#cbd5e1',
			};
	}
}

export function renderWebSearchResultBlock(
	block: Extract<RenderBlock, { type: 'web_search_result_block' }>,
): ReactElement {
	return (
		<article
			key={block.id}
			id={getPresentationBlockDomId(block.id)}
			tabIndex={-1}
			aria-labelledby={getPresentationBlockTitleDomId(block.id)}
			aria-describedby={getPresentationBlockSummaryDomId(block.id)}
			style={{
				...webSearchCardStyle,
				borderColor: 'rgba(45, 212, 191, 0.3)',
				background: 'linear-gradient(180deg, rgba(6, 24, 30, 0.94) 0%, rgba(2, 6, 23, 0.9) 100%)',
			}}
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-start',
					gap: '12px',
					flexWrap: 'wrap',
					marginBottom: '10px',
				}}
			>
				<div style={{ display: 'grid', gap: '4px' }}>
					<span style={secondaryLabelStyle}>web search</span>
					<h3
						id={getPresentationBlockTitleDomId(block.id)}
						style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}
					>
						{block.payload.title}
					</h3>
				</div>
				<div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
					<code style={inspectionChipStyle}>{block.payload.search_provider}</code>
					{block.payload.is_truncated ? (
						<span
							style={{
								padding: '4px 10px',
								borderRadius: '999px',
								border: '1px solid rgba(45, 212, 191, 0.3)',
								color: '#99f6e4',
								fontSize: '11px',
								fontWeight: 700,
								letterSpacing: '0.08em',
								textTransform: 'uppercase',
							}}
						>
							truncated
						</span>
					) : null}
				</div>
			</div>
			<p
				id={getPresentationBlockSummaryDomId(block.id)}
				style={{ ...presentationSubtleTextStyle, margin: 0, color: 'hsl(var(--color-text))' }}
			>
				{block.payload.summary}
			</p>
			<div style={searchMetaGridStyle}>
				<div>
					<div style={secondaryLabelStyle}>query</div>
					<code
						style={{
							...inspectionChipStyle,
							display: 'inline-block',
							marginTop: '4px',
							color: '#99f6e4',
						}}
					>
						{block.payload.query}
					</code>
				</div>
				<div>
					<div style={secondaryLabelStyle}>visible results</div>
					<div style={{ color: '#e5e7eb', marginTop: '4px' }}>{block.payload.results.length}</div>
				</div>
			</div>
			{block.payload.source_priority_note ||
			block.payload.conflict_note ||
			block.payload.authority_note ||
			block.payload.freshness_note ? (
				<div style={inspectionDetailListStyle}>
					{block.payload.source_priority_note ? (
						<div style={inspectionDetailItemStyle}>
							<div style={secondaryLabelStyle}>source priority</div>
							<div style={{ marginTop: '6px', color: '#cbd5e1', lineHeight: 1.5 }}>
								{block.payload.source_priority_note}
							</div>
						</div>
					) : null}
					{block.payload.conflict_note ? (
						<div style={inspectionDetailItemStyle}>
							<div style={secondaryLabelStyle}>conflict note</div>
							<div style={{ marginTop: '6px', color: '#cbd5e1', lineHeight: 1.5 }}>
								{block.payload.conflict_note}
							</div>
						</div>
					) : null}
					{block.payload.authority_note ? (
						<div style={inspectionDetailItemStyle}>
							<div style={secondaryLabelStyle}>authority note</div>
							<div style={{ marginTop: '6px', color: '#cbd5e1', lineHeight: 1.5 }}>
								{block.payload.authority_note}
							</div>
						</div>
					) : null}
					{block.payload.freshness_note ? (
						<div style={inspectionDetailItemStyle}>
							<div style={secondaryLabelStyle}>freshness note</div>
							<div style={{ marginTop: '6px', color: '#cbd5e1', lineHeight: 1.5 }}>
								{block.payload.freshness_note}
							</div>
						</div>
					) : null}
				</div>
			) : null}
			<div style={webSearchResultListStyle}>
				{block.payload.results.length === 0 ? (
					<div style={webSearchCardStyle}>
						<div style={{ color: '#94a3b8' }}>
							No authority-ranked public results were kept for this query.
						</div>
					</div>
				) : (
					block.payload.results.map((result) => (
						<div key={`${block.id}:${result.url}`} style={webSearchCardStyle}>
							<div style={{ display: 'grid', gap: '10px' }}>
								<div
									style={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'flex-start',
										gap: '10px',
										flexWrap: 'wrap',
									}}
								>
									<a
										href={result.url}
										rel="noreferrer"
										target="_blank"
										style={{
											color: '#f8fafc',
											fontWeight: 700,
											textDecoration: 'none',
											lineHeight: 1.5,
											wordBreak: 'break-word',
										}}
									>
										{result.title}
									</a>
									<div style={inspectionChipListStyle}>
										<code style={getTrustTierChipStyle(result.trust_tier)}>
											{formatTrustTierLabel(result.trust_tier)}
										</code>
										<code style={inspectionChipStyle}>{result.source}</code>
									</div>
								</div>
								<div style={{ color: '#cbd5e1', lineHeight: 1.6 }}>{result.snippet}</div>
								<div style={{ display: 'grid', gap: '6px' }}>
									<div style={{ color: '#7dd3fc', fontSize: '12px', wordBreak: 'break-word' }}>
										{result.url}
									</div>
									{result.authority_note ? (
										<div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: 1.5 }}>
											{result.authority_note}
										</div>
									) : null}
									{result.freshness_hint ? (
										<div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: 1.5 }}>
											{result.freshness_hint}
										</div>
									) : null}
								</div>
							</div>
						</div>
					))
				)}
			</div>
		</article>
	);
}

export function renderWorkspaceInspectionBlock(
	block: Extract<RenderBlock, { type: 'workspace_inspection_block' }>,
	onRequestInspection?: (targetKind: InspectionTargetKind, targetId?: string) => void,
	getInspectionActionState?: GetInspectionActionState,
): ReactElement {
	return (
		<article
			key={block.id}
			id={getPresentationBlockDomId(block.id)}
			tabIndex={-1}
			aria-labelledby={getPresentationBlockTitleDomId(block.id)}
			aria-describedby={getPresentationBlockSummaryDomId(block.id)}
			style={{
				...eventCardStyle,
				borderColor: 'rgba(96, 165, 250, 0.3)',
				background: 'linear-gradient(180deg, rgba(10, 20, 38, 0.94) 0%, rgba(2, 6, 23, 0.88) 100%)',
			}}
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-start',
					gap: '12px',
					flexWrap: 'wrap',
					marginBottom: '10px',
				}}
			>
				<div style={{ display: 'grid', gap: '4px' }}>
					<span style={secondaryLabelStyle}>workspace summary</span>
					<h3
						id={getPresentationBlockTitleDomId(block.id)}
						style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}
					>
						{block.payload.title}
					</h3>
				</div>
				<div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
					{block.payload.project_name ? (
						<code
							style={{
								fontSize: '12px',
								color: '#bfdbfe',
								background: 'rgba(15, 23, 42, 0.72)',
								padding: '4px 10px',
								borderRadius: '999px',
							}}
						>
							{block.payload.project_name}
						</code>
					) : null}
					{renderInspectionAction(
						block,
						'workspace',
						onRequestInspection,
						getInspectionActionState,
					)}
				</div>
			</div>
			<p
				id={getPresentationBlockSummaryDomId(block.id)}
				style={{ margin: 0, color: '#e5e7eb', lineHeight: 1.5 }}
			>
				{block.payload.summary}
			</p>
			{block.payload.project_type_hints.length > 0 ? (
				<div style={{ marginTop: '12px' }}>
					<div style={secondaryLabelStyle}>project signals</div>
					<div style={inspectionChipListStyle}>
						{block.payload.project_type_hints.map((hint) => (
							<code key={`${block.id}:hint:${hint}`} style={inspectionChipStyle}>
								{hint}
							</code>
						))}
					</div>
				</div>
			) : null}
			{block.payload.top_level_signals.length > 0 ? (
				<div style={{ marginTop: '12px' }}>
					<div style={secondaryLabelStyle}>top-level signals</div>
					<div style={inspectionChipListStyle}>
						{block.payload.top_level_signals.map((signal) => (
							<code key={`${block.id}:signal:${signal}`} style={inspectionChipStyle}>
								{signal}
							</code>
						))}
					</div>
				</div>
			) : null}
			{block.payload.last_search_summary ? (
				<div style={toolResultPreviewStyle}>
					<div style={{ ...secondaryLabelStyle, marginBottom: '6px' }}>recent search</div>
					<div>{block.payload.last_search_summary}</div>
				</div>
			) : null}
			{block.payload.inspection_notes && block.payload.inspection_notes.length > 0 ? (
				<div style={toolResultPreviewStyle}>
					<div style={{ ...secondaryLabelStyle, marginBottom: '6px' }}>workspace notes</div>
					<div style={{ display: 'grid', gap: '6px' }}>
						{block.payload.inspection_notes.map((note) => (
							<div key={`${block.id}:note:${note}`}>{note}</div>
						))}
					</div>
				</div>
			) : null}
		</article>
	);
}

export function getRunTimelineItemAccent(state: string | undefined): {
	readonly borderColor: string;
	readonly chipColor: string;
	readonly chipBackground: string;
} {
	switch (state) {
		case 'approved':
		case 'completed':
		case 'success':
			return {
				borderColor: 'rgba(34, 197, 94, 0.28)',
				chipBackground: 'rgba(20, 83, 45, 0.34)',
				chipColor: '#86efac',
			};
		case 'failed':
		case 'rejected':
		case 'error':
			return {
				borderColor: 'rgba(248, 113, 113, 0.28)',
				chipBackground: 'rgba(127, 29, 29, 0.24)',
				chipColor: '#fca5a5',
			};
		case 'pending':
		case 'requested':
		case 'active':
			return {
				borderColor: 'rgba(250, 204, 21, 0.24)',
				chipBackground: 'rgba(113, 63, 18, 0.24)',
				chipColor: '#fde68a',
			};
		default:
			return {
				borderColor: 'rgba(148, 163, 184, 0.24)',
				chipBackground: 'rgba(30, 41, 59, 0.5)',
				chipColor: '#cbd5e1',
			};
	}
}
export function renderRunTimelineBlock(
	block: Extract<RenderBlock, { type: 'run_timeline_block' }>,
	onRequestInspection?: (targetKind: InspectionTargetKind, targetId?: string) => void,
	getInspectionActionState?: GetInspectionActionState,
	correlationLabel?: string | null,
): ReactElement {
	return (
		<article
			key={block.id}
			id={getPresentationBlockDomId(block.id)}
			tabIndex={-1}
			aria-labelledby={getPresentationBlockTitleDomId(block.id)}
			aria-describedby={getPresentationBlockSummaryDomId(block.id)}
			style={{
				...eventCardStyle,
				borderColor: 'rgba(96, 165, 250, 0.28)',
				background: 'linear-gradient(180deg, rgba(9, 17, 31, 0.94) 0%, rgba(2, 6, 23, 0.88) 100%)',
			}}
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-start',
					gap: '12px',
					flexWrap: 'wrap',
					marginBottom: '10px',
				}}
			>
				<div style={{ display: 'grid', gap: '4px' }}>
					<span style={secondaryLabelStyle}>timeline summary</span>
					<h3
						id={getPresentationBlockTitleDomId(block.id)}
						style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}
					>
						{block.payload.title}
					</h3>
				</div>
				{renderInspectionAction(block, 'timeline', onRequestInspection, getInspectionActionState)}
			</div>
			<p
				id={getPresentationBlockSummaryDomId(block.id)}
				style={{ margin: 0, color: '#e5e7eb', lineHeight: 1.5 }}
			>
				{block.payload.summary}
			</p>
			{renderInspectionCorrelationContext(correlationLabel ?? null)}
			<div style={{ ...secondaryLabelStyle, marginTop: '14px' }}>recent steps</div>
			<div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
				{block.payload.items.map((item, index) => {
					const accent = getRunTimelineItemAccent(item.state);
					return (
						<div
							key={`${block.id}:${index}:${item.kind}:${item.call_id ?? item.label}`}
							style={{
								border: `1px solid ${accent.borderColor}`,
								borderRadius: '14px',
								padding: '12px',
								background: 'rgba(15, 23, 42, 0.54)',
							}}
						>
							<div
								style={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'flex-start',
									gap: '10px',
									flexWrap: 'wrap',
								}}
							>
								<div style={{ color: '#f8fafc', fontWeight: 600 }}>{item.label}</div>
								{item.state ? (
									<span
										style={{
											padding: '3px 8px',
											borderRadius: '999px',
											background: accent.chipBackground,
											border: `1px solid ${accent.borderColor}`,
											color: accent.chipColor,
											fontSize: '11px',
											fontWeight: 700,
											letterSpacing: '0.08em',
											textTransform: 'uppercase',
										}}
									>
										{item.state}
									</span>
								) : null}
							</div>
							{item.tool_name || item.call_id ? (
								<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
									{item.tool_name ? (
										<code style={inspectionChipStyle}>{item.tool_name}</code>
									) : null}
									{item.call_id ? <code style={inspectionChipStyle}>{item.call_id}</code> : null}
								</div>
							) : null}
							{item.detail ? (
								<div style={{ color: '#cbd5e1', marginTop: '8px', lineHeight: 1.5 }}>
									{item.detail}
								</div>
							) : null}
						</div>
					);
				})}
			</div>
		</article>
	);
}

export function getTraceDebugStateAccent(
	runState: Extract<RenderBlock, { type: 'trace_debug_block' }>['payload']['run_state'],
): { readonly borderColor: string; readonly chipBackground: string; readonly chipColor: string } {
	switch (runState) {
		case 'COMPLETED':
			return {
				borderColor: 'rgba(34, 197, 94, 0.28)',
				chipBackground: 'rgba(20, 83, 45, 0.34)',
				chipColor: '#86efac',
			};
		case 'FAILED':
			return {
				borderColor: 'rgba(248, 113, 113, 0.28)',
				chipBackground: 'rgba(127, 29, 29, 0.24)',
				chipColor: '#fca5a5',
			};
		case 'WAITING_APPROVAL':
			return {
				borderColor: 'rgba(250, 204, 21, 0.24)',
				chipBackground: 'rgba(113, 63, 18, 0.24)',
				chipColor: '#fde68a',
			};
		default:
			return {
				borderColor: 'rgba(96, 165, 250, 0.24)',
				chipBackground: 'rgba(30, 41, 59, 0.5)',
				chipColor: '#bfdbfe',
			};
	}
}

export function renderTraceDebugBlock(
	block: Extract<RenderBlock, { type: 'trace_debug_block' }>,
	onRequestInspection?: (targetKind: InspectionTargetKind, targetId?: string) => void,
	getInspectionActionState?: GetInspectionActionState,
	correlationLabel?: string | null,
): ReactElement {
	const accent = getTraceDebugStateAccent(block.payload.run_state);
	return (
		<article
			key={block.id}
			id={getPresentationBlockDomId(block.id)}
			tabIndex={-1}
			aria-labelledby={getPresentationBlockTitleDomId(block.id)}
			aria-describedby={getPresentationBlockSummaryDomId(block.id)}
			style={{
				...eventCardStyle,
				borderColor: 'rgba(125, 211, 252, 0.28)',
				background: 'linear-gradient(180deg, rgba(8, 19, 34, 0.94) 0%, rgba(2, 6, 23, 0.88) 100%)',
			}}
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-start',
					gap: '12px',
					flexWrap: 'wrap',
					marginBottom: '10px',
				}}
			>
				<div style={{ display: 'grid', gap: '4px' }}>
					<span style={secondaryLabelStyle}>trace / debug summary</span>
					<h3
						id={getPresentationBlockTitleDomId(block.id)}
						style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}
					>
						{block.payload.title}
					</h3>
				</div>
				<div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
					<span
						style={{
							padding: '4px 10px',
							borderRadius: '999px',
							background: accent.chipBackground,
							border: `1px solid ${accent.borderColor}`,
							color: accent.chipColor,
							fontSize: '11px',
							fontWeight: 700,
							letterSpacing: '0.08em',
							textTransform: 'uppercase',
						}}
					>
						{block.payload.run_state}
					</span>
					{renderInspectionAction(
						block,
						'trace_debug',
						onRequestInspection,
						getInspectionActionState,
					)}
				</div>
			</div>
			<p
				id={getPresentationBlockSummaryDomId(block.id)}
				style={{ margin: 0, color: '#e5e7eb', lineHeight: 1.5 }}
			>
				{block.payload.summary}
			</p>
			{renderInspectionCorrelationContext(block.payload.trace_label ?? correlationLabel ?? null)}
			{block.payload.tool_chain_summary ? (
				<div style={toolResultPreviewStyle}>
					<div style={{ ...secondaryLabelStyle, marginBottom: '6px' }}>tool path</div>
					<div>{block.payload.tool_chain_summary}</div>
				</div>
			) : null}
			{block.payload.approval_summary ? (
				<div style={toolResultPreviewStyle}>
					<div style={{ ...secondaryLabelStyle, marginBottom: '6px' }}>approval signal</div>
					<div>{block.payload.approval_summary}</div>
				</div>
			) : null}
			{block.payload.debug_notes && block.payload.debug_notes.length > 0 ? (
				<div style={toolResultPreviewStyle}>
					<div style={{ ...secondaryLabelStyle, marginBottom: '6px' }}>debug cues</div>
					<div style={{ display: 'grid', gap: '6px' }}>
						{block.payload.debug_notes.map((note) => (
							<div key={`${block.id}:debug:${note}`}>{note}</div>
						))}
					</div>
				</div>
			) : null}
			{block.payload.warning_notes && block.payload.warning_notes.length > 0 ? (
				<div
					style={{
						...toolResultPreviewStyle,
						border: '1px solid rgba(250, 204, 21, 0.24)',
						background: 'rgba(60, 41, 5, 0.24)',
					}}
				>
					<div style={{ ...secondaryLabelStyle, marginBottom: '6px', color: '#fcd34d' }}>
						watchouts
					</div>
					<div style={{ display: 'grid', gap: '6px', color: '#fde68a' }}>
						{block.payload.warning_notes.map((note) => (
							<div key={`${block.id}:warning:${note}`}>{note}</div>
						))}
					</div>
				</div>
			) : null}
		</article>
	);
}
