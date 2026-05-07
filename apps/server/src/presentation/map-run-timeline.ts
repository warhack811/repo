import type {
	AnyRuntimeEvent,
	ApprovalBlock,
	RenderBlock,
	RunTimelineBlock,
	RunTimelineBlockItem,
	ToolName,
	ToolResultBlock,
} from '@runa/types';

const MAX_TIMELINE_DETAIL_LENGTH = 160;
const MAX_TIMELINE_ITEMS = 10;
const RUN_TIMELINE_BLOCK_TITLE = 'Çalışma akışı';

interface MapRunTimelineInput {
	readonly blocks?: readonly RenderBlock[];
	readonly created_at: string;
	readonly events: readonly AnyRuntimeEvent[];
	readonly run_id?: string;
}

interface TimelineBlockCorrelations {
	readonly diff_summary?: string;
	readonly search_summary?: string;
}

interface TimelineItemCandidate {
	readonly item: RunTimelineBlockItem;
	readonly key: string;
}

type TimelineToolItem = RunTimelineBlockItem & {
	readonly kind: 'tool_completed' | 'tool_failed' | 'tool_requested';
};

type FailedTimelineToolItem = RunTimelineBlockItem & {
	readonly kind: 'tool_failed';
};

function getCandidateQuality(candidate: TimelineItemCandidate): number {
	return (
		(candidate.item.tool_name ? 4 : 0) +
		(candidate.item.call_id ? 2 : 0) +
		(candidate.item.detail ? Math.min(candidate.item.detail.length, 120) : 0)
	);
}

function normalizeText(value: string): string {
	return value.replace(/\s+/gu, ' ').trim();
}

function normalizeOptionalText(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}

	const normalizedValue = normalizeText(value);

	if (normalizedValue.length === 0) {
		return undefined;
	}

	return normalizedValue.length > MAX_TIMELINE_DETAIL_LENGTH
		? `${normalizedValue.slice(0, MAX_TIMELINE_DETAIL_LENGTH - 3)}...`
		: normalizedValue;
}

function capitalizeSentence(value: string): string {
	return value.length === 0
		? value
		: `${value.charAt(0).toLocaleUpperCase('tr-TR')}${value.slice(1)}`;
}

function createCandidate(
	key: string,
	item: RunTimelineBlockItem,
): TimelineItemCandidate | undefined {
	return item.label.length > 0 ? { item, key } : undefined;
}

function isTimelineToolItem(item: RunTimelineBlockItem | undefined): item is TimelineToolItem {
	return (
		item?.kind === 'tool_completed' ||
		item?.kind === 'tool_failed' ||
		item?.kind === 'tool_requested'
	);
}

function isFailedTimelineToolItem(item: RunTimelineBlockItem): item is FailedTimelineToolItem {
	return item.kind === 'tool_failed';
}

function buildTimelineBlockCorrelations(
	blocks: readonly RenderBlock[] | undefined,
): TimelineBlockCorrelations {
	let diffSummary: string | undefined;
	let searchSummary: string | undefined;

	for (const block of blocks ?? []) {
		if (block.type === 'diff_block') {
			diffSummary = normalizeOptionalText(block.payload.summary);
			continue;
		}

		if (block.type === 'search_result_block' || block.type === 'web_search_result_block') {
			searchSummary = normalizeOptionalText(block.payload.summary);
		}
	}

	return {
		diff_summary: diffSummary,
		search_summary: searchSummary,
	};
}

