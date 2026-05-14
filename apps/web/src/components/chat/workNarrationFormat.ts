const workToolLabels = new Map<string, string>([
	['agent.delegate', 'Alt gÃ¶rev'],
	['browser.click', 'TarayÄ±cÄ± tÄ±klamasÄ±'],
	['browser.extract', 'Sayfa okuma'],
	['browser.fill', 'Form doldurma'],
	['browser.navigate', 'TarayÄ±cÄ± gezintisi'],
	['desktop.click', 'MasaÃ¼stÃ¼ tÄ±klamasÄ±'],
	['desktop.clipboard.read', 'Pano okuma'],
	['desktop.clipboard.write', 'Pano yazma'],
	['desktop.keypress', 'Klavye kÄ±sayolu'],
	['desktop.launch', 'Uygulama baÅŸlatma'],
	['desktop.scroll', 'MasaÃ¼stÃ¼ kaydÄ±rma'],
	['desktop.screenshot', 'Ekran gÃ¶rÃ¼ntÃ¼sÃ¼'],
	['desktop.type', 'MasaÃ¼stÃ¼ne yazma'],
	['desktop.verify_state', 'MasaÃ¼stÃ¼ doÄŸrulama'],
	['desktop.vision_analyze', 'Ekran analizi'],
	['edit.patch', 'Kod deÄŸiÅŸikliÄŸi'],
	['file.list', 'Dosya listeleme'],
	['file.read', 'Dosya okuma'],
	['file.write', 'Dosya yazma'],
	['file.share', 'Dosya paylaÅŸÄ±mÄ±'],
	['file.watch', 'Dosya takibi'],
	['git.diff', 'DeÄŸiÅŸiklik inceleme'],
	['git.status', 'Git durum kontrolÃ¼'],
	['memory.delete', 'Bellek silme'],
	['memory.list', 'Bellek listeleme'],
	['memory.save', 'BelleÄŸe kaydetme'],
	['memory.search', 'Bellek aramasÄ±'],
	['search.codebase', 'Kod arama'],
	['search.grep', 'Dosya arama'],
	['search.memory', 'Bellek aramasÄ±'],
	['shell.exec', 'Terminal komutu'],
	['web.search', 'Web arama'],
]);

const timelineLabelOverrides = new Map<string, string>([
	['Run started', 'Runa iÅŸi baÅŸlattÄ±'],
	['Model planned the next step', 'Sonraki adÄ±m belirlendi'],
	['Model is thinking', 'Runa sonraki adÄ±mÄ± deÄŸerlendiriyor'],
	['Assistant finished the turn', 'YanÄ±t tamamlandÄ±'],
	['Run failed', 'Ã‡alÄ±ÅŸma tamamlanamadÄ±'],
	['Approval requested for desktop.screenshot', 'Ekran gÃ¶rÃ¼ntÃ¼sÃ¼ iÃ§in onay bekleniyor'],
	['Approval requested for file.write', 'Dosya yazma iÃ§in onay bekleniyor'],
	['Approval requested for file.read', 'Dosya okuma iÃ§in onay bekleniyor'],
]);

const knownDetailTranslations = new Map<string, string>([
	[
		'Captures a screenshot of the server host desktop and returns the image as base64-encoded PNG data.',
		'Ekrandaki gÃ¶rÃ¼nÃ¼r bilgileri yakalamak iÃ§in ekran gÃ¶rÃ¼ntÃ¼sÃ¼ alÄ±nÄ±r.',
	],
	[
		'Reads text from the connected desktop agent clipboard through an approval-gated bridge, returning a bounded redaction-aware payload.',
		'BaÄŸlÄ± masaÃ¼stÃ¼ panosundaki metin gÃ¼venli sÄ±nÄ±rlar iÃ§inde okunur.',
	],
	[
		'Writes text to the connected desktop agent clipboard through an approval-gated bridge.',
		'BaÄŸlÄ± masaÃ¼stÃ¼ panosuna metin yazÄ±lÄ±r.',
	],
	[
		'Writes text to the connected desktop agent clipboard through an explicit approval-gated bridge path.',
		'BaÄŸlÄ± masaÃ¼stÃ¼ panosuna metin yazÄ±lÄ±r.',
	],
]);

