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
			detail: 'Calisma kabul edildi; ilk gorunur yuzey hazirlaniyor.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Calisma hazirlaniyor',
			tone: 'info',
		};
	}

	if (input.run_summary.final_state === 'FAILED') {
		return {
			chip_label: 'failed',
			detail: 'Bu calisma tamamlanamadi. En son gorunur kartlar korunuyor.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Calisma durdu',
			tone: 'error',
			trace_id: input.run_summary.trace_id,
		};
	}

	if (input.run_summary.final_state === 'COMPLETED') {
		return {
			chip_label: 'completed',
			detail: input.has_visible_surface
				? 'Calisma tamamlandi. Son kartlar ve detaylar burada sabit kaldi.'
				: 'Calisma tamamlandi.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Calisma tamamlandi',
			tone: 'success',
			trace_id: input.run_summary.trace_id,
		};
	}

	return {
		chip_label: input.include_presentation_blocks ? 'live' : 'thinking',
		detail: input.has_visible_surface
			? 'Runa mevcut kartlari guncellerken akisi ayni yerde tutuyor.'
			: 'Runa dusunuyor ve ilk yuzeyi hazirliyor.',
		pending_detail_count: input.pending_detail_count,
		run_id: runId,
		title: 'Calisma suruyor',
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
		return { label: 'FAILED', tone: 'error' };
	}

	if (runSummary.final_state === 'COMPLETED') {
		return { label: 'COMPLETED', tone: 'success' };
	}

	if (runSummary.latest_runtime_state === 'WAITING_APPROVAL') {
		return { label: 'WAITING APPROVAL', tone: 'warning' };
	}

	if (runSummary.last_runtime_event_type === 'model.completed') {
		return { label: 'MODEL COMPLETED', tone: 'info' };
	}

	return runSummary.has_presentation_blocks ? { label: 'LIVE', tone: 'info' } : null;
}

export function isRunFinishedMessage(
	message: WebSocketServerBridgeMessage,
): message is RunFinishedServerMessage {
	return message.type === 'run.finished';
}