function getToolTimelineCopy(toolName: ToolName): Readonly<{
	readonly completed_label: string;
	readonly failed_label: string;
	readonly requested_label: string;
}> {
	switch (toolName) {
		case 'agent.delegate':
			return {
				completed_label: 'Alt görev tamamlandı',
				failed_label: 'Alt görev başlatılamadı',
				requested_label: 'Alt görev hazırlanıyor',
			};
		case 'browser.click':
			return {
				completed_label: 'Tarayıcıda tıklama yapıldı',
				failed_label: 'Tarayıcı tıklaması tamamlanamadı',
				requested_label: 'Tarayıcıda tıklama hazırlanıyor',
			};
		case 'browser.extract':
			return {
				completed_label: 'Sayfa bilgisi çıkarıldı',
				failed_label: 'Sayfa bilgisi çıkarılamadı',
				requested_label: 'Sayfa bilgisi okunuyor',
			};
		case 'browser.fill':
			return {
				completed_label: 'Tarayıcı formu dolduruldu',
				failed_label: 'Tarayıcı formu doldurulamadı',
				requested_label: 'Tarayıcı formu hazırlanıyor',
			};
		case 'browser.navigate':
			return {
				completed_label: 'Tarayıcı sayfası açıldı',
				failed_label: 'Tarayıcı sayfası açılamadı',
				requested_label: 'Tarayıcı sayfası açılıyor',
			};
		case 'desktop.click':
			return {
				completed_label: 'Masaüstünde tıklama yapıldı',
				failed_label: 'Masaüstü tıklaması tamamlanamadı',
				requested_label: 'Masaüstünde tıklama hazırlanıyor',
			};
		case 'desktop.clipboard.read':
			return {
				completed_label: 'Pano içeriği okundu',
				failed_label: 'Pano okunamadı',
				requested_label: 'Pano içeriği okunuyor',
			};
		case 'desktop.clipboard.write':
			return {
				completed_label: 'Pano güncellendi',
				failed_label: 'Pano güncellenemedi',
				requested_label: 'Pano güncellemesi hazırlanıyor',
			};
		case 'desktop.keypress':
			return {
				completed_label: 'Klavye kısayolu gönderildi',
				failed_label: 'Klavye kısayolu gönderilemedi',
				requested_label: 'Klavye kısayolu hazırlanıyor',
			};
		case 'desktop.launch':
			return {
				completed_label: 'Uygulama başlatıldı',
				failed_label: 'Uygulama başlatılamadı',
				requested_label: 'Uygulama başlatılıyor',
			};
		case 'desktop.scroll':
			return {
				completed_label: 'Masaüstünde kaydırma yapıldı',
				failed_label: 'Masaüstü kaydırması tamamlanamadı',
				requested_label: 'Masaüstünde kaydırma hazırlanıyor',
			};
		case 'desktop.screenshot':
			return {
				completed_label: 'Ekran görüntüsü alındı',
				failed_label: 'Ekran görüntüsü alınamadı',
				requested_label: 'Ekran görüntüsü isteniyor',
			};
		case 'desktop.type':
			return {
				completed_label: 'Masaüstüne metin yazıldı',
				failed_label: 'Masaüstüne metin yazılamadı',
				requested_label: 'Masaüstüne yazma hazırlanıyor',
			};
		case 'desktop.verify_state':
			return {
				completed_label: 'Masaüstü durumu doğrulandı',
				failed_label: 'Masaüstü durumu doğrulanamadı',
				requested_label: 'Masaüstü durumu kontrol ediliyor',
			};
		case 'desktop.vision_analyze':
			return {
				completed_label: 'Ekran görsel olarak incelendi',
				failed_label: 'Ekran görsel olarak incelenemedi',
				requested_label: 'Ekran görsel olarak inceleniyor',
			};
		case 'edit.patch':
			return {
				completed_label: 'Kod değişikliği hazırlandı',
				failed_label: 'Kod değişikliği hazırlanamadı',
				requested_label: 'Kod değişikliği hazırlanıyor',
			};
		case 'file.list':
			return {
				completed_label: 'Dosyalar listelendi',
				failed_label: 'Dosyalar listelenemedi',
				requested_label: 'Dosya listesi alınıyor',
			};
		case 'file.read':
			return {
				completed_label: 'Dosya okundu',
				failed_label: 'Dosya okunamadı',
				requested_label: 'Dosya okunuyor',
			};
		case 'file.write':
			return {
				completed_label: 'Dosya güncellendi',
				failed_label: 'Dosya güncellenemedi',
				requested_label: 'Dosya güncellemesi hazırlanıyor',
			};
		case 'file.share':
			return {
				completed_label: 'Dosya paylaşımı hazırlandı',
				failed_label: 'Dosya paylaşımı hazırlanamadı',
				requested_label: 'Dosya paylaşımı hazırlanıyor',
			};
		case 'file.watch':
			return {
				completed_label: 'Dosya takibi kuruldu',
				failed_label: 'Dosya takibi kurulamadı',
				requested_label: 'Dosya takibi hazırlanıyor',
			};
		case 'git.diff':
			return {
				completed_label: 'Değişiklikler incelendi',
				failed_label: 'Değişiklikler incelenemedi',
				requested_label: 'Değişiklikler inceleniyor',
			};
		case 'git.status':
			return {
				completed_label: 'Git durumu kontrol edildi',
				failed_label: 'Git durumu kontrol edilemedi',
				requested_label: 'Git durumu kontrol ediliyor',
			};
		case 'memory.delete':
			return {
				completed_label: 'Bellek kaydı silindi',
				failed_label: 'Bellek kaydı silinemedi',
				requested_label: 'Bellek silme adımı hazırlanıyor',
			};
		case 'memory.list':
			return {
				completed_label: 'Bellek kayıtları listelendi',
				failed_label: 'Bellek kayıtları listelenemedi',
				requested_label: 'Bellek kayıtları listeleniyor',
			};
		case 'memory.save':
			return {
				completed_label: 'Bilgi belleğe kaydedildi',
				failed_label: 'Bilgi belleğe kaydedilemedi',
				requested_label: 'Belleğe kaydetme hazırlanıyor',
			};
		case 'memory.search':
		case 'search.memory':
			return {
				completed_label: 'Bellekte arama yapıldı',
				failed_label: 'Bellek araması tamamlanamadı',
				requested_label: 'Bellekte arama yapılıyor',
			};
		case 'search.codebase':
			return {
				completed_label: 'Kod tabanında arama yapıldı',
				failed_label: 'Kod araması tamamlanamadı',
				requested_label: 'Kod tabanında arama yapılıyor',
			};
		case 'search.grep':
			return {
				completed_label: 'Dosyalarda arama yapıldı',
				failed_label: 'Dosya araması tamamlanamadı',
				requested_label: 'Dosyalarda arama yapılıyor',
			};
		case 'web.search':
			return {
				completed_label: 'Web araması yapıldı',
				failed_label: 'Web araması tamamlanamadı',
				requested_label: 'Web araması yapılıyor',
			};
		case 'shell.exec':
			return {
				completed_label: 'Terminal komutu çalıştı',
				failed_label: 'Terminal komutu tamamlanamadı',
				requested_label: 'Terminal komutu hazırlanıyor',
			};
		default:
			return {
				completed_label: `${toolName.replace(/\./gu, ' ')} tamamlandı`,
				failed_label: `${toolName.replace(/\./gu, ' ')} tamamlanamadı`,
				requested_label: `${toolName.replace(/\./gu, ' ')} hazırlanıyor`,
			};
	}
}

