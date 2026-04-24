import type { ReactElement } from 'react';

import type { RunFeedbackState, RunTransportSummary } from '../../lib/chat-runtime/types.js';
import {
	eventCardStyle,
	inspectionActionButtonStyle,
	inspectionChipStyle,
	inspectionDetailItemStyle,
	inspectionDetailListStyle,
	inspectionRelationBannerStyle,
	inspectionRelationMetaStyle,
	presentationBlockCardStyle,
	presentationSubtleTextStyle,
	secondaryLabelStyle,
} from '../../lib/chat-styles.js';
import type {
	ApprovalResolveDecision,
	ConnectionStatus,
	InspectionTargetKind,
	RenderBlock,
	RunFinishedServerMessage,
	RuntimeEventServerMessage,
	WebSocketServerBridgeMessage,
} from '../../ws-types.js';
import { ApprovalPanel } from '../approval/ApprovalPanel.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';
import {
	renderCodeBlock,
	renderDiffBlock,
	renderRunTimelineBlock,
	renderSearchResultBlock,
	renderToolResultBlock,
	renderTraceDebugBlock,
	renderWebSearchResultBlock,
	renderWorkspaceInspectionBlock,
	summarizeEventListBlock,
} from './PresentationBlockRenderer.js';
import type {
	GetInspectionActionState,
	InspectionSummaryRenderBlock,
} from './PresentationBlockRenderer.js';

interface MutableRunTransportSummary {
	final_state?: RunTransportSummary['final_state'];
	has_accepted: boolean;
	has_presentation_blocks: boolean;
	has_runtime_event: boolean;
	latest_runtime_state?: string;
	last_runtime_event_type?: RuntimeEventServerMessage['payload']['event']['event_type'];
	provider?: RunTransportSummary['provider'];
	run_id: string;
	trace_id?: string;
}

interface StatusChipDescriptor {
	readonly label: string;
	readonly tone: RunFeedbackState['tone'];
}

export interface InspectionDetailRelation {
	readonly anchor_id?: string;
	readonly summary_label: string;
	readonly summary_title: string;
}

function shortenCorrelationIdentifier(value: string): string {
	const normalizedValue = value.trim().replace(/\s+/gu, ' ');

	if (normalizedValue.length <= 20) {
		return normalizedValue;
	}

	return `${normalizedValue.slice(0, 8)}...${normalizedValue.slice(-6)}`;
}

