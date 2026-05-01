import { describe, expect, it } from 'vitest';

import { classifySearchIntent } from './intent.js';

describe('classifySearchIntent', () => {
	it.each([
		['bugün hava nasıl', 'news'],
		['son dakika ekonomi', 'news'],
		['az önce ne oldu', 'news'],
		['şimdi seçim sonucu', 'news'],
		['güncel dolar kuru', 'news'],
		['dakikalar önce deprem', 'news'],
		['son haber teknoloji', 'news'],
		['kaç saat önce açıklandı', 'news'],
		['today weather', 'news'],
		['breaking ai regulation', 'news'],
		['latest openai model', 'news'],
		['current inflation rate', 'news'],
		['just now market close', 'news'],
		['Python nedir', 'research'],
		['Ada Lovelace kim', 'research'],
		['kuantum bilgisayar açıkla', 'research'],
		['Osmanlı tarihçe', 'research'],
		['HTTP nasıl çalışır', 'research'],
		['token ne demek', 'research'],
		['what is TypeScript', 'research'],
		['who is Alan Turing', 'research'],
		['explain TLS', 'research'],
		['history of internet', 'research'],
		['how does DNS work', 'research'],
		['meaning of entropy', 'research'],
		['Runa mimari notları', 'general'],
		['best laptop specs', 'general'],
		['Serper API examples', 'general'],
		['React vite setup', 'general'],
		['PostgreSQL index tuning', 'general'],
		['istanbul kahve önerisi', 'general'],
	] as const)('classifies "%s" as %s', (query, expectedIntent) => {
		expect(classifySearchIntent(query)).toBe(expectedIntent);
	});
});