function getCorrelatedToolDetail(
	toolName: ToolName,
	correlations: TimelineBlockCorrelations,
	fallbackDetail?: string,
): string | undefined {
	if (
		(toolName === 'search.codebase' || toolName === 'web.search') &&
		correlations.search_summary
	) {
		return correlations.search_summary;
	}

	if (toolName === 'git.diff' && correlations.diff_summary) {
		return correlations.diff_summary;
	}

	return normalizeOptionalText(fallbackDetail);
}

function createToolTimelineCandidate(
	input: Readonly<{
		call_id: string;
		correlations: TimelineBlockCorrelations;
		detail?: string;
		kind: 'tool_completed' | 'tool_failed' | 'tool_requested';
		state: string;
		tool_name: ToolName;
	}>,
): TimelineItemCandidate | undefined {
	const timelineCopy = getToolTimelineCopy(input.tool_name);
	const label =
		input.kind === 'tool_requested'
			? timelineCopy.requested_label
			: input.kind === 'tool_completed'
				? timelineCopy.completed_label
				: timelineCopy.failed_label;

	return createCandidate(`${input.kind}:${input.call_id}`, {
		call_id: input.call_id,
		detail: getCorrelatedToolDetail(input.tool_name, input.correlations, input.detail),
		kind: input.kind,
		label,
		state: input.state,
		tool_name: input.tool_name,
	});
}

function buildApprovalLabel(status: string, toolName?: ToolName): string {
	const actionPhrase = toolName ? getToolSummaryPhrase(toolName) : 'işlem';

	if (!toolName) {
		return status === 'pending' ? 'Onay bekleniyor' : 'Onay kararı işlendi';
	}

	if (status === 'pending') {
		return capitalizeSentence(`${actionPhrase} için onay bekleniyor`);
	}

	if (status === 'approved') {
		return capitalizeSentence(`${actionPhrase} onaylandı`);
	}

	if (status === 'rejected') {
		return capitalizeSentence(`${actionPhrase} reddedildi`);
	}

	return capitalizeSentence(`${actionPhrase} onayı kapandı`);
}