export function getStatusAccent(status: ConnectionStatus): string {
	switch (status) {
		case 'open':
			return '#22c55e';
		case 'error':
			return '#f87171';
		case 'closed':
			return '#94a3b8';
		default:
			return '#f59e0b';
	}
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

export function countInspectionRequestsForRun(
	requestKeys: readonly string[],
	runId: string,
): number {
	let requestCount = 0;

	for (const requestKey of requestKeys) {
		if (isInspectionDetailRequestKeyForRun(requestKey, runId)) {
			requestCount += 1;
		}
	}

	return requestCount;
}

export function createPendingDetailLabel(count: number): string {
	return `${count} ${count === 1 ? 'detail pending' : 'details pending'}`;
}

export function createInspectionCountLabel(
	count: number,
	singular: string,
	plural: string,
): string {
	return `${count} ${count === 1 ? singular : plural}`;
}

export function buildRunTransportSummaryMap(
	messages: readonly WebSocketServerBridgeMessage[],
): ReadonlyMap<string, RunTransportSummary> {
	const runSummaries = new Map<string, MutableRunTransportSummary>();

	function ensureRunSummary(runId: string): MutableRunTransportSummary {
		const existingSummary = runSummaries.get(runId);

		if (existingSummary) {
			return existingSummary;
		}

		const nextSummary: MutableRunTransportSummary = {
			has_accepted: false,
			has_presentation_blocks: false,
			has_runtime_event: false,
			run_id: runId,
		};

		runSummaries.set(runId, nextSummary);
		return nextSummary;
	}

	for (const message of messages) {
		switch (message.type) {
			case 'connection.ready':
				break;
			case 'run.accepted': {
				const runSummary = ensureRunSummary(message.payload.run_id);
				runSummary.has_accepted = true;
				runSummary.provider = message.payload.provider;
				runSummary.trace_id = message.payload.trace_id;
				break;
			}
			case 'runtime.event': {
				const runSummary = ensureRunSummary(message.payload.run_id);
				const runtimeEvent = message.payload.event;
				runSummary.has_runtime_event = true;
				runSummary.last_runtime_event_type = runtimeEvent.event_type;
				runSummary.trace_id = message.payload.trace_id ?? runSummary.trace_id;

				if (runtimeEvent.event_type === 'state.entered') {
					runSummary.latest_runtime_state = runtimeEvent.payload.state;
				}

				if (runtimeEvent.event_type === 'run.completed') {
					runSummary.final_state = 'COMPLETED';
				}

				if (runtimeEvent.event_type === 'run.failed') {
					runSummary.final_state = 'FAILED';
				}

				break;
			}
			case 'text.delta': {
				const runSummary = ensureRunSummary(message.payload.run_id);
				runSummary.trace_id = message.payload.trace_id ?? runSummary.trace_id;
				break;
			}
			case 'presentation.blocks': {
				const runSummary = ensureRunSummary(message.payload.run_id);
				runSummary.has_presentation_blocks = true;
				runSummary.trace_id = message.payload.trace_id ?? runSummary.trace_id;
				break;
			}
			case 'run.finished': {
				const runSummary = ensureRunSummary(message.payload.run_id);
				runSummary.final_state = message.payload.final_state;
				runSummary.trace_id = message.payload.trace_id ?? runSummary.trace_id;
				break;
			}
			case 'run.rejected': {
				if (!message.payload.run_id) {
					break;
				}

				const runSummary = ensureRunSummary(message.payload.run_id);
				runSummary.final_state = 'FAILED';

				if (message.payload.trace_id) {
					runSummary.trace_id = message.payload.trace_id ?? runSummary.trace_id;
				}

				break;
			}
		}
	}

	return runSummaries;
}

export function buildRunFeedbackState(
	input: Readonly<{
		has_visible_surface: boolean;
		include_presentation_blocks: boolean | null;
		is_submitting: boolean;
		pending_detail_count: number;
		run_id: string | null;
		run_summary?: RunTransportSummary;
	}>,
): RunFeedbackState | null {
	const runId = input.run_id;

	if (!runId) {
		return null;
	}

	if (input.is_submitting) {
		return {
			chip_label: 'sending',
			detail: 'Runa yeni istegi canli runtime hattina iletiyor.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Istek gonderiliyor',
			tone: 'info',
			trace_id: input.run_summary?.trace_id,
		};
	}

	if (!input.run_summary) {
		return {
			chip_label: 'accepted',
			detail: 'Çalışma kabul edildi; ilk görünür yüzey hazırlanıyor.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Çalışma hazırlanıyor',
			tone: 'info',
		};
	}

	if (input.run_summary.final_state === 'FAILED') {
		return {
			chip_label: 'failed',
			detail: 'Bu calisma tamamlanamadi. En son gorunur kartlar korunuyor.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Çalışma durdu',
			tone: 'error',
			trace_id: input.run_summary.trace_id,
		};
	}

	if (input.run_summary.final_state === 'COMPLETED') {
		return {
			chip_label: 'completed',
			detail: input.has_visible_surface
				? 'Çalışma tamamlandı. Son kartlar ve detaylar burada sabit kaldı.'
				: 'Çalışma tamamlandı.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Çalışma tamamlandı',
			tone: 'success',
			trace_id: input.run_summary.trace_id,
		};
	}

	return {
		chip_label: input.include_presentation_blocks ? 'live' : 'thinking',
		detail: input.has_visible_surface
			? 'Runa mevcut kartları güncellerken akışı aynı yerde tutuyor.'
			: 'Runa düşünüyor ve ilk yüzeyi hazırlıyor.',
		pending_detail_count: input.pending_detail_count,
		run_id: runId,
		title: 'Çalışma sürüyor',
		tone: 'info',
		trace_id: input.run_summary.trace_id,
	};
}

export function getRunSurfaceStatusChip(
	runSummary?: RunTransportSummary,
): StatusChipDescriptor | null {
	if (!runSummary) {
		return null;
	}

	if (runSummary.final_state === 'FAILED') {
		return {
			label: 'FAILED',
			tone: 'error',
		};
	}

	if (runSummary.final_state === 'COMPLETED') {
		return {
			label: 'COMPLETED',
			tone: 'success',
		};
	}

	if (runSummary.latest_runtime_state === 'WAITING_APPROVAL') {
		return {
			label: 'WAITING APPROVAL',
			tone: 'warning',
		};
	}

	if (runSummary.last_runtime_event_type === 'model.completed') {
		return {
			label: 'MODEL COMPLETED',
			tone: 'info',
		};
	}

	return runSummary.has_presentation_blocks
		? {
				label: 'LIVE',
				tone: 'info',
			}
		: null;
}

function normalizeInspectionTargetId(targetId?: string): string | undefined {
	const normalizedTargetId = targetId?.trim();
	return normalizedTargetId && normalizedTargetId.length > 0 ? normalizedTargetId : undefined;
}

export function isInspectionDetailRequestKeyForRun(requestKey: string, runId: string): boolean {
	return requestKey.startsWith(`inspection_request:${runId}:`);
}

export function createInspectionDetailRequestKey(
	input: Readonly<{
		detail_level: string;
		run_id: string;
		target_id?: string;
		target_kind: InspectionTargetKind;
	}>,
): string {
	return `inspection_request:${input.run_id}:${input.target_kind}:${input.detail_level}:${normalizeInspectionTargetId(input.target_id) ?? 'latest'}`;
}

export function getInspectionDetailBlockId(
	runId: string,
	targetKind: InspectionTargetKind,
	targetId?: string,
): string {
	return `inspection_detail_block:${runId}:${targetKind}:${normalizeInspectionTargetId(targetId) ?? 'latest'}`;
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

function getInspectionRelationDomId(blockId: string): string {
	return `inspection-relation:${encodeURIComponent(blockId)}`;
}

function scrollToPresentationBlock(blockId: string): void {
	const blockElement = document.getElementById(getPresentationBlockDomId(blockId));

	if (!blockElement) {
		return;
	}

	blockElement.scrollIntoView({
		behavior: 'smooth',
		block: 'center',
	});
	blockElement.focus({
		preventScroll: true,
	});
}

type InspectionDetailRenderBlock = Extract<RenderBlock, { type: 'inspection_detail_block' }>;

interface PresentationBlockGroups {
	readonly detailBlocks: readonly InspectionDetailRenderBlock[];
	readonly nonDetailBlocks: readonly RenderBlock[];
}

function getInspectionDetailTargetId(blockId: string): string | undefined {
	const [, , , targetId] = blockId.split(':', 4);
	return targetId && targetId !== 'latest' ? targetId : undefined;
}

function splitPresentationBlocks(blocks: readonly RenderBlock[]): PresentationBlockGroups {
	const detailBlocks: InspectionDetailRenderBlock[] = [];
	const nonDetailBlocks: RenderBlock[] = [];

	for (const block of blocks) {
		if (block.type === 'inspection_detail_block') {
			detailBlocks.push(block);
		} else {
			nonDetailBlocks.push(block);
		}
	}

	return {
		detailBlocks,
		nonDetailBlocks,
	};
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

function getInspectionSummaryLabel(targetKind: InspectionTargetKind): string {
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

function getInspectionTargetKindForSummaryBlock(
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

export function buildInspectionDetailRelations(
	blocks: readonly RenderBlock[],
	inspectionAnchorIdsByDetailId: ReadonlyMap<string, string | undefined>,
): ReadonlyMap<string, InspectionDetailRelation> {
	const summaryMetaByTargetId = new Map<
		string,
		{
			readonly target_kind: InspectionTargetKind;
			readonly title: string;
		}
	>();

	for (const block of splitPresentationBlocks(blocks).nonDetailBlocks) {
		if (!isInspectionSummaryBlock(block)) {
			continue;
		}

		summaryMetaByTargetId.set(block.id, {
			target_kind: getInspectionTargetKindForSummaryBlock(block),
			title: getInspectionSummaryTitle(block),
		});
	}

	const relations = new Map<string, InspectionDetailRelation>();

	for (const block of splitPresentationBlocks(blocks).detailBlocks) {
		const targetId =
			inspectionAnchorIdsByDetailId.get(block.id) ?? getInspectionDetailTargetId(block.id);

		const targetMeta = targetId ? summaryMetaByTargetId.get(targetId) : undefined;
		relations.set(block.id, {
			anchor_id: targetId,
			summary_label: targetMeta
				? getInspectionSummaryLabel(targetMeta.target_kind)
				: formatInspectionTargetLabel(block.payload.target_kind),
			summary_title: targetMeta?.title ?? formatInspectionTargetLabel(block.payload.target_kind),
		});
	}

	return relations;
}

export function buildInspectionSurfaceMeta(blocks: readonly RenderBlock[]): Readonly<{
	detail_count: number;
	summary_count: number;
}> | null {
	const { detailBlocks, nonDetailBlocks } = splitPresentationBlocks(blocks);

	if (detailBlocks.length === 0 && nonDetailBlocks.length === 0) {
		return null;
	}

	return {
		detail_count: detailBlocks.length,
		summary_count: nonDetailBlocks.length,
	};
}

function renderInspectionDetailBlock(
	block: Extract<RenderBlock, { type: 'inspection_detail_block' }>,
	relation?: InspectionDetailRelation,
): ReactElement {
	const anchorId = relation?.anchor_id;

	return (
		<article
			key={block.id}
			id={getPresentationBlockDomId(block.id)}
			tabIndex={-1}
			aria-labelledby={getPresentationBlockTitleDomId(block.id)}
			aria-describedby={`${getPresentationBlockSummaryDomId(block.id)} ${getInspectionRelationDomId(block.id)}`}
			style={{
				...presentationBlockCardStyle,
				borderColor: 'rgba(59, 130, 246, 0.35)',
				borderLeft: '3px solid rgba(96, 165, 250, 0.46)',
				background: 'linear-gradient(180deg, rgba(8, 19, 34, 0.94) 0%, rgba(2, 6, 23, 0.88) 100%)',
				marginLeft: 'clamp(0px, 3vw, 16px)',
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
					<span style={secondaryLabelStyle}>detail card</span>
					<h3
						id={getPresentationBlockTitleDomId(block.id)}
						style={{ margin: 0, fontSize: '16px', color: 'hsl(var(--color-text))' }}
					>
						{block.payload.title}
					</h3>
				</div>
				<code style={inspectionChipStyle}>
					{getInspectionSummaryLabel(block.payload.target_kind)}
				</code>
			</div>

			<p id={getPresentationBlockSummaryDomId(block.id)} style={presentationSubtleTextStyle}>
				{block.payload.summary}
			</p>

			<div id={getInspectionRelationDomId(block.id)} style={inspectionRelationBannerStyle}>
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'flex-start',
						gap: '10px',
						flexWrap: 'wrap',
					}}
				>
					<div style={{ display: 'grid', gap: '4px' }}>
						<div style={secondaryLabelStyle}>summary source</div>
						<div style={{ color: 'hsl(var(--color-text))', fontWeight: 600 }}>
							{relation?.summary_title ?? formatInspectionTargetLabel(block.payload.target_kind)}
						</div>
						<div style={inspectionRelationMetaStyle}>
							Opened from the{' '}
							{relation?.summary_label ?? getInspectionSummaryLabel(block.payload.target_kind)}. Use
							Back to summary to return focus.
						</div>
					</div>
					{anchorId ? (
						<button
							type="button"
							onClick={() => scrollToPresentationBlock(anchorId)}
							aria-controls={getPresentationBlockDomId(anchorId)}
							aria-label={`Back to summary: ${relation.summary_title}`}
							style={inspectionActionButtonStyle}
						>
							Back to summary
						</button>
					) : null}
				</div>
			</div>

			<dl style={{ ...inspectionDetailListStyle, marginBottom: 0 }}>
				{block.payload.detail_items.map((item) => (
					<div key={`${block.id}:${item.label}`} style={inspectionDetailItemStyle}>
						<dt style={{ ...secondaryLabelStyle, marginBottom: '6px' }}>{item.label}</dt>
						<dd style={{ margin: 0, color: 'hsl(var(--color-text))', lineHeight: 1.6 }}>
							{item.value}
						</dd>
					</div>
				))}
			</dl>
		</article>
	);
}

export function renderPresentationBlock(
	block: RenderBlock,
	onResolveApproval?: (approvalId: string, decision: ApprovalResolveDecision) => void,
	onRequestInspection?: (targetKind: InspectionTargetKind, targetId?: string) => void,
	getInspectionActionState?: GetInspectionActionState,
	inspectionDetailRelations?: ReadonlyMap<string, InspectionDetailRelation>,
	presentationCorrelationLabel?: string | null,
): ReactElement {
	switch (block.type) {
		case 'text':
			return (
				<article key={block.id} style={eventCardStyle}>
					<strong style={{ display: 'block', marginBottom: '8px' }}>text</strong>
					<MarkdownRenderer content={block.payload.text} />
				</article>
			);
		case 'status':
			return (
				<article key={block.id} style={eventCardStyle}>
					<strong style={{ display: 'block', marginBottom: '8px' }}>status</strong>
					<div style={{ color: '#fbbf24', textTransform: 'uppercase', fontSize: '12px' }}>
						{block.payload.level}
					</div>
					<div style={{ color: 'hsl(var(--color-text))', marginTop: '6px' }}>
						{block.payload.message}
					</div>
				</article>
			);
		case 'event_list':
			return (
				<article key={block.id} style={eventCardStyle}>
					<strong style={{ display: 'block', marginBottom: '8px' }}>event_list</strong>
					<div style={{ color: 'hsl(var(--color-text-muted))' }}>
						{summarizeEventListBlock(block)}
					</div>
				</article>
			);
		case 'code_block':
			return renderCodeBlock(block);
		case 'diff_block':
			return renderDiffBlock(block, onRequestInspection, getInspectionActionState);
		case 'inspection_detail_block':
			return renderInspectionDetailBlock(block, inspectionDetailRelations?.get(block.id));
		case 'run_timeline_block':
			return renderRunTimelineBlock(
				block,
				onRequestInspection,
				getInspectionActionState,
				presentationCorrelationLabel,
			);
		case 'search_result_block':
			return renderSearchResultBlock(block, onRequestInspection, getInspectionActionState);
		case 'web_search_result_block':
			return renderWebSearchResultBlock(block);
		case 'trace_debug_block':
			return renderTraceDebugBlock(
				block,
				onRequestInspection,
				getInspectionActionState,
				presentationCorrelationLabel,
			);
		case 'workspace_inspection_block':
			return renderWorkspaceInspectionBlock(block, onRequestInspection, getInspectionActionState);
		case 'approval_block':
			return <ApprovalPanel key={block.id} block={block} onResolveApproval={onResolveApproval} />;
		case 'tool_result':
			return renderToolResultBlock(block);
	}
}

export function isRunFinishedMessage(
	message: WebSocketServerBridgeMessage,
): message is RunFinishedServerMessage {
	return message.type === 'run.finished';
}
