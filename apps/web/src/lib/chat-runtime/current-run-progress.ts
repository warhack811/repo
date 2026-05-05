import { uiCopy } from '../../localization/copy.js';
import type { RenderBlock } from '../../ws-types.js';
import type {
	PresentationRunSurface,
	RunFeedbackState,
	RunFeedbackTone,
	RunTransportSummary,
} from './types.js';

type ApprovalBlock = Extract<RenderBlock, { type: 'approval_block' }>;
type RunTimelineBlock = Extract<RenderBlock, { type: 'run_timeline_block' }>;
type RunTimelineItem = RunTimelineBlock['payload']['items'][number];

export type RunStatusChipTone = 'error' | 'info' | 'neutral' | 'success' | 'warning';

export interface RunStatusChipItem {
	readonly label: string;
	readonly tone: RunStatusChipTone;
	readonly value: string;
}

export interface CurrentRunProgressSurface {
	readonly approval_block: ApprovalBlock | null;
	readonly correlation_label: string | null;
	readonly detail: string;
	readonly headline: string;
	readonly hidden_step_count: number;
	readonly meta_items: readonly RunStatusChipItem[];
	readonly phase_items: readonly RunStatusChipItem[];
	readonly run_id: string;
	readonly status_tone: RunStatusChipTone;
	readonly step_items: readonly RunTimelineItem[];
}

function humanizeProvider(provider: RunTransportSummary['provider']): string {
	switch (provider) {
		case 'claude':
			return 'Claude';
		case 'groq':
			return 'Groq';
		default:
			return 'Bilinmiyor';
	}
}

function humanizeRuntimeState(state: string | undefined): string {
	switch (state) {
		case 'MODEL_THINKING':
			return 'Model düşünüyor';
		case 'TOOL_EXECUTING':
			return 'Araç çalışıyor';
		case 'TOOL_RESULT_INGESTING':
			return 'Araç sonucu işleniyor';
		case 'WAITING_APPROVAL':
			return 'Onay bekleniyor';
		case 'COMPLETED':
			return 'Tamamlandı';
		case 'FAILED':
			return 'Başarısız';
		default:
			return 'Bekliyor';
	}
}

function humanizeApprovalStatus(status: ApprovalBlock['payload']['status']): string {
	switch (status) {
		case 'approved':
			return uiCopy.approval.approved;
		case 'cancelled':
			return 'Cancelled';
		case 'expired':
			return 'Expired';
		case 'pending':
			return 'Bekliyor';
		case 'rejected':
			return uiCopy.approval.rejected;
	}
}

function shortenCorrelationIdentifier(value: string): string {
	const normalizedValue = value.trim().replace(/\s+/gu, ' ');

	if (normalizedValue.length <= 20) {
		return normalizedValue;
	}

	return `${normalizedValue.slice(0, 8)}...${normalizedValue.slice(-6)}`;
}

