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
			case 'text.delta': {
				const runSummary = ensureRunSummary(message.payload.run_id);
				runSummary.trace_id ??= message.payload.trace_id;
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
				? 'Son yüzey görünür kalır; böylece hata öncesinde tamamlanan kısmı görebilirsin.'
				: 'Bu başarısız çalışma için yeni bir görünür yüzey yok.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Çalışma hata ile bitti',
			tone: 'error',
			trace_id: traceId,
		};
	}

	if (input.pending_detail_count > 0) {
		return {
			chip_label: 'detail loading',
			detail:
				input.pending_detail_count === 1
					? 'İstenen detay kartı yanıt geldiğinde aynı akış içinde açılacak.'
					: 'İstenen detay kartları geldikçe aynı akış içinde açılacak.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title:
				input.pending_detail_count === 1
					? '1 detay kartı yükleniyor'
					: `${input.pending_detail_count} detay kartı yükleniyor`,
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
			detail: 'Sunucu isteği kabul etti. İlk görünür çıktı hazırlanıyor.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Çalışma kabul edildi',
			tone: 'info',
			trace_id: traceId,
		};
	}

	if (input.run_summary?.latest_runtime_state === 'WAITING_APPROVAL') {
		return {
			chip_label: 'approval',
			detail: 'Çalışma onay beklediği için duraklatıldı.',
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
				detail: 'Bu istekte presentation blocks kapalı olduğu için görünür yüzey üretilmiyor.',
				pending_detail_count: input.pending_detail_count,
				run_id: runId,
				title: 'Canli runtime acik, gorunur yuzey koprusu kapali',
				tone: 'warning',
				trace_id: traceId,
			};
		}

		return {
			chip_label: 'warming up',
			detail: 'Runtime başladı. İlk görünür yüzey hazır olduğunda burada belirecek.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'İlk özet kartları hazırlanıyor',
			tone: 'info',
			trace_id: traceId,
		};
	}

	if (input.run_summary?.latest_runtime_state === 'TOOL_EXECUTING') {
		return {
			chip_label: 'tools',
			detail: 'Çalışma sürüyor. Araçlar tamamlandıkça özet ve detaylar yenilenecek.',
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
			detail: 'Araç sonucu mevcut çalışma yüzeyine işleniyor.',
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
				: 'Model düşünüyor. İlk görünür çıktı hazır olduğunda burada belirecek.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: input.has_visible_surface
				? 'Model calismaya devam ediyor'
				: 'İlk görünür çıktı hazırlanıyor',
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
			detail: 'Çalışma sürerken yeni özet ve detaylar aynı akış içinde yerleşecek.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Canlı çalışma yüzeyi',
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
					: 'Çalışma tamamlandı ancak tutulmuş bir görünür yüzey oluşmadı.',
			pending_detail_count: input.pending_detail_count,
			run_id: runId,
			title: 'Çalışma tamamlandı',
			tone: 'success',
			trace_id: traceId,
		};
	}

	return null;
}