const englishLeakPattern =
	/\b(exe(?:c(?:ute)?s?)|subproc(?:ess)?|arg(?:v)|captured|redaction|truncated)\b/iu;

export function formatWorkToolLabel(toolName: string): string {
	return workToolLabels.get(toolName) ?? toolName.replace(/\./gu, ' ');
}

export function formatWorkDetail(detail: string | undefined): string | null {
	if (!detail) {
		return null;
	}

	const normalizedDetail = detail.trim();

	if (normalizedDetail.length === 0) {
		return null;
	}

	const knownTranslation = knownDetailTranslations.get(normalizedDetail);

	if (knownTranslation) {
		return knownTranslation;
	}

	let formattedDetail = normalizedDetail;

	for (const [technicalLabel, friendlyLabel] of workToolLabels) {
		formattedDetail = formattedDetail.replaceAll(technicalLabel, friendlyLabel);
	}

	formattedDetail = formattedDetail
		.replaceAll('deepseek / deepseek-v4-pro', 'DeepSeek V4 Pro')
		.replaceAll('Approval rejected for ', 'Onay reddedildi: ')
		.replaceAll('completed successfully.', 'tamamlandÄ±.')
		.replaceAll('failed.', 'tamamlanamadÄ±.');

	if (englishLeakPattern.test(formattedDetail)) {
		return null;
	}

	return formattedDetail === normalizedDetail ? null : formattedDetail;
}

export function formatWorkTimelineLabel(label: string): string {
	return timelineLabelOverrides.get(label) ?? formatWorkDetail(label) ?? 'Ã‡alÄ±ÅŸma adÄ±mÄ±';
}

export function formatWorkSummary(summary: string): string {
	if (summary === 'Timeline shows approval wait for desktop screenshot.') {
		return 'Runa ekran gÃ¶rÃ¼ntÃ¼sÃ¼ iÃ§in onay bekliyor.';
	}

	if (summary === 'Timeline shows a direct assistant completion.') {
		return 'Runa yanÄ±tÄ± doÄŸrudan tamamladÄ±.';
	}

	const formattedSummary = formatWorkDetail(summary);

	if (!formattedSummary) {
		return 'Runa Ã§alÄ±ÅŸma adÄ±mlarÄ±nÄ± sÃ¼rdÃ¼rÃ¼yor.';
	}

	return formattedSummary
		.replaceAll('Timeline shows ', 'Runa ')
		.replaceAll(' before assistant completion.', ' yaptÄ± ve yanÄ±tÄ± tamamladÄ±.')
		.replaceAll(' before run failure.', ' adÄ±mÄ±nda sorunla karÅŸÄ±laÅŸtÄ±.')
		.replaceAll('approval wait for ', 'onay bekliyor: ')
		.replaceAll('public web search', 'web aramasÄ±')
		.replaceAll('codebase search', 'kod aramasÄ±')
		.replaceAll('git diff inspection', 'deÄŸiÅŸiklik inceleme')
		.replaceAll('assistant completion', 'yanÄ±t tamamlama')
		.replaceAll('file write', 'dosya yazma')
		.replaceAll('desktop screenshot', 'ekran gÃ¶rÃ¼ntÃ¼sÃ¼');
}

export function formatWorkStateLabel(state: string | undefined): string {
	switch (state) {
		case 'active':
		case 'info':
			return 'sÃ¼rÃ¼yor';
		case 'approved':
			return 'onaylandÄ±';
		case 'completed':
		case 'success':
			return 'tamamlandÄ±';
		case 'error':
		case 'failed':
			return 'hata';
		case 'neutral':
			return 'hazÄ±r';
		case 'pending':
		case 'paused':
		case 'warning':
			return 'bekliyor';
		case 'rejected':
			return 'reddedildi';
		case 'requested':
			return 'isteniyor';
		default:
			return state ?? 'hazÄ±r';
	}
}