function getToolSummaryPhrase(toolName: ToolName): string {
	switch (toolName) {
		case 'agent.delegate':
			return 'alt görev';
		case 'browser.click':
			return 'tarayıcı tıklaması';
		case 'browser.extract':
			return 'sayfa okuma';
		case 'browser.fill':
			return 'tarayıcı formu';
		case 'browser.navigate':
			return 'tarayıcı gezinmesi';
		case 'desktop.click':
			return 'masaüstü tıklaması';
		case 'desktop.clipboard.read':
			return 'pano okuma';
		case 'desktop.clipboard.write':
			return 'pano yazma';
		case 'desktop.keypress':
			return 'klavye kısayolu';
		case 'desktop.launch':
			return 'uygulama başlatma';
		case 'desktop.scroll':
			return 'masaüstü kaydırması';
		case 'desktop.screenshot':
			return 'ekran görüntüsü';
		case 'desktop.type':
			return 'masaüstüne yazma';
		case 'desktop.verify_state':
			return 'masaüstü doğrulaması';
		case 'desktop.vision_analyze':
			return 'ekran analizi';
		case 'edit.patch':
			return 'kod değişikliği';
		case 'file.list':
			return 'dosya listeleme';
		case 'file.read':
			return 'dosya okuma';
		case 'file.write':
			return 'dosya yazma';
		case 'file.share':
			return 'dosya paylaşımı';
		case 'file.watch':
			return 'dosya takibi';
		case 'git.diff':
			return 'değişiklik inceleme';
		case 'git.status':
			return 'git durum kontrolü';
		case 'memory.delete':
			return 'bellek silme';
		case 'memory.list':
			return 'bellek listeleme';
		case 'memory.save':
			return 'belleğe kaydetme';
		case 'memory.search':
		case 'search.memory':
			return 'bellek araması';
		case 'search.codebase':
			return 'kod araması';
		case 'search.grep':
			return 'dosya araması';
		case 'web.search':
			return 'web araması';
		case 'shell.exec':
			return 'terminal komutu';
		default:
			return toolName.replace(/\./gu, ' ');
	}
}

function getToolFailureSummaryPhrase(toolName: ToolName): string {
	switch (toolName) {
		case 'git.diff':
			return 'git diff';
		default:
			return getToolSummaryPhrase(toolName);
	}
}

function getSearchInspectionPhrase(
	items: readonly RunTimelineBlockItem[],
	blocks?: readonly RenderBlock[],
): string {
	const hasCodebaseSearch =
		items.some((item) => item.kind === 'tool_completed' && item.tool_name === 'search.codebase') ||
		(blocks ?? []).some((block) => block.type === 'search_result_block');
	const hasWebSearch =
		items.some((item) => item.kind === 'tool_completed' && item.tool_name === 'web.search') ||
		(blocks ?? []).some((block) => block.type === 'web_search_result_block');

	if (hasCodebaseSearch && hasWebSearch) {
		return 'kod araması ve web araması';
	}

	if (hasWebSearch) {
		return 'web araması';
	}

	return 'kod araması';
}

function getApprovalSummaryPhrase(
	status: 'approved' | 'pending' | 'rejected',
	toolName?: ToolName,
): string {
	const actionPhrase = toolName ? getToolSummaryPhrase(toolName) : 'approval';

	switch (status) {
		case 'pending':
			return toolName ? `${actionPhrase} için onay bekleyişi` : 'onay bekleyişi';
		case 'approved':
			return toolName ? `${actionPhrase} onayı` : 'onay kararı';
		case 'rejected':
			return toolName ? `${actionPhrase} reddi` : 'onay reddi';
	}
}

function getLatestToolItem(items: readonly RunTimelineBlockItem[]): TimelineToolItem | undefined {
	for (let index = items.length - 1; index >= 0; index -= 1) {
		const item = items[index];

		if (isTimelineToolItem(item)) {
			return item;
		}
	}

	return undefined;
}

