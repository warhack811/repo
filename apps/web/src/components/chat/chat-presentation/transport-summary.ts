import type { RunFeedbackState, RunTransportSummary } from '../../../lib/chat-runtime/types.js';
import type {
	RunFinishedServerMessage,
	RuntimeEventServerMessage,
	WebSocketServerBridgeMessage,
} from '../../../ws-types.js';
import type { MutableRunTransportSummary, StatusChipDescriptor } from './types.js';

function ensureRunSummary(
	runSummaries: Map<string, MutableRunTransportSummary>,
	runId: string,
): MutableRunTransportSummary {
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

function applyRuntimeEvent(
	runSummary: MutableRunTransportSummary,
	runtimeEvent: RuntimeEventServerMessage['payload']['event'],
): void {
	runSummary.has_runtime_event = true;
	runSummary.last_runtime_event_type = runtimeEvent.event_type;

	if (runtimeEvent.event_type === 'state.entered') {
		runSummary.latest_runtime_state = runtimeEvent.payload.state;
	}

	if (runtimeEvent.event_type === 'run.completed') {
		runSummary.final_state = 'COMPLETED';
	}

	if (runtimeEvent.event_type === 'run.failed') {
		runSummary.final_state = 'FAILED';
	}
}

export function buildRunTransportSummaryMap(
	messages: readonly WebSocketServerBridgeMessage[],
): ReadonlyMap<string, RunTransportSummary> {
	const runSummaries = new Map<string, MutableRunTransportSummary>();

	for (const message of messages) {
		switch (message.type) {
			case 'connection.ready':
				break;
			case 'run.accepted': {
				const runSummary = ensureRunSummary(runSummaries, message.payload.run_id);
				runSummary.has_accepted = true;
				runSummary.provider = message.payload.provider;
				runSummary.trace_id = message.payload.trace_id;
				break;
			}
			case 'runtime.event': {
				const runSummary = ensureRunSummary(runSummaries, message.payload.run_id);
				applyRuntimeEvent(runSummary, message.payload.event);
				runSummary.trace_id = message.payload.trace_id ?? runSummary.trace_id;
				break;
			}
			case 'text.delta': {
				const runSummary = ensureRunSummary(runSummaries, message.payload.run_id);
				runSummary.trace_id = message.payload.trace_id ?? runSummary.trace_id;
				break;
			}
			case 'presentation.blocks': {
				const runSummary = ensureRunSummary(runSummaries, message.payload.run_id);
				runSummary.has_presentation_blocks = true;
				runSummary.trace_id = message.payload.trace_id ?? runSummary.trace_id;
				break;
			}
			case 'run.finished': {
				const runSummary = ensureRunSummary(runSummaries, message.payload.run_id);
				runSummary.final_state = message.payload.final_state;
				runSummary.trace_id = message.payload.trace_id ?? runSummary.trace_id;
				break;
			}
			case 'run.rejected': {
				if (!message.payload.run_id) {
					break;
				}

				const runSummary = ensureRunSummary(runSummaries, message.payload.run_id);
				runSummary.final_state = 'FAILED';
				runSummary.trace_id = message.payload.trace_id ?? runSummary.trace_id;
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
			chip_label: 'gönderiliyor',
			detail: 'İstek canlı çalışma hattına iletiliyor.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'İstek gönderiliyor',
			tone: 'info',
			trace_id: input.run_summary?.trace_id,
		};
	}

	if (!input.run_summary) {
		return {
			chip_label: 'hazırlanıyor',
			detail: 'Çalışma kabul edildi; ilk yanıt hazırlanıyor.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Çalışma hazırlanıyor',
			tone: 'info',
		};
	}

	if (input.run_summary.final_state === 'FAILED') {
		return {
			chip_label: 'durdu',
			detail: 'Bu çalışma tamamlanamadı. Son görünür sonuçlar korunur.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Çalışma durdu',
			tone: 'error',
			trace_id: input.run_summary.trace_id,
		};
	}

	if (input.run_summary.final_state === 'COMPLETED') {
		return {
			chip_label: 'tamamlandı',
			detail: input.has_visible_surface
				? 'Çalışma tamamlandı. Son sonuçlar hazır.'
				: 'Çalışma tamamlandı.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Çalışma tamamlandı',
			tone: 'success',
			trace_id: input.run_summary.trace_id,
		};
	}

	return {
		chip_label: input.include_presentation_blocks ? 'canlı' : 'düşünüyor',
		detail: input.has_visible_surface
			? 'Sonuçlar güncellenirken akış korunuyor.'
			: 'İlk yanıt hazırlanıyor.',
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
		return { label: 'Durdu', tone: 'error' };
	}

	if (runSummary.final_state === 'COMPLETED') {
		return { label: 'Tamamlandı', tone: 'success' };
	}

	if (runSummary.latest_runtime_state === 'WAITING_APPROVAL') {
		return { label: 'Onay bekliyor', tone: 'warning' };
	}

	if (runSummary.last_runtime_event_type === 'model.completed') {
		return { label: 'Yanıt hazır', tone: 'info' };
	}

	return runSummary.has_presentation_blocks ? { label: 'Canlı', tone: 'info' } : null;
}

export function isRunFinishedMessage(
	message: WebSocketServerBridgeMessage,
): message is RunFinishedServerMessage {
	return message.type === 'run.finished';
}
