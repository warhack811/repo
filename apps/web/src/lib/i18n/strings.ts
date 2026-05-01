export const uiText = {
	code: {
		copy: 'Kopyala',
		copied: 'Kopyalandı',
		copyFailed: 'Kopyalama başarısız',
		highlighting: 'Vurgulama yükleniyor...',
		highlightingFailed: (language: string) => `${language} vurgulama başarısız`,
	},
	evidence: {
		noReliableSourcesFound: 'Güvenilir kaynak bulunamadı',
		results: (count: number) => `${count} sonuç`,
		searches: (count: number) => `${count} arama`,
		truncated: 'Bazı sonuçlar kısaltıldı',
	},
	reasoning: {
		thinking: 'Düşünüyor...',
		thoughtFor: (seconds: number) => `${seconds} saniye düşündü`,
		thoughtForAFewSeconds: 'Birkaç saniye düşündü',
	},
	sources: {
		openSource: 'Kaynağı aç',
		showingWebResults: (count: number) => `${count} web sonucu gösteriliyor`,
		title: 'Kaynaklar',
		used: (count: number, results?: number) =>
			results === undefined ? `${count} kaynak kullanıldı` : `${count} kaynak · ${results} sonuç`,
		webSearchResults: 'Web arama sonuçları',
	},
	tool: {
		awaitingApproval: 'Onay bekliyor',
		completed: 'Tamamlandı',
		error: 'Hata',
		parameters: 'Parametreler',
		queued: 'Sırada',
		result: 'Sonuç',
		running: 'Çalışıyor',
	},
	transport: {
		connectionLost: 'Bağlantı koptu — Tekrar dene',
		rateLimit: 'Kullanım sınırına ulaşıldı — Tekrar dene',
		retry: 'Tekrar dene',
		serverError: 'Sunucu hatası — Tekrar dene',
		timeout: 'İstek zaman aşımına uğradı — Tekrar dene',
		unknown: 'Bağlantı sorunu oluştu — Tekrar dene',
		wsDisconnected: 'Canlı bağlantı koptu — Tekrar dene',
	},
} as const;