function getApprovalToolName(
	items: readonly RunTimelineBlockItem[],
	status: 'approved' | 'pending' | 'rejected',
): ToolName | undefined {
	for (let index = items.length - 1; index >= 0; index -= 1) {
		const item = items[index];

		if (
			item?.kind === 'approval_requested' &&
			status === 'pending' &&
			typeof item.tool_name === 'string'
		) {
			return item.tool_name;
		}

		if (
			item?.kind === 'approval_resolved' &&
			item.state === status &&
			typeof item.tool_name === 'string'
		) {
			return item.tool_name;
		}
	}

	return undefined;
}

function mapRuntimeEventToTimelineCandidate(
	event: AnyRuntimeEvent,
	correlations: TimelineBlockCorrelations,
): TimelineItemCandidate | undefined {
	switch (event.event_type) {
		case 'run.started':
			return createCandidate('run_started', {
				kind: 'run_started',
				label: 'Runa işi başlattı',
			});
		case 'state.entered':
			return event.payload.state === 'MODEL_THINKING'
				? createCandidate('model_thinking', {
						kind: 'model_thinking',
						label: 'Runa sonraki adımı değerlendiriyor',
						state: 'active',
					})
				: undefined;
		case 'model.completed':
			return createCandidate('model_completed', {
				kind: 'model_completed',
				label: 'Sonraki adım belirlendi',
				state: 'completed',
			});
		case 'tool.call.started':
			return createToolTimelineCandidate({
				call_id: event.payload.call_id,
				correlations,
				kind: 'tool_requested',
				state: 'requested',
				tool_name: event.payload.tool_name,
			});
		case 'tool.call.completed':
			return createToolTimelineCandidate({
				call_id: event.payload.call_id,
				correlations,
				kind: event.payload.result_status === 'success' ? 'tool_completed' : 'tool_failed',
				state: event.payload.result_status,
				tool_name: event.payload.tool_name,
			});
		case 'tool.call.failed':
			return createToolTimelineCandidate({
				call_id: event.payload.call_id,
				correlations,
				detail: event.payload.error_message,
				kind: 'tool_failed',
				state: 'error',
				tool_name: event.payload.tool_name,
			});
		case 'approval.requested':
			return createCandidate(`approval_requested:${event.payload.approval_id}`, {
				call_id: event.payload.call_id,
				detail: normalizeOptionalText(event.payload.summary),
				kind: 'approval_requested',
				label: buildApprovalLabel('pending', event.payload.tool_name),
				state: 'pending',
				tool_name: event.payload.tool_name,
			});
		case 'approval.resolved':
			return createCandidate(`approval_resolved:${event.payload.approval_id}`, {
				detail: normalizeOptionalText(event.payload.note),
				kind: 'approval_resolved',
				label: buildApprovalLabel(event.payload.decision),
				state: event.payload.decision,
			});
		case 'run.completed':
			return createCandidate('assistant_completed', {
				kind: 'assistant_completed',
				label: 'Yanıt tamamlandı',
				state: 'completed',
			});
		case 'run.failed':
			return createCandidate('run_failed', {
				detail: normalizeOptionalText(event.payload.error_message),
				kind: 'run_failed',
				label: 'Çalışma tamamlanamadı',
				state: 'failed',
			});
		default:
			return undefined;
	}
}

function mapToolResultBlockToTimelineCandidate(
	block: ToolResultBlock,
	correlations: TimelineBlockCorrelations,
): TimelineItemCandidate | undefined {
	return createToolTimelineCandidate({
		call_id: block.payload.call_id,
		correlations,
		detail: block.payload.summary,
		kind: block.payload.status === 'success' ? 'tool_completed' : 'tool_failed',
		state: block.payload.status,
		tool_name: block.payload.tool_name,
	});
}

function mapApprovalBlockToTimelineCandidate(
	block: ApprovalBlock,
): TimelineItemCandidate | undefined {
	if (block.payload.status === 'pending') {
		return createCandidate(`approval_requested:${block.payload.approval_id}`, {
			call_id: block.payload.call_id,
			detail: normalizeOptionalText(block.payload.summary),
			kind: 'approval_requested',
			label: buildApprovalLabel('pending', block.payload.tool_name),
			state: 'pending',
			tool_name: block.payload.tool_name,
		});
	}

	return createCandidate(`approval_resolved:${block.payload.approval_id}`, {
		call_id: block.payload.call_id,
		detail: normalizeOptionalText(block.payload.note ?? block.payload.summary),
		kind: 'approval_resolved',
		label: buildApprovalLabel(block.payload.status, block.payload.tool_name),
		state: block.payload.status,
		tool_name: block.payload.tool_name,
	});
}

