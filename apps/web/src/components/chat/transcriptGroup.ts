import type { ConversationMessage } from '../../hooks/useConversations.js';

export type MessageGroup = Readonly<{
	key: string;
	dayDivider: string | null;
	messages: readonly ConversationMessage[];
}>;

function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDayDividerLabel(messageDate: Date, now: Date): string {
	const today = startOfDay(now);
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);
	const messageDay = startOfDay(messageDate).getTime();

	if (messageDay === today.getTime()) {
		return 'Bugün';
	}

	if (messageDay === yesterday.getTime()) {
		return 'Dün';
	}

	return messageDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

export function groupMessagesByDay(
	messages: readonly ConversationMessage[],
	now: Date = new Date(),
): readonly MessageGroup[] {
	if (messages.length === 0) {
		return [];
	}

	const groups: MessageGroup[] = [];
	let currentBucket: ConversationMessage[] = [];
	let currentDay: number | null = null;
	let currentDivider: string | null = null;

	for (const message of messages) {
		const messageDate = new Date(message.created_at);
		const messageDay = startOfDay(messageDate).getTime();

		if (messageDay !== currentDay) {
			if (currentBucket.length > 0 && currentDay !== null) {
				groups.push({
					key: String(currentDay),
					dayDivider: currentDivider,
					messages: currentBucket,
				});
			}

			currentDay = messageDay;
			currentDivider = getDayDividerLabel(messageDate, now);
			currentBucket = [];
		}

		currentBucket.push(message);
	}

	if (currentBucket.length > 0 && currentDay !== null) {
		groups.push({
			key: String(currentDay),
			dayDivider: currentDivider,
			messages: currentBucket,
		});
	}

	return groups.map((group, index) => (index === 0 ? { ...group, dayDivider: null } : group));
}
