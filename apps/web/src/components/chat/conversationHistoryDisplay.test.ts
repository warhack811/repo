import { describe, expect, it } from 'vitest';

import type { ConversationSummary } from '../../hooks/useConversations.js';
import {
	daysBetweenCalendarDates,
	formatConversationUpdatedAt,
	getConversationEmptyStateCopy,
	getConversationHistoryErrorMessage,
	groupConversationsByRecency,
	matchesConversationSearch,
} from './conversationHistoryDisplay.js';

function createConversation(input: {
	readonly id: string;
	readonly preview: string;
	readonly title: string;
	readonly updatedAt: string;
}): ConversationSummary {
	return {
		access_role: 'owner',
		conversation_id: input.id,
		created_at: input.updatedAt,
		last_message_at: input.updatedAt,
		last_message_preview: input.preview,
		title: input.title,
		updated_at: input.updatedAt,
	};
}

describe('conversationHistoryDisplay', () => {
	it('groups conversations by today, yesterday, previous seven days, and older', () => {
		const now = new Date('2026-05-16T10:00:00.000Z');
		const groups = groupConversationsByRecency(
			[
				createConversation({
					id: 'today',
					preview: 'Bugün notu',
					title: 'Bugün',
					updatedAt: '2026-05-16T08:00:00.000Z',
				}),
				createConversation({
					id: 'yesterday',
					preview: 'Dün notu',
					title: 'Dün',
					updatedAt: '2026-05-15T08:00:00.000Z',
				}),
				createConversation({
					id: 'three-days',
					preview: 'Üç gün önce',
					title: 'Son 7 gün',
					updatedAt: '2026-05-13T08:00:00.000Z',
				}),
				createConversation({
					id: 'twelve-days',
					preview: 'On iki gün önce',
					title: 'Daha eski',
					updatedAt: '2026-05-04T08:00:00.000Z',
				}),
			],
			now,
		);

		expect(groups.map((group) => group.label)).toEqual(['Bugün', 'Dün', 'Son 7 gün', 'Daha eski']);
		expect(groups[0]?.items.map((conversation) => conversation.conversation_id)).toEqual(['today']);
		expect(groups[1]?.items.map((conversation) => conversation.conversation_id)).toEqual([
			'yesterday',
		]);
		expect(groups[2]?.items.map((conversation) => conversation.conversation_id)).toEqual([
			'three-days',
		]);
		expect(groups[3]?.items.map((conversation) => conversation.conversation_id)).toEqual([
			'twelve-days',
		]);
	});

	it('does not return empty groups', () => {
		const now = new Date('2026-05-16T10:00:00.000Z');
		const groups = groupConversationsByRecency(
			[
				createConversation({
					id: 'today',
					preview: 'Bugün',
					title: 'Bugün',
					updatedAt: '2026-05-16T09:00:00.000Z',
				}),
			],
			now,
		);

		expect(groups).toHaveLength(1);
		expect(groups[0]?.label).toBe('Bugün');
	});

	it('maps invalid dates to older group', () => {
		const now = new Date('2026-05-16T10:00:00.000Z');
		const groups = groupConversationsByRecency(
			[
				createConversation({
					id: 'invalid',
					preview: 'Geçersiz tarih',
					title: 'Tarih yok',
					updatedAt: 'not-a-date',
				}),
			],
			now,
		);

		expect(groups).toHaveLength(1);
		expect(groups[0]?.label).toBe('Daha eski');
	});

	it('finds matches in title and preview with case-insensitive, whitespace-tolerant search', () => {
		const conversation = createConversation({
			id: 'match',
			preview: 'Yeni   sürüm   yayında',
			title: 'Proje Notları',
			updatedAt: '2026-05-16T10:00:00.000Z',
		});

		expect(matchesConversationSearch(conversation, 'proje')).toBe(true);
		expect(matchesConversationSearch(conversation, '  sürüm   yayında  ')).toBe(true);
		expect(matchesConversationSearch(conversation, 'PROJE')).toBe(true);
		expect(matchesConversationSearch(conversation, '')).toBe(true);
		expect(matchesConversationSearch(conversation, 'bulunamadı')).toBe(false);
	});

	it('formats updatedAt when date is valid and returns raw value when invalid', () => {
		const formatted = formatConversationUpdatedAt('2026-05-16T10:30:00.000Z', 'en-US');
		expect(formatted.length).toBeGreaterThan(0);
		expect(formatConversationUpdatedAt('invalid-date')).toBe('invalid-date');
	});

	it('returns null for nullish errors and keeps safe user-facing errors trimmed', () => {
		expect(getConversationHistoryErrorMessage(null)).toBeNull();
		expect(getConversationHistoryErrorMessage(undefined)).toBeNull();
		expect(getConversationHistoryErrorMessage('  Ağ bağlantısını kontrol et.  ')).toBe(
			'Ağ bağlantısını kontrol et.',
		);
	});

	it('sanitizes internal or raw history errors to fallback copy', () => {
		const fallback = 'Sohbet geçmişi şu anda yüklenemedi. Biraz sonra yeniden deneyebilirsin.';

		expect(getConversationHistoryErrorMessage('Internal Server Error')).toBe(fallback);
		expect(getConversationHistoryErrorMessage('{"error":"boom"}')).toBe(fallback);
		expect(getConversationHistoryErrorMessage('Conversation request failed with status 500.')).toBe(
			fallback,
		);
		expect(getConversationHistoryErrorMessage('Desteklenmeyen conversation list yaniti.')).toBe(
			fallback,
		);
		expect(getConversationHistoryErrorMessage('undefined')).toBe(fallback);
		expect(getConversationHistoryErrorMessage('null')).toBe(fallback);
	});

	it('returns expected empty-state copy for no conversations and search no-result', () => {
		expect(
			getConversationEmptyStateCopy({
				hasConversations: false,
				isSearchActive: false,
				surface: 'sidebar',
			}),
		).toEqual({
			description: 'İlk mesajından sonra sohbetlerin burada\u00A0görünür.',
			title: 'Henüz sohbet yok.',
		});

		expect(
			getConversationEmptyStateCopy({
				hasConversations: true,
				isSearchActive: true,
				surface: 'history-page',
			}),
		).toEqual({
			description: 'Farklı bir başlık veya önizleme deneyebilirsin.',
			title: 'Bu aramayla eşleşen sohbet yok.',
		});
	});

	it('does not leak forbidden raw/internal strings in fallback copy and contains no mojibake', () => {
		const output = [
			getConversationHistoryErrorMessage('{"detail":"stack trace"}'),
			getConversationEmptyStateCopy({
				hasConversations: false,
				isSearchActive: false,
				surface: 'sidebar',
			}).title,
			getConversationEmptyStateCopy({
				hasConversations: true,
				isSearchActive: true,
				surface: 'history-page',
			}).description,
		]
			.filter((value): value is string => typeof value === 'string')
			.join(' ');

		const forbidden = [
			'conversation_id',
			'Internal Server Error',
			'{"error"',
			'trace',
			'stack',
			'backend',
			'protocol',
			'metadata',
		];
		const mojibake = ['Ã', 'Ä', 'Å', 'â€¢', '�'];

		for (const token of forbidden) {
			expect(output).not.toContain(token);
		}

		for (const token of mojibake) {
			expect(output).not.toContain(token);
		}
	});

	it('calculates calendar-day differences deterministically', () => {
		const now = new Date(2026, 4, 16, 20, 0, 0, 0);
		const todayLocal = new Date(2026, 4, 16, 1, 0, 0, 0);
		const yesterdayLocal = new Date(2026, 4, 15, 12, 0, 0, 0);
		expect(daysBetweenCalendarDates(now, todayLocal.toISOString())).toBe(0);
		expect(daysBetweenCalendarDates(now, yesterdayLocal.toISOString())).toBe(1);
		expect(daysBetweenCalendarDates(now, 'not-a-date')).toBe(Number.POSITIVE_INFINITY);
	});
});