function collectTimelineCandidates(input: MapRunTimelineInput): readonly TimelineItemCandidate[] {
	const correlations = buildTimelineBlockCorrelations(input.blocks);
	const candidates: TimelineItemCandidate[] = [];
	const candidateIndexesByKey = new Map<string, number>();

	function upsertCandidate(candidate: TimelineItemCandidate | undefined): void {
		if (!candidate) {
			return;
		}

		const existingIndex = candidateIndexesByKey.get(candidate.key);

		if (existingIndex === undefined) {
			candidateIndexesByKey.set(candidate.key, candidates.length);
			candidates.push(candidate);
			return;
		}

		const existingCandidate = candidates[existingIndex];

		if (!existingCandidate) {
			candidateIndexesByKey.set(candidate.key, candidates.length);
			candidates.push(candidate);
			return;
		}

		if (getCandidateQuality(candidate) > getCandidateQuality(existingCandidate)) {
			candidates[existingIndex] = candidate;
		}
	}

	for (const event of input.events) {
		upsertCandidate(mapRuntimeEventToTimelineCandidate(event, correlations));
	}

	for (const block of input.blocks ?? []) {
		let candidate: TimelineItemCandidate | undefined;

		if (block.type === 'tool_result') {
			candidate = mapToolResultBlockToTimelineCandidate(block, correlations);
		} else if (block.type === 'approval_block') {
			candidate = mapApprovalBlockToTimelineCandidate(block);
		}

		upsertCandidate(candidate);
	}

	return candidates;
}

function dropRedundantToolRequestedCandidates(
	candidates: readonly TimelineItemCandidate[],
): readonly TimelineItemCandidate[] {
	const terminalToolCallIds = new Set(
		candidates
			.filter(
				(candidate) =>
					(candidate.item.kind === 'tool_completed' || candidate.item.kind === 'tool_failed') &&
					typeof candidate.item.call_id === 'string',
			)
			.map((candidate) => candidate.item.call_id as string),
	);

	return candidates.filter(
		(candidate) =>
			!(
				candidate.item.kind === 'tool_requested' &&
				candidate.item.call_id &&
				terminalToolCallIds.has(candidate.item.call_id)
			),
	);
}

function dropRedundantModelCompletedCandidates(
	candidates: readonly TimelineItemCandidate[],
): readonly TimelineItemCandidate[] {
	return candidates.filter((candidate, index, allCandidates) => {
		if (candidate.item.kind !== 'model_completed') {
			return true;
		}

		for (let nextIndex = index + 1; nextIndex < allCandidates.length; nextIndex += 1) {
			const nextCandidate = allCandidates[nextIndex];

			if (!nextCandidate || nextCandidate.item.kind === 'model_thinking') {
				continue;
			}

			return nextCandidate.item.kind !== 'assistant_completed';
		}

		return true;
	});
}

function dropLowSignalThinkingCandidates(
	candidates: readonly TimelineItemCandidate[],
): readonly TimelineItemCandidate[] {
	const hasHigherSignalItems = candidates.some(
		(candidate) =>
			candidate.item.kind === 'approval_requested' ||
			candidate.item.kind === 'approval_resolved' ||
			candidate.item.kind === 'assistant_completed' ||
			candidate.item.kind === 'run_failed' ||
			candidate.item.kind === 'tool_completed' ||
			candidate.item.kind === 'tool_failed',
	);

	if (!hasHigherSignalItems || candidates.length <= 3) {
		return candidates;
	}

	return candidates.filter((candidate) => candidate.item.kind !== 'model_thinking');
}

function collapseTimelineCandidates(
	candidates: readonly TimelineItemCandidate[],
): readonly TimelineItemCandidate[] {
	return dropRedundantModelCompletedCandidates(
		dropLowSignalThinkingCandidates(dropRedundantToolRequestedCandidates(candidates)),
	);
}

