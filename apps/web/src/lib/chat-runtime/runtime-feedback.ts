import type { GatewayProvider, WebSocketServerBridgeMessage } from '../../ws-types.js';
import type { RunFeedbackState, RunTransportSummary, RuntimeEventType } from './types.js';

interface MutableRunTransportSummary {
	final_state?: RunTransportSummary['final_state'];
	has_accepted: boolean;
	has_presentation_blocks: boolean;
	has_runtime_event: boolean;
	latest_runtime_state?: string;
	last_runtime_event_type?: RuntimeEventType;
	provider?: GatewayProvider;
	run_id: string;
	trace_id?: string;
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
				runSummary.trace_id ??= message.payload.trace_id;

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
			case 'presentation.blocks': {
				const runSummary = ensureRunSummary(message.payload.run_id);
				runSummary.has_presentation_blocks = true;
				runSummary.trace_id ??= message.payload.trace_id;
				break;
			}
			case 'run.finished': {
				const runSummary = ensureRunSummary(message.payload.run_id);
				runSummary.final_state = message.payload.final_state;
				runSummary.trace_id ??= message.payload.trace_id;
				break;
			}
			case 'run.rejected': {
				if (!message.payload.run_id) {
					break;
				}

				const runSummary = ensureRunSummary(message.payload.run_id);
				runSummary.final_state = 'FAILED';

				if (message.payload.trace_id) {
					runSummary.trace_id ??= message.payload.trace_id;
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

	const traceId = input.run_summary?.trace_id;

	if (input.run_summary?.final_state === 'FAILED') {
		return {
			chip_label: 'failed',
			detail: input.has_visible_surface
				? 'Son yuzey gorunur kalir; boylece hata oncesinde tamamlanan kismi gorebilirsin.'
				: 'Bu basarisiz calisma icin yeni bir gorunur yuzey yok.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Calisma hata ile bitti',
			tone: 'error',
			trace_id: traceId,
		};
	}

	if (input.pending_detail_count > 0) {
		return {
			chip_label: 'detail loading',
			detail:
				input.pending_detail_count === 1
					? 'Istenen detay karti yanit geldiginde ayni akis icinde acilacak.'
					: 'Istenen detay kartlari geldikce ayni akis icinde acilacak.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title:
				input.pending_detail_count === 1
					? '1 detay karti yukleniyor'
					: `${input.pending_detail_count} detay karti yukleniyor`,
			tone: 'info',
			trace_id: traceId,
		};
	}

	if (input.is_submitting && !input.run_summary?.has_accepted) {
		return {
			chip_label: 'sending',
			detail: 'Istek gonderiliyor ve sunucunun kabul etmesi bekleniyor.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Istek gonderiliyor',
			tone: 'info',
			trace_id: traceId,
		};
	}

	if (input.run_summary?.has_accepted && !input.run_summary.has_runtime_event) {
		return {
			chip_label: 'accepted',
			detail: 'Sunucu istegi kabul etti. Ilk gorunur cikti hazirlaniyor.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Calisma kabul edildi',
			tone: 'info',
			trace_id: traceId,
		};
	}

	if (input.run_summary?.latest_runtime_state === 'WAITING_APPROVAL') {
		return {
			chip_label: 'approval',
			detail: 'Calisma onay bekledigi icin duraklatildi.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Onay bekleniyor',
			tone: 'warning',
			trace_id: traceId,
		};
	}

	if (!input.has_visible_surface && input.run_summary?.has_runtime_event) {
		if (input.include_presentation_blocks === false) {
			return {
				chip_label: 'bridge off',
				detail: 'Bu istekte presentation blocks kapali oldugu icin gorunur yuzey uretilmiyor.',
				pending_detail_count: input.pending_detail_count,
				run_id: runId,
				title: 'Canli runtime acik, gorunur yuzey koprusu kapali',
				tone: 'warning',
				trace_id: traceId,
			};
		}

		return {
			chip_label: 'warming up',
			detail: 'Runtime basladi. Ilk gorunur yuzey hazir oldugunda burada belirecek.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Ilk ozet kartlari hazirlaniyor',
			tone: 'info',
			trace_id: traceId,
		};
	}

	if (input.run_summary?.latest_runtime_state === 'TOOL_EXECUTING') {
		return {
			chip_label: 'tools',
			detail: 'Calisma suruyor. Araclar tamamlandikca ozet ve detaylar yenilenecek.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Araclar calisiyor',
			tone: 'info',
			trace_id: traceId,
		};
	}

	if (input.run_summary?.latest_runtime_state === 'TOOL_RESULT_INGESTING') {
		return {
			chip_label: 'refreshing',
			detail: 'Arac sonucu mevcut calisma yuzeyine isleniyor.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Ozetler yenileniyor',
			tone: 'info',
			trace_id: traceId,
		};
	}

	if (input.run_summary?.latest_runtime_state === 'MODEL_THINKING') {
		return {
			chip_label: 'thinking',
			detail: input.has_visible_surface
				? 'Mevcut calisma sabit kalirken model yeni cikti uretmeye devam ediyor.'
				: 'Model dusunuyor. Ilk gorunur cikti hazir oldugunda burada belirecek.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: input.has_visible_surface
				? 'Model calismaya devam ediyor'
				: 'Ilk gorunur cikti hazirlaniyor',
			tone: 'info',
			trace_id: traceId,
		};
	}

	if (
		input.has_visible_surface &&
		input.run_summary &&
		input.run_summary.final_state === undefined &&
		(input.run_summary.has_presentation_blocks || input.run_summary.has_runtime_event)
	) {
		return {
			chip_label: 'live',
			detail: 'Calisma surerken yeni ozet ve detaylar ayni akis icinde yerlesecek.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Canli calisma yuzeyi',
			tone: 'info',
			trace_id: traceId,
		};
	}

	if (input.run_summary?.final_state === 'COMPLETED' && !input.has_visible_surface) {
		return {
			chip_label: 'complete',
			detail:
				input.include_presentation_blocks === false
					? 'Bu istek gorunur yuzey koprusu olmadan tamamlandi.'
					: 'Calisma tamamlandi ancak tutulmus bir gorunur yuzey olusmadi.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Calisma tamamlandi',
			tone: 'success',
			trace_id: traceId,
		};
	}

	return null;
}