function buildCorrelationLabel(
	runId: string | undefined,
	traceId: string | undefined,
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

function findLatestBlock<TType extends RenderBlock['type']>(
	blocks: readonly RenderBlock[],
	type: TType,
): Extract<RenderBlock, { type: TType }> | null {
	for (let index = blocks.length - 1; index >= 0; index -= 1) {
		const block = blocks[index];

		if (block?.type === type) {
			return block as Extract<RenderBlock, { type: TType }>;
		}
	}

	return null;
}

function hasTimelineToolActivity(items: readonly RunTimelineItem[]): boolean {
	return items.some(
		(item) =>
			item.kind === 'tool_requested' ||
			item.kind === 'tool_completed' ||
			item.kind === 'tool_failed',
	);
}

function hasTimelineToolCompletion(items: readonly RunTimelineItem[]): boolean {
	return items.some((item) => item.kind === 'tool_completed' || item.kind === 'tool_failed');
}

function hasTimelineRunCompletion(items: readonly RunTimelineItem[]): boolean {
	return items.some(
		(item) => item.kind === 'assistant_completed' || item.kind === 'model_completed',
	);
}

function hasTimelineRunFailure(items: readonly RunTimelineItem[]): boolean {
	return items.some((item) => item.kind === 'run_failed');
}

function hasTimelineToolFailure(items: readonly RunTimelineItem[]): boolean {
	return items.some((item) => item.kind === 'tool_failed');
}

function isStoppedByApprovalRejection(
	approvalBlock: ApprovalBlock | null,
	stepItems: readonly RunTimelineItem[],
): boolean {
	return approvalBlock?.payload.status === 'rejected' && !hasTimelineToolFailure(stepItems);
}

function hasModelProgress(
	items: readonly RunTimelineItem[],
	runSummary: RunTransportSummary | undefined,
): boolean {
	if (items.length > 0) {
		return true;
	}

	return runSummary?.has_runtime_event === true;
}

function getLatestApprovalBlock(surface: PresentationRunSurface | null): ApprovalBlock | null {
	if (!surface) {
		return null;
	}

	for (let index = surface.blocks.length - 1; index >= 0; index -= 1) {
		const block = surface.blocks[index];

		if (block?.type === 'approval_block' && block.payload.status === 'pending') {
			return block;
		}
	}

	return findLatestBlock(surface.blocks, 'approval_block');
}

function getTimelineBlock(surface: PresentationRunSurface | null): RunTimelineBlock | null {
	return surface ? findLatestBlock(surface.blocks, 'run_timeline_block') : null;
}

function countBlocksByType(surface: PresentationRunSurface | null): Readonly<{
	approval_count: number;
	detail_count: number;
	non_detail_count: number;
}> {
	if (!surface) {
		return {
			approval_count: 0,
			detail_count: 0,
			non_detail_count: 0,
		};
	}

	let approvalCount = 0;
	let detailCount = 0;

	for (const block of surface.blocks) {
		if (block.type === 'approval_block') {
			approvalCount += 1;
		}

		if (block.type === 'inspection_detail_block') {
			detailCount += 1;
		}
	}

	return {
		approval_count: approvalCount,
		detail_count: detailCount,
		non_detail_count: surface.blocks.length - detailCount,
	};
}

function getRuntimeMetaItem(
	runSummary: RunTransportSummary | undefined,
	feedback: RunFeedbackState | null,
	approvalBlock: ApprovalBlock | null,
	stepItems: readonly RunTimelineItem[],
): RunStatusChipItem {
	if (isStoppedByApprovalRejection(approvalBlock, stepItems)) {
		return {
			label: 'Runtime',
			tone: 'warning',
			value: 'Stopped',
		};
	}

	if (runSummary?.final_state === 'FAILED' || feedback?.tone === 'error') {
		return {
			label: 'Runtime',
			tone: 'error',
			value: 'Failed',
		};
	}

	if (runSummary?.final_state === 'COMPLETED') {
		return {
			label: 'Runtime',
			tone: 'success',
			value: 'Completed',
		};
	}

	if (
		approvalBlock?.payload.status === 'pending' ||
		runSummary?.latest_runtime_state === 'WAITING_APPROVAL'
	) {
		return {
			label: 'Runtime',
			tone: 'warning',
			value: 'Waiting approval',
		};
	}

	if (runSummary?.latest_runtime_state) {
		return {
			label: 'Runtime',
			tone: 'info',
			value: humanizeRuntimeState(runSummary.latest_runtime_state),
		};
	}

	if (runSummary?.has_accepted) {
		return {
			label: 'Runtime',
			tone: 'info',
			value: 'Accepted',
		};
	}

	if (feedback?.chip_label === 'sending') {
		return {
			label: 'Runtime',
			tone: 'info',
			value: 'Submitting',
		};
	}

	return {
		label: 'Runtime',
		tone: 'neutral',
		value: 'Idle',
	};
}

function createPhaseItems(
	input: Readonly<{
		approval_block: ApprovalBlock | null;
		feedback: RunFeedbackState | null;
		run_summary: RunTransportSummary | undefined;
		step_items: readonly RunTimelineItem[];
	}>,
): readonly RunStatusChipItem[] {
	const finalState = input.run_summary?.final_state;
	const latestState = input.run_summary?.latest_runtime_state;
	const hasToolActivity = hasTimelineToolActivity(input.step_items);
	const hasToolCompletion = hasTimelineToolCompletion(input.step_items);
	const hasRunCompletion = hasTimelineRunCompletion(input.step_items);
	const hasRunFailure = hasTimelineRunFailure(input.step_items);
	const hasApproval = input.approval_block !== null;

	return [
		input.run_summary?.has_accepted
			? { label: 'Accepted', tone: 'success', value: 'Done' }
			: input.feedback?.chip_label === 'sending'
				? { label: 'Accepted', tone: 'info', value: 'Sending' }
				: { label: 'Accepted', tone: 'neutral', value: 'Pending' },
		latestState === 'MODEL_THINKING'
			? { label: 'Thinking', tone: 'info', value: 'Active' }
			: hasModelProgress(input.step_items, input.run_summary)
				? { label: 'Thinking', tone: 'success', value: 'Done' }
				: { label: 'Thinking', tone: 'neutral', value: 'Pending' },
		latestState === 'TOOL_EXECUTING'
			? { label: 'Tools', tone: 'info', value: 'Active' }
			: hasToolActivity
				? { label: 'Tools', tone: 'success', value: 'Done' }
				: { label: 'Tools', tone: 'neutral', value: 'Pending' },
		latestState === 'TOOL_RESULT_INGESTING'
			? { label: 'Refresh', tone: 'info', value: 'Active' }
			: hasToolCompletion &&
					(hasApproval || finalState !== undefined || input.step_items.length > 0)
				? { label: 'Refresh', tone: 'success', value: 'Done' }
				: { label: 'Refresh', tone: 'neutral', value: 'Pending' },
		input.approval_block?.payload.status === 'pending' || latestState === 'WAITING_APPROVAL'
			? { label: 'Approval', tone: 'warning', value: 'Waiting' }
			: input.approval_block?.payload.status === 'approved'
				? { label: 'Approval', tone: 'success', value: 'Approved' }
				: input.approval_block?.payload.status === 'rejected'
					? { label: 'Approval', tone: 'warning', value: 'Rejected' }
					: input.approval_block
						? {
								label: 'Approval',
								tone:
									input.approval_block.payload.status === 'cancelled' ||
									input.approval_block.payload.status === 'expired'
										? 'warning'
										: 'neutral',
								value: humanizeApprovalStatus(input.approval_block.payload.status),
							}
						: { label: 'Approval', tone: 'neutral', value: 'Not needed' },
		isStoppedByApprovalRejection(input.approval_block, input.step_items)
			? { label: 'Outcome', tone: 'warning', value: 'Stopped' }
			: finalState === 'COMPLETED' || hasRunCompletion
			? { label: 'Outcome', tone: 'success', value: 'Completed' }
			: finalState === 'FAILED' || hasRunFailure || input.feedback?.tone === 'error'
				? { label: 'Outcome', tone: 'error', value: 'Failed' }
				: { label: 'Outcome', tone: 'neutral', value: 'In progress' },
	];
}

function getStatusTone(
	feedback: RunFeedbackState | null,
	approvalBlock: ApprovalBlock | null,
	runSummary: RunTransportSummary | undefined,
	stepItems: readonly RunTimelineItem[],
): RunStatusChipTone {
	if (isStoppedByApprovalRejection(approvalBlock, stepItems)) {
		return 'warning';
	}

	if (runSummary?.final_state === 'FAILED' || hasTimelineRunFailure(stepItems)) {
		return 'error';
	}

	if (
		approvalBlock?.payload.status === 'pending' ||
		runSummary?.latest_runtime_state === 'WAITING_APPROVAL'
	) {
		return 'warning';
	}

	if (runSummary?.final_state === 'COMPLETED' || hasTimelineRunCompletion(stepItems)) {
		return 'success';
	}

	switch (feedback?.tone) {
		case 'error':
			return 'error';
		case 'success':
			return 'success';
		case 'warning':
			return 'warning';
		case 'info':
			return 'info';
		default:
			return runSummary?.final_state === 'FAILED'
				? 'error'
				: runSummary?.final_state === 'COMPLETED'
					? 'success'
					: 'info';
	}
}

function getFallbackHeadline(runSummary: RunTransportSummary | undefined): string {
	if (runSummary?.final_state === 'FAILED') {
		return 'Çalışma hata ile bitti';
	}

	if (runSummary?.final_state === 'COMPLETED') {
		return 'Çalışma tamamlandı';
	}

	if (runSummary?.latest_runtime_state === 'WAITING_APPROVAL') {
		return 'Onay bekleniyor';
	}

	if (runSummary?.latest_runtime_state === 'TOOL_RESULT_INGESTING') {
		return 'Araç sonucu işleniyor';
	}

	if (runSummary?.latest_runtime_state === 'TOOL_EXECUTING') {
		return 'Araçlar çalışıyor';
	}

	if (runSummary?.latest_runtime_state === 'MODEL_THINKING') {
		return 'Model çalışıyor';
	}

	if (runSummary?.has_accepted) {
		return 'Çalışma kabul edildi';
	}

	return uiCopy.run.currentRunProgress;
}

function getApprovalRejectedHeadline(): string {
	return 'Onay reddedildi';
}

function getApprovalRejectedDetail(): string {
	return 'Çalışma güven kararınla durduruldu. İstersen isteği değiştirip yeniden gönderebilirsin.';
}

function getFallbackDetail(
	runSummary: RunTransportSummary | undefined,
	approvalBlock: ApprovalBlock | null,
): string {
	if (approvalBlock?.payload.status === 'pending') {
		return 'Mevcut çalışma onay sınırında durdu. Devam etmeden önce istenen işlemi gözden geçir.';
	}

	if (runSummary?.final_state === 'COMPLETED') {
		return 'Mevcut çalışma tamamlandı. Son özet ve destek kartları aşağıda görünür kalır.';
	}

	if (runSummary?.final_state === 'FAILED') {
		return 'Mevcut çalışma başarısız oldu. Son görünür kartlar inceleme için aşağıda kalır.';
	}

	if (runSummary?.latest_runtime_state === 'TOOL_RESULT_INGESTING') {
		return 'Araç sonucu mevcut çalışma yüzeyine işleniyor.';
	}

	if (runSummary?.latest_runtime_state === 'TOOL_EXECUTING') {
		return 'Çalışma araçları çalıştırıyor. Adımlar tamamlandıkça yeni özetler güncellenecek.';
	}

	if (runSummary?.latest_runtime_state === 'MODEL_THINKING') {
		return 'Model sonraki adımı planlıyor. Yeni çıktı gelirken mevcut yüzey sabit kalır.';
	}

	if (runSummary?.has_accepted) {
		return 'İstek kabul edildi. Çalışma kaldığı yerden devam ediyor.';
	}

	return 'Mevcut çalışma burada birinci planda kalır.';
}

export function deriveCurrentRunProgressSurface(
	input: Readonly<{
		current_presentation_surface: PresentationRunSurface | null;
		current_run_feedback: RunFeedbackState | null;
		run_summary: RunTransportSummary | undefined;
	}>,
): CurrentRunProgressSurface | null {
	const runId = input.current_run_feedback?.run_id ?? input.current_presentation_surface?.run_id;

	if (!runId) {
		return null;
	}

	const timelineBlock = getTimelineBlock(input.current_presentation_surface);
	const approvalBlock = getLatestApprovalBlock(input.current_presentation_surface);
	const stepItems = timelineBlock?.payload.items ?? [];
	const visibleStepItems = stepItems.slice(-5);
	const blockCounts = countBlocksByType(input.current_presentation_surface);
	const stoppedByApprovalRejection = isStoppedByApprovalRejection(approvalBlock, stepItems);
	const correlationLabel = buildCorrelationLabel(
		runId,
		input.current_run_feedback?.trace_id ??
			input.current_presentation_surface?.trace_id ??
			input.run_summary?.trace_id,
	);
	const metaItems: RunStatusChipItem[] = [
		getRuntimeMetaItem(input.run_summary, input.current_run_feedback, approvalBlock, stepItems),
	];

	if (input.run_summary?.provider) {
		metaItems.unshift({
			label: 'Provider',
			tone: 'info',
			value: humanizeProvider(input.run_summary.provider),
		});
	}

	if (blockCounts.non_detail_count > 0) {
		metaItems.push({
			label: 'Blocks',
			tone: 'info',
			value: String(blockCounts.non_detail_count),
		});
	}

	if (blockCounts.detail_count > 0) {
		metaItems.push({
			label: 'Details',
			tone: 'info',
			value: String(blockCounts.detail_count),
		});
	}

	if (blockCounts.approval_count > 0) {
		metaItems.push({
			label: 'Approvals',
			tone: approvalBlock?.payload.status === 'pending' ? 'warning' : 'info',
			value: String(blockCounts.approval_count),
		});
	}

	return {
		approval_block: approvalBlock,
		correlation_label: correlationLabel,
		detail: stoppedByApprovalRejection
			? getApprovalRejectedDetail()
			: input.current_run_feedback?.detail ?? getFallbackDetail(input.run_summary, approvalBlock),
		headline: stoppedByApprovalRejection
			? getApprovalRejectedHeadline()
			: input.current_run_feedback?.title ?? getFallbackHeadline(input.run_summary),
		hidden_step_count: Math.max(stepItems.length - visibleStepItems.length, 0),
		meta_items: metaItems,
		phase_items: createPhaseItems({
			approval_block: approvalBlock,
			feedback: input.current_run_feedback,
			run_summary: input.run_summary,
			step_items: stepItems,
		}),
		run_id: runId,
		status_tone: getStatusTone(
			input.current_run_feedback,
			approvalBlock,
			input.run_summary,
			stepItems,
		),
		step_items: visibleStepItems,
	};
}
