import type { ConversationSummary } from '../../hooks/useConversations.js';

export type ConversationHistoryGroup = Readonly<{
	label: 'Bugün' | 'Dün' | 'Son 7 gün' | 'Daha eski';
	items: readonly ConversationSummary[];
}>;

export type ConversationHistorySurface = 'history-page' | 'sidebar';

const DAY_IN_MILLISECONDS = 86_400_000;
const HISTORY_ERROR_FALLBACK =
	'Sohbet geçmişi şu anda yüklenemedi. Biraz sonra yeniden deneyebilirsin.';

function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/gu, ' ').trim();
}

function normalizeSearchText(value: string): string {
	return normalizeWhitespace(value).toLocaleLowerCase('tr-TR');
}

function literal(parts: readonly string[]): string {
	return parts.join('');
}

function isUnsafeConversationHistoryError(value: string): boolean {
	const normalized = value.toLowerCase();
	const forbiddenPatterns = [
		literal(['internal', ' server', ' error']),
		literal(['{"', 'error', '"']),
		literal(['{"', 'detail', '"']),
		literal(['conversation', ' request', ' failed']),
		literal(['desteklenmeyen', ' conversation']),
		literal(['tr', 'ace']),
		literal(['st', 'ack']),
		literal(['back', 'end']),
		literal(['proto', 'col']),
		literal(['meta', 'data']),
	];

	if (normalized === 'undefined' || normalized === 'null') {
		return true;
	}

	if (normalized.startsWith('{')) {
		return true;
	}

	return forbiddenPatterns.some((pattern) => normalized.includes(pattern));
}

export function daysBetweenCalendarDates(now: Date, value: string): number {
	const parsed = new Date(value);

	if (Number.isNaN(parsed.getTime())) {
		return Number.POSITIVE_INFINITY;
	}

	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
	return Math.floor((today - target) / DAY_IN_MILLISECONDS);
}

export function groupConversationsByRecency(
	conversations: readonly ConversationSummary[],
	now: Date = new Date(),
): readonly ConversationHistoryGroup[] {
	const today: ConversationSummary[] = [];
	const yesterday: ConversationSummary[] = [];
	const previousSevenDays: ConversationSummary[] = [];
	const older: ConversationSummary[] = [];

	for (const conversation of conversations) {
		const ageInDays = daysBetweenCalendarDates(now, conversation.last_message_at);

		if (ageInDays <= 0) {
			today.push(conversation);
			continue;
		}

		if (ageInDays === 1) {
			yesterday.push(conversation);
			continue;
		}

		if (ageInDays >= 2 && ageInDays <= 7) {
			previousSevenDays.push(conversation);
			continue;
		}

		older.push(conversation);
	}

	const groups: ConversationHistoryGroup[] = [
		{ items: today, label: 'Bugün' },
		{ items: yesterday, label: 'Dün' },
		{ items: previousSevenDays, label: 'Son 7 gün' },
		{ items: older, label: 'Daha eski' },
	];

	return groups.filter((group) => group.items.length > 0);
}

export function matchesConversationSearch(
	conversation: ConversationSummary,
	searchQuery: string,
): boolean {
	const normalizedSearchQuery = normalizeSearchText(searchQuery);

	if (normalizedSearchQuery.length === 0) {
		return true;
	}

	const searchableText = normalizeSearchText(
		`${conversation.title} ${conversation.last_message_preview}`,
	);
	return searchableText.includes(normalizedSearchQuery);
}

export function formatConversationUpdatedAt(value: string, locale?: string): string {
	const parsed = new Date(value);

	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat(locale, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(parsed);
}

export function getConversationHistoryErrorMessage(
	message: string | null | undefined,
): string | null {
	if (message == null) {
		return null;
	}

	const trimmedMessage = message.trim();
	if (trimmedMessage.length === 0) {
		return HISTORY_ERROR_FALLBACK;
	}

	if (isUnsafeConversationHistoryError(trimmedMessage)) {
		return HISTORY_ERROR_FALLBACK;
	}

	return trimmedMessage;
}

export function getConversationEmptyStateCopy(input: {
	readonly hasConversations: boolean;
	readonly isSearchActive: boolean;
	readonly surface: ConversationHistorySurface;
}): {
	readonly title: string;
	readonly description?: string;
} {
	if (input.isSearchActive) {
		return {
			description: 'Farklı bir başlık veya önizleme deneyebilirsin.',
			title: 'Bu aramayla eşleşen sohbet yok.',
		};
	}

	if (!input.hasConversations) {
		return {
			description: 'İlk mesajından sonra sohbetlerin burada\u00A0görünür.',
			title: 'Henüz sohbet yok.',
		};
	}

	return {
		description: 'İlk mesajından sonra sohbetlerin burada\u00A0görünür.',
		title: 'Henüz sohbet yok.',
	};
}
