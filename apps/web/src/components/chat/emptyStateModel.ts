export type EmptyStateSuggestionKind = 'code' | 'review' | 'research' | 'document';

export type EmptyStateSuggestion = Readonly<{
	kind: EmptyStateSuggestionKind;
	label: string;
	description: string;
	prompt: string;
}>;

export type EmptyStateContext = Readonly<{
	now?: Date;
	workingDirectory?: string | null;
	activeDeviceLabel?: string | null;
	conversationCount?: number;
}>;

export type EmptyStateModel = Readonly<{
	greeting: string;
	lead: string;
	contextLine: string | null;
	contextChips: readonly string[];
	suggestions: readonly EmptyStateSuggestion[];
}>;

const SUGGESTIONS: readonly EmptyStateSuggestion[] = [
	{
		kind: 'code',
		label: 'Kod işini güvenle ilerlet',
		description: 'İlgili dosyaları bul, değişikliği planla ve test kanıtıyla kapat.',
		prompt:
			'Bu kod işini güvenli şekilde ilerlet: önce ilgili dosyaları bul, kısa plan çıkar, değişikliği uygula, testleri çalıştır ve sonuçları raporla. Konu: ',
	},
	{
		kind: 'review',
		label: 'Bir hatayı araştır',
		description: 'Belirtiyi, olası nedeni ve kalıcı çözümü ayır.',
		prompt:
			'Bu hatayı kök nedenle incele: belirtileri ayır, ilgili dosyaları kontrol et, geçici çözüm yerine kalıcı düzeltme öner ve doğrulama planı çıkar. Hata: ',
	},
	{
		kind: 'research',
		label: 'Araştırma notu çıkar',
		description: 'Kaynakları ayır, çelişkileri belirt ve karar notu hazırla.',
		prompt:
			'Bu konuyu araştır ve karar notu hazırla: güvenilir kaynakları ayır, çelişkileri belirt, seçenekleri karşılaştır ve önerini net yaz. Konu: ',
	},
	{
		kind: 'document',
		label: 'Dokümanı netleştir',
		description: 'Taslağı hedefe, okuyucuya ve aksiyonlara göre düzenle.',
		prompt:
			'Bu metni net ve uygulanabilir hale getir: hedef okuyucuyu düşün, gereksiz tekrarları temizle, aksiyonları ayır ve profesyonel bir son sürüm öner. Metin: ',
	},
];

export function getGreeting(date?: Date): string {
	const hour = (date ?? new Date()).getHours();

	if (hour >= 5 && hour <= 11) {
		return 'Günaydın';
	}

	if (hour >= 12 && hour <= 17) {
		return 'İyi günler';
	}

	if (hour >= 18 && hour <= 22) {
		return 'İyi akşamlar';
	}

	return 'Geç oldu';
}

function getLastPathSegment(path: string): string {
	const normalized = path.replace(/[/\\]+$/, '');
	const separator = normalized.includes('\\') ? '\\' : '/';
	const segments = normalized.split(separator);
	return segments.at(-1) ?? path;
}

export function getProjectNameFromWorkingDirectory(
	workingDirectory: string | null | undefined,
): string | null {
	if (!workingDirectory || typeof workingDirectory !== 'string') {
		return null;
	}

	const trimmed = workingDirectory.trim();
	if (!trimmed) {
		return null;
	}

	if (trimmed.length > 500) {
		return null;
	}

	const lastSegment = getLastPathSegment(trimmed);
	if (!lastSegment || lastSegment.length > 128) {
		return null;
	}

	// Root paths and drive roots (D:, C: etc.) should not be shown as project names
	if (/^[a-zA-Z]:$/u.test(lastSegment)) {
		return null;
	}

	return lastSegment;
}

function buildContextLine(projectName: string | null, deviceLabel: string | null): string | null {
	const hasProject = projectName !== null;
	const hasDevice = deviceLabel !== null;

	if (hasProject && hasDevice) {
		return `${projectName} ve masaüstü cihazın hazır.`;
	}

	if (hasProject) {
		return `${projectName} üzerinde çalışmaya hazırım.`;
	}

	if (hasDevice) {
		return 'Masaüstü cihazın hazır.';
	}

	return null;
}

function buildContextChips(
	projectName: string | null,
	deviceLabel: string | null,
	conversationCount: number,
): readonly string[] {
	const chips: string[] = [];

	if (projectName !== null) {
		chips.push(`Proje: ${projectName}`);
	}

	if (deviceLabel !== null) {
		chips.push('Cihaz hazır');
	}

	if (conversationCount > 0) {
		chips.push(`${conversationCount} konuşma`);
	}

	return chips;
}

export function deriveEmptyStateModel(context?: EmptyStateContext): EmptyStateModel {
	const now = context?.now;
	const workingDirectory = context?.workingDirectory;
	const rawLabel = context?.activeDeviceLabel;
	const deviceLabel =
		rawLabel && typeof rawLabel === 'string' && rawLabel.trim().length > 0 ? rawLabel.trim() : null;
	const conversationCount = context?.conversationCount ?? 0;

	const projectName = getProjectNameFromWorkingDirectory(workingDirectory);
	const greeting = getGreeting(now);

	return {
		greeting,
		lead: 'Nereden başlayalım?',
		contextLine: buildContextLine(projectName, deviceLabel),
		contextChips: buildContextChips(projectName, deviceLabel, conversationCount),
		suggestions: SUGGESTIONS,
	};
}