function selectVisibleCandidates(
	candidates: readonly TimelineItemCandidate[],
): readonly TimelineItemCandidate[] {
	if (candidates.length <= MAX_TIMELINE_ITEMS) {
		return candidates;
	}

	if (candidates[0]?.item.kind === 'run_started') {
		return [candidates[0], ...candidates.slice(-(MAX_TIMELINE_ITEMS - 1))];
	}

	return candidates.slice(-MAX_TIMELINE_ITEMS);
}

function hasPendingApproval(candidates: readonly TimelineItemCandidate[]): boolean {
	const requestedApprovalIds = new Set<string>();
	const resolvedApprovalIds = new Set<string>();

	for (const candidate of candidates) {
		if (candidate.key.startsWith('approval_requested:')) {
			requestedApprovalIds.add(candidate.key.slice('approval_requested:'.length));
		} else if (candidate.key.startsWith('approval_resolved:')) {
			resolvedApprovalIds.add(candidate.key.slice('approval_resolved:'.length));
		}
	}

	return [...requestedApprovalIds].some((approvalId) => !resolvedApprovalIds.has(approvalId));
}

function buildTimelineSummary(
	input: Readonly<{
		blocks?: readonly RenderBlock[];
		candidates: readonly TimelineItemCandidate[];
		visible_item_count: number;
	}>,
): string {
	const items = input.candidates.map((candidate) => candidate.item);
	const hasAssistantCompleted = items.some((item) => item.kind === 'assistant_completed');
	const hasRunFailed = items.some((item) => item.kind === 'run_failed');
	const hasToolActivity = items.some(
		(item) =>
			item.kind === 'tool_completed' ||
			item.kind === 'tool_failed' ||
			item.kind === 'tool_requested',
	);
	const hasToolFailure = items.some((item) => item.kind === 'tool_failed');
	const hasApprovedApproval = items.some(
		(item) => item.kind === 'approval_resolved' && item.state === 'approved',
	);
	const hasRejectedApproval = items.some(
		(item) => item.kind === 'approval_resolved' && item.state === 'rejected',
	);
	const pendingApprovalToolName = getApprovalToolName(items, 'pending');
	const approvedApprovalToolName = getApprovalToolName(items, 'approved');
	const rejectedApprovalToolName = getApprovalToolName(items, 'rejected');
	const hasSearchInspection =
		(input.blocks ?? []).some(
			(block) => block.type === 'search_result_block' || block.type === 'web_search_result_block',
		) ||
		items.some(
			(item) =>
				item.kind === 'tool_completed' &&
				(item.tool_name === 'search.codebase' || item.tool_name === 'web.search'),
		);
	const hasDiffInspection =
		(input.blocks ?? []).some((block) => block.type === 'diff_block') ||
		items.some((item) => item.kind === 'tool_completed' && item.tool_name === 'git.diff');
	const latestToolItem = getLatestToolItem(items);
	const latestToolPhrase = latestToolItem?.tool_name
		? getToolSummaryPhrase(latestToolItem.tool_name)
		: undefined;
	const searchInspectionPhrase = getSearchInspectionPhrase(items, input.blocks);
	const latestFailedToolItem = items
		.slice()
		.reverse()
		.find((item): item is FailedTimelineToolItem => isFailedTimelineToolItem(item));
	const latestFailedToolPhrase = latestFailedToolItem?.tool_name
		? getToolFailureSummaryPhrase(latestFailedToolItem.tool_name)
		: undefined;
	const genericToolSummary =
		latestToolPhrase && items.filter((item) => item.kind.startsWith('tool_')).length > 1
			? 'araç kullanımı'
			: latestToolPhrase;

	let summary: string;

	if (hasRunFailed) {
		summary = hasRejectedApproval
			? `Runa, çalışma durmadan önce ${getApprovalSummaryPhrase('rejected', rejectedApprovalToolName)} aldı.`
			: latestFailedToolPhrase
				? `Runa, çalışma durmadan önce ${latestFailedToolPhrase} adımında sorunla karşılaştı.`
				: hasToolFailure
					? 'Runa, çalışma durmadan önce bir araç adımında sorunla karşılaştı.'
					: 'Runa bu çalışmayı tamamlayamadı.';
	} else if (hasAssistantCompleted) {
		summary =
			hasSearchInspection && hasDiffInspection
				? `Runa ${searchInspectionPhrase} yaptı, değişiklikleri inceledi ve yanıtı tamamladı.`
				: hasApprovedApproval
					? hasToolActivity
						? latestToolPhrase
							? `Runa ${getApprovalSummaryPhrase('approved', approvedApprovalToolName)} aldı, ${latestToolPhrase} adımını tamamladı ve yanıtı bitirdi.`
							: 'Runa onaylı bir araç adımından sonra yanıtı tamamladı.'
						: `Runa ${getApprovalSummaryPhrase('approved', approvedApprovalToolName)} aldı ve yanıtı tamamladı.`
					: hasSearchInspection
						? `Runa ${searchInspectionPhrase} yaptı ve yanıtı tamamladı.`
						: hasDiffInspection
							? 'Runa değişiklikleri inceledi ve yanıtı tamamladı.'
							: genericToolSummary
								? `Runa ${genericToolSummary} adımını tamamladı ve yanıtı bitirdi.`
								: 'Runa yanıtı doğrudan tamamladı.';
	} else if (hasPendingApproval(input.candidates)) {
		summary =
			hasSearchInspection && hasDiffInspection
				? `Runa ${searchInspectionPhrase} yaptı, değişiklikleri inceledi ve şimdi ${getApprovalSummaryPhrase('pending', pendingApprovalToolName)} var.`
				: genericToolSummary
					? `Runa ${genericToolSummary} adımından sonra ${getApprovalSummaryPhrase('pending', pendingApprovalToolName)} durumunda.`
					: `Runa ${getApprovalSummaryPhrase('pending', pendingApprovalToolName)} durumunda.`;
	} else if (hasRejectedApproval) {
		summary = `Runa ${getApprovalSummaryPhrase('rejected', rejectedApprovalToolName)} aldı.`;
	} else if (hasApprovedApproval && hasToolActivity) {
		summary =
			hasSearchInspection && hasDiffInspection
				? `Runa ${searchInspectionPhrase} yaptı, değişiklikleri inceledi ve ${getApprovalSummaryPhrase('approved', approvedApprovalToolName)} aldı.`
				: genericToolSummary
					? `Runa ${genericToolSummary} adımını yürüttü ve ${getApprovalSummaryPhrase('approved', approvedApprovalToolName)} aldı.`
					: `Runa ${getApprovalSummaryPhrase('approved', approvedApprovalToolName)} aldı.`;
	} else if (hasApprovedApproval) {
		summary = `Runa ${getApprovalSummaryPhrase('approved', approvedApprovalToolName)} aldı.`;
	} else if (hasSearchInspection && hasDiffInspection) {
		summary = `Runa ${searchInspectionPhrase} yaptı ve değişiklikleri inceledi.`;
	} else if (hasSearchInspection) {
		summary = `Runa ${searchInspectionPhrase} yaptı.`;
	} else if (hasDiffInspection) {
		summary = 'Runa değişiklikleri inceledi.';
	} else if (genericToolSummary) {
		summary = `Runa ${genericToolSummary} adımını yürüttü.`;
	} else {
		summary = 'Runa çalışmayı hazırlıyor.';
	}

	return input.candidates.length > input.visible_item_count
		? `${summary} Son ${input.visible_item_count}/${input.candidates.length} adım gösteriliyor.`
		: summary;
}

export function mapRunTimelineToBlock(input: MapRunTimelineInput): RunTimelineBlock | undefined {
	const collapsedCandidates = collapseTimelineCandidates(collectTimelineCandidates(input));

	if (collapsedCandidates.length === 0) {
		return undefined;
	}

	const visibleCandidates = selectVisibleCandidates(collapsedCandidates);
	const idSuffix = input.run_id ?? input.created_at;

	return {
		created_at: input.created_at,
		id: `run_timeline_block:${idSuffix}`,
		payload: {
			items: visibleCandidates.map((candidate) => candidate.item),
			summary: buildTimelineSummary({
				blocks: input.blocks,
				candidates: collapsedCandidates,
				visible_item_count: visibleCandidates.length,
			}),
			title: RUN_TIMELINE_BLOCK_TITLE,
		},
		schema_version: 1,
		type: 'run_timeline_block',
	};
}
