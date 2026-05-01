export const uiText = {
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
		title: 'Kaynaklar',
		used: (count: number, results?: number) =>
			results === undefined ? `${count} kaynak kullanıldı` : `${count} kaynak · ${results} sonuç`,
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
