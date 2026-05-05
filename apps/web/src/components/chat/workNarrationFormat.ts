const workToolLabels = new Map<string, string>([
	['agent.delegate', 'Alt görev'],
	['browser.click', 'Tarayıcı tıklaması'],
	['browser.extract', 'Sayfa okuma'],
	['browser.fill', 'Form doldurma'],
	['browser.navigate', 'Tarayıcı gezintisi'],
	['desktop.click', 'Masaüstü tıklaması'],
	['desktop.clipboard.read', 'Pano okuma'],
	['desktop.clipboard.write', 'Pano yazma'],
	['desktop.keypress', 'Klavye kısayolu'],
	['desktop.launch', 'Uygulama başlatma'],
	['desktop.scroll', 'Masaüstü kaydırma'],
	['desktop.screenshot', 'Ekran görüntüsü'],
	['desktop.type', 'Masaüstüne yazma'],
	['desktop.verify_state', 'Masaüstü doğrulama'],
	['desktop.vision_analyze', 'Ekran analizi'],
	['edit.patch', 'Kod değişikliği'],
	['file.list', 'Dosya listeleme'],
	['file.read', 'Dosya okuma'],
	['file.write', 'Dosya yazma'],
	['file.share', 'Dosya paylaşımı'],
	['file.watch', 'Dosya takibi'],
	['git.diff', 'Değişiklik inceleme'],
	['git.status', 'Git durum kontrolü'],
	['memory.delete', 'Bellek silme'],
	['memory.list', 'Bellek listeleme'],
	['memory.save', 'Belleğe kaydetme'],
	['memory.search', 'Bellek araması'],
	['search.codebase', 'Kod arama'],
	['search.grep', 'Dosya arama'],
	['search.memory', 'Bellek araması'],
	['shell.exec', 'Terminal komutu'],
	['web.search', 'Web arama'],
]);

const timelineLabelOverrides = new Map<string, string>([
	['Run started', 'Runa işi başlattı'],
	['Model planned the next step', 'Sonraki adım belirlendi'],
	['Model is thinking', 'Runa sonraki adımı değerlendiriyor'],
	['Assistant finished the turn', 'Yanıt tamamlandı'],
	['Run failed', 'Çalışma tamamlanamadı'],
	['Approval requested for desktop.screenshot', 'Ekran görüntüsü için onay bekleniyor'],
	['Approval requested for file.write', 'Dosya yazma için onay bekleniyor'],
	['Approval requested for file.read', 'Dosya okuma için onay bekleniyor'],
]);

export function formatWorkToolLabel(toolName: string): string {
	return workToolLabels.get(toolName) ?? toolName.replace(/\./gu, ' ');
}

export function formatWorkDetail(detail: string | undefined): string | undefined {
	if (!detail) {
		return undefined;
	}

	let formattedDetail = detail;

	for (const [technicalLabel, friendlyLabel] of workToolLabels) {
		formattedDetail = formattedDetail.replaceAll(technicalLabel, friendlyLabel);
	}

	return formattedDetail
		.replaceAll(
			'Captures a screenshot of the server host desktop and returns the image as base64-encoded PNG data.',
			'Ekrandaki görünür bilgileri yakalamak için ekran görüntüsü alınır.',
		)
		.replaceAll(
			'Reads text from the connected desktop agent clipboard through an approval-gated bridge, returning a bounded redaction-aware payload.',
			'Bağlı masaüstü panosundaki metin güvenli sınırlar içinde okunur.',
		)
		.replaceAll(
			'Writes text to the connected desktop agent clipboard through an approval-gated bridge.',
			'Bağlı masaüstü panosuna metin yazılır.',
		)
		.replaceAll('deepseek / deepseek-v4-pro', 'DeepSeek V4 Pro')
		.replaceAll('Approval rejected for ', 'Onay reddedildi: ')
		.replaceAll('completed successfully.', 'tamamlandı.')
		.replaceAll('failed.', 'tamamlanamadı.');
}

export function formatWorkTimelineLabel(label: string): string {
	return timelineLabelOverrides.get(label) ?? formatWorkDetail(label) ?? label;
}

export function formatWorkSummary(summary: string): string {
	if (summary === 'Timeline shows approval wait for desktop screenshot.') {
		return 'Runa ekran görüntüsü için onay bekliyor.';
	}

	if (summary === 'Timeline shows a direct assistant completion.') {
		return 'Runa yanıtı doğrudan tamamladı.';
	}

	return (
		formatWorkDetail(summary)
			?.replaceAll('Timeline shows ', 'Runa ')
			.replaceAll(' before assistant completion.', ' yaptı ve yanıtı tamamladı.')
			.replaceAll(' before run failure.', ' adımında sorunla karşılaştı.')
			.replaceAll('approval wait for ', 'onay bekliyor: ')
			.replaceAll('public web search', 'web araması')
			.replaceAll('codebase search', 'kod araması')
			.replaceAll('git diff inspection', 'değişiklik inceleme')
			.replaceAll('assistant completion', 'yanıt tamamlama')
			.replaceAll('file write', 'dosya yazma')
			.replaceAll('desktop screenshot', 'ekran görüntüsü') ?? summary
	);
}

export function formatWorkStateLabel(state: string | undefined): string {
	switch (state) {
		case 'active':
		case 'info':
			return 'sürüyor';
		case 'approved':
			return 'onaylandı';
		case 'completed':
		case 'success':
			return 'tamamlandı';
		case 'error':
		case 'failed':
			return 'hata';
		case 'neutral':
			return 'hazır';
		case 'pending':
		case 'paused':
		case 'warning':
			return 'bekliyor';
		case 'rejected':
			return 'reddedildi';
		case 'requested':
			return 'isteniyor';
		default:
			return state ?? 'hazır';
	}
}
